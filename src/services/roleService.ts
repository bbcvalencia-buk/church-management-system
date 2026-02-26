import { supabase } from "../lib/supabase";
import { UserRole } from "../types";

export interface MemberRole {
    member_id: string;
    role: string;
    member?: {
        first_name: string;
        surname: string;
        profile_picture_url?: string;
    };
}

export interface ProfileEditRequest {
    id: string;
    target_member_id: string;
    requested_by_member_id?: string | null;
    request_message: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    resolved_at?: string;
    resolved_by?: string;
}

/**
 * Fetches all user role assignments.
 */
export const getAllUserRoles = async (): Promise<MemberRole[]> => {
    const { data, error } = await supabase
        .from('user_roles')
        .select('member_id, role, members(first_name, surname, profile_picture_url)');

    if (error) {
        if (error.code === '42P01') {
            return [];
        }
        throw new Error(`Failed to fetch user roles: ${error.message}`);
    }

    return (data || []).map((r: any) => ({
        member_id: r.member_id,
        role: r.role,
        member: r.members
    }));
};

/**
 * Assigns a role to a member.
 */
export const assignRole = async (memberId: string, role: string): Promise<void> => {
    const { error } = await supabase
        .from('user_roles')
        .insert({ member_id: memberId, role });

    if (error) {
        throw new Error(`Failed to assign role: ${error.message}`);
    }
};

/**
 * Removes a role from a member.
 */
export const removeRole = async (memberId: string, role: string): Promise<void> => {
    const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('member_id', memberId)
        .eq('role', role);

    if (error) {
        throw new Error(`Failed to remove role: ${error.message}`);
    }
};

/**
 * Fetches pending profile edit requests.
 */
export const getPendingProfileEditRequests = async (limit = 20): Promise<ProfileEditRequest[]> => {
    const { data, error } = await supabase
        .from('member_profile_edit_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (error.code === '42P01') {
            return [];
        }
        throw new Error(`Failed to fetch edit requests: ${error.message}`);
    }

    return (data || []) as ProfileEditRequest[];
};

/**
 * Resolves a profile edit request.
 */
export const resolveProfileEditRequest = async (requestId: string, status: 'approved' | 'rejected'): Promise<void> => {
    const { data: userResult } = await supabase.auth.getUser();
    const adminUserId = userResult.user?.id || null;

    const { error } = await supabase
        .from('member_profile_edit_requests')
        .update({
            status,
            resolved_at: new Date().toISOString(),
            resolved_by: adminUserId
        } as any)
        .eq('id', requestId);

    if (error) {
        throw new Error(`Failed to resolve request: ${error.message}`);
    }
};

/**
 * Checks if the current user has a specific role.
 */
export const hasRole = async (role: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('app_has_role', { target_role: role });
    if (error) return false;
    return !!data;
};
