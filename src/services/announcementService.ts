import { supabase } from "../lib/supabase";
import { isMissingTableError, isTableMarkedMissing, markTableMissing } from "./supabaseErrorUtils";

/**
 * Fetches data for the announcements page.
 */
export const getAnnouncementData = async (limit: number = 60) => {
    const churchEventsPromise = isTableMarkedMissing('church_events')
        ? Promise.resolve({ data: [], error: null } as any)
        : supabase
            .from("church_events")
            .select("id, event_name, event_type, event_date, total_attendance")
            .order("event_date", { ascending: false })
            .limit(limit)
            .then((result) => {
                if (result.error && isMissingTableError(result.error)) {
                    markTableMissing('church_events');
                    return { data: [], error: null } as any;
                }
                return result;
            });

    return await Promise.all([
        supabase
            .from("services")
            .select("id, service_type, service_date, total_attendance, visitors_present, souls_saved, prospects_for_baptism, members_who_prayed")
            .order("service_date", { ascending: false })
            .limit(limit),
        supabase
            .from("sunday_school_sessions")
            .select("id, department, session_date, total_attendance, visitors_present, souls_saved")
            .order("session_date", { ascending: false })
            .limit(limit),
        supabase
            .from("activities")
            .select("id, activity_type, activity_date, area, total_attendance, non_member_attendance, souls_saved")
            .order("activity_date", { ascending: false })
            .limit(limit),
        churchEventsPromise,
        supabase
            .from("members")
            .select("id, first_name, surname, date_of_birth")
            .eq("membership_status", "active")
    ]);
};
