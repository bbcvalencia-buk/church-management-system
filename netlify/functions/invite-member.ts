import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const authHeader = event.headers.authorization;
        if (!authHeader) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Missing authorization header' }) };
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        // Verify role
        const { data: members } = await supabase
            .from('members')
            .select('id')
            .eq('email', user.email)
            .limit(1);

        const currentMemberId = members?.[0]?.id;

        if (!currentMemberId) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Member not found' }) };
        }

        const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('member_id', currentMemberId);

        const hasAdminRole = roles?.some(r => r.role === 'church_administrator' || r.role === 'church_clerk');

        if (!hasAdminRole) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient privileges' }) };
        }

        const { member_id, email } = JSON.parse(event.body || '{}');

        if (!member_id || !email) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: member_id and email' }) };
        }

        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);

        if (error) {
            return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error: any) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
    }
};
