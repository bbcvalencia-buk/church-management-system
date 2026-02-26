import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
    envFile.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => {
            const [key, ...value] = line.split('=');
            return [key.trim(), value.join('=').trim()];
        })
);

const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, supabaseKey);

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
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

const csvPath = 'v1_exports/visitors_rows.csv';
const logDir = 'scripts/logs';
const logPath = path.join(logDir, 'visitors_migration.json');

async function migrate() {
    if (!fs.existsSync(csvPath)) {
        console.error(`File ${csvPath} not found.`);
        return;
    }

    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => normalizeCSVValue(h));
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line).map(v => normalizeCSVValue(v));
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });

    const logs = [];
    const stats = { matched: 0, inserted_members: 0, upserted_visitors: 0, conflicts: 0 };

    console.log(`Starting migration of ${rows.length} visitors...`);

    for (const row of rows) {
        const { id: legacy_v1_id } = row;
        const sourceMemberLegacyId = row.member_id;
        const fullName = (row.name || `${row.first_name || ''} ${row.surname || ''}`).trim();
        const nameParts = fullName.split(/\s+/).filter(Boolean);
        const first_name = row.first_name || nameParts.slice(0, -1).join(' ') || nameParts[0] || '';
        const surname = row.surname || nameParts[nameParts.length - 1] || '';
        const date_of_birth = row.date_of_birth?.trim() || '1900-01-01';

        const normFirst = first_name.trim().toLowerCase();
        const normLast = surname.trim().toLowerCase();
        const normDOB = date_of_birth;

        if (!normFirst || !normLast) {
            logs.push({ status: 'skip', reason: 'missing_name', data: row });
            continue;
        }

        const { data: matchesByMemberRef } = await supabase
            .from('members')
            .select('id')
            .or(`legacy_v1_id.eq.${sourceMemberLegacyId},id.eq.${sourceMemberLegacyId}`)
            .limit(1);

        let matches = matchesByMemberRef || [];
        let error = null;
        if (matches.length === 0) {
            const result = await supabase
            .from('members') // V2 uses members table for visitors too, with is_visitor=true
            .select('id')
            .ilike('first_name', normFirst)
            .ilike('surname', normLast)
            .eq('date_of_birth', normDOB);
            matches = result.data || [];
            error = result.error;
        }

        if (error) {
            console.error(`Error querying matches for ${first_name} ${surname}:`, error);
            continue;
        }

        let targetId = null;
        if (matches.length === 1) {
            targetId = matches[0].id;
            const { error: updateError } = await supabase
                .from('members')
                .update({ is_regular_member: false })
                .eq('id', targetId);

            if (updateError) {
                logs.push({ status: 'error', reason: 'update_failed', data: row, error: updateError });
                continue;
            } else {
                stats.matched++;
                logs.push({ status: 'matched', legacy_id: legacy_v1_id, v2_id: targetId, name: `${first_name} ${surname}` });
            }
        } else if (matches.length === 0) {
            const payload = {
                first_name,
                middle_name: '',
                surname,
                date_of_birth,
                gender: row.gender || 'Male',
                civil_status: row.marital_status || 'Single',
                nationality: 'Filipino',
                home_address: row.address || 'N/A',
                phone_number: row.contact_number || 'N/A',
                membership_status: 'active',
                is_regular_member: false,
                legacy_v1_id: sourceMemberLegacyId
            };
            const { data: insertedMember, error: insertError } = await supabase
                .from('members')
                .insert([payload])
                .select('id')
                .single();

            if (insertError) {
                logs.push({ status: 'error', reason: 'insert_failed', data: row, error: insertError });
                continue;
            } else {
                targetId = insertedMember.id;
                stats.inserted_members++;
                logs.push({ status: 'inserted', legacy_id: legacy_v1_id, name: `${first_name} ${surname}` });
            }
        } else {
            stats.conflicts++;
            await supabase.from('import_conflicts').insert([{
                import_type: 'visitor',
                raw_data: row,
                conflict_reason: 'multiple_matches',
                candidate_ids: matches.map(m => m.id)
            }]);
            logs.push({ status: 'conflict', reason: 'multiple_matches', data: row, candidates: matches.map(m => m.id) });
            continue;
        }

        // Upsert visitor details into visitors table.
        const resolveRef = async (table, oldId) => {
            if (!oldId) return null;
            const { data } = await supabase
                .from(table)
                .select('id')
                .or(`legacy_v1_id.eq.${oldId},id.eq.${oldId}`)
                .limit(1);
            return (data && data.length > 0) ? data[0].id : null;
        };

        const serviceId = await resolveRef('services', row.service_id);
        const sundaySchoolSessionId = await resolveRef('sunday_school_sessions', row.sunday_school_session_id);
        const visitorPayload = {
            id: legacy_v1_id,
            member_id: targetId,
            name: fullName || `${first_name} ${surname}`.trim(),
            address: row.address || 'N/A',
            office_address: nullIfEmpty(row.office_address),
            marital_status: row.marital_status || 'Single',
            gender: row.gender || 'Male',
            church_name: nullIfEmpty(row.church_name),
            age: row.age ? parseInt(row.age, 10) : null,
            date_of_birth: nullIfEmpty(row.date_of_birth),
            contact_number: row.contact_number || 'N/A',
            invited_by: nullIfEmpty(row.invited_by),
            visit_time: (row.visit_time === 'AM' || row.visit_time === 'PM') ? row.visit_time : null,
            visit_date: row.visit_date,
            service_id: serviceId,
            sunday_school_session_id: sundaySchoolSessionId,
            address_sketch_url: nullIfEmpty(row.address_sketch_url),
            visitor_card_image_url: nullIfEmpty(row.visitor_card_image_url),
            visitor_card_images: (row.visitor_card_images === '[]' || !row.visitor_card_images) ? [] : [row.visitor_card_images],
            is_saved: parseBool(row.is_saved, false),
            is_prospect_for_baptism: parseBool(row.is_prospect_for_baptism, false),
            follow_up_status: row.follow_up_status || 'pending',
            converted_to_member: parseBool(row.converted_to_member, false),
            conversion_date: nullIfEmpty(row.conversion_date),
            created_at: row.created_at,
            updated_at: row.updated_at
        };
        const { error: visitorUpsertError } = await supabase
            .from('visitors')
            .upsert([visitorPayload], { onConflict: 'id' });

        if (visitorUpsertError) {
            logs.push({ status: 'error', reason: 'visitor_upsert_failed', data: row, error: visitorUpsertError });
        } else {
            stats.upserted_visitors++;
        }
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log('\nVisitor Migration Summary:');
    console.log(`- Matched & Updated: ${stats.matched}`);
    console.log(`- New Members Inserted: ${stats.inserted_members}`);
    console.log(`- Visitor Rows Upserted: ${stats.upserted_visitors}`);
    console.log(`- Conflicts Logged: ${stats.conflicts}`);
    console.log(`Full log written to ${logPath}`);
}

migrate();
