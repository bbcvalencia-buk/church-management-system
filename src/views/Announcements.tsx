import React, { useEffect, useMemo, useState } from "react";
import * as announcementService from "@/services/announcementService";
import { toISODateLocal } from "@/lib/date";
import { Bell, Calendar, BookOpen, Activity, Users, Heart, UserPlus, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";

type AnnouncementSource = "service" | "sunday_school" | "activity" | "church_event" | "goodnews_class";

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
    activity: { label: "Activity", icon: Activity, color: "bg-purple-100 text-purple-600" },
    church_event: { label: "Church Event", icon: Calendar, color: "bg-orange-100 text-orange-600" },
    goodnews_class: { label: "Good News Class", icon: BookOpen, color: "bg-sky-100 text-sky-600" }
};

const sumNumberField = (rows: any[], fieldName: string) =>
    rows.reduce((sum, row) => sum + (Number(row?.[fieldName]) || 0), 0);

/** Collect unique Sunday dates (sorted descending) from services + sunday school */
const collectSundayDates = (services: any[], sundaySchoolSessions: any[]): string[] => {
    const dateSet = new Set<string>();

    services.forEach((row) => {
        if (row.service_type === "sunday_morning" || row.service_type === "sunday_afternoon") {
            dateSet.add(row.service_date);
        }
    });

    sundaySchoolSessions.forEach((row) => {
        dateSet.add(row.session_date);
    });

    // Ensure the upcoming/recent Sunday is always in the list so that users can 
    // preview the activities building up to the upcoming Sunday before service happens.
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    // Calculate the most relevant Sunday (if today is Sunday, today; otherwise, the coming Sunday)
    const daysUntilNextSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
    const nextSundayDate = new Date(today);
    nextSundayDate.setDate(today.getDate() + daysUntilNextSunday);
    const nextSundayStr = nextSundayDate.toISOString().split('T')[0];

    dateSet.add(nextSundayStr);

    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
};

const Announcements: React.FC = () => {
    const [items, setItems] = useState<AnnouncementItem[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [sundaySchoolSessions, setSundaySchoolSessions] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [churchEvents, setChurchEvents] = useState<any[]>([]);
    const [goodnewsSessions, setGoodnewsSessions] = useState<any[]>([]);
    const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayItem[]>([]);
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
    const [selectedSundayIndex, setSelectedSundayIndex] = useState(0);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            setLoading(true);
            setSourceWarnings([]);

            const results = await announcementService.getAnnouncementData(60);

            const [servicesResult, sundaySchoolResult, activitiesResult, churchEventsResult, birthdaysResult, attendanceLogsResult, goodnewsResult] = results as any[];

            const nextWarnings: string[] = [];

            const serviceRows = servicesResult.error ? [] : (servicesResult.data || []);
            if (servicesResult.error) nextWarnings.push("Service results are not available for your account.");

            const sundaySchoolRows = sundaySchoolResult.error ? [] : (sundaySchoolResult.data || []);
            if (sundaySchoolResult.error) nextWarnings.push("Sunday School results are not available for your account.");

            const activityRows = activitiesResult.error ? [] : (activitiesResult.data || []);
            if (activitiesResult.error) nextWarnings.push("Activity results are not available for your account.");

            const churchEventRows = churchEventsResult.error ? [] : (churchEventsResult.data || []);
            if (churchEventsResult.error) nextWarnings.push("Church Event results are not available for your account.");

            const goodnewsRows = goodnewsResult?.error ? [] : (goodnewsResult?.data || []);
            if (goodnewsResult?.error) nextWarnings.push("Goodnews class results are not available for your account.");

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

            const churchEventItems: AnnouncementItem[] = churchEventRows.map((row: any) => ({
                id: `event-${row.id}`,
                source: "church_event",
                date: row.event_date,
                title: row.event_name,
                subtitle: `${row.event_type.charAt(0).toUpperCase() + row.event_type.slice(1)} Event`,
                attendance: row.total_attendance || 0,
                visitors: 0,
                soulsSaved: 0
            }));

            const goodnewsItems: AnnouncementItem[] = goodnewsRows.map((row: any) => ({
                id: `goodnews-${row.id}`,
                source: "goodnews_class",
                date: row.date,
                title: "Goodnews Class",
                subtitle: row.series?.area ? `Session reported (${row.series.area})` : "Session reported",
                attendance: row.children_count || 0,
                visitors: 0,
                soulsSaved: row.souls_saved_count || 0
            }));

            const merged = [...serviceItems, ...sundaySchoolItems, ...activityItems, ...churchEventItems, ...goodnewsItems].sort(
                (a: AnnouncementItem, b: AnnouncementItem) => new Date(b.date).getTime() - new Date(a.date).getTime()
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
                    .sort((a: BirthdayItem, b: BirthdayItem) => a.nextBirthday.localeCompare(b.nextBirthday))
                    .slice(0, 8);
            }

            const logsRows = attendanceLogsResult?.error ? [] : (attendanceLogsResult?.data || []);

            setServices(serviceRows);
            setSundaySchoolSessions(sundaySchoolRows);
            setActivities(activityRows);
            setChurchEvents(churchEventRows);
            setGoodnewsSessions(goodnewsRows);
            setUpcomingBirthdays(birthdayRows);
            setAttendanceLogs(logsRows);
            setItems(merged);
            setSourceWarnings(nextWarnings);
            setLoading(false);
        };

        fetchAnnouncements();
    }, []);

    // Collect unique Sunday dates
    const sundayDates = useMemo(
        () => collectSundayDates(services, sundaySchoolSessions),
        [services, sundaySchoolSessions]
    );

    const selectedSundayDate = sundayDates[selectedSundayIndex] || null;

    // Per-Sunday summary (only the selected Sunday)
    const sundaySummary = useMemo(() => {
        if (!selectedSundayDate) {
            return {
                morningServiceAttendance: 0,
                childrenDeptAttendance: 0,
                sundayMorningTotal: 0,
                afternoonAttendance: 0,
                morningVisitors: 0,
                childrenVisitors: 0,
                totalVisitors: 0,
                morningSoulsSaved: 0,
                childrenSoulsSaved: 0,
                totalSoulsSaved: 0,
                morningMembersWhoPrayed: 0,
                morningProspectsForBaptism: 0,
            };
        }

        // Morning service on this date
        const morningServices = services.filter(
            (row) => row.service_type === "sunday_morning" && row.service_date === selectedSundayDate
        );
        const morningServiceAttendance = sumNumberField(morningServices, "total_attendance");
        const morningVisitors = sumNumberField(morningServices, "visitors_present");
        const morningSoulsSaved = sumNumberField(morningServices, "souls_saved");
        const morningMembersWhoPrayed = sumNumberField(morningServices, "members_who_prayed");
        const morningProspectsForBaptism = sumNumberField(morningServices, "prospects_for_baptism");

        // Children departments on this date
        const childrenSessions = sundaySchoolSessions.filter(
            (row) => CHILDREN_DEPARTMENTS.has(row.department) && row.session_date === selectedSundayDate
        );
        const childrenDeptAttendance = sumNumberField(childrenSessions, "total_attendance");
        const childrenVisitors = sumNumberField(childrenSessions, "visitors_present");
        const childrenSoulsSaved = sumNumberField(childrenSessions, "souls_saved");

        // Deduplicated Total Calculation
        const morningServiceIds = new Set(morningServices.map(s => s.id));
        const childrenSessionIds = new Set(childrenSessions.map(s => s.id));

        const uniqueMemberIds = new Set<string>();

        attendanceLogs.forEach(log => {
            if (morningServiceIds.has(log.event_id) || childrenSessionIds.has(log.event_id)) {
                if (log.member_id) uniqueMemberIds.add(log.member_id);
            }
        });

        let anonymousCount = 0;
        morningServices.forEach(s => {
            const logsForThis = attendanceLogs.filter(l => l.event_id === s.id).length;
            anonymousCount += Math.max(0, (s.total_attendance || 0) - logsForThis);
        });
        childrenSessions.forEach(s => {
            const logsForThis = attendanceLogs.filter(l => l.event_id === s.id).length;
            anonymousCount += Math.max(0, (s.total_attendance || 0) - logsForThis);
        });

        const sundayMorningTotal = uniqueMemberIds.size + anonymousCount;
        const totalVisitors = morningVisitors + childrenVisitors;
        const totalSoulsSaved = morningSoulsSaved + childrenSoulsSaved;

        // Afternoon service on this date
        const afternoonServices = services.filter(
            (row) => row.service_type === "sunday_afternoon" && row.service_date === selectedSundayDate
        );
        const afternoonAttendance = sumNumberField(afternoonServices, "total_attendance");

        return {
            morningServiceAttendance,
            childrenDeptAttendance,
            sundayMorningTotal,
            afternoonAttendance,
            morningVisitors,
            childrenVisitors,
            totalVisitors,
            morningSoulsSaved,
            childrenSoulsSaved,
            totalSoulsSaved,
            morningMembersWhoPrayed,
            morningProspectsForBaptism,
        };
    }, [services, sundaySchoolSessions, attendanceLogs, selectedSundayDate]);

    // Per-Week summary (Monday to selected Sunday)
    const weeklySummary = useMemo(() => {
        if (!selectedSundayDate) {
            return {
                wednesdayAttendance: 0,
                wednesdaySoulsSaved: 0,
                goodnewsAttendance: 0,
                goodnewsSoulsSaved: 0,
                otherActivitiesAttendance: 0,
                otherActivitiesSoulsSaved: 0,
                goodnewsClasses: [] as any[],
                otherActivitiesList: [] as any[],
            };
        }

        const dDate = new Date(`${selectedSundayDate}T00:00:00`);
        const sDate = new Date(dDate);
        sDate.setDate(dDate.getDate() - 6);

        const startDateStr = sDate.toISOString().split('T')[0];
        const endDateStr = selectedSundayDate;

        const isWithinWeek = (dateStr: string) => dateStr >= startDateStr && dateStr <= endDateStr;

        // Wednesday Service
        const wedServices = services.filter(
            (row) => row.service_type === "wednesday_prayer" && isWithinWeek(row.service_date)
        );
        const wednesdayAttendance = sumNumberField(wedServices, "total_attendance");
        const wednesdaySoulsSaved = sumNumberField(wedServices, "souls_saved");

        // Goodnews Class
        const gnActivities = goodnewsSessions.filter(
            (row) => isWithinWeek(row.date)
        );
        const goodnewsAttendance = sumNumberField(gnActivities, "children_count");
        const goodnewsSoulsSaved = sumNumberField(gnActivities, "souls_saved_count");
        const goodnewsClasses = gnActivities.map(row => ({
            area: row.series?.area,
            total_attendance: row.children_count,
            souls_saved: row.souls_saved_count
        }));

        // Other Activities
        const otherActivities = activities.filter(
            (row) => row.activity_type !== "goodnews_class" && isWithinWeek(row.activity_date)
        );
        const otherActivitiesAttendance = sumNumberField(otherActivities, "total_attendance");
        const otherActivitiesSoulsSaved = sumNumberField(otherActivities, "souls_saved");

        return {
            wednesdayAttendance,
            wednesdaySoulsSaved,
            goodnewsAttendance,
            goodnewsSoulsSaved,
            otherActivitiesAttendance,
            otherActivitiesSoulsSaved,
            goodnewsClasses,
            otherActivitiesList: otherActivities,
        };
    }, [services, activities, goodnewsSessions, selectedSundayDate]);

    const canGoPrev = selectedSundayIndex < sundayDates.length - 1;
    const canGoNext = selectedSundayIndex > 0;

    const formatSundayLabel = (dateStr: string) => {
        const d = new Date(`${dateStr}T00:00:00`);
        return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    };

    return (
        <div className="space-y-6 p-6 lg:p-8">
            {/* Header */}
            < div className="bg-white border border-gray-100 rounded-2xl p-6" >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Bell size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
                        <p className="text-sm text-gray-500">
                            Sunday service results, upcoming birthdays, and recent reports.
                        </p>
                    </div>
                </div>
            </div >

            {/* Sunday Date Selector */}
            {
                sundayDates.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                        {/* Date navigation bar */}
                        <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
                            <button
                                onClick={() => setSelectedSundayIndex((prev) => Math.min(prev + 1, sundayDates.length - 1))}
                                disabled={!canGoPrev}
                                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Previous Sunday"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="text-center">
                                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Sunday Results</p>
                                <p className="text-white font-bold text-lg mt-0.5">
                                    {selectedSundayDate ? formatSundayLabel(selectedSundayDate) : "No Data"}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedSundayIndex((prev) => Math.max(prev - 1, 0))}
                                disabled={!canGoNext}
                                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Next Sunday"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Three sections: Morning, Afternoon, and Weekly */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                            {/* MORNING SECTION */}
                            <div className="p-6">
                                <div className="flex items-center gap-2.5 mb-5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                                        <Sun size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900">Sunday Morning</h3>
                                        <p className="text-[10px] text-gray-500 font-medium">Service + Children Department</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {/* Total */}
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-blue-500">
                                                    Total Attendance
                                                </p>
                                                <p className="text-3xl font-black text-gray-900 mt-1">{sundaySummary.sundayMorningTotal}</p>
                                            </div>
                                            <div className="text-right space-y-0.5">
                                                <p className="text-[10px] text-gray-500 font-semibold">
                                                    Service: <span className="text-gray-800 font-bold">{sundaySummary.morningServiceAttendance}</span>
                                                </p>
                                                <p className="text-[10px] text-gray-500 font-semibold">
                                                    Children: <span className="text-gray-800 font-bold">{sundaySummary.childrenDeptAttendance}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 flex items-center gap-1">
                                                <UserPlus size={11} /> Visitors
                                            </p>
                                            <p className="text-xl font-black text-gray-900 mt-1">{sundaySummary.totalVisitors}</p>
                                        </div>
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 flex items-center gap-1">
                                                <Heart size={11} /> Souls Saved
                                            </p>
                                            <p className="text-xl font-black text-gray-900 mt-1">{sundaySummary.totalSoulsSaved}</p>
                                        </div>
                                    </div>

                                    {(sundaySummary.morningMembersWhoPrayed > 0 || sundaySummary.morningProspectsForBaptism > 0) && (
                                        <div className="flex gap-3 text-xs text-gray-500 bg-gray-50/50 rounded-lg px-3 py-2">
                                            <span>Prayed: <strong className="text-gray-700">{sundaySummary.morningMembersWhoPrayed}</strong></span>
                                            <span>•</span>
                                            <span>Prospects: <strong className="text-gray-700">{sundaySummary.morningProspectsForBaptism}</strong></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* AFTERNOON SECTION */}
                            <div className="p-6">
                                <div className="flex items-center gap-2.5 mb-5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Moon size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900">Sunday Afternoon</h3>
                                        <p className="text-[10px] text-gray-500 font-medium">Afternoon Worship Service Only</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-500">
                                            Total Attendance
                                        </p>
                                        <p className="text-3xl font-black text-gray-900 mt-1">{sundaySummary.afternoonAttendance}</p>
                                    </div>

                                    {sundaySummary.afternoonAttendance === 0 && (
                                        <p className="text-xs text-gray-400 font-medium text-center py-2">
                                            No afternoon service report for this Sunday.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* WEEKLY SECTION */}
                            <div className="p-6">
                                <div className="flex items-center gap-2.5 mb-5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                        <Activity size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900">Last Week's Activities</h3>
                                        <p className="text-[10px] text-gray-500 font-medium">Recorded from the previous week</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {/* Wednesday Service */}
                                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Wednesday Service</p>
                                            <div className="flex gap-3 text-[10px] mt-1 text-gray-400 font-semibold">
                                                <span>Att: <strong className="text-gray-700">{weeklySummary.wednesdayAttendance}</strong></span>
                                                <span>Saved: <strong className="text-gray-700">{weeklySummary.wednesdaySoulsSaved}</strong></span>
                                            </div>
                                        </div>
                                        <div className="bg-white border border-gray-200 w-10 h-10 rounded-lg flex items-center justify-center font-black text-gray-900 shadow-sm">
                                            {weeklySummary.wednesdayAttendance}
                                        </div>
                                    </div>

                                    {/* Goodnews Class */}
                                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 flex items-center gap-1">
                                                <BookOpen size={11} /> Goodnews Class
                                            </p>
                                            <div className="flex gap-2 text-[10px] text-gray-400 font-semibold">
                                                <span>Total Att: <strong className="text-gray-700">{weeklySummary.goodnewsAttendance}</strong></span>
                                                <span>Saved: <strong className="text-gray-700">{weeklySummary.goodnewsSoulsSaved}</strong></span>
                                            </div>
                                        </div>
                                        {weeklySummary.goodnewsClasses.length > 0 ? (
                                            <div className="space-y-1.5 mt-2">
                                                {weeklySummary.goodnewsClasses.map((ac, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white border border-gray-100 rounded-md px-2 py-1.5 text-xs">
                                                        <span className="font-medium text-gray-700 truncate mr-2" title={ac.area || "Unknown Area"}>📍 {ac.area || "Unknown"}</span>
                                                        <span className="text-gray-500 font-semibold flex-shrink-0">
                                                            A: {ac.total_attendance || 0} | S: {ac.souls_saved || 0}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic text-center py-1">No classes this week</p>
                                        )}
                                    </div>

                                    {/* Other Ministries */}
                                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 flex items-center gap-1">
                                                <Users size={11} /> Activities & Ministries
                                            </p>
                                            <div className="flex gap-2 text-[10px] text-gray-400 font-semibold">
                                                <span>Total Att: <strong className="text-gray-700">{weeklySummary.otherActivitiesAttendance}</strong></span>
                                                <span>Saved: <strong className="text-gray-700">{weeklySummary.otherActivitiesSoulsSaved}</strong></span>
                                            </div>
                                        </div>
                                        {weeklySummary.otherActivitiesList.length > 0 ? (
                                            <div className="space-y-1.5 mt-2">
                                                {weeklySummary.otherActivitiesList.map((ac, idx) => {
                                                    let details = "";
                                                    if (ac.activity_type === "outreach" && ac.mission_church_name) details = ac.mission_church_name;
                                                    if (ac.activity_type === "visitation" && ac.family_name) details = ac.family_name;
                                                    if (ac.activity_type === "bible_study" && ac.bible_study_type) details = ac.bible_study_type;

                                                    return (
                                                        <div key={idx} className="flex flex-col bg-white border border-gray-100 rounded-md px-2 py-1.5 text-xs">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-gray-700 capitalize">
                                                                    {ac.activity_type.replace('_', ' ')}
                                                                </span>
                                                                <span className="text-gray-500 font-semibold text-[10px]">
                                                                    A: {ac.total_attendance || 0} | S: {ac.souls_saved || 0}
                                                                </span>
                                                            </div>
                                                            {details && (
                                                                <span className="text-[10px] text-gray-500 mt-0.5 truncate">
                                                                    ➔ {details}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic text-center py-1">No activities this week</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Upcoming Birthdays */}
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

            {
                sourceWarnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm font-medium space-y-1">
                        {sourceWarnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                        ))}
                    </div>
                )
            }

            {/* Recent Result Announcements */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Recent Reports</h2>
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
        </div >
    );
};

export default Announcements;
