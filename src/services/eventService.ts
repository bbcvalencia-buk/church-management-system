import { supabase } from "../lib/supabase";
import type { ChurchEvent } from "../types";

/**
 * Fetches all church events.
 */
export const getChurchEvents = async (): Promise<ChurchEvent[]> => {
    const { data, error } = await supabase
        .from('church_events')
        .select('*')
        .order('event_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch church events: ${error.message}`);
    }
    return data as ChurchEvent[];
};

/**
 * Upserts a church event.
 */
export const upsertChurchEvent = async (eventData: Partial<ChurchEvent>): Promise<ChurchEvent> => {
    const { data, error } = await supabase
        .from('church_events')
        .upsert(eventData as any)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save church event: ${error.message}`);
    }
    return data as ChurchEvent;
};

/**
 * Deletes a church event and its logs.
 */
export const deleteChurchEvent = async (eventId: string): Promise<void> => {
    await supabase.from('attendance_log').delete().eq('event_id', eventId).eq('event_type', 'church_event');

    const { error } = await supabase.from('church_events').delete().eq('id', eventId);
    if (error) {
        throw new Error(`Failed to delete church event: ${error.message}`);
    }
};

/**
 * Fetches attendance logs for a church event.
 */
export const getChurchEventAttendanceLogs = async (eventId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('attendance_log')
        .select('member_id')
        .eq('event_id', eventId)
        .eq('event_type', 'church_event');

    if (error) {
        throw new Error(`Failed to fetch church event attendance: ${error.message}`);
    }
    return (data || []).map(d => d.member_id);
};

/**
 * Updates attendance logs for a church event.
 */
export const updateChurchEventAttendanceLogs = async (eventId: string, date: string, memberIds: string[]): Promise<void> => {
    await supabase.from('attendance_log')
        .delete()
        .eq('event_id', eventId)
        .eq('event_type', 'church_event');

    if (memberIds.length > 0) {
        const logs = memberIds.map(mid => ({
            member_id: mid,
            event_type: 'church_event',
            event_id: eventId,
            event_date: date,
            was_present: true
        }));
        const { error } = await supabase.from('attendance_log').insert(logs);
        if (error) {
            throw new Error(`Failed to save church event attendance: ${error.message}`);
        }
    }
};
