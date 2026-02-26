import { supabase } from "../lib/supabase";
import type { Visitor } from "../types";

/**
 * Fetches all visitors ordered by visit date descending.
 */
export const getVisitors = async (): Promise<Visitor[]> => {
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .order('visit_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch visitors: ${error.message}`);
    }
    return data as Visitor[];
};

/**
 * Fetches a single visitor by ID.
 */
export const getVisitorById = async (id: string): Promise<Visitor> => {
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        throw new Error(`Failed to fetch visitor with ID ${id}: ${error.message}`);
    }
    return data as Visitor;
};

/**
 * Upserts a visitor record.
 */
export const upsertVisitor = async (visitorData: Partial<Visitor>): Promise<Visitor> => {
    const { data, error } = await supabase
        .from('visitors')
        .upsert(visitorData as any)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save visitor: ${error.message}`);
    }
    return data as Visitor;
};

/**
 * Deletes a visitor.
 */
export const deleteVisitor = async (visitorId: string): Promise<void> => {
    const { error } = await supabase.from('visitors').delete().eq('id', visitorId);
    if (error) {
        throw new Error(`Failed to delete visitor: ${error.message}`);
    }
};

/**
 * Marks a visitor as converted to a member.
 */
export const convertVisitorToMember = async (visitorId: string, memberId: string): Promise<void> => {
    const { error } = await supabase
        .from('visitors')
        .update({
            member_id: memberId,
            follow_up_status: 'converted',
            converted_to_member: true
        } as any)
        .eq('id', visitorId);

    if (error) {
        throw new Error(`Failed to convert visitor to member: ${error.message}`);
    }
};

/**
 * Fetches visitors linked to a specific Sunday School session.
 */
export const getVisitorsBySundaySchoolSession = async (sessionId: string): Promise<Visitor[]> => {
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('sunday_school_session_id', sessionId);

    if (error) {
        throw new Error(`Failed to fetch visitors for Sunday School session: ${error.message}`);
    }
    return data as Visitor[];
};
/**
 * Fetches visitors linked to a specific service.
 */
export const getVisitorsByService = async (serviceId: string): Promise<Visitor[]> => {
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('service_id', serviceId);

    if (error) {
        throw new Error(`Failed to fetch visitors for service: ${error.message}`);
    }
    return data as Visitor[];
};
