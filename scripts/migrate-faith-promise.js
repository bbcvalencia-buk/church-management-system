import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()];
}));

const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, supabaseKey);

function parseCSVLine(line) {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current); return result;
}

function normalizeCSVValue(value) {
    return (value ?? '').replace(/\r/g, '').replace(/^\uFEFF/, '');
}

const csvPath = 'v1_exports/faith_promise_commitments_rows.csv';
const logDir = 'scripts/logs';
const logPath = path.join(logDir, 'faith_promise_migration.json');

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

    console.log(`Starting migration of ${rows.length} faith promise commitments...`);

    for (const row of rows) {
        const oldMemberId = row.member_id;
        const legacy_v1_id = row.id;

        const { data: memberMatch, error: memberError } = await supabase
            .from('members')
            .select('id')
            .or(`legacy_v1_id.eq.${oldMemberId},id.eq.${oldMemberId}`)
            .limit(1);

        const member = (memberMatch && memberMatch.length > 0) ? memberMatch[0] : null;

        if (memberError || !member) {
            stats.missing_member++;
            await supabase.from('import_conflicts').insert([{
                import_type: 'faith_promise',
                raw_data: row,
                conflict_reason: 'missing_member_uuid'
            }]);
            logs.push({ status: 'conflict', reason: 'missing_member_uuid', data: row });
            continue;
        }

        const payload = {
            ...Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'id')),
            member_id: member.id,
            legacy_v1_id
        };

        const { error: insertError } = await supabase
            .from('faith_promise_commitments')
            .upsert([payload], { onConflict: 'member_id,year' });

        if (insertError) {
            logs.push({ status: 'error', reason: 'insert_failed', data: row, error: insertError });
        } else {
            stats.upserted++;
            logs.push({ status: 'upserted', legacy_id: legacy_v1_id, member_id: member.id });
        }
    }

    // NOTE: current schema tracks commitments (year/promised_amount) only;
    // no given_amount/start_date/end_date columns exist for reconciliation here.

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log('\nFaith Promise Migration Summary:');
    console.log(`- Upserted: ${stats.upserted}`);
    console.log(`- Missing Member (Conflicts): ${stats.missing_member}`);
    console.log('- Reconciliation skipped (not applicable to current schema).');
}

migrate();
