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

const roleMap = {
    super_admin: 'church_administrator'
};

const allowedRoles = new Set([
    'church_administrator',
    'pastor',
    'church_clerk',
    'treasurer',
    'recording_secretary',
    'music_minister',
    'sunday_school_admin',
    'goodnews_teacher',
    'activity_coordinator',
    'member'
]);

const csvPath = 'v1_exports/user_roles_rows.csv';
const logDir = 'scripts/logs';
const logPath = path.join(logDir, 'user_roles_migration.json');

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
    const stats = { upserted: 0, missing_member: 0, remapped_role: 0, invalid_role: 0 };

    console.log(`Starting migration of ${rows.length} user roles...`);

    for (const row of rows) {
        const oldMemberId = row.member_id;
        const legacyRole = row.role;
        const mappedRole = roleMap[legacyRole] || legacyRole;

        if (!allowedRoles.has(mappedRole)) {
            stats.invalid_role++;
            logs.push({ status: 'conflict', reason: 'invalid_role', data: row, mapped_role: mappedRole });
            await supabase.from('import_conflicts').insert([{
                import_type: 'user_roles',
                raw_data: row,
                conflict_reason: `invalid_role:${mappedRole}`
            }]);
            continue;
        }

        if (mappedRole !== legacyRole) stats.remapped_role++;

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
                import_type: 'user_roles',
                raw_data: row,
                conflict_reason: 'missing_member_uuid'
            }]);
            continue;
        }

        const payload = {
            member_id: member.id,
            role: mappedRole,
            assigned_at: row.assigned_at || undefined
        };

        const { error: upsertError } = await supabase
            .from('user_roles')
            .upsert([payload], { onConflict: 'member_id,role' });

        if (upsertError) {
            logs.push({ status: 'error', reason: 'upsert_failed', data: row, error: upsertError });
        } else {
            stats.upserted++;
            logs.push({ status: 'upserted', member_id: member.id, role: mappedRole });
        }
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log('\nUser Roles Migration Summary:');
    console.log(`- Upserted: ${stats.upserted}`);
    console.log(`- Missing Member (Conflicts): ${stats.missing_member}`);
    console.log(`- Remapped Roles: ${stats.remapped_role}`);
    console.log(`- Invalid Roles (Conflicts): ${stats.invalid_role}`);
    console.log(`Full log written to ${logPath}`);
}

migrate();
