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

/**
 * Fetches the attendance rate for each member per music practice type.
 * Returns a nested object: Record<memberId, Record<practiceType, { count: number, rate: string, total: number }>>
 */
export const getMusicPracticeAttendanceRates = async (): Promise<Record<string, Record<string, { count: number, rate: string, total: number }>>> => {
    // 1. Get all practice sessions to count total per type
    const { data: allSessions, error: err1 } = await supabase.from('music_practice_sessions').select('id, practice_type');

    if (err1) {
        throw new Error(`Failed to get practice sessions: ${err1.message}`);
    }

    if (!allSessions || allSessions.length === 0) return {};

    const totalsByType: Record<string, number> = {};
    const sessionTypeMap: Record<string, string> = {};
    for (const session of allSessions) {
        const type = session.practice_type || 'unknown';
        totalsByType[type] = (totalsByType[type] || 0) + 1;
        sessionTypeMap[session.id] = type;
    }

    // 2. Get all attendance
    const { data: attendanceData, error: err2 } = await supabase
        .from('attendance_log')
        .select('member_id, event_id')
        .eq('event_type', 'music_practice')
        .eq('was_present', true);

    if (err2) {
        throw new Error(`Failed to get attendance data: ${err2.message}`);
    }

    // 3. Count attendances per member per type
    // memberId -> type -> count
    const memberCounts: Record<string, Record<string, number>> = {};
    if (attendanceData) {
        for (const row of attendanceData) {
            const type = sessionTypeMap[row.event_id];
            if (!type) continue;

            if (!memberCounts[row.member_id]) {
                memberCounts[row.member_id] = {};
            }
            memberCounts[row.member_id][type] = (memberCounts[row.member_id][type] || 0) + 1;
        }
    }

    // 4. Calculate final rates
    const rates: Record<string, Record<string, { count: number, rate: string, total: number }>> = {};
    Object.keys(memberCounts).forEach(memberId => {
        rates[memberId] = {};
        for (const [type, count] of Object.entries(memberCounts[memberId])) {
            const total = totalsByType[type] || 1;
            const rate = Math.round((count / total) * 100);
            rates[memberId][type] = {
                count,
                total,
                rate: `${rate}%`
            };
        }
    });

    return rates;
};

/**
 * Fetches the recent music practice attendance history for a single member.
 */
export const getMemberMusicPracticeHistory = async (memberId: string, limit = 5): Promise<any[]> => {
    // 1. Get member's music ministries and attended sessions
    const [{ data: positions, error: posErr }, { data: attendanceLogs, error: attErr }] = await Promise.all([
        supabase
            .from('church_positions')
            .select('department')
            .eq('member_id', memberId)
            .eq('position_category', 'music_ministry')
            .eq('is_active', true),
        supabase
            .from('attendance_log')
            .select('event_id')
            .eq('event_type', 'music_practice')
            .eq('member_id', memberId)
            .eq('was_present', true)
    ]);

    if (posErr) throw new Error(`Failed to fetch positions: ${posErr.message}`);
    if (attErr) throw new Error(`Failed to fetch practice attendance: ${attErr.message}`);

    const attendedSessionIds = new Set(attendanceLogs?.map(log => log.event_id) || []);
    const keywords = (positions || []).map(p => (p.department || '').toLowerCase());

    // 2. Fetch practice sessions
    const { data: sessions, error: sessErr } = await supabase
        .from('music_practice_sessions')
        .select('id, practice_date, practice_type')
        .order('practice_date', { ascending: false })
        .limit(100);

    if (sessErr) throw new Error(`Failed to fetch recent practice sessions: ${sessErr.message}`);
    if (!sessions) return [];

    // Filter sessions to only those relevant to the member
    const relevantSessions = sessions.filter(session => {
        // Always show if explicitly attended
        if (attendedSessionIds.has(session.id)) return true;

        // Otherwise, show if it matches their assigned ministry departments
        const type = String(session.practice_type || '').toLowerCase();
        return keywords.some(k => k.includes(type) || type.includes(k));
    });

    return relevantSessions.slice(0, limit).map(session => ({
        id: session.id,
        date: session.practice_date,
        name: session.practice_type,
        present: attendedSessionIds.has(session.id)
    }));
};
