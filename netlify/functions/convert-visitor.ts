import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
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

        // Check if admin or clerk
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();

        if (memberError || !memberData) {
            return { statusCode: 403, body: JSON.stringify({ error: 'You do not have permission to convert visitors.' }) };
        }

        const { data: roleRows, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('member_id', memberData.id)
            .in('role', ['church_administrator', 'church_clerk']);

        if (roleError || !roleRows || roleRows.length === 0) {
            return { statusCode: 403, body: JSON.stringify({ error: 'You do not have permission to convert visitors.' }) };
        }

        const adminId = user.id;

        const {
            visitorId,
            membershipStatus,
            dateJoined,
            baptismDate,
            memberNumber,
        } = body;

        if (!visitorId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Visitor ID is required' }) };
        }

        // Fetch the visitor
        const { data: visitor, error: vErr } = await supabase
            .from('visitors')
            .select('*')
            .eq('id', visitorId)
            .single();

        if (vErr || !visitor) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Visitor not found.' }) };
        }

        if (visitor.converted_to_member || visitor.status === 'converted') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Visitor is already converted.' }) };
        }

        const firstName = visitor.name.split(' ')[0] || '';
        const surname = visitor.name.split(' ').slice(1).join(' ') || 'Unknown';

        // Insert new member
        const { data: newMember, error: insertErr } = await supabase
            .from('members')
            .insert({
                member_number: memberNumber || null,
                first_name: firstName,
                surname: surname,
                date_of_birth: visitor.date_of_birth || '1900-01-01',
                gender: visitor.gender || 'Male',
                civil_status: visitor.marital_status || 'Single',
                home_address: visitor.address || 'Unknown',
                phone_number: visitor.contact_number || '',
                membership_status: 'active',
                is_regular_member: true,
                is_visitor: false, // Ensure shadow flag doesn't carry over
                membership_date: dateJoined || new Date().toISOString().split('T')[0],
                baptism_date: baptismDate || null,
                converted_from_visitor_id: visitor.id,
                // Include other relevant fields if necessary
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        // Update visitor
        const { error: updErr } = await supabase
            .from('visitors')
            .update({
                status: 'converted',
                converted_to_member_id: newMember.id,
                converted_at: new Date().toISOString(),
                converted_by: adminId,
                converted_to_member: true, // Legacy boolean if still needed
            })
            .eq('id', visitor.id);

        if (updErr) {
            // Rollback might be needed in a real distributed tx, here we just log it
            console.error('Failed to update visitor status:', updErr);
        }

        // Audit Log
        await supabase.from('audit_logs').insert({
            user_id: adminId,
            action: 'visitor_converted',
            entity_type: 'member',
            entity_id: newMember.id,
            details: `Visitor ${visitor.name} converted to Member ${memberNumber || newMember.id} by admin`
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, member: newMember })
        };

    } catch (e: any) {
        console.error('Convert Visitor Error:', e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal server error.' }) };
    }
};
