import { supabase } from "../lib/supabase";
import type { AttendanceLog } from "../types";

export interface ActivityRecord {
    id: string;
    activity_type: string;
    activity_date: string;
    members_present: number;
    non_member_attendance: number;
    total_attendance: number;
    souls_saved: number;
    kids_attended: number;
    tracts_distributed: number;
    area?: string;
    bible_study_type?: 'individual' | 'family';
    family_name?: string;
    mission_church_name?: string;
    facebook_post_link?: string;
    attachment_url?: string;
    activity_data?: any;
}

/**
 * Fetches all activity records.
 */
export const getActivities = async (): Promise<ActivityRecord[]> => {
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('activity_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch activities: ${error.message}`);
    }
    return data as ActivityRecord[];
};

/**
 * Upserts an activity record.
 */
export const upsertActivity = async (activityData: Partial<ActivityRecord>): Promise<ActivityRecord> => {
    const { data, error } = await supabase
        .from('activities')
        .upsert(activityData as any)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save activity: ${error.message}`);
    }
    return data as ActivityRecord;
};

/**
 * Deletes an activity and its associated attendance logs.
 */
export const deleteActivity = async (activityId: string): Promise<void> => {
    await supabase.from('attendance_log').delete().eq('event_id', activityId).eq('event_type', 'activity');

    const { error } = await supabase.from('activities').delete().eq('id', activityId);
    if (error) {
        throw new Error(`Failed to delete activity: ${error.message}`);
    }
};

/**
 * Fetches attendance logs for an activity.
 */
export const getActivityAttendanceLogs = async (activityId: string): Promise<{ memberIds: string[]; tardyIds: string[] }> => {
    const { data, error } = await supabase
        .from('attendance_log')
        .select('member_id, was_tardy')
        .eq('event_id', activityId)
        .eq('event_type', 'activity');

    if (error) {
        throw new Error(`Failed to fetch activity attendance: ${error.message}`);
    }
    const rows = data || [];
    return {
        memberIds: rows.map(d => d.member_id),
        tardyIds: rows.filter((d: any) => d.was_tardy === true).map(d => d.member_id)
    };
};

/**
 * Updates attendance logs for an activity.
 */
export const updateActivityAttendanceLogs = async (activityId: string, date: string, memberIds: string[], tardyIds: string[] = []): Promise<void> => {
    await supabase.from('attendance_log')
        .delete()
        .eq('event_id', activityId)
        .eq('event_type', 'activity');

    if (memberIds.length > 0) {
        const logs = memberIds.map(mid => ({
            member_id: mid,
            event_type: 'activity',
            event_id: activityId,
            event_date: date,
            was_present: true,
            was_tardy: tardyIds.includes(mid)
        }));
        const { error } = await supabase.from('attendance_log').insert(logs);
        if (error) {
            throw new Error(`Failed to save activity attendance: ${error.message}`);
        }
    }
};
