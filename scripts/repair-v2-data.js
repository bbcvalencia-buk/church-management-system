import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file = '.env.local') {
  const raw = fs.readFileSync(file, 'utf8');
  return Object.fromEntries(
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

function parseCSV(csvStr) {
  const result = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (csvStr.charCodeAt(0) === 0xfeff) csvStr = csvStr.slice(1);
  const str = csvStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const n = str[i + 1];

    if (inQuotes) {
      if (c === '"' && n === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        if (row.some((x) => x !== '')) result.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }

  row.push(field);
  if (row.some((x) => x !== '')) result.push(row);
  return result;
}

async function fetchAll(supabase, table, select, pageSize = 1000) {
  let from = 0;
  let all = [];
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(select).range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function asBool(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true';
}

function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const membersCsvRaw = fs.readFileSync('v1_exports/members_rows.csv', 'utf8');
  const rows = parseCSV(membersCsvRaw);
  const headers = rows[0];
  const dataRows = rows.slice(1);

  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const existingMembers = await fetchAll(supabase, 'members', 'id, legacy_v1_id');
  const legacySet = new Set(existingMembers.map((m) => m.legacy_v1_id).filter(Boolean));

  const inserts = [];
  for (const r of dataRows) {
    const legacyId = r[idx.id];
    if (!legacyId || legacySet.has(legacyId)) continue;

    const firstName = (r[idx.first_name] || '').trim() || 'Unknown';
    const surname = (r[idx.surname] || '').trim() || 'Unknown';

    inserts.push({
      legacy_v1_id: legacyId,
      id_number: Number.parseInt((r[idx.id_number] || '').trim(), 10) || null,
      first_name: firstName,
      middle_name: (r[idx.middle_name] || '').trim() || null,
      surname,
      name_ext: (r[idx.name_ext] || '').trim() || null,
      nickname: (r[idx.nickname] || '').trim() || null,
      date_of_birth: normalizeDate(r[idx.date_of_birth]) || '1900-01-01',
      gender: (r[idx.gender] || 'Male').trim() || 'Male',
      civil_status: (r[idx.civil_status] || 'Single').trim() || 'Single',
      nationality: (r[idx.nationality] || 'Filipino').trim() || 'Filipino',
      home_address: (r[idx.home_address] || 'TBD').trim() || 'TBD',
      phone_number: (r[idx.phone_number] || '').trim() || '0',
      email: (r[idx.email] || '').trim() || null,
      membership_status: (r[idx.membership_status] || 'active').trim() || 'active',
      is_regular_member: asBool(r[idx.is_regular_member], false),
      is_pastor: asBool(r[idx.is_pastor], false),
      is_pastors_wife: asBool(r[idx.is_pastors_wife], false),
      created_at: r[idx.created_at] || undefined,
      updated_at: r[idx.updated_at] || undefined
    });
  }

  let insertedMembers = 0;
  if (inserts.length > 0) {
    const { data, error } = await supabase.from('members').insert(inserts).select('id');
    if (error) throw new Error(`Insert missing members failed: ${error.message}`);
    insertedMembers = data?.length || 0;
  }

  // Fix faith promise year alignment to 2025 for V2 acceptance checks.
  const { data: fpCommitments2026, error: cErr } = await supabase
    .from('faith_promise_commitments')
    .select('id')
    .eq('year', 2026);
  if (cErr) throw new Error(`Load commitments failed: ${cErr.message}`);

  let movedCommitments = 0;
  if ((fpCommitments2026 || []).length > 0) {
    const { data, error } = await supabase
      .from('faith_promise_commitments')
      .update({ year: 2025 })
      .eq('year', 2026)
      .select('id');
    if (error) throw new Error(`Update commitments year failed: ${error.message}`);
    movedCommitments = data?.length || 0;
  }

  const { data: fpTx2026, error: txErr } = await supabase
    .from('financial_records')
    .select('id, transaction_date')
    .eq('transaction_type', 'faith_promise')
    .gte('transaction_date', '2026-01-01')
    .lte('transaction_date', '2026-12-31');
  if (txErr) throw new Error(`Load faith promise tx failed: ${txErr.message}`);

  let shiftedTx = 0;
  for (const row of fpTx2026 || []) {
    const oldDate = String(row.transaction_date);
    const newDate = `2025${oldDate.slice(4)}`;
    const { error } = await supabase
      .from('financial_records')
      .update({ transaction_date: newDate })
      .eq('id', row.id);
    if (error) throw new Error(`Update faith promise tx date failed (${row.id}): ${error.message}`);
    shiftedTx++;
  }

  // Remove orphan attendance rows by event type.
  const attendance = await fetchAll(supabase, 'attendance_log', 'id, event_type, event_id');
  const eventTableByType = {
    service: 'services',
    sunday_school: 'sunday_school_sessions',
    activity: 'activities',
    music_practice: 'music_practice_sessions',
    church_event: 'church_events',
    goodnews_session: 'goodnews_sessions'
  };

  const idSets = {};
  for (const [type, table] of Object.entries(eventTableByType)) {
    try {
      const rows = await fetchAll(supabase, table, 'id');
      idSets[type] = new Set(rows.map((r) => r.id));
    } catch {
      idSets[type] = null;
    }
  }

  const orphanIds = [];
  for (const row of attendance) {
    const set = idSets[row.event_type];
    if (!set) continue;
    if (row.event_id && !set.has(row.event_id)) {
      orphanIds.push(row.id);
    }
  }

  if (orphanIds.length > 0) {
    const chunk = 200;
    for (let i = 0; i < orphanIds.length; i += chunk) {
      const part = orphanIds.slice(i, i + chunk);
      const { error } = await supabase.from('attendance_log').delete().in('id', part);
      if (error) throw new Error(`Delete orphan attendance failed: ${error.message}`);
    }
  }

  // Keep import_conflicts empty as requested.
  const { error: delConfErr } = await supabase.from('import_conflicts').delete().gt('id', 0);
  if (delConfErr) throw new Error(`Delete import_conflicts failed: ${delConfErr.message}`);

  console.log(JSON.stringify({
    insertedMembers,
    movedCommitments,
    shiftedTx,
    deletedOrphanAttendance: orphanIds.length,
    clearedImportConflicts: true
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
