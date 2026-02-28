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
 * Fetches all active members with their active church positions.
 */
export const getActiveMembersWithPositions = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from("members")
        .select(`
            id,
            first_name,
            surname,
            member_number,
            profile_picture_url,
            church_positions (
                position_name,
                is_active
            )
        `)
        .eq("membership_status", "active")
        .order("surname", { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch active members with positions: ${error.message}`);
    }
    return data || [];
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
export const getFamilyRelationships = async (memberId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from("family_relationships")
        .select(`
            *,
            members:related_member_id (
                id,
                first_name,
                surname,
                member_number,
                profile_picture_url
            )
        `)
        .eq("member_id", memberId);

    if (error) {
        throw new Error(`Failed to fetch family relationships for member ${memberId}: ${error.message}`);
    }
    return data;
};

/**
 * Maps a relationship from the perspective of the target back to the source.
 * Example: If A adds B as "father", B should add A as "son" (if A is male) or "daughter" (if A is female).
 */
export const getReciprocalRelation = (relation: string, sourceGender?: string): string => {
    const isFemale = sourceGender?.toLowerCase() === 'female';
    switch (relation.toLowerCase()) {
        case 'spouse': return 'spouse';
        case 'father': return isFemale ? 'daughter' : 'son';
        case 'mother': return isFemale ? 'daughter' : 'son';
        case 'son': return isFemale ? 'mother' : 'father';
        case 'daughter': return isFemale ? 'mother' : 'father';
        case 'brother': return isFemale ? 'sister' : 'brother';
        case 'sister': return isFemale ? 'sister' : 'brother';
        case 'grandfather': return isFemale ? 'granddaughter' : 'grandson';
        case 'grandmother': return isFemale ? 'granddaughter' : 'grandson';
        case 'grandson': return isFemale ? 'grandmother' : 'grandfather';
        case 'granddaughter': return isFemale ? 'grandmother' : 'grandfather';
        case 'uncle': return isFemale ? 'niece' : 'nephew';
        case 'aunt': return isFemale ? 'niece' : 'nephew';
        case 'nephew': return isFemale ? 'aunt' : 'uncle';
        case 'niece': return isFemale ? 'aunt' : 'uncle';
        case 'cousin': return 'cousin';
        case 'in_law': return 'in_law';
        default: return relation;
    }
}

/**
 * Upserts a family relationship and automatically ensures the reciprocal relationship exists.
 */
export const upsertFamilyRelationship = async (relationship: Partial<FamilyRelationship>, skipReciprocal = false): Promise<void> => {
    // 1. Sanitize the payload to only include actual table columns
    const { members, ...dbPayload } = relationship as any;

    // 2. Insert/Update the primary relationship
    const { error, data: savedRelation } = await supabase
        .from("family_relationships")
        .upsert(dbPayload)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save family relationship: ${error.message}`);
    }

    // 2. If it is linked to another member, dynamically ensure the reciprocal exists
    if (!skipReciprocal && relationship.related_member_id && relationship.member_id) {
        // Find existing reciprocal where member_id = B and related_member_id = A
        const { data: existingReciprocal } = await supabase
            .from("family_relationships")
            .select("id")
            .eq("member_id", relationship.related_member_id)
            .eq("related_member_id", relationship.member_id)
            .maybeSingle();

        if (!existingReciprocal) {
            // Get source member to know their gender
            const { data: sourceMember } = await supabase
                .from("members")
                .select("gender, first_name, surname")
                .eq("id", relationship.member_id)
                .single();

            if (sourceMember) {
                const reciprocalType = getReciprocalRelation(relationship.relationship_type || '', sourceMember.gender);
                await supabase
                    .from("family_relationships")
                    .insert({
                        member_id: relationship.related_member_id,
                        related_member_id: relationship.member_id,
                        relationship_type: reciprocalType,
                        non_member_name: `${sourceMember.first_name} ${sourceMember.surname}`
                    });
            }
        }
    }
};

/**
 * Deletes specific family relationships and automatically removes their reciprocals to avoid dangling orphans.
 */
export const deleteFamilyRelationships = async (relationshipIds: string[]): Promise<void> => {
    if (!relationshipIds?.length) return;

    // First find what we are deleting to grab their target IDs
    const { data: deletingRels } = await supabase
        .from("family_relationships")
        .select("member_id, related_member_id")
        .in("id", relationshipIds)
        .not("related_member_id", "is", null);

    const { error } = await supabase
        .from("family_relationships")
        .delete()
        .in("id", relationshipIds);

    if (error) {
        throw new Error(`Failed to delete family relationships: ${error.message}`);
    }

    // Delete reciprocal pairs too
    if (deletingRels && deletingRels.length > 0) {
        for (const rel of deletingRels) {
            await supabase
                .from("family_relationships")
                .delete()
                .eq("member_id", rel.related_member_id!)
                .eq("related_member_id", rel.member_id);
        }
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
        .eq('was_present', true);

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

/**
 * Fetches the recent service history for a specific member.
 * Gets the last 5 services where they had an assigned role.
 */
export const getMemberServiceHistory = async (memberId: string, limit: number = 5): Promise<any[]> => {
    if (isTableMarkedMissing('service_assignments')) {
        return [];
    }

    const { data, error } = await supabase
        .from('service_assignments')
        .select(`
            id,
            role,
            notes,
            services (
                id,
                service_date,
                service_type
            )
        `)
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
            return [];
        }
        console.error(`Failed to fetch service history for member ${memberId}:`, error);
        return [];
    }

    // Sort heavily by service_date from the join just to be safe
    return (data || []).sort((a: any, b: any) => {
        const dateA = new Date(a.services?.service_date || 0).getTime();
        const dateB = new Date(b.services?.service_date || 0).getTime();
        return dateB - dateA;
    });
};
