import { supabase } from "../lib/supabase";
import type { AttendanceLog } from "../types";

export interface PracticeSession {
    id: string;
    practice_type: string;
    practice_date: string;
    practice_start_time?: string | null;
    practice_end_time?: string | null;
    members_present: number;
    non_member_attendance?: number;
    created_at: string;
}

/**
 * Fetches all music practice sessions.
 */
export const getMusicSessions = async (): Promise<PracticeSession[]> => {
    const { data, error } = await supabase
        .from('music_practice_sessions')
        .select('*')
        .order('practice_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch music sessions: ${error.message}`);
    }
    return data as PracticeSession[];
};

/**
 * Fetches a single music session by ID.
 */
export const getMusicSessionById = async (id: string): Promise<PracticeSession> => {
    const { data, error } = await supabase
        .from('music_practice_sessions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        throw new Error(`Failed to fetch music session with ID ${id}: ${error.message}`);
    }
    return data as PracticeSession;
};

/**
 * Upserts a music practice session.
 */
export const upsertMusicSession = async (sessionData: Partial<PracticeSession>): Promise<PracticeSession> => {
    const { data, error } = await supabase
        .from('music_practice_sessions')
        .upsert(sessionData as any)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save music session: ${error.message}`);
    }
    return data as PracticeSession;
};

/**
 * Deletes a music session and its logs.
 */
export const deleteMusicSession = async (sessionId: string): Promise<void> => {
    await supabase.from('attendance_log').delete().eq('event_id', sessionId).eq('event_type', 'music_practice');

    const { error } = await supabase.from('music_practice_sessions').delete().eq('id', sessionId);
    if (error) {
        throw new Error(`Failed to delete music session: ${error.message}`);
    }
};

/**
 * Fetches attendance logs for a music session.
 */
export const getMusicSessionAttendanceLogs = async (sessionId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('attendance_log')
        .select('member_id')
        .eq('event_id', sessionId)
        .eq('event_type', 'music_practice');

    if (error) {
        throw new Error(`Failed to fetch music session attendance: ${error.message}`);
    }
    return (data || []).map(d => d.member_id);
};

/**
 * Updates attendance logs for a music session.
 */
export const updateMusicSessionAttendanceLogs = async (sessionId: string, date: string, memberIds: string[]): Promise<void> => {
    await supabase.from('attendance_log')
        .delete()
        .eq('event_id', sessionId)
        .eq('event_type', 'music_practice');

    if (memberIds.length > 0) {
        const logs = memberIds.map(mid => ({
            member_id: mid,
            event_type: 'music_practice',
            event_id: sessionId,
            event_date: date,
            was_present: true
        }));
        const { error } = await supabase.from('attendance_log').insert(logs);
        if (error) {
            throw new Error(`Failed to save music session attendance: ${error.message}`);
        }
    }
};

/**
 * Fetches music ministry assignments.
 */
export const getMusicMinistryAssignments = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('church_positions')
        .select('member_id, department, position_name')
        .eq('position_category', 'music_ministry')
        .eq('is_active', true);

    if (error) {
        throw new Error(`Failed to fetch music assignments: ${error.message}`);
    }
    return data || [];
};
