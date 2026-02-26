import { supabase } from "../lib/supabase";

export interface EditRequest {
    id: string;
    member_id: string;
    requested_by: string;
    message: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

/**
 * Creates a new edit request.
 */
export const createEditRequest = async (requestData: any): Promise<void> => {
    const { error } = await supabase
        .from('member_profile_edit_requests')
        .insert([requestData]);

    if (error) {
        throw error;
    }
};

/**
 * Fetches edit requests for a specific member.
 */
export const getEditRequestsByMember = async (memberId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('member_profile_edit_requests')
        .select('*')
        .eq('target_member_id', memberId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch edit requests: ${error.message}`);
    }
    return data || [];
};
