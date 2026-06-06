import { supabase } from "../lib/supabase";
import type { SundaySchoolSession, AttendanceLog } from "../types";

/**
 * Fetches Sunday School sessions, filtered by department if needed.
 */
export const getSundaySchoolSessions = async (managedDepartmentIds: string[], isAdmin: boolean): Promise<SundaySchoolSession[]> => {
    let query = supabase
        .from('sunday_school_sessions')
        .select('*')
        .order('session_date', { ascending: false })
        .limit(100);

    if (!isAdmin && managedDepartmentIds.length > 0) {
        query = query.in('department', managedDepartmentIds as any);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch Sunday School sessions: ${error.message}`);
    }
    return data as SundaySchoolSession[];
};

/**
 * Fetches a single session by ID.
 */
export const getSundaySchoolSessionById = async (id: string): Promise<SundaySchoolSession> => {
    const { data, error } = await supabase
        .from('sunday_school_sessions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        throw new Error(`Failed to fetch Sunday School session with ID ${id}: ${error.message}`);
    }
    return data as SundaySchoolSession;
};

/**
 * Upserts a Sunday School session.
 */
export const upsertSundaySchoolSession = async (sessionData: Partial<SundaySchoolSession>): Promise<SundaySchoolSession> => {
    const { data, error } = await supabase
        .from('sunday_school_sessions')
        .upsert(sessionData as any)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save Sunday School session: ${error.message}`);
    }
    return data as SundaySchoolSession;
};

/**
 * Deletes a session and its associated logs.
 */
export const deleteSundaySchoolSession = async (sessionId: string): Promise<void> => {
    await supabase.from('attendance_log').delete().eq('event_id', sessionId).eq('event_type', 'sunday_school');

    const { error } = await supabase.from('sunday_school_sessions').delete().eq('id', sessionId);
    if (error) {
        throw new Error(`Failed to delete Sunday School session: ${error.message}`);
    }
};

/**
 * Fetches attendance logs for a Sunday School session.
 */
export const getSundaySchoolAttendanceLogs = async (sessionId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('attendance_log')
        .select('member_id')
        .eq('event_id', sessionId)
        .eq('event_type', 'sunday_school');

    if (error) {
        throw new Error(`Failed to fetch attendance logs: ${error.message}`);
    }
    return (data || []).map(d => d.member_id);
};

/**
 * Updates attendance logs for a Sunday School session.
 * Now accepts optional assessment scores per member.
 */
export const updateSundaySchoolAttendanceLogs = async (
    sessionId: string,
    date: string,
    memberIds: string[],
    assessmentScores?: Record<string, number | null>,
    tardyIds: string[] = []
): Promise<void> => {
    await supabase.from('attendance_log')
        .delete()
        .eq('event_id', sessionId)
        .eq('event_type', 'sunday_school');

    if (memberIds.length > 0) {
        const logs = memberIds.map(mid => ({
            member_id: mid,
            event_type: 'sunday_school',
            event_id: sessionId,
            event_date: date,
            was_present: true,
            was_tardy: tardyIds.includes(mid),
            assessment_score: assessmentScores?.[mid] ?? null
        }));
        const { error } = await supabase.from('attendance_log').insert(logs);
        if (error) {
            throw new Error(`Failed to save attendance logs: ${error.message}`);
        }
    }
};

/**
 * Fetches teacher assignments for a member.
 */
export const getTeacherAssignments = async (memberId: string, categories: string[]): Promise<any[]> => {
    const { data, error } = await supabase
        .from("church_positions")
        .select("position_category, department, position_name, specific_role, is_ministry_head")
        .eq("member_id", memberId)
        .eq("is_active", true)
        .in("position_category", categories);

    if (error) {
        throw new Error(`Failed to fetch teacher assignments: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches all student assignments in Sunday School.
 */
export const getSundaySchoolStudentAssignments = async (categories: string[]): Promise<any[]> => {
    const { data, error } = await supabase
        .from("church_positions")
        .select("member_id, position_category, department, position_name, specific_role, is_ministry_head")
        .eq("is_active", true)
        .in("position_category", categories);

    if (error) {
        throw new Error(`Failed to fetch student assignments: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches Sunday School sessions by a list of IDs.
 */
export const getSundaySchoolSessionsByIds = async (ids: string[]): Promise<SundaySchoolSession[]> => {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
        .from("sunday_school_sessions")
        .select("id, session_date, department")
        .in("id", ids);

    if (error) {
        throw new Error(`Failed to fetch Sunday School sessions: ${error.message}`);
    }
    return data as SundaySchoolSession[];
};

/**
 * Fetches attendance logs for a session.
 */
export const getAttendanceLogs = async (eventId: string, eventType: string): Promise<any[]> => {
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

/**
 * Deletes attendance logs for a session.
 */
export const deleteAttendanceLogs = async (eventId: string, eventType: string): Promise<void> => {
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
 * Fetches visitors by Sunday School session ID.
 */
export const getVisitorsBySessionId = async (sessionId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('sunday_school_session_id', sessionId);

    if (error) {
        throw new Error(`Failed to fetch visitors by session: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches visitors by member IDs.
 */
export const getVisitorsByMemberIds = async (memberIds: string[]): Promise<any[]> => {
    if (memberIds.length === 0) return [];
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .in('member_id', memberIds);

    if (error) {
        throw new Error(`Failed to fetch visitors by member IDs: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches a visitor by ID.
 */
export const getVisitorById = async (id: string): Promise<any> => {
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        throw new Error(`Failed to fetch visitor: ${error.message}`);
    }
    return data;
};

/**
 * Updates a visitor.
 */
export const updateVisitor = async (visitorData: any): Promise<void> => {
    const { error } = await supabase
        .from('visitors')
        .update(visitorData)
        .eq('id', visitorData.id);

    if (error) {
        throw new Error(`Failed to update visitor: ${error.message}`);
    }
};

/**
 * Creates a visitor.
 */
export const createVisitor = async (visitorData: any): Promise<void> => {
    const { error } = await supabase
        .from('visitors')
        .insert(visitorData);

    if (error) {
        throw new Error(`Failed to create visitor: ${error.message}`);
    }
};

/**
 * Fetches attendance logs for sessions on a specific date and department.
 * Returns an array of { member_id, event_id, assessment_score } for that session/date.
 */
export const getAttendanceLogsBySessionIds = async (sessionIds: string[]): Promise<{ member_id: string; event_id: string; assessment_score?: number | null; was_tardy?: boolean }[]> => {
    if (sessionIds.length === 0) return [];
    const { data, error } = await supabase
        .from('attendance_log')
        .select('member_id, event_id, assessment_score, was_tardy')
        .in('event_id', sessionIds)
        .eq('event_type', 'sunday_school')
        .eq('was_present', true);

    if (error) {
        throw new Error(`Failed to fetch attendance logs by session IDs: ${error.message}`);
    }
    return (data || []) as { member_id: string; event_id: string; assessment_score?: number | null; was_tardy?: boolean }[];
};

/**
 * Fetches attendance counts per member for a department.
 * Returns a map of member_id -> number of sessions attended.
 */
export const getAttendanceCountsByDepartment = async (department: string): Promise<Record<string, number>> => {
    // First get all session IDs for this department
    const { data: sessions, error: sessionsError } = await supabase
        .from('sunday_school_sessions')
        .select('id')
        .eq('department', department);

    if (sessionsError) {
        throw new Error(`Failed to fetch sessions for department: ${sessionsError.message}`);
    }

    const sessionIds = (sessions || []).map((s: any) => s.id);
    if (sessionIds.length === 0) return {};

    // Then get all attendance logs for these sessions
    const { data: logs, error: logsError } = await supabase
        .from('attendance_log')
        .select('member_id')
        .in('event_id', sessionIds)
        .eq('event_type', 'sunday_school')
        .eq('was_present', true);

    if (logsError) {
        throw new Error(`Failed to fetch attendance counts: ${logsError.message}`);
    }

    const counts: Record<string, number> = {};
    for (const log of (logs || [])) {
        counts[log.member_id] = (counts[log.member_id] || 0) + 1;
    }
    return counts;
};

/**
 * Fetches assessment score stats per member for a department.
 * Returns a map of member_id -> { totalScore, submissionCount }.
 */
export const getAssessmentScoresByDepartment = async (department: string): Promise<Record<string, { totalScore: number; submissionCount: number }>> => {
    const { data: sessions, error: sessionsError } = await supabase
        .from('sunday_school_sessions')
        .select('id')
        .eq('department', department);

    if (sessionsError) {
        throw new Error(`Failed to fetch sessions for department: ${sessionsError.message}`);
    }

    const sessionIds = (sessions || []).map((s: any) => s.id);
    if (sessionIds.length === 0) return {};

    const { data: logs, error: logsError } = await supabase
        .from('attendance_log')
        .select('member_id, assessment_score')
        .in('event_id', sessionIds)
        .eq('event_type', 'sunday_school')
        .eq('was_present', true);

    if (logsError) {
        throw new Error(`Failed to fetch assessment scores: ${logsError.message}`);
    }

    const stats: Record<string, { totalScore: number; submissionCount: number }> = {};
    for (const log of (logs || [])) {
        if (!stats[log.member_id]) {
            stats[log.member_id] = { totalScore: 0, submissionCount: 0 };
        }
        if (log.assessment_score != null && log.assessment_score > 0) {
            stats[log.member_id].totalScore += log.assessment_score;
            stats[log.member_id].submissionCount += 1;
        }
    }
    return stats;
};

/**
 * Updates session (partial).
 */
export const updateSundaySchoolSession = async (id: string, updates: any): Promise<void> => {
    const { error } = await supabase
        .from('sunday_school_sessions')
        .update(updates)
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update session: ${error.message}`);
    }
};
