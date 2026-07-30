import { supabase } from "../lib/supabase";
import type { AttendanceLog } from "../types";
import { isMissingTableError, isTableMarkedMissing, markTableMissing } from "./supabaseErrorUtils";

export const getMemberAttendanceLogs = async (memberId: string): Promise<AttendanceLog[]> => {
    const { data, error } = await supabase.from("attendance_log").select("*").eq("member_id", memberId);
    if (error) throw new Error(`Failed to fetch attendance logs for member ${memberId}: ${error.message}`);
    return data as AttendanceLog[];
};
export const getServiceAssignmentCounts = async (): Promise<Record<string, number>> => {
    if (isTableMarkedMissing('service_assignments')) return {};
    const { data, error } = await supabase.from('service_assignments').select('member_id');
    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
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
export const getMemberAttendanceRates = async (): Promise<Record<string, { count: number, rate: string, total: number }>> => {
    const { count: totalServices, error: err1 } = await supabase.from('services').select('id', { count: 'exact', head: true });
    if (err1) throw new Error(`Failed to get total services count: ${err1.message}`);
    if (!totalServices) return {};
    const { data: attendanceData, error: err2 } = await supabase.from('attendance_log').select('member_id').eq('event_type', 'service').eq('was_present', true);
    if (err2) throw new Error(`Failed to get attendance data: ${err2.message}`);
    const counts: Record<string, number> = {};
    if (attendanceData) {
        for (const row of attendanceData) counts[row.member_id] = (counts[row.member_id] || 0) + 1;
    }
    const rates: Record<string, { count: number, rate: string, total: number }> = {};
    for (const [memberId, count] of Object.entries(counts)) {
        rates[memberId] = { count, total: totalServices, rate: `${Math.round((count / totalServices) * 100)}%` };
    }
    return rates;
};
export const getMemberServiceHistory = async (memberId: string, limit: number = 5): Promise<any[]> => {
    if (isTableMarkedMissing('service_assignments')) return [];
    const { data, error } = await supabase.from('service_assignments').select(`id, role, notes, services (id, service_date, service_type)`).eq('member_id', memberId).order('created_at', { ascending: false }).limit(limit);
    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing('service_assignments');
            return [];
        }
        console.error(`Failed to fetch service history for member ${memberId}:`, error);
        return [];
    }
    return (data || []).sort((a: any, b: any) => {
        const dateA = new Date(a.services?.service_date || 0).getTime();
        const dateB = new Date(b.services?.service_date || 0).getTime();
        return dateB - dateA;
    });
};
