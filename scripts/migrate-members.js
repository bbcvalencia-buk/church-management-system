import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
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

function buildMemberPayload(row, legacy_v1_id) {
    const idNumber = Number.parseInt((row.id_number || '').trim(), 10);
    return {
        id_number: Number.isFinite(idNumber) ? idNumber : null,
        first_name: row.first_name,
        middle_name: nullIfEmpty(row.middle_name),
        surname: row.surname,
        name_ext: nullIfEmpty(row.name_ext),
        nickname: nullIfEmpty(row.nickname),
        date_of_birth: row.date_of_birth || '1900-01-01',
        gender: row.gender || 'Male',
        civil_status: row.civil_status || 'Single',
        nationality: row.nationality || 'Filipino',
        place_of_birth: nullIfEmpty(row.place_of_birth),
        home_address: row.home_address || 'TBD',
        phone_number: row.phone_number || '0',
        alternative_phone: nullIfEmpty(row.alternative_phone),
        email: nullIfEmpty(row.email),
        emergency_contact_name: nullIfEmpty(row.emergency_contact_name),
        emergency_contact_phone: nullIfEmpty(row.emergency_contact_phone),
        emergency_contact_relationship: nullIfEmpty(row.emergency_contact_relationship),
        previous_church: nullIfEmpty(row.previous_church),
        previous_religion: nullIfEmpty(row.previous_religion),
        membership_status: row.membership_status || 'active',
        is_regular_member: parseBool(row.is_regular_member, true),
        is_pastor: parseBool(row.is_pastor, false),
        is_pastors_wife: parseBool(row.is_pastors_wife, false),
        profile_picture_url: nullIfEmpty(row.profile_picture_url),
        id_card_url: nullIfEmpty(row.id_card_url),
        attachment_url: nullIfEmpty(row.attachment_url),
        created_at: nullIfEmpty(row.created_at),
        updated_at: nullIfEmpty(row.updated_at),
        legacy_v1_id,
        salvation_date: nullIfEmpty(row.salvation_date),
        baptism_date: nullIfEmpty(row.baptism_date),
        membership_date: nullIfEmpty(row.membership_date),
        deleted_at: nullIfEmpty(row.deleted_at)
    };
}

const csvPath = 'v1_exports/members_rows.csv';
const logDir = 'scripts/logs';
const logPath = path.join(logDir, 'members_migration.json');

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

async function migrate() {
    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => normalizeCSVValue(h));
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line).map(v => normalizeCSVValue(v));
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });

    const logs = [];
    const stats = { matched: 0, inserted: 0, conflicts: 0 };

    console.log(`Starting migration of ${rows.length} members...`);

    for (const row of rows) {
        const { first_name, surname, date_of_birth, id: legacy_v1_id } = row;

        // Normalize for matching
        const normFirst = first_name.trim().toLowerCase();
        const normLast = surname.trim().toLowerCase();
        const normDOB = date_of_birth.trim();

        // Query V2 for match
        const { data: matches, error } = await supabase
            .from('members')
            .select('id, first_name, surname')
            .ilike('first_name', normFirst)
            .ilike('surname', normLast)
            .eq('date_of_birth', normDOB);

        if (error) {
            console.error(`Error querying matches for ${first_name} ${surname}:`, error);
            continue;
        }

        if (matches.length === 0) {
            const { data: byLegacyOrId } = await supabase
                .from('members')
                .select('id')
                .or(`legacy_v1_id.eq.${legacy_v1_id},id.eq.${legacy_v1_id}`)
                .limit(1);
            if (byLegacyOrId && byLegacyOrId.length > 0) {
                matches.push(byLegacyOrId[0]);
            }
        }

        if (matches.length === 1) {
            // MATCH found: UPDATE
            const targetId = matches[0].id;
            const payload = buildMemberPayload(row, legacy_v1_id);
            const { error: updateError } = await supabase
                .from('members')
                .update(payload)
                .eq('id', targetId);

            if (updateError) {
                logs.push({ status: 'error', reason: 'update_failed', data: row, error: updateError });
            } else {
                stats.matched++;
                logs.push({ status: 'matched', legacy_id: legacy_v1_id, v2_id: targetId, name: `${first_name} ${surname}` });
            }
        } else if (matches.length === 0) {
            // NO MATCH: INSERT
            const payload = buildMemberPayload(row, legacy_v1_id);
            const intendedRegular = payload.is_regular_member;
            const insertPayload = { ...payload, is_regular_member: false };
            const { data: insertedMember, error: insertError } = await supabase
                .from('members')
                .insert([insertPayload])
                .select('id')
                .single();

            if (insertError) {
                logs.push({ status: 'error', reason: 'insert_failed', data: row, error: insertError });
            } else {
                if (insertedMember?.id && intendedRegular) {
                    const { error: postUpdateError } = await supabase
                        .from('members')
                        .update({ is_regular_member: true })
                        .eq('id', insertedMember.id);
                    if (postUpdateError) {
                        logs.push({ status: 'error', reason: 'post_insert_regular_member_update_failed', data: row, error: postUpdateError });
                        continue;
                    }
                }
                stats.inserted++;
                logs.push({ status: 'inserted', legacy_id: legacy_v1_id, name: `${first_name} ${surname}` });
            }
        } else {
            // MULTIPLE MATCHES: CONFLICT
            stats.conflicts++;
            const { error: conflictError } = await supabase
                .from('import_conflicts')
                .insert([{
                    import_type: 'member',
                    raw_data: row,
                    conflict_reason: 'multiple_matches',
                    candidate_ids: matches.map(m => m.id)
                }]);

            logs.push({
                status: 'conflict',
                reason: 'multiple_matches',
                data: row,
                candidates: matches.map(m => m.id),
                log_error: conflictError
            });
        }
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log('\nMigration Summary:');
    console.log(`- Matched & Updated: ${stats.matched}`);
    console.log(`- New Inserted: ${stats.inserted}`);
    console.log(`- Conflicts Logged: ${stats.conflicts}`);
    console.log(`Full log written to ${logPath}`);
}

migrate();
