import fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file = '.env.local') {
  const raw = fs.readFileSync(file, 'utf8');
  return Object.fromEntries(
    raw.split('\n')
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

function bool(v, fallback = false) {
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return fallback;
}

function nil(v) {
  return (v == null || String(v).trim() === '') ? null : v;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const csv = fs.readFileSync('v1_exports/members_rows.csv', 'utf8');
  const rows = parseCSV(csv);
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

  const { data: existing } = await supabase.from('members').select('legacy_v1_id');
  const legacySet = new Set((existing || []).map((r) => r.legacy_v1_id).filter(Boolean));

  const inserts = [];
  for (const r of dataRows) {
    const legacy = r[idx.id];
    if (!legacy || legacySet.has(legacy)) continue;

    const idNumber = Number.parseInt((r[idx.id_number] || '').trim(), 10);

    inserts.push({
      legacy_v1_id: legacy,
      id_number: Number.isFinite(idNumber) ? idNumber : null,
      first_name: r[idx.first_name] || 'Unknown',
      middle_name: nil(r[idx.middle_name]),
      surname: r[idx.surname] || 'Unknown',
      name_ext: nil(r[idx.name_ext]),
      nickname: nil(r[idx.nickname]),
      date_of_birth: r[idx.date_of_birth] || '1900-01-01',
      gender: r[idx.gender] || 'Male',
      civil_status: r[idx.civil_status] || 'Single',
      nationality: r[idx.nationality] || 'Filipino',
      place_of_birth: nil(r[idx.place_of_birth]),
      home_address: r[idx.home_address] || 'TBD',
      phone_number: r[idx.phone_number] || '0',
      alternative_phone: nil(r[idx.alternative_phone]),
      email: nil(r[idx.email]),
      emergency_contact_name: nil(r[idx.emergency_contact_name]),
      emergency_contact_phone: nil(r[idx.emergency_contact_phone]),
      emergency_contact_relationship: nil(r[idx.emergency_contact_relationship]),
      salvation_date: nil(r[idx.salvation_date]),
      baptism_date: nil(r[idx.baptism_date]),
      membership_date: nil(r[idx.membership_date]),
      previous_church: nil(r[idx.previous_church]),
      previous_religion: nil(r[idx.previous_religion]),
      membership_status: r[idx.membership_status] || 'active',
      is_regular_member: bool(r[idx.is_regular_member], true),
      is_pastor: bool(r[idx.is_pastor], false),
      is_pastors_wife: bool(r[idx.is_pastors_wife], false),
      profile_picture_url: nil(r[idx.profile_picture_url]),
      id_card_url: nil(r[idx.id_card_url]),
      attachment_url: nil(r[idx.attachment_url]),
      created_at: nil(r[idx.created_at]),
      updated_at: nil(r[idx.updated_at]),
      deleted_at: nil(r[idx.deleted_at])
    });
  }

  let inserted = 0;
  if (inserts.length) {
    const { data, error } = await supabase.from('members').insert(inserts).select('id');
    if (error) throw new Error(`Backfill members failed: ${error.message}`);
    inserted = data?.length || 0;
  }

  const rerun = [
    'node scripts/migrate-financial.js',
    'node scripts/migrate-faith-promise.js',
    'node scripts/migrate-attendance.js',
    'node scripts/migrate-church-positions.js',
    'node scripts/migrate-user-roles.js',
    'node scripts/reconcile-import-conflicts.js',
    'node scripts/verify-system-v2.js'
  ];

  for (const cmd of rerun) {
    execSync(cmd, { stdio: 'inherit' });
  }

  console.log(`Inserted missing members: ${inserted}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
