import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const splitIdx = l.indexOf('=');
    return [l.substring(0, splitIdx).trim(), l.substring(splitIdx + 1).trim()];
}));

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function runTests() {
    let output = "=== RUNNING FINANCIAL SECURITY BACKEND TESTS ===\n\n";
    let passed = 0;
    let failed = 0;
    let memberId = null;

    try {
        const { data: memberData } = await supabaseAdmin.from('members').select('id').limit(1).single();
        if (!memberData) throw new Error("No members found in DB to test against.");
        memberId = memberData.id;

        output += "[Test 1] Lock a period and verify INSERT throws exception\n";
        const year = 2029;
        const month = 12;

        await supabaseAdmin.from('financial_period_locks').delete().eq('year', year).eq('month', month);
        const { error: lockErr } = await supabaseAdmin.from('financial_period_locks').insert([{ year, month }]);

        if (lockErr) {
            output += "🚨 DB ERROR on financial_period_locks: " + JSON.stringify(lockErr) + "\n";
            output += "Have you run migration_financial_security.sql?\n";
        }

        const { error: insertLockError } = await supabaseAdmin.from('financial_records').insert([{
            member_id: memberId,
            transaction_date: `${year}-${month}-01`,
            transaction_type: 'tithe',
            amount: 100
        }]);

        if (insertLockError && (insertLockError.message.includes('Contact Church Administrator') || insertLockError.message.includes('locked'))) {
            output += "✅ Passed: Insert threw correctly: " + insertLockError.message + "\n";
            passed++;
        } else {
            output += "❌ Failed: Insert did not throw correct locked period exception.\n" + JSON.stringify(insertLockError) + "\n";
            failed++;
        }
        await supabaseAdmin.from('financial_period_locks').delete().eq('year', year).eq('month', month);

        output += "\n[Test 2] Insert a financial record — confirm audit log entry is created automatically\n";
        const { data: newRecord, error: insertError } = await supabaseAdmin.from('financial_records').insert([{
            member_id: memberId,
            transaction_date: `2099-01-01`,
            transaction_type: 'tithe',
            amount: 100
        }]).select('id').single();

        if (insertError) {
            output += "❌ Failed to insert test record.\n" + JSON.stringify(insertError) + "\n";
            failed++;
        } else {
            const { data: auditLog, error: auditErr } = await supabaseAdmin.from('financial_audit_log')
                .select('*')
                .eq('financial_record_id', newRecord.id)
                .eq('action', 'INSERT')
                .single();

            if (auditErr) {
                output += "🚨 DB ERROR on financial_audit_log: " + JSON.stringify(auditErr) + "\n";
            } else if (auditLog) {
                output += "✅ Passed: Audit log entry verified: " + auditLog.id + "\n";
                passed++;
            } else {
                output += "❌ Failed: Audit log entry NOT created.\n";
                failed++;
            }
            await supabaseAdmin.from('financial_records').delete().eq('id', newRecord.id);
        }

        output += "\n[Test 3] Try to DELETE from financial_audit_log — confirm it is denied\n";
        const { data: newestAudit } = await supabaseAdmin
            .from('financial_audit_log')
            .select('id')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        if (!newestAudit?.id) {
            output += "❌ Failed: Could not find an audit row to test deletion against.\n";
            failed++;
        } else {
            const auditId = newestAudit.id;
            const { error: deleteAuditError } = await supabaseAnon
                .from('financial_audit_log')
                .delete()
                .eq('id', auditId);

            const { data: stillThere, error: recheckError } = await supabaseAdmin
                .from('financial_audit_log')
                .select('id')
                .eq('id', auditId)
                .maybeSingle();

            if (deleteAuditError) {
                output += "✅ Passed: Delete from audit log as anon denied with error.\n";
                passed++;
            } else if (recheckError) {
                output += "🚨 DB ERROR while rechecking audit row: " + JSON.stringify(recheckError) + "\n";
                failed++;
            } else if (stillThere?.id) {
                output += "✅ Passed: Delete was blocked (row still exists).\n";
                passed++;
            } else {
                output += "❌ Failed: Anonymous user could delete from financial_audit_log!\n";
                failed++;
            }
        }

        output += `\n=== RESULTS: Passed: ${passed} | Failed: ${failed} ===\n`;
    } catch (e) {
        output += "Test execution failed: " + e.message + "\n";
    }

    fs.writeFileSync('scripts/logs/test_security_out.txt', output, 'utf8');
}

runTests();
