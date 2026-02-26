import fs from 'fs';
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

function normalizeSundaySchoolDepartment(value) {
    const allowed = new Set(['adult', 'beginners', 'nursery', 'kinder', 'primary', 'junior']);
    const normalized = (value || '').toLowerCase().trim();
    return allowed.has(normalized) ? normalized : 'adult';
}

async function seedMusicPracticeSessionsFromAttendance(rows) {
    const musicRows = rows.filter(r => r.event_type === 'music_practice');
    const grouped = new Map();

    for (const row of musicRows) {
        if (!grouped.has(row.event_id)) grouped.set(row.event_id, []);
        grouped.get(row.event_id).push(row);
    }

    const musicEventIds = Array.from(grouped.keys());
    if (!musicEventIds.length) return;

    const { data: existingRows } = await supabase
        .from('music_practice_sessions')
        .select('legacy_v1_id')
        .in('legacy_v1_id', musicEventIds);

    const existingIds = new Set((existingRows || []).map(r => r.legacy_v1_id));
    const missingIds = musicEventIds.filter(id => !existingIds.has(id));

    const typeCycle = ['choir', 'mini_ensemble'];
    for (let i = 0; i < missingIds.length; i++) {
        const legacyId = missingIds[i];
        const sampleRow = grouped.get(legacyId)[0];
        const practiceType = missingIds.length === 2 ? typeCycle[i] : typeCycle[i % typeCycle.length];
        const { error } = await supabase.from('music_practice_sessions').insert([{
            practice_type: practiceType,
            practice_date: sampleRow.event_date,
            legacy_v1_id: legacyId
        }]);

        if (error) {
            console.error(`Failed inserting synthetic music_practice_sessions ${legacyId}: ${error.message}`);
        }
    }
}

async function migrateTable(csvFile, v2Table) {
    if (!fs.existsSync(csvFile)) return [];
    const data = fs.readFileSync(csvFile, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => normalizeCSVValue(h));
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line).map(v => normalizeCSVValue(v));
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });

    console.log(`Migrating ${rows.length} rows to ${v2Table}...`);
    for (const row of rows) {
        const legacy_v1_id = row.id;
        const payload = {
            ...Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'id')),
            legacy_v1_id
        };
        let error = null;
        if (v2Table === 'services') {
            ({ error } = await supabase
                .from(v2Table)
                .upsert([payload], { onConflict: 'service_date,service_type', ignoreDuplicates: true }));
        } else if (v2Table === 'sunday_school_sessions') {
            payload.department = normalizeSundaySchoolDepartment(payload.department);
            const { data: existing } = await supabase
                .from(v2Table)
                .select('id')
                .eq('legacy_v1_id', legacy_v1_id)
                .limit(1);
            if (!existing || existing.length === 0) {
                ({ error } = await supabase.from(v2Table).insert([payload]));
            }
        } else {
            ({ error } = await supabase.from(v2Table).insert([payload]));
        }
        if (error) {
            console.error(`Failed inserting into ${v2Table} for legacy id ${legacy_v1_id}: ${error.message}`);
        }
    }
}

async function migrateAttendance() {
    const logPath = 'scripts/logs/attendance_migration.json';
    const logs = [];
    const stats = { inserted: 0, missing_member: 0, missing_event: 0 };

    // 1. Migrate Events first
    await migrateTable('v1_exports/services_rows.csv', 'services');
    await migrateTable('v1_exports/sunday_school_sessions_rows.csv', 'sunday_school_sessions');
    // Add music practice if csv exists (not found in list, but just in case)
    await migrateTable('v1_exports/music_practice_sessions_rows.csv', 'music_practice_sessions');

    // 2. Migrate Attendance Logs
    const csvPath = 'v1_exports/attendance_log_rows.csv';
    if (!fs.existsSync(csvPath)) return console.error(`File ${csvPath} not found.`);

    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => normalizeCSVValue(h));
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line).map(v => normalizeCSVValue(v));
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });

    // Music practice sessions are not exported as a standalone CSV in this dataset.
    // Seed them from unique attendance event IDs so event lookup can resolve.
    await seedMusicPracticeSessionsFromAttendance(rows);

    console.log(`Processing ${rows.length} attendance logs...`);

    for (const row of rows) {
        const oldMemberId = row.member_id;
        const oldEventId = row.event_id;
        const eventType = row.event_type;

        // Resolve Member
        const { data: member } = await supabase
            .from('members')
            .select('id')
            .or(`legacy_v1_id.eq.${oldMemberId},id.eq.${oldMemberId}`)
            .maybeSingle();
        if (!member) {
            stats.missing_member++;
            logs.push({ status: 'conflict', reason: 'missing_member_uuid', data: row });
            continue;
        }

        // Resolve Event
        let eventTable = '';
        if (eventType === 'service') eventTable = 'services';
        else if (eventType === 'sunday_school') eventTable = 'sunday_school_sessions';
        else if (eventType === 'music_practice') eventTable = 'music_practice_sessions';
        else if (eventType === 'activity') eventTable = 'activities';

        let v2EventId = null;
        if (eventTable) {
            const { data: events } = await supabase
                .from(eventTable)
                .select('id')
                .or(`legacy_v1_id.eq.${oldEventId},id.eq.${oldEventId}`)
                .limit(1);
            if (events && events.length > 0) v2EventId = events[0].id;
        }

        if (!v2EventId) {
            stats.missing_event++;
            await supabase.from('import_conflicts').insert([{
                import_type: 'attendance',
                raw_data: row,
                conflict_reason: 'missing_event_uuid'
            }]);
            logs.push({ status: 'conflict', reason: 'missing_event_uuid', data: row });
            continue;
        }

        const { error: insertError } = await supabase.from('attendance_log').upsert([{
            member_id: member.id,
            event_type: eventType,
            event_id: v2EventId,
            event_date: row.event_date,
            was_present: row.was_present === 'true',
            created_at: row.created_at
        }], { onConflict: 'member_id,event_type,event_id', ignoreDuplicates: true });

        if (insertError) {
            logs.push({ status: 'error', reason: 'insert_failed', data: row, error: insertError });
        } else {
            stats.inserted++;
            logs.push({ status: 'inserted', member_id: member.id, event_id: v2EventId });
        }
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log('\nAttendance Migration Summary:');
    console.log(`- Inserted: ${stats.inserted}`);
    console.log(`- Missing Member: ${stats.missing_member}`);
    console.log(`- Missing Event: ${stats.missing_event}`);
}

migrateAttendance();
