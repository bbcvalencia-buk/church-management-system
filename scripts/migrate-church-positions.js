import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim()];
}));

const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, supabaseKey);

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current);
    return result;
}

function normalizeCSVValue(value) {
    return (value ?? '').replace(/\r/g, '').replace(/^\uFEFF/, '');
}

function nullIfEmpty(value) {
    return value === '' ? null : value;
}

function parseBool(value, fallback = false) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return fallback;
}

const csvPath = 'v1_exports/church_positions_rows.csv';
const logDir = 'scripts/logs';
const logPath = path.join(logDir, 'church_positions_migration.json');

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

async function migrate() {
    if (!fs.existsSync(csvPath)) return console.error(`File ${csvPath} not found.`);

    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => normalizeCSVValue(h));
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line).map(v => normalizeCSVValue(v));
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });

    const logs = [];
    const stats = { upserted: 0, missing_member: 0 };

    console.log(`Starting migration of ${rows.length} church positions...`);

    for (const row of rows) {
        const oldMemberId = row.member_id;
        const legacyId = row.id;

        const { data: memberMatches, error: memberError } = await supabase
            .from('members')
            .select('id')
            .or(`legacy_v1_id.eq.${oldMemberId},id.eq.${oldMemberId}`)
            .limit(1);

        const member = (memberMatches && memberMatches.length > 0) ? memberMatches[0] : null;
        if (memberError || !member) {
            stats.missing_member++;
            logs.push({ status: 'conflict', reason: 'missing_member_uuid', data: row });
            await supabase.from('import_conflicts').insert([{
                import_type: 'church_positions',
                raw_data: row,
                conflict_reason: 'missing_member_uuid'
            }]);
            continue;
        }

        const payload = {
            id: legacyId,
            member_id: member.id,
            position_name: row.position_name,
            position_category: row.position_category,
            department: nullIfEmpty(row.department),
            specific_role: nullIfEmpty(row.specific_role),
            start_date: row.start_date,
            end_date: nullIfEmpty(row.end_date),
            is_active: parseBool(row.is_active, true),
            assignment_reason: nullIfEmpty(row.assignment_reason),
            created_at: row.created_at,
            is_ministry_head: parseBool(row.is_ministry_head, false)
        };

        const { error: upsertError } = await supabase
            .from('church_positions')
            .upsert([payload], { onConflict: 'id' });

        if (upsertError) {
            logs.push({ status: 'error', reason: 'upsert_failed', data: row, error: upsertError });
        } else {
            stats.upserted++;
            logs.push({ status: 'upserted', legacy_id: legacyId, member_id: member.id });
        }
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log('\nChurch Positions Migration Summary:');
    console.log(`- Upserted: ${stats.upserted}`);
    console.log(`- Missing Member (Conflicts): ${stats.missing_member}`);
    console.log(`Full log written to ${logPath}`);
}

migrate();
