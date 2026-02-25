import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toISODateLocal } from "@/lib/date";
import { Bell, Calendar, BookOpen, Activity, Users, Heart, UserPlus } from "lucide-react";

type AnnouncementSource = "service" | "sunday_school" | "activity";

interface AnnouncementItem {
    id: string;
    source: AnnouncementSource;
    date: string;
    title: string;
    subtitle: string;
    attendance?: number;
    visitors?: number;
    soulsSaved?: number;
    extra?: string[];
}

interface BirthdayItem {
    id: string;
    first_name: string;
    surname: string;
    nextBirthday: string;
    daysAway: number;
}

const SERVICE_LABELS: Record<string, string> = {
    sunday_morning: "Sunday Morning Service",
    sunday_afternoon: "Sunday Afternoon Service",
    wednesday_prayer: "Wednesday Prayer Meeting",
    pre_service: "Pre-Service",
    funeral: "Funeral Service"
};

const DEPARTMENT_LABELS: Record<string, string> = {
    adult: "Adult Department",
    beginners: "Beginners Department",
    nursery: "Nursery/Toddler Department",
   kinder: "Kindergarten Department",
   primary: "Primary Department",
    junior: "Junior Department"
};

const ACTIVITY_LABELS: Record<string, string> = {
    goodnews_class: "Good News Class",
    soul_winning: "Soul Winning",
    bible_study: "Bible Study",
    outreach: "Outreach"
};

const CHILDREN_DEPARTMENTS = new Set(["junior", "nursery", "kinder", "primary"]);
const PRIMARY_SERVICE_TYPES = new Set(["sunday_morning", "sunday_afternoon", "wednesday_prayer"]);
const isPrimaryServiceType = (serviceType?: string) => PRIMARY_SERVICE_TYPES.has(serviceType || "");

const formatLabel = (value: string) =>
    value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const SOURCE_META: Record<AnnouncementSource, { label: string; icon: React.ElementType; color: string }> = {
    service: { label: "Service", icon: Calendar, color: "bg-blue-100 text-blue-600" },
    sunday_school: { label: "Sunday School", icon: BookOpen, color: "bg-emerald-100 text-emerald-600" },
    activity: { label: "Activity", icon: Activity, color: "bg-purple-100 text-purple-600" }
};

const sumNumberField = (rows: any[], fieldName: string) =>
    rows.reduce((sum, row) => sum + (Number(row?.[fieldName]) || 0), 0);

const Announcements: React.FC = () => {
    const [items, setItems] = useState<AnnouncementItem[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [sundaySchoolSessions, setSundaySchoolSessions] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            setLoading(true);
            setSourceWarnings([]);

            const [servicesResult, sundaySchoolResult, activitiesResult, birthdaysResult] = await Promise.all([
                supabase
                    .from("services")
                    .select("id, service_type, service_date, total_attendance, visitors_present, souls_saved, prospects_for_baptism, members_who_prayed")
                    .order("service_date", { ascending: false })
                    .limit(60),
                supabase
                    .from("sunday_school_sessions")
                    .select("id, department, session_date, total_attendance, visitors_present, souls_saved")
                    .order("session_date", { ascending: false })
                    .limit(60),
                supabase
                    .from("activities")
                    .select("id, activity_type, activity_date, area, total_attendance, non_member_attendance, souls_saved")
                    .order("activity_date", { ascending: false })
                    .limit(60),
                supabase
                    .from("members")
                    .select("id, first_name, surname, date_of_birth")
                    .eq("membership_status", "active")
            ]);

            const nextWarnings: string[] = [];

            const serviceRows = servicesResult.error ? [] : (servicesResult.data || []);
            if (servicesResult.error) nextWarnings.push("Service results are not available for your account.");

            const sundaySchoolRows = sundaySchoolResult.error ? [] : (sundaySchoolResult.data || []);
            if (sundaySchoolResult.error) nextWarnings.push("Sunday School results are not available for your account.");

            const activityRows = activitiesResult.error ? [] : (activitiesResult.data || []);
            if (activitiesResult.error) nextWarnings.push("Activity results are not available for your account.");

            const serviceItems: AnnouncementItem[] = serviceRows.map((row: any) => {
                const isPrimaryService = isPrimaryServiceType(row.service_type);
                return {
                    id: `service-${row.id}`,
                    source: "service",
                    date: row.service_date,
                    title: SERVICE_LABELS[row.service_type] || formatLabel(row.service_type || "Service"),
                    subtitle: "Service report submitted",
                    attendance: row.total_attendance || 0,
                    visitors: isPrimaryService ? (row.visitors_present || 0) : 0,
                    soulsSaved: isPrimaryService ? (row.souls_saved || 0) : 0,
                    extra: [
                        `Members who prayed: ${row.members_who_prayed || 0}`,
                        `Prospects for baptism: ${row.prospects_for_baptism || 0}`
                    ]
                };
            });

            const sundaySchoolItems: AnnouncementItem[] = sundaySchoolRows.map((row: any) => {
                const isChildrenDepartment = CHILDREN_DEPARTMENTS.has(row.department);
                return {
                    id: `sunday-${row.id}`,
                    source: "sunday_school",
                    date: row.session_date,
                    title: DEPARTMENT_LABELS[row.department] || formatLabel(row.department || "Department"),
                    subtitle: "Sunday School report submitted",
                    attendance: row.total_attendance || 0,
                    visitors: isChildrenDepartment ? (row.visitors_present || 0) : 0,
                    soulsSaved: isChildrenDepartment ? (row.souls_saved || 0) : 0
                };
            });

            const activityItems: AnnouncementItem[] = activityRows.map((row: any) => ({
                id: `activity-${row.id}`,
                source: "activity",
                date: row.activity_date,
                title: ACTIVITY_LABELS[row.activity_type] || formatLabel(row.activity_type || "Activity"),
                subtitle: row.area ? `Activity report (${row.area})` : "Activity report submitted",
                attendance: row.total_attendance || 0,
                visitors: 0,
                soulsSaved: 0
            }));

            const merged = [...serviceItems, ...sundaySchoolItems, ...activityItems].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let birthdayRows: BirthdayItem[] = [];
            if (birthdaysResult.error) {
                nextWarnings.push("Upcoming birthdays are not available for your account.");
            } else {
                birthdayRows = (birthdaysResult.data || [])
                    .map((row: any) => {
                        const birthDate = new Date(row.date_of_birth);
                        if (Number.isNaN(birthDate.getTime())) return null;

                        const nextBirthdayDate = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                        if (nextBirthdayDate < today) {
                            nextBirthdayDate.setFullYear(nextBirthdayDate.getFullYear() + 1);
                        }

                        const daysAway = Math.round((nextBirthdayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysAway < 0 || daysAway > 30) return null;

                        return {
                            id: row.id,
                            first_name: row.first_name,
                            surname: row.surname,
                            nextBirthday: toISODateLocal(nextBirthdayDate),
                            daysAway
                        };
                    })
                    .filter((row: BirthdayItem | null): row is BirthdayItem => row !== null)
                    .sort((a, b) => a.nextBirthday.localeCompare(b.nextBirthday))
                    .slice(0, 8);
            }

            setServices(serviceRows);
            setSundaySchoolSessions(sundaySchoolRows);
            setActivities(activityRows);
            setUpcomingBirthdays(birthdayRows);
            setItems(merged);
            setSourceWarnings(nextWarnings);
            setLoading(false);
        };

        fetchAnnouncements();
    }, []);

    const summary = useMemo(() => {
        const primaryServices = services.filter((row) => isPrimaryServiceType(row.service_type));
        const childrenSundaySchoolSessions = sundaySchoolSessions.filter((row) =>
            CHILDREN_DEPARTMENTS.has(row.department)
        );

        const sundayMorningServiceAttendance = services
            .filter((row) => row.service_type === "sunday_morning")
            .reduce((sum, row) => sum + (Number(row.total_attendance) || 0), 0);

        const sundayMorningChildrenAttendance = sundaySchoolSessions
            .filter((row) => CHILDREN_DEPARTMENTS.has(row.department))
            .reduce((sum, row) => sum + (Number(row.total_attendance) || 0), 0);

        const sundayMorningAttendance = sundayMorningServiceAttendance + sundayMorningChildrenAttendance;

        const sundayAfternoonAttendance = services
            .filter((row) => row.service_type === "sunday_afternoon")
            .reduce((sum, row) => sum + (Number(row.total_attendance) || 0), 0);

        const wednesdayPrayerAttendance = services
            .filter((row) => row.service_type === "wednesday_prayer")
            .reduce((sum, row) => sum + (Number(row.total_attendance) || 0), 0);

        const primaryServiceAttendanceTotal =
            sundayMorningAttendance +
            sundayAfternoonAttendance +
            wednesdayPrayerAttendance;

        const totalVisitors =
            sumNumberField(primaryServices, "visitors_present") +
            sumNumberField(childrenSundaySchoolSessions, "visitors_present");

        const totalSoulsSaved =
            sumNumberField(primaryServices, "souls_saved") +
            sumNumberField(childrenSundaySchoolSessions, "souls_saved");

        return {
            sundayMorningAttendance,
            sundayAfternoonAttendance,
            wednesdayPrayerAttendance,
            primaryServiceAttendanceTotal,
            totalVisitors,
            totalSoulsSaved
        };
    }, [services, sundaySchoolSessions, activities]);

    return (
        <div className="space-y-6 p-6 lg:p-8">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Bell size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
                        <p className="text-sm text-gray-500">
                            Services, Sunday School, Activities, and upcoming birthdays.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
                    <SummaryTile
                        label="Sunday Morning (Service + Children Dep)"
                        value={summary.sundayMorningAttendance}
                    />
                    <SummaryTile
                        label="Sunday Afternoon Service"
                        value={summary.sundayAfternoonAttendance}
                    />
                    <SummaryTile
                        label="Wednesday Prayer Meeting"
                        value={summary.wednesdayPrayerAttendance}
                    />
                    <SummaryTile
                        label="Primary Services Total Attendance"
                        value={summary.primaryServiceAttendanceTotal}
                    />
                    <SummaryTile
                        label="Visitors / Guests (Primary Services + Children Dept)"
                        value={summary.totalVisitors}
                    />
                    <SummaryTile
                        label="Souls Saved (Primary Services + Children Dept)"
                        value={summary.totalSoulsSaved}
                    />
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-gray-900">Upcoming Birthdays</h2>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next 30 days</p>
                </div>

                {loading ? (
                    <div className="p-6 text-center text-gray-500">Loading birthdays...</div>
                ) : upcomingBirthdays.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No upcoming birthdays in the next 30 days.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {upcomingBirthdays.map((birthday) => (
                            <div key={birthday.id} className="px-6 py-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                                        <Calendar size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">
                                            {birthday.first_name} {birthday.surname}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(`${birthday.nextBirthday}T00:00:00`).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric"
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs font-semibold text-gray-600">
                                    {birthday.daysAway === 0 ? "Today" : `In ${birthday.daysAway} day${birthday.daysAway === 1 ? "" : "s"}`}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {sourceWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm font-medium space-y-1">
                    {sourceWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                    ))}
                </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Recent Result Announcements</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading announcements...</div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No announcements available for your access level.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {items.map((item) => {
                            const sourceMeta = SOURCE_META[item.source];
                            const Icon = sourceMeta.icon;

                            return (
                                <div key={item.id} className="p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sourceMeta.color}`}>
                                                <Icon size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {new Date(item.date).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric"
                                                    })}{" "}
                                                    | {sourceMeta.label}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 sm:min-w-[280px]">
                                            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wide font-bold text-gray-500 flex items-center gap-1">
                                                    <Users size={11} /> Attendance
                                                </p>
                                                <p className="text-sm font-bold text-gray-900 mt-1">{item.attendance || 0}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wide font-bold text-gray-500 flex items-center gap-1">
                                                    <UserPlus size={11} /> Visitors
                                                </p>
                                                <p className="text-sm font-bold text-gray-900 mt-1">{item.visitors || 0}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wide font-bold text-gray-500 flex items-center gap-1">
                                                    <Heart size={11} /> Saved
                                                </p>
                                                <p className="text-sm font-bold text-gray-900 mt-1">{item.soulsSaved || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {item.extra && item.extra.length > 0 && (
                                        <div className="mt-3 text-xs text-gray-600 space-y-1">
                                            {item.extra.map((line) => (
                                                <p key={line}>{line}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const SummaryTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-xs uppercase tracking-wider font-bold text-gray-500">{label}</p>
        <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
);

export default Announcements;
