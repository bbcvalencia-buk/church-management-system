import { supabase } from "../lib/supabase";

/**
 * Fetches Good News class assignments for a specific member.
 */
export const getGoodnewsAssignmentsByMember = async (memberId: string) => {
    const { data, error } = await supabase
        .from('goodnews_session_members')
        .select('*, session:goodnews_sessions(*, series:goodnews_series(*))')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch Good News assignments: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches all Good News series.
 */
export const getGoodnewsSeries = async () => {
    const { data, error } = await supabase
        .from('goodnews_series')
        .select('*, lead_member:lead_member_id(id, first_name, surname)')
        .order('start_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch Good News series: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches sessions for a specific series.
 */
export const getGoodnewsSessionsBySeries = async (seriesId: string) => {
    const { data, error } = await supabase
        .from('goodnews_sessions')
        .select('*, members:goodnews_session_members(member_id, role, notes, member:members(first_name, surname))')
        .eq('series_id', seriesId)
        .order('session_number', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch Good News sessions: ${error.message}`);
    }
    return data || [];
};

/**
 * Upserts a Good News series.
 */
export const upsertGoodnewsSeries = async (seriesData: any) => {
    const { data, error } = await supabase
        .from('goodnews_series')
        .upsert(seriesData)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save Good News series: ${error.message}`);
    }
    return data;
};

/**
 * Upserts a Good News session.
 */
export const upsertGoodnewsSession = async (sessionData: any) => {
    const { data, error } = await supabase
        .from('goodnews_sessions')
        .upsert(sessionData)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save Good News session: ${error.message}`);
    }
    return data;
};

/**
 * Updates members for a Good News session.
 * Handles deletion of old members and insertion of new ones and attendance logs.
 */
export const updateGoodnewsSessionMembers = async (sessionId: string, date: string, memberRoles: any[]) => {
    // Delete old members and attendance
    await supabase.from('goodnews_session_members').delete().eq('session_id', sessionId);
    await supabase.from('attendance_log').delete().eq('event_id', sessionId).eq('event_type', 'goodnews_session');

    if (memberRoles.length > 0) {
        // Insert new members
        const membersPayload = memberRoles.map(m => ({
            session_id: sessionId,
            member_id: m.member_id,
            role: m.role,
            notes: m.notes
        }));
        const { error: mError } = await supabase.from('goodnews_session_members').insert(membersPayload);
        if (mError) throw new Error(`Failed to save session members: ${mError.message}`);

        // Add attendance
        const attendancePayload = memberRoles.map(m => ({
            member_id: m.member_id,
            event_type: 'goodnews_session',
            event_id: sessionId,
            event_date: date,
            was_present: true
        }));
        const { error: aError } = await supabase.from('attendance_log').insert(attendancePayload);
        if (aError) throw new Error(`Failed to save session attendance: ${aError.message}`);
    }
};

/**
 * Deletes a Good News series.
 */
export const deleteGoodnewsSeries = async (seriesId: string) => {
    const { error } = await supabase.from('goodnews_series').delete().eq('id', seriesId);
    if (error) {
        throw new Error(`Failed to delete series: ${error.message}`);
    }
};

/**
 * Deletes a Good News session.
 * Also deletes associated attendance logs.
 */
export const deleteGoodnewsSession = async (sessionId: string) => {
    await supabase.from('attendance_log').delete().eq('event_id', sessionId).eq('event_type', 'goodnews_session');
    const { error } = await supabase.from('goodnews_sessions').delete().eq('id', sessionId);
    if (error) {
        throw new Error(`Failed to delete session: ${error.message}`);
    }
};
