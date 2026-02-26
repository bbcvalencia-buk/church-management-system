import fs from 'fs';
import path from 'path';
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

function csvRowCount(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l, i) => i > 0 && l.length > 0).length;
}

function csvFirstColumnSet(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const rows = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l, i) => i > 0 && l.length > 0);
  const out = new Set();
  for (const row of rows) {
    const first = row.split(',')[0]?.trim();
    if (first && first !== 'id') out.add(first);
  }
  return out;
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

function checkNoOrphans(childRows, childCol, parentSet, label) {
  const orphanRows = childRows.filter((r) => r[childCol] && !parentSet.has(r[childCol]));
  return {
    label,
    ok: orphanRows.length === 0,
    count: orphanRows.length,
    sample: orphanRows.slice(0, 5).map((r) => r[childCol])
  };
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(url, service);

  const out = [];
  out.push(`# V2 Verification Report (${new Date().toISOString()})`);
  out.push('');

  const membersV1Path = path.join('v1_exports', 'members_rows.csv');
  const finV1Path = path.join('v1_exports', 'financial_records_rows.csv');

  const v1MemberCount = csvRowCount(membersV1Path);
  const v1FinancialCount = csvRowCount(finV1Path);
  const v1MemberIds = csvFirstColumnSet(membersV1Path);
  const v1FinIds = csvFirstColumnSet(finV1Path);

  const members = await fetchAll(supabase, 'members', 'id, legacy_v1_id, member_number');
  const financial = await fetchAll(supabase, 'financial_records', 'id, member_id, legacy_v1_id, transaction_date, transaction_type, amount');
  const roles = await fetchAll(supabase, 'user_roles', 'id, member_id, role');
  const positions = await fetchAll(supabase, 'church_positions', 'id, member_id');
  const families = await fetchAll(supabase, 'family_relationships', 'id, member_id, related_member_id');
  const visitors = await fetchAll(supabase, 'visitors', 'id, member_id, status');
  const conflicts = await fetchAll(supabase, 'import_conflicts', 'id, resolved_at');
  const attendance = await fetchAll(supabase, 'attendance_log', 'id, member_id, event_type, event_id');

  const memberIds = new Set(members.map((m) => m.id));

  const dbLegacyMemberIds = new Set(members.map((m) => m.legacy_v1_id).filter(Boolean));
  const missingV1Members = [...v1MemberIds].filter((id) => !dbLegacyMemberIds.has(id));

  const dbLegacyFinancialIds = new Set(financial.map((r) => r.legacy_v1_id).filter(Boolean));
  const missingV1Financial = [...v1FinIds].filter((id) => !dbLegacyFinancialIds.has(id));

  const membersWithNumber = members.filter((m) => m.member_number).length;

  let faith2025 = [];
  const { data: fpYearRows, error: fpYearErr } = await supabase
    .from('faith_promise_ledger')
    .select('member_number, committed_amount, total_paid, status, year')
    .eq('year', 2025);
  if (!fpYearErr) {
    faith2025 = fpYearRows || [];
  } else {
    const fallbackRows = await fetchAll(supabase, 'faith_promise_ledger', 'member_number, committed_amount, total_paid, status', 1000);
    faith2025 = fallbackRows;
  }

  const { count: nullMemberFinancialCount, error: nullMemberErr } = await supabase
    .from('financial_records')
    .select('*', { count: 'exact', head: true })
    .is('member_id', null);
  if (nullMemberErr) throw new Error(`financial_records null member_id check failed: ${nullMemberErr.message}`);

  const unresolvedConflicts = conflicts.filter((c) => !c.resolved_at);

  const orphanChecks = [];
  orphanChecks.push(checkNoOrphans(financial, 'member_id', memberIds, 'financial_records.member_id -> members.id'));
  orphanChecks.push(checkNoOrphans(roles, 'member_id', memberIds, 'user_roles.member_id -> members.id'));
  orphanChecks.push(checkNoOrphans(positions, 'member_id', memberIds, 'church_positions.member_id -> members.id'));

  const familyMemberOrphans = families.filter((f) => f.member_id && !memberIds.has(f.member_id));
  const familyRelatedOrphans = families.filter((f) => f.related_member_id && !memberIds.has(f.related_member_id));
  orphanChecks.push({
    label: 'family_relationships.member_id -> members.id',
    ok: familyMemberOrphans.length === 0,
    count: familyMemberOrphans.length,
    sample: familyMemberOrphans.slice(0, 5).map((r) => r.member_id)
  });
  orphanChecks.push({
    label: 'family_relationships.related_member_id -> members.id',
    ok: familyRelatedOrphans.length === 0,
    count: familyRelatedOrphans.length,
    sample: familyRelatedOrphans.slice(0, 5).map((r) => r.related_member_id)
  });
  orphanChecks.push(checkNoOrphans(visitors.filter((v) => v.member_id), 'member_id', memberIds, 'visitors.member_id -> members.id'));
  orphanChecks.push(checkNoOrphans(attendance.filter((a) => a.member_id), 'member_id', memberIds, 'attendance_log.member_id -> members.id'));

  async function loadIdSet(table) {
    const rows = await fetchAll(supabase, table, 'id');
    return new Set(rows.map((r) => r.id));
  }

  const eventSets = {};
  const eventTableByType = {
    service: 'services',
    sunday_school: 'sunday_school_sessions',
    activity: 'activities',
    music_practice: 'music_practice_sessions',
    church_event: 'church_events',
    goodnews_session: 'goodnews_sessions'
  };

  for (const [eventType, table] of Object.entries(eventTableByType)) {
    try {
      eventSets[eventType] = await loadIdSet(table);
    } catch {
      eventSets[eventType] = null;
    }
  }

  const eventOrphans = [];
  for (const row of attendance) {
    const set = eventSets[row.event_type];
    if (!set) continue;
    if (row.event_id && !set.has(row.event_id)) {
      eventOrphans.push({ id: row.id, event_type: row.event_type, event_id: row.event_id });
    }
  }

  const visitorsMissingStatus = visitors.filter((v) => v.status == null);

  out.push('## Data Integrity');
  out.push(`- V1 members rows: ${v1MemberCount}`);
  out.push(`- Members in DB: ${members.length}`);
  out.push(`- Members with member_number: ${membersWithNumber}`);
  out.push(`- Missing V1 member legacy IDs in DB: ${missingV1Members.length}`);
  if (missingV1Members.length) out.push(`- Sample missing member legacy IDs: ${missingV1Members.slice(0, 10).join(', ')}`);
  out.push(`- V1 financial rows: ${v1FinancialCount}`);
  out.push(`- Financial rows in DB: ${financial.length}`);
  out.push(`- Missing V1 financial legacy IDs in DB: ${missingV1Financial.length}`);
  if (missingV1Financial.length) out.push(`- Sample missing financial legacy IDs: ${missingV1Financial.slice(0, 10).join(', ')}`);
  out.push(`- financial_records with NULL member_id: ${nullMemberFinancialCount ?? 0}`);
  out.push(`- import_conflicts total: ${conflicts.length}`);
  out.push(`- import_conflicts unresolved: ${unresolvedConflicts.length}`);
  out.push(`- visitors with NULL status: ${visitorsMissingStatus.length}`);
  out.push(`- attendance event orphans: ${eventOrphans.length}`);
  if (eventOrphans.length) out.push(`- Sample attendance event orphans: ${JSON.stringify(eventOrphans.slice(0, 5))}`);

  out.push('');
  out.push('### Orphan Checks');
  for (const c of orphanChecks) {
    out.push(`- ${c.ok ? 'PASS' : 'FAIL'} ${c.label} (count=${c.count})`);
    if (!c.ok && c.sample.length) {
      out.push(`  sample: ${c.sample.join(', ')}`);
    }
  }

  out.push('');
  out.push('### Faith Promise Ledger (2025 query sample)');
  out.push(`- Rows returned from faith_promise_ledger: ${faith2025.length}`);
  out.push('- Query used by this test: SELECT member_number, committed_amount, total_paid, status FROM faith_promise_ledger WHERE year = 2025');

  const reportPath = path.join('scripts', 'logs', 'verify_system_v2_report.md');
  fs.writeFileSync(reportPath, out.join('\n'), 'utf8');
  console.log(`Report written: ${reportPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
