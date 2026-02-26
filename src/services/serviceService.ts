import { supabase } from "../lib/supabase";
import type { Service, ServiceAssignment } from "../types";
import { isMissingTableError, isTableMarkedMissing, markTableMissing } from "./supabaseErrorUtils";

/**
 * Fetches all service records.
 */
export const getServices = async (): Promise<Service[]> => {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('service_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch services: ${error.message}`);
    }
    return data as Service[];
};

/**
 * Deletes a service and its associated attendance logs.
 */
export const deleteService = async (serviceId: string): Promise<void> => {
    await supabase.from('attendance_log').delete().eq('event_id', serviceId).eq('event_type', 'service');
    const { error } = await supabase.from('services').delete().eq('id', serviceId);
    if (error) {
        throw new Error(`Failed to delete service: ${error.message}`);
    }
};

/**
 * Fetches assignments (roster) for a specific service.
 */
export const getServiceAssignments = async (serviceId: string): Promise<ServiceAssignment[]> => {
    if (isTableMarkedMissing('service_assignments')) {
        return [];
    }

    const { data, error } = await supabase
        .from('service_assignments')
        .select('*, member:members(id, first_name, surname, profile_picture_url)')
        .eq('service_id', serviceId);

    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
            console.warn('service_assignments table not found - returning empty assignments');
            return [];
        }
        throw new Error(`Failed to fetch service assignments: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches a single service by ID.
 */
export const getServiceById = async (id: string): Promise<Service> => {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        throw new Error(`Failed to fetch service with ID ${id}: ${error.message}`);
    }
    return data as Service;
};

/**
 * Fetches services by IDs.
 */
export const getServicesByIds = async (ids: string[]): Promise<Service[]> => {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .in('id', ids);

    if (error) {
        throw new Error(`Failed to fetch services: ${error.message}`);
    }
    return data as Service[];
};

/**
 * Fetches service assignments for a member.
 */
export const getServiceAssignmentsByMember = async (memberId: string) => {
    if (isTableMarkedMissing('service_assignments')) {
        return [];
    }

    const { data, error } = await supabase
        .from('service_assignments')
        .select('*, service:services(*)')
        .eq('member_id', memberId);

    if (error) {
        // Table may not exist yet - gracefully return empty
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
            console.warn('service_assignments table not found - skipping');
            return [];
        }
        throw new Error(`Failed to fetch service assignments for member: ${error.message}`);
    }
    return data || [];
};

/**
 * Upserts a service record.
 */
export const upsertService = async (serviceData: any) => {
    const { data, error } = await supabase
        .from('services')
        .upsert(serviceData)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save service: ${error.message}`);
    }
    return data;
};

/**
 * Deletes service assignments by service ID.
 */
export const deleteServiceAssignments = async (serviceId: string) => {
    if (isTableMarkedMissing('service_assignments')) {
        return;
    }

    const { error } = await supabase
        .from('service_assignments')
        .delete()
        .eq('service_id', serviceId);

    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
            console.warn('service_assignments table not found - skipping delete');
            return;
        }
        throw new Error(`Failed to delete service assignments: ${error.message}`);
    }
};

/**
 * Creates multiple service assignments.
 */
export const createServiceAssignments = async (assignments: any[]) => {
    if (assignments.length === 0) return;
    if (isTableMarkedMissing('service_assignments')) return;

    const { error } = await supabase
        .from('service_assignments')
        .insert(assignments);

    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
            console.warn('service_assignments table not found - skipping insert');
            return;
        }
        throw new Error(`Failed to create service assignments: ${error.message}`);
    }
};

/**
 * Creates attendance logs.
 */
export const createAttendanceLogs = async (logs: any[]) => {
    if (logs.length === 0) return;
    const { error } = await supabase
        .from('attendance_log')
        .insert(logs);

    if (error) {
        throw new Error(`Failed to create attendance logs: ${error.message}`);
    }
};

/**
 * Deletes attendance logs for a service.
 */
export const deleteAttendanceLogs = async (eventId: string, eventType: string = 'service') => {
    const { error } = await supabase
        .from('attendance_log')
        .delete()
        .eq('event_id', eventId)
        .eq('event_type', eventType);

    if (error) {
        throw new Error(`Failed to delete attendance logs: ${error.message}`);
    }
};

/**
 * Gets attendance logs for an event.
 */
export const getAttendanceLogsByEvent = async (eventId: string, eventType: string = 'service') => {
    const { data, error } = await supabase
        .from('attendance_log')
        .select('*')
        .eq('event_id', eventId)
        .eq('event_type', eventType);

    if (error) {
        throw new Error(`Failed to fetch attendance logs: ${error.message}`);
    }
    return data || [];
};
