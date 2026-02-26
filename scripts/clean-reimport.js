/**
 * clean-reimport.js  (v3 — schema-matched)
 *
 * Wipes ALL data then directly inserts every row from v1_exports.
 * Only sends columns that actually exist in the current DB schema.
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// ── Helpers ────────────────────────────────────
function loadEnv(file = '.env.local') {
    const raw = fs.readFileSync(file, 'utf8');
    return Object.fromEntries(
        raw.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#') && l.includes('='))
            .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (c === '"') { inQuotes = !inQuotes; }
        else if (c === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += c; }
    }
    result.push(current);
    return result;
}

function readCSV(filepath) {
    const raw = fs.readFileSync(filepath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/\r/g, '').replace(/^\uFEFF/, '').trim());
    return lines.slice(1).map(line => {
        const vals = parseCSVLine(line).map(v => (v ?? '').replace(/\r/g, '').trim());
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    });
}

const clean = v => (v === undefined || v === null || v === '') ? null : v;
const cleanBool = (v, fb = false) => v === 'true' || v === true ? true : v === 'false' || v === false ? false : fb;
const cleanNumber = v => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
function cleanArray(val) {
    if (!val || val === '[]' || val === '{}') return [];
    if (val.startsWith('{') && val.endsWith('}')) return val.slice(1, -1).split(',').filter(Boolean);
    try { return JSON.parse(val); } catch { return []; }
}

// ── Main ────────────────────────────────────
async function main() {
    const env = loadEnv();
    const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' }
    });

    // ── STEP 1: Delete ALL data ──
    console.log('🗑️  STEP 1: Deleting all existing data...');
    const deletionOrder = [
        'import_conflicts', 'import_export_log',
        'attendance_log',
        'goodnews_session_members', 'goodnews_sessions', 'goodnews_series',
        'activities', 'music_practice_sessions',
        'sunday_school_sessions', 'services',
        'financial_records', 'faith_promise_commitments',
        'financial_period_locks', 'financial_audit_log',
        'member_profile_edit_requests', 'family_relationships',
        'church_positions', 'user_roles', 'visitors', 'members'
    ];
    for (const table of deletionOrder) {
        const { error } = await supabase.from(table).delete().not('id', 'is', null);
        console.log(`  ${error ? '⚠️' : '✅'} ${table}: ${error ? error.message : 'cleared'}`);
    }

    // ── STEP 2: Members ──
    // Trigger on members references NEW.is_visitor — we must include it
    console.log('\n📥 STEP 2: Importing members...');
    const members = readCSV('v1_exports/members_rows.csv');
    let mOK = 0, mFail = 0;
    const seenIdNumbers = new Set();

    for (const row of members) {
        let idNum = cleanNumber(row.id_number);
        if (idNum !== null && seenIdNumbers.has(idNum)) idNum = null;
        if (idNum !== null) seenIdNumbers.add(idNum);

        const payload = {
            id: row.id,
            id_number: idNum,
            member_number: clean(row.member_number),
            member_number_year: cleanNumber(row.member_number_year),
            member_number_seq: cleanNumber(row.member_number_seq),
            first_name: (row.first_name || 'Unknown').trim(),
            middle_name: clean(row.middle_name),
            surname: (row.surname || 'Unknown').trim(),
            name_ext: clean(row.name_ext),
            nickname: clean(row.nickname),
            date_of_birth: row.date_of_birth || '1900-01-01',
            gender: row.gender || 'Male',
            civil_status: row.civil_status || 'Single',
            nationality: row.nationality || 'Filipino',
            place_of_birth: clean(row.place_of_birth),
            home_address: row.home_address || 'TBD',
            phone_number: row.phone_number || '0',
            alternative_phone: clean(row.alternative_phone),
            email: clean(row.email),
            emergency_contact_name: clean(row.emergency_contact_name),
            emergency_contact_phone: clean(row.emergency_contact_phone),
            emergency_contact_relationship: clean(row.emergency_contact_relationship),
            previous_church: clean(row.previous_church),
            previous_religion: clean(row.previous_religion),
            membership_status: row.membership_status || 'active',
            is_regular_member: false, // set later
            is_visitor: cleanBool(row.is_visitor, false),  // trigger needs this
            is_pastor: cleanBool(row.is_pastor),
            is_pastors_wife: cleanBool(row.is_pastors_wife),
            profile_picture_url: clean(row.profile_picture_url),
            id_card_url: clean(row.id_card_url),
            attachment_url: clean(row.attachment_url),
            legacy_v1_id: row.id,
            salvation_date: clean(row.salvation_date),
            baptism_date: clean(row.baptism_date),
            membership_date: clean(row.membership_date),
            deleted_at: clean(row.deleted_at),
        };

        const { data: inserted, error } = await supabase.from('members').insert([payload]).select('id').single();
        if (error) {
            console.log(`  ❌ Member ${row.first_name} ${row.surname} (${row.id}): ${error.message}`);
            mFail++;
        } else {
            // Now set is_regular_member separately to bypass trigger
            if (cleanBool(row.is_regular_member, false) && inserted?.id) {
                await supabase.from('members').update({ is_regular_member: true }).eq('id', inserted.id);
            }
            mOK++;
        }
    }
    console.log(`  Members: ${mOK} imported, ${mFail} failed (of ${members.length})`);

    // ── STEP 3: Services (no non_member_attendance column) ──
    console.log('\n📥 STEP 3: Importing services...');
    const services = readCSV('v1_exports/services_rows.csv');
    let sOK = 0;
    for (const row of services) {
        const payload = {
            id: row.id,
            service_type: clean(row.service_type),
            service_date: clean(row.service_date),
            sermon_title: clean(row.sermon_title),
            sermon_scripture: clean(row.sermon_scripture),
            souls_saved: cleanNumber(row.souls_saved),
            total_attendance: cleanNumber(row.total_attendance),
            // non_member_attendance does NOT exist in current schema
            notes: clean(row.notes),
            created_at: clean(row.created_at),
        };
        const { error } = await supabase.from('services').insert([payload]);
        if (error) console.log(`  ❌ Service ${row.id}: ${error.message}`);
        else sOK++;
    }
    console.log(`  Services: ${sOK}/${services.length}`);

    // ── STEP 4: Sunday school (no notes column) ──
    console.log('\n📥 STEP 4: Importing sunday school sessions...');
    const ssSessions = readCSV('v1_exports/sunday_school_sessions_rows.csv');
    let ssOK = 0;
    for (const row of ssSessions) {
        const payload = {
            id: row.id,
            department: clean(row.department),
            session_date: clean(row.session_date),
            members_present: cleanNumber(row.members_present),
            visitors_present: cleanNumber(row.visitors_present),
            total_attendance: cleanNumber(row.total_attendance),
            souls_saved: cleanNumber(row.souls_saved),
            // notes does NOT exist in current schema
            created_at: clean(row.created_at),
        };
        const { error } = await supabase.from('sunday_school_sessions').insert([payload]);
        if (error) console.log(`  ❌ SS ${row.id}: ${error.message}`);
        else ssOK++;
    }
    console.log(`  SS Sessions: ${ssOK}/${ssSessions.length}`);

    // ── STEP 5: Financial records (no imported_from_v1 column) ──
    console.log('\n📥 STEP 5: Importing financial records...');
    const financials = readCSV('v1_exports/financial_records_rows.csv');
    let fOK = 0, fFail = 0;
    for (const row of financials) {
        if (!clean(row.member_id)) { fFail++; continue; }

        const payload = {
            id: row.id,
            member_id: row.member_id,
            transaction_date: clean(row.transaction_date),
            transaction_type: clean(row.transaction_type) || 'tithe',
            amount: cleanNumber(row.amount),
            pledge_purpose: clean(row.pledge_purpose),
            faith_promise_year: cleanNumber(row.faith_promise_year),
            notes: clean(row.notes),
            description: clean(row.description),
            source: clean(row.source),
            recorded_by: clean(row.recorded_by),
            // imported_from_v1 does NOT exist in current schema
            created_at: clean(row.created_at),
            updated_at: clean(row.updated_at),
            deleted_at: clean(row.deleted_at),
        };

        const { error } = await supabase.from('financial_records').insert([payload]);
        if (error) {
            console.log(`  ❌ Fin ${row.id} (member: ${row.member_id}): ${error.message}`);
            fFail++;
        } else {
            fOK++;
        }
    }
    console.log(`  Financial: ${fOK} imported, ${fFail} failed (of ${financials.length})`);

    // ── STEP 6: Faith Promise ──
    console.log('\n📥 STEP 6: Importing faith promise commitments...');
    const fpcs = readCSV('v1_exports/faith_promise_commitments_rows.csv');
    let fpOK = 0, fpFail = 0;
    for (const row of fpcs) {
        if (!clean(row.member_id)) continue;
        const payload = {
            id: row.id,
            member_id: row.member_id,
            year: cleanNumber(row.year),
            promised_amount: cleanNumber(row.promised_amount),
            created_at: clean(row.created_at),
        };
        const { error } = await supabase.from('faith_promise_commitments').insert([payload]);
        if (error) { console.log(`  ❌ FPC ${row.id}: ${error.message}`); fpFail++; }
        else fpOK++;
    }
    console.log(`  Faith Promise: ${fpOK}/${fpcs.length} (${fpFail} failed)`);

    // ── STEP 7: Attendance (no status column) ──
    console.log('\n📥 STEP 7: Importing attendance logs...');
    const attendance = readCSV('v1_exports/attendance_log_rows.csv');
    let aOK = 0, aFail = 0;
    for (const row of attendance) {
        if (!clean(row.member_id)) { aFail++; continue; }
        const payload = {
            id: row.id,
            member_id: row.member_id,
            event_type: clean(row.event_type),
            event_id: clean(row.event_id),
            event_date: clean(row.event_date),
            // status does NOT exist in current schema
            created_at: clean(row.created_at),
        };
        const { error } = await supabase.from('attendance_log').insert([payload]);
        if (error) { console.log(`  ❌ Att ${row.id}: ${error.message}`); aFail++; }
        else aOK++;
    }
    console.log(`  Attendance: ${aOK} imported, ${aFail} failed (of ${attendance.length})`);

    // ── STEP 8: Visitors (no birthday column) ──
    console.log('\n📥 STEP 8: Importing visitors...');
    const visitors = readCSV('v1_exports/visitors_rows.csv');
    let vOK = 0;
    for (const row of visitors) {
        const payload = {
            id: row.id,
            member_id: clean(row.member_id),
            name: clean(row.name),
            address: clean(row.address),
            office_school: clean(row.office_school),
            age: cleanNumber(row.age),
            // birthday does NOT exist in current schema
            phone: clean(row.phone),
            first_visit_date: clean(row.first_visit_date),
            status: clean(row.status) || 'first_time',
            notes: clean(row.notes),
            image_urls: cleanArray(row.image_urls),
            created_at: clean(row.created_at),
        };
        const { error } = await supabase.from('visitors').insert([payload]);
        if (error) console.log(`  ❌ Visitor ${row.name}: ${error.message}`);
        else vOK++;
    }
    console.log(`  Visitors: ${vOK}/${visitors.length}`);

    // ── STEP 9: Church positions (no position_type column) ──
    console.log('\n📥 STEP 9: Importing church positions...');
    const positions = readCSV('v1_exports/church_positions_rows.csv');
    let pOK = 0;
    for (const row of positions) {
        if (!clean(row.member_id)) continue;
        const payload = {
            id: row.id,
            member_id: row.member_id,
            position_name: clean(row.position_name),
            // position_type does NOT exist in current schema
            department: clean(row.department),
            specific_role: clean(row.specific_role),
            is_active: cleanBool(row.is_active, true),
            is_ministry_head: cleanBool(row.is_ministry_head, false),
            created_at: clean(row.created_at),
        };
        const { error } = await supabase.from('church_positions').insert([payload]);
        if (error) console.log(`  ❌ Pos ${row.id}: ${error.message}`);
        else pOK++;
    }
    console.log(`  Positions: ${pOK}/${positions.length}`);

    // ── STEP 10: User Roles ──
    console.log('\n📥 STEP 10: Importing user roles...');
    const roles = readCSV('v1_exports/user_roles_rows.csv');
    let rOK = 0;
    // Valid enum values
    const validRoles = new Set([
        'church_administrator', 'pastor', 'church_clerk', 'treasurer',
        'recording_secretary', 'music_minister', 'sunday_school_admin',
        'goodnews_teacher', 'activity_coordinator', 'member'
    ]);
    for (const row of roles) {
        if (!clean(row.member_id)) continue;
        let role = clean(row.role) || 'member';
        // Map super_admin -> church_administrator
        if (role === 'super_admin') role = 'church_administrator';
        if (!validRoles.has(role)) role = 'member';

        const payload = {
            id: row.id,
            member_id: row.member_id,
            role: role,
            assigned_at: clean(row.assigned_at),
        };
        const { error } = await supabase.from('user_roles').insert([payload]);
        if (error) console.log(`  ❌ Role ${row.id}: ${error.message}`);
        else rOK++;
    }
    console.log(`  Roles: ${rOK}/${roles.length}`);

    // ── Summary ──
    console.log('\n═══════════════════════════════════════');
    console.log('✅ CLEAN RE-IMPORT COMPLETE');
    console.log(`   Members:       ${mOK}/${members.length}`);
    console.log(`   Services:      ${sOK}/${services.length}`);
    console.log(`   SS Sessions:   ${ssOK}/${ssSessions.length}`);
    console.log(`   Financial:     ${fOK}/${financials.length}`);
    console.log(`   Faith Promise: ${fpOK}/${fpcs.length}`);
    console.log(`   Attendance:    ${aOK}/${attendance.length}`);
    console.log(`   Visitors:      ${vOK}/${visitors.length}`);
    console.log(`   Positions:     ${pOK}/${positions.length}`);
    console.log(`   User Roles:    ${rOK}/${roles.length}`);
    console.log('═══════════════════════════════════════');
}

main().catch(err => {
    console.error('FATAL:', err.message || err);
    process.exit(1);
});
