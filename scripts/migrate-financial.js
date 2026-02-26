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

function nullIfEmpty(value) {
    return value === '' ? null : value;
}

const csvPath = 'v1_exports/financial_records_rows.csv';
const logPath = 'scripts/logs/financial_migration.json';

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
    const stats = { inserted: 0, skipped_existing: 0, missing_member: 0 };

    console.log(`Starting migration of ${rows.length} financial records...`);

    for (const row of rows) {
        const oldMemberId = row.member_id;
        const legacy_v1_id = row.id;

        const { data: member, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('legacy_v1_id', oldMemberId)
            .single();

        if (memberError || !member) {
            stats.missing_member++;
            await supabase.from('import_conflicts').insert([{
                import_type: 'financial',
                raw_data: row,
                conflict_reason: 'missing_member_uuid'
            }]);
            logs.push({ status: 'conflict', reason: 'missing_member_uuid', data: row });
            continue;
        }

        const { id: _legacyId, ...rowWithoutId } = row;
        const { data: existingByLegacy } = await supabase
            .from('financial_records')
            .select('id')
            .eq('legacy_v1_id', legacy_v1_id)
            .limit(1);

        if (existingByLegacy && existingByLegacy.length > 0) {
            stats.skipped_existing++;
            logs.push({ status: 'skipped', reason: 'already_imported', legacy_id: legacy_v1_id });
            continue;
        }

        const { error: insertError } = await supabase
            .from('financial_records')
            .insert([{
                ...rowWithoutId,
                member_id: member.id,
                pledge_purpose: nullIfEmpty(rowWithoutId.pledge_purpose),
                faith_promise_year: nullIfEmpty(rowWithoutId.faith_promise_year),
                notes: nullIfEmpty(rowWithoutId.notes),
                description: nullIfEmpty(rowWithoutId.description),
                deleted_at: nullIfEmpty(rowWithoutId.deleted_at),
                recorded_by: nullIfEmpty(rowWithoutId.recorded_by),
                legacy_v1_id
            }]);

        if (insertError) {
            logs.push({ status: 'error', reason: 'insert_failed', data: row, error: insertError });
        } else {
            stats.inserted++;
            logs.push({ status: 'inserted', legacy_id: legacy_v1_id, member_id: member.id });
        }
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log('\nFinancial Migration Summary:');
    console.log(`- Inserted: ${stats.inserted}`);
    console.log(`- Skipped Existing: ${stats.skipped_existing}`);
    console.log(`- Missing Member (Conflicts): ${stats.missing_member}`);
}

migrate();
