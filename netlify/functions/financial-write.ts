import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const authHeader = event.headers.authorization;

        if (!authHeader) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Missing authorization header' }) };
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token.' }) };
        }

        // Resolve the member row by auth user's email, then check member-based roles.
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();

        if (memberError || !memberData) {
            return { statusCode: 403, body: JSON.stringify({ error: 'You do not have permission to modify financial records.' }) };
        }

        const { data: roleRows, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('member_id', memberData.id)
            .in('role', ['church_administrator', 'treasurer']);

        if (roleError || !roleRows || roleRows.length === 0) {
            return { statusCode: 403, body: JSON.stringify({ error: 'You do not have permission to modify financial records.' }) };
        }

        const action = body.action; // 'INSERT', 'UPDATE', 'DELETE'

        if (!['INSERT', 'UPDATE', 'DELETE'].includes(action)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action.' }) };
        }

        const records = body.records ? (Array.isArray(body.records) ? body.records : [body.records]) : [];

        // Ensure we handle period lock manually or rely on triggers
        // The trigger is enforced at PG layer, so even with service role, the trigger runs!
        // But since user requested: "check period not locked... Use SUPABASE_SERVICE_ROLE_KEY to bypass RLS"
        // Service Role bypasses RLS, but triggers STILL Fire! We can try... catch the exception and pass it up.

        let result;

        if (action === 'DELETE') {
            // Soft delete
            const targetIds = records.map((r: any) => r.id).filter(Boolean);
            const targetMemberId = body.member_id;
            const targetDate = body.transaction_date;

            // Delete by member and date if provided (Treasury Revert)
            if (targetMemberId && targetDate) {
                const { data, error } = await supabase
                    .from('financial_records')
                    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
                    .eq('member_id', targetMemberId)
                    .eq('transaction_date', targetDate);

                if (error) throw error;
                result = data;
            } else if (targetIds.length > 0) {
                const { data, error } = await supabase
                    .from('financial_records')
                    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
                    .in('id', targetIds);

                if (error) throw error;
                result = data;
            } else {
                throw new Error("Missing items to delete");
            }

        } else if (action === 'INSERT') {
            const { data, error } = await supabase
                .from('financial_records')
                .insert(records);

            if (error) throw error;
            result = data;
        } else if (action === 'UPDATE') {
            const { data, error } = await supabase
                .from('financial_records')
                .upsert(records);

            if (error) throw error;
            result = data;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Success", result })
        };

    } catch (err: any) {
        console.error("Financial write error:", err);
        let errorMsg = err.message || "An unexpected error occurred.";

        // Match PG constraint or trigger messages
        if (errorMsg.includes("Period") && errorMsg.includes("is locked")) {
            return { statusCode: 403, body: JSON.stringify({ error: "The selected financial period is locked. Please contact the administrator." }) };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: errorMsg })
        };
    }
};
