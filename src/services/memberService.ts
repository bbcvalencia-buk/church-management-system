import { supabase } from "../lib/supabase";
import type { Member, ChurchPosition, FamilyRelationship, FaithPromiseCommitment, AttendanceLog } from "../types";
import { isMissingTableError, isTableMarkedMissing, markTableMissing } from "./supabaseErrorUtils";

/**
 * Fetches all members from the database, ordered by surname.
 */
export const getAllMembers = async (): Promise<Member[]> => {
    const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("surname", { ascending: true });

    return data as Member[];
};

/**
 * Fetches all active members from the database, ordered by surname.
 */
export const getActiveMembers = async (): Promise<Member[]> => {
    const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("membership_status", "active")
        .order("surname", { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch active members: ${error.message}`);
    }
    return data as Member[];
};

/**
 * Fetches a single member by their ID.
 */
export const getMemberById = async (id: string): Promise<Member> => {
    // Try RPC first (bypasses RLS infinite recursion)
    const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_member_by_id', { target_id: id });

    if (!rpcError && rpcData) {
        return rpcData as Member;
    }

    // Fallback to direct query
    const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        throw new Error(`Failed to fetch member with ID ${id}: ${error.message}`);
    }
    return data as Member;
};

/**
 * Updates an existing member or inserts a new one if no ID is present.
 */
export const upsertMember = async (memberData: Partial<Member>): Promise<Member> => {
    const { data, error } = await supabase
        .from("members")
        .upsert(memberData)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save member: ${error.message}`);
    }
    return data as Member;
};

/**
 * Deletes a member by their ID.
 */
export const deleteMember = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", id);

    if (error) {
        throw new Error(`Failed to delete member with ID ${id}: ${error.message}`);
    }
};

/**
 * Fetches all positions held by a specific member.
 */
export const getMemberPositions = async (memberId: string): Promise<ChurchPosition[]> => {
    const { data, error } = await supabase
        .from("church_positions")
        .select("*")
        .eq("member_id", memberId);

    if (error) {
        throw new Error(`Failed to fetch positions for member ${memberId}: ${error.message}`);
    }
    return data as ChurchPosition[];
};

/**
 * Upserts a church position or multiple positions.
 */
export const upsertChurchPosition = async (position: Partial<ChurchPosition> | Partial<ChurchPosition>[]): Promise<void> => {
    const { error } = await supabase
        .from("church_positions")
        .upsert(position);

    if (error) {
        throw new Error(`Failed to save church position: ${error.message}`);
    }
};

/**
 * Deletes specific positions for a member.
 */
export const deleteChurchPositions = async (memberId: string, positionIds: string[]): Promise<void> => {
    const { error } = await supabase
        .from("church_positions")
        .delete()
        .eq("member_id", memberId)
        .in("id", positionIds);

    if (error) {
        throw new Error(`Failed to delete church positions: ${error.message}`);
    }
};

/**
 * Fetches family relationships for a specific member.
 */
export const getFamilyRelationships = async (memberId: string): Promise<FamilyRelationship[]> => {
    const { data, error } = await supabase
        .from("family_relationships")
        .select("*")
        .eq("member_id", memberId);

    if (error) {
        throw new Error(`Failed to fetch family relationships for member ${memberId}: ${error.message}`);
    }
    return data as FamilyRelationship[];
};

/**
 * Upserts a family relationship.
 */
export const upsertFamilyRelationship = async (relationship: Partial<FamilyRelationship>): Promise<void> => {
    const { error } = await supabase
        .from("family_relationships")
        .upsert(relationship);

    if (error) {
        throw new Error(`Failed to save family relationship: ${error.message}`);
    }
};

/**
 * Deletes specific family relationships.
 */
export const deleteFamilyRelationships = async (relationshipIds: string[]): Promise<void> => {
    const { error } = await supabase
        .from("family_relationships")
        .delete()
        .in("id", relationshipIds);

    if (error) {
        throw new Error(`Failed to delete family relationships: ${error.message}`);
    }
};

/**
 * Fetches attendance logs for a specific member.
 */
export const getMemberAttendanceLogs = async (memberId: string): Promise<AttendanceLog[]> => {
    const { data, error } = await supabase
        .from("attendance_log")
        .select("*")
        .eq("member_id", memberId);

    if (error) {
        throw new Error(`Failed to fetch attendance logs for member ${memberId}: ${error.message}`);
    }
    return data as AttendanceLog[];
};

/**
 * Searches for members by name, surname, or member number.
 */
export const searchMembers = async (query: string, limit: number = 20): Promise<Member[]> => {
    let req = supabase.from('members').select('*').order('surname').limit(limit);

    if (query) {
        req = req.or(`first_name.ilike.%${query}%,surname.ilike.%${query}%,member_number.ilike.%${query}%`);
    }

    const { data, error } = await req;

    if (error) {
        throw new Error(`Failed to search members: ${error.message}`);
    }
    return data as Member[];
};

/**
 * Gets the total number of members in the registry.
 */
export const getMemberCount = async (): Promise<number> => {
    const { count, error } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true });

    if (error) {
        throw new Error(`Failed to get member count: ${error.message}`);
    }
    return count ?? 0;
};

/**
 * Fetches teammates for a specific department.
 */
export const getTeammates = async (department: string) => {
    const { data, error } = await supabase
        .from("church_positions")
        .select(`
            position_name,
            is_ministry_head,
            members!inner(id, first_name, surname, profile_picture_url)
        `)
        .eq("department", department)
        .eq("is_active", true);

    if (error) {
        throw new Error(`Failed to fetch teammates: ${error.message}`);
    }
    return data || [];
};

/**
 * Updates an existing member.
 */
export const updateMember = async (id: string, memberData: Partial<Member>): Promise<Member> => {
    const { error } = await supabase
        .from("members")
        .update(memberData)
        .eq("id", id);

    if (error) {
        throw new Error(`Failed to update member: ${error.message}`);
    }

    // Some roles/policies can update but not return selected row.
    const { data: updatedRow } = await supabase
        .from("members")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (updatedRow) {
        return updatedRow as Member;
    }

    return { id, ...memberData } as Member;
};

/**
 * Creates a new member.
 */
export const createMember = async (memberData: Omit<Partial<Member>, 'id'>): Promise<Member> => {
    const { data, error } = await supabase
        .from("members")
        .insert(memberData)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create member: ${error.message}`);
    }
    return data as Member;
};

/**
 * Checks if a member is a visitor.
 */
export const isVisitorMember = async (id: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('visitors')
        .select('id')
        .eq('member_id', id)
        .maybeSingle();

    if (error) return false;
    return !!data;
};

/**
 * Fetches members by surname.
 */
export const getMembersBySurname = async (surname: string): Promise<Member[]> => {
    const { data, error } = await supabase
        .from("members")
        .select("*")
        .ilike("surname", surname)
        .order("date_of_birth", { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch family members: ${error.message}`);
    }
    return data as Member[];
};

/**
 * Fetches all church positions with member details.
 */
export const getChurchPositions = async (activeOnly = true): Promise<any[]> => {
    let query = supabase
        .from('church_positions')
        .select('*, members(id, first_name, surname, profile_picture_url)')
        .order('position_name', { ascending: true });

    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
        throw new Error(`Failed to fetch positions: ${error.message}`);
    }
    return data || [];
};

/**
 * Updates multiple church positions by their IDs.
 */
export const updateChurchPositions = async (ids: string[], updates: Partial<ChurchPosition>): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase
        .from('church_positions')
        .update(updates)
        .in('id', ids);

    if (error) {
        throw new Error(`Failed to update positions: ${error.message}`);
    }
};

/**
 * Fetches the count of service assignments for each member.
 */
export const getServiceAssignmentCounts = async (): Promise<Record<string, number>> => {
    if (isTableMarkedMissing('service_assignments')) {
        return {};
    }

    const { data, error } = await supabase.from('service_assignments').select('member_id');
    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
            console.warn('service_assignments table not found - returning empty counts');
            return {};
        }
        throw new Error(`Failed to fetch service assignments: ${error.message}`);
    }

    if (!data) return {};

    return data.reduce((acc: any, curr: any) => {
        acc[curr.member_id] = (acc[curr.member_id] || 0) + 1;
        return acc;
    }, {});
};

/**
 * Fetches the attendance rate for each member.
 * Calculates what percentage of total services the member has attended.
 */
export const getMemberAttendanceRates = async (): Promise<Record<string, { count: number, rate: string, total: number }>> => {
    // 1. Get total services count
    const { count: totalServices, error: err1 } = await supabase.from('services').select('id', { count: 'exact', head: true });

    if (err1) {
        throw new Error(`Failed to get total services count: ${err1.message}`);
    }

    if (!totalServices) return {};

    // 2. Get all attendance logs for services
    const { data: attendanceData, error: err2 } = await supabase
        .from('attendance_log')
        .select('member_id')
        .eq('event_type', 'service')
        .eq('status', 'present');

    if (err2) {
        throw new Error(`Failed to get attendance data: ${err2.message}`);
    }

    const counts: Record<string, number> = {};
    if (attendanceData) {
        for (const row of attendanceData) {
            counts[row.member_id] = (counts[row.member_id] || 0) + 1;
        }
    }

    const rates: Record<string, { count: number, rate: string, total: number }> = {};
    for (const [memberId, count] of Object.entries(counts)) {
        rates[memberId] = {
            count,
            total: totalServices,
            rate: `${Math.round((count / totalServices) * 100)}%`
        };
    }

    return rates;
};


