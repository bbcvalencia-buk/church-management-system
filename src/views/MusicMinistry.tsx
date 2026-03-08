import React, { useState, useEffect, useMemo } from "react";
import * as musicService from "@/services/musicService";
import * as memberService from "@/services/memberService";
import { getLatestSundayISODate } from "@/lib/date";
import { exportToCSV } from "@/lib/csv";
import {
    Music,
    Calendar,
    Users,
    Plus,
    X,
    Save,
    Trash2,
    Search,
    ArrowLeft,
    Printer,
    Download,
    Edit2,
    BarChart2,
    Filter,
    MoreHorizontal,
    MapPin,
    Clock,
    User,
    ArrowRight
} from "lucide-react";

import ConfirmModal from "@/components/ConfirmModal";
import SuccessModal from "@/components/SuccessModal";
import MemberAttendancePicker from "@/components/MemberAttendancePicker";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";
import { useSessionDraft, useSessionValue } from "@/hooks/useSessionDraft";

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

export interface Member {
    id: string;
    first_name: string;
    surname: string;
    profile_picture_url?: string;
    member_number?: string;
}

interface MusicPositionAssignment {
    member_id: string;
    department?: string | null;
    position_name?: string | null;
}

const normalizeGroupKey = (value?: string | null) =>
    (value || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const resolvePracticeTypeKey = (value?: string | null) => {
    const normalized = normalizeGroupKey(value);
    if (!normalized) return "";
    if (normalized.includes("choir")) return "choir";
    if (
        normalized.includes("mini ensemble") ||
        normalized.includes("miniensemble") ||
        (normalized.includes("mini") && normalized.includes("ensemble"))
    ) {
        return "mini_ensemble";
    }
    return normalized;
};

const DEFAULT_PRACTICE_START_TIME = "18:30";
const DEFAULT_PRACTICE_END_TIME = "20:30";

const toTitleCase = (value: string) =>
    value
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ");

const formatPracticeTypeLabel = (practiceType?: string | null) => {
    const normalized = resolvePracticeTypeKey(practiceType);
    if (normalized === "choir") return "Choir Practice";
    if (normalized === "mini_ensemble") return "Mini Ensemble Practice";

    const fallback = toTitleCase((practiceType || "").replace(/_/g, " ").trim());
    if (!fallback) return "Practice";
    return fallback.toLowerCase().includes("practice") ? fallback : `${fallback} Practice`;
};

const normalizeTimeInputValue = (value?: string | null, fallback = "") => {
    if (!value) return fallback;
    return value.slice(0, 5);
};

const formatPracticeTime = (value?: string | null) => {
    if (!value) return "";
    const normalized = value.slice(0, 5);
    const [hourRaw, minuteRaw] = normalized.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return normalized;

    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
};

const formatPracticeTimeRange = (start?: string | null, end?: string | null) => {
    const startLabel = formatPracticeTime(start || DEFAULT_PRACTICE_START_TIME);
    const endLabel = formatPracticeTime(end || DEFAULT_PRACTICE_END_TIME);
    return `${startLabel} - ${endLabel}`;
};

const sortMembersByName = (members: Member[]) =>
    [...members].sort((a, b) => {
        const surnameCompare = (a.surname || "").localeCompare(b.surname || "");
        if (surnameCompare !== 0) return surnameCompare;
        return (a.first_name || "").localeCompare(b.first_name || "");
    });

const INITIAL_STATE: Partial<PracticeSession> = {
    practice_type: 'choir',
    practice_date: getLatestSundayISODate(),
    practice_start_time: DEFAULT_PRACTICE_START_TIME,
    practice_end_time: DEFAULT_PRACTICE_END_TIME,
    members_present: 0,
    non_member_attendance: 0
};

const MusicMinistry: React.FC = () => {
    const { roles } = useAuth();
    const canManageMusic = roles.includes(UserRole.CHURCH_ADMINISTRATOR) || roles.includes(UserRole.MUSIC_MINISTER);
    // Data State
    const [sessions, setSessions] = useState<PracticeSession[]>([]);
    const [allMembers, setAllMembers] = useState<Member[]>([]); // All members from memberService
    const [musicAssignments, setMusicAssignments] = useState<MusicPositionAssignment[]>([]); // All music ministry assignments
    const [allMusicMembers, setAllMusicMembers] = useState<Member[]>([]); // Filtered music members
    const [membersByPracticeType, setMembersByPracticeType] = useState<Record<string, Member[]>>({});
    const [form, setForm, clearFormDraft] = useSessionDraft<Partial<PracticeSession>>('music-practice-form', INITIAL_STATE);
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [selectedMemberIds, setSelectedMemberIds, clearMembersDraft] = useSessionValue<string[]>('music-practice-members', []);
    const [tardyMemberIds, setTardyMemberIds, clearTardyDraft] = useSessionValue<string[]>('music-practice-tardy', []);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

    // Detailed View State
    const [viewSession, setViewSession] = useState<PracticeSession | null>(null);
    const [viewSessionAttendance, setViewSessionAttendance] = useState<string[]>([]);

    useEffect(() => {
        fetchSessions();
        fetchMembers();
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data = await musicService.getMusicSessions();
            setSessions(data || []);
        } catch (err) {
            console.error("Error fetching sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const [allMembersData, musicAssignmentsData] = await Promise.all([
                memberService.getAllMembers(),
                musicService.getMusicMinistryAssignments()
            ]);

            setAllMembers(allMembersData || []);
            setMusicAssignments(musicAssignmentsData || []);

            const allMusicMemberIds = new Set<string>();
            const groupedMemberIds = new Map<string, Set<string>>();

            for (const assignment of musicAssignmentsData || []) {
                if (!assignment.member_id) continue;
                allMusicMemberIds.add(assignment.member_id);

                const practiceKey = resolvePracticeTypeKey(assignment.department || assignment.position_name);
                if (!practiceKey) continue;
                if (!groupedMemberIds.has(practiceKey)) {
                    groupedMemberIds.set(practiceKey, new Set<string>());
                }
                groupedMemberIds.get(practiceKey)!.add(assignment.member_id);
            }

            const musicMemberIds = Array.from(allMusicMemberIds);
            if (musicMemberIds.length === 0) {
                setAllMusicMembers([]);
                setMembersByPracticeType({});
                return;
            }

            const filteredMusicMembers = (allMembersData || []).filter(member => musicMemberIds.includes(member.id));
            const sortedMembers = sortMembersByName(filteredMusicMembers);
            setAllMusicMembers(sortedMembers);

            const memberById = new Map(sortedMembers.map((member) => [member.id, member]));
            const groupedRosters: Record<string, Member[]> = {};

            groupedMemberIds.forEach((memberIds, practiceKey) => {
                const roster = Array.from(memberIds)
                    .map((memberId) => memberById.get(memberId))
                    .filter((member): member is Member => Boolean(member));
                groupedRosters[practiceKey] = sortMembersByName(roster);
            });

            setMembersByPracticeType(groupedRosters);

        } catch (err) {
            console.error("Error fetching members/assignments:", err);
            setAllMusicMembers([]);
            setMembersByPracticeType({});
        }
    };

    const fetchSessionAttendance = async (sessionId: string) => {
        try {
            const { memberIds, tardyIds } = await musicService.getMusicSessionAttendanceLogs(sessionId);
            setSelectedMemberIds(memberIds);
            setTardyMemberIds(tardyIds);
        } catch (err) {
            console.error("Error fetching attendance:", err);
        }
    };

    const handleOpenModal = (session?: PracticeSession) => {
        if (session) {
            setForm({
                ...session,
                practice_start_time: normalizeTimeInputValue(session.practice_start_time, DEFAULT_PRACTICE_START_TIME),
                practice_end_time: normalizeTimeInputValue(session.practice_end_time, DEFAULT_PRACTICE_END_TIME)
            });
            setSelectedMemberIds([]);
            setTardyMemberIds([]);
            fetchSessionAttendance(session.id);
        } else {
            setForm(INITIAL_STATE);
            setSelectedMemberIds([]);
            setTardyMemberIds([]);
        }
        setMemberSearchTerm("");
        setIsModalOpen(true);
    };

    const handleViewSession = async (session: PracticeSession) => {
        setViewSession(session);
        // Fetch attendance for this specific session view
        const { memberIds: data } = await musicService.getMusicSessionAttendanceLogs(session.id);
        if (data) setViewSessionAttendance(data);
    };

    const handleSave = async () => {
        if (!canManageMusic) {
            alert("You have read-only access.");
            return;
        }
        setSaving(true);
        try {
            const nonMemberAttendance = Number(form.non_member_attendance) || 0;
            const practiceStartTime = normalizeTimeInputValue(form.practice_start_time, DEFAULT_PRACTICE_START_TIME);
            const practiceEndTime = normalizeTimeInputValue(form.practice_end_time, DEFAULT_PRACTICE_END_TIME);

            const sessionsToSave = {
                ...form,
                practice_start_time: practiceStartTime,
                practice_end_time: practiceEndTime,
                members_present: selectedMemberIds.length + tardyMemberIds.length,
                non_member_attendance: nonMemberAttendance
            };

            const savedSession = await musicService.upsertMusicSession(sessionsToSave as PracticeSession);

            await musicService.updateMusicSessionAttendanceLogs(savedSession.id, savedSession.practice_date, [...selectedMemberIds, ...tardyMemberIds], tardyMemberIds);

            fetchSessions();
            setIsModalOpen(false);
            clearFormDraft();
            clearMembersDraft();
            clearTardyDraft();
            setShowSuccessModal(true);

            if (viewSession && viewSession.id === savedSession.id) {
                handleViewSession(savedSession as PracticeSession);
            }

        } catch (err: any) {
            alert("Error saving session: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!canManageMusic) {
            alert("You have read-only access.");
            return;
        }
        if (!confirmDelete.id) return;
        setSaving(true);
        try {
            await musicService.deleteMusicSession(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null });
            setIsModalOpen(false);
            setViewSession(null); // Clear view if the deleted session was being viewed
            fetchSessions();
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const hasGroupedRosters = Object.keys(membersByPracticeType).length > 0;

    const getMembersForPracticeType = (practiceType?: string | null) => {
        const practiceKey = resolvePracticeTypeKey(practiceType);
        const roster = practiceKey ? membersByPracticeType[practiceKey] : undefined;
        if (roster) return roster;
        return hasGroupedRosters ? [] : allMusicMembers;
    };

    const getRosterSizeForPracticeType = (practiceType?: string | null) =>
        getMembersForPracticeType(practiceType).length;

    const formMembers = useMemo(
        () => getMembersForPracticeType(form.practice_type),
        [form.practice_type, membersByPracticeType, hasGroupedRosters, allMusicMembers]
    );

    const viewMembers = useMemo(
        () => getMembersForPracticeType(viewSession?.practice_type),
        [viewSession?.practice_type, membersByPracticeType, hasGroupedRosters, allMusicMembers]
    );

    useEffect(() => {
        if (!isModalOpen) return;
        const allowedMemberIds = new Set(formMembers.map((member) => member.id));
        setSelectedMemberIds((prev) => {
            const filtered = prev.filter((id) => allowedMemberIds.has(id));
            return filtered.length === prev.length ? prev : filtered;
        });
    }, [isModalOpen, formMembers]);

    const totalRoster = viewMembers.length;
    const attendedCount = viewSessionAttendance.length;
    const viewedNonMemberAttendance = viewSession?.non_member_attendance || 0;
    const viewedTotalAttendance = attendedCount + viewedNonMemberAttendance;
    const attendancePercentage = totalRoster > 0 ? Math.round((attendedCount / totalRoster) * 100) : 0;

    // Computed Dashboard Stats
    const totalPractices = sessions.length;

    // Average Attendance
    const attendanceRatios = sessions
        .map((session) => {
            const rosterSize = getRosterSizeForPracticeType(session.practice_type);
            if (rosterSize <= 0) return null;
            return session.members_present / rosterSize;
        })
        .filter((ratio): ratio is number => ratio !== null);

    const avgAttendancePercentage = attendanceRatios.length > 0
        ? Math.round((attendanceRatios.reduce((sum, ratio) => sum + ratio, 0) / attendanceRatios.length) * 100)
        : 0;

    // Active Groups
    const activeGroupTypes = Array.from(new Set(sessions.map(s => s.practice_type)));
    const activeGroupsCount = activeGroupTypes.length || 0;
    const activeGroupsLabels = activeGroupTypes.map((t) => formatPracticeTypeLabel(t)).join(', ') || 'No active groups';

    // Needs Attention Logic
    const needsAttention = [];
    const lowAttendanceSessions = sessions.filter((session) => {
        const rosterSize = getRosterSizeForPracticeType(session.practice_type);
        return new Date(session.practice_date) < new Date() && rosterSize > 0 && (session.members_present / rosterSize) < 0.5;
    });
    if (lowAttendanceSessions.length > 0) {
        needsAttention.push({
            title: "Low Attendance Recorded",
            desc: `For ${formatPracticeTypeLabel(lowAttendanceSessions[0].practice_type)} (${new Date(lowAttendanceSessions[0].practice_date).toLocaleDateString()})`,
            node: <span className="font-bold text-sm">!</span>,
            colorClass: 'bg-red-50 text-red-700 border-red-100'
        });
    }
    const upcomingSessions = sessions.filter(s => new Date(s.practice_date) >= new Date(new Date().setHours(0, 0, 0, 0)));
    if (upcomingSessions.length === 0) {
        needsAttention.push({
            title: "No Upcoming Practices",
            desc: "Schedule your next rehearsal.",
            node: <Calendar size={14} />,
            colorClass: 'bg-orange-50 text-orange-700 border-orange-100'
        });
    }

    return (
        <div className="space-y-6 pb-20 fade-in animate-in w-full">
            {viewSession ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Header Section */}
                    <div className="flex justify-between items-end">
                        <div>
                            <button
                                onClick={() => setViewSession(null)}
                                className="text-blue-600 font-bold uppercase tracking-wider text-xs flex items-center gap-1 hover:underline mb-2"
                            >
                                <ArrowLeft size={14} /> Back to Dashboard
                            </button>
                            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 mb-1">
                                <Calendar size={14} />
                                <span>{formatPracticeTypeLabel(viewSession.practice_type)}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600">{new Date(viewSession.practice_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Music Practice Report</h1>
                        </div>
                        <div className="flex gap-3">
                            <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
                                <Printer size={16} /> Print Report
                            </button>
                            <button
                                onClick={() => {
                                    if (!viewSession) return;
                                    const exportData = viewMembers.map(m => ({
                                        member_number: m.member_number || '',
                                        surname: m.surname,
                                        first_name: m.first_name,
                                        status: viewSessionAttendance.includes(m.id) ? 'Present' : 'Absent'
                                    }));
                                    const filename = `Music_Attendance_${viewSession.practice_type}_${viewSession.practice_date}.csv`;
                                    exportToCSV(filename, exportData, [
                                        { key: 'member_number', label: 'Member #' },
                                        { key: 'surname', label: 'Surname' },
                                        { key: 'first_name', label: 'First Name' },
                                        { key: 'status', label: 'Status' }
                                    ]);
                                }}
                                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Download size={16} /> Export to CSV
                            </button>
                            <button
                                onClick={() => handleOpenModal(viewSession)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <Edit2 size={16} /> Edit Record
                            </button>
                            <button
                                onClick={() => setConfirmDelete({ isOpen: true, id: viewSession.id })}
                                className="bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Summary Card */}
                            <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mb-2">Total Attendance</p>
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-5xl font-black text-gray-900 tracking-tighter">{viewedTotalAttendance}</span>
                                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-800">
                                        <BarChart2 size={24} />
                                    </div>
                                </div>
                                <p className="text-xs font-semibold text-gray-500">
                                    Members: {attendedCount} | Non-members: {viewedNonMemberAttendance}
                                </p>
                                <div className="w-full bg-gray-100 rounded-full h-2 mt-6 overflow-hidden">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${attendancePercentage}%` }}></div>
                                </div>
                                <p className="text-right text-xs text-gray-400 font-semibold mt-2">{attendancePercentage}% of roster</p>
                            </div>

                            {/* List Card */}
                            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-900 text-lg">Attendance List</h3>
                                    <div className="flex gap-2 text-gray-400">
                                        <Filter size={18} className="cursor-pointer hover:text-gray-600 transition-colors" />
                                        <MoreHorizontal size={18} className="cursor-pointer hover:text-gray-600 transition-colors" />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[500px]">
                                        <thead>
                                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Member</th>
                                                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Time In</th>
                                                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {viewMembers.map((member, idx) => {
                                                const isPresent = viewSessionAttendance.includes(member.id);
                                                const initials = `${member.first_name?.[0] || ''}${member.surname?.[0] || ''}`.toUpperCase();
                                                const colors = [
                                                    'bg-[#e2e8e0] text-[#4d6a42]', 'bg-[#1f2937] text-white', 'bg-[#e0e7ff] text-[#4338ca]', 'bg-[#fae8d4] text-[#855322]'
                                                ];
                                                const colorClass = colors[idx % colors.length];

                                                return (
                                                    <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="relative">
                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold leading-none ${colorClass}`}>
                                                                        {initials}
                                                                    </div>
                                                                    {isPresent && (
                                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-900">{member.surname}, {member.first_name}</p>
                                                                    <p className="text-xs font-semibold text-gray-400 mt-0.5">Member</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            {isPresent ? (
                                                                <div className="inline-flex items-center gap-1.5 bg-[#f0fdf6] px-3 py-1 rounded-full border border-green-100 text-[11px] font-bold text-green-700 uppercase tracking-wider">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Present
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div> Absent
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-6 text-sm text-gray-500 font-medium">
                                                            {isPresent ? 'Entered' : '--'}
                                                        </td>
                                                        <td className="py-4 px-6 text-right">
                                                            <button
                                                                onClick={() => handleOpenModal(viewSession)}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                                title="Edit Attendance"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100 h-full flex flex-col">
                                <h3 className="font-bold text-gray-900 text-lg mb-8">Event Details</h3>

                                <div className="space-y-8 flex-1">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0 mt-0.5">
                                            <MapPin size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-tight">Main Sanctuary</p>
                                            <p className="text-xs font-medium text-gray-500 mt-0.5">BBC Valencia</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0 mt-0.5">
                                            <Clock size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-tight">Ministry Schedule</p>
                                            <p className="text-xs font-medium text-gray-500 mt-0.5">
                                                {formatPracticeTimeRange(viewSession.practice_start_time, viewSession.practice_end_time)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0 mt-0.5">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-tight">Lead Director</p>
                                            <p className="text-xs font-medium text-gray-500 mt-0.5">Music Ministry</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                                    <button className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                                        View Full Event <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Embedded Modals Support within Detail View */}
                    {isModalOpen && (
                        // We render the edit modal on top
                        <></>
                    )}
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-center bg-white p-6 -mx-8 -mt-8 px-8 border-b border-gray-100 shadow-sm z-10 sticky top-0">
                        <div>
                            <h1 className="text-2xl font-black flex items-center gap-3 text-gray-900 tracking-tight">
                                <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-blue-600">
                                    <Music size={20} />
                                </div>
                                Music Ministry
                            </h1>
                            <p className="text-sm font-medium text-gray-500 mt-1 pl-13">Manage practices, schedules, and team performance.</p>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-[8px] flex items-center gap-2 transition-transform hover:-translate-y-0.5 font-bold shadow-sm"
                        >
                            <Plus size={18} /> Log Practice
                        </button>
                    </div>

                    {/* Dashboard Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                        <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Practices</p>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-gray-900">{totalPractices}</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-blue-600">
                                    <Calendar size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Avg. Attendance</p>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-gray-900">{avgAttendancePercentage}%</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-[10px] bg-[#eff6ff] flex items-center justify-center text-blue-500">
                                    <Users size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active Groups</p>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-gray-900">{activeGroupsCount}</span>
                                        <span className="text-[11px] font-medium text-gray-500 mb-1 capitalize truncate max-w-[120px]" title={activeGroupsLabels}>{activeGroupsLabels}</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-[10px] bg-[#fdf2f8] flex items-center justify-center text-pink-500">
                                    <Music size={18} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
                        {/* List Section */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900">Recent & Upcoming Practices</h2>
                                <button className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
                                    View All <ArrowRight size={14} />
                                </button>
                            </div>

                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 flex flex-col divide-y divide-gray-50">
                                {loading ? <p className="p-8 text-center text-gray-500 font-medium">Loading...</p> : sessions.length === 0 ? <p className="p-8 text-center text-gray-500 font-medium">No practice sessions recorded yet.</p> : (
                                    sessions.slice(0, 5).map(session => {
                                        const isChoirLike = resolvePracticeTypeKey(session.practice_type) === 'choir';
                                        const typeConfig = isChoirLike
                                            ? { bg: 'bg-[#fdf2f8]', text: 'text-pink-500', icon: Music, label: formatPracticeTypeLabel(session.practice_type) }
                                            : { bg: 'bg-[#eff6ff]', text: 'text-blue-500', icon: Users, label: formatPracticeTypeLabel(session.practice_type) };

                                        const sessionRosterCount = getRosterSizeForPracticeType(session.practice_type);
                                        const attendanceRatio = Math.min((session.members_present / (sessionRosterCount || 1)), 1);
                                        const isLow = attendanceRatio < 0.5;

                                        return (
                                            <div
                                                key={session.id}
                                                onClick={() => handleViewSession(session)}
                                                className="p-6 flex items-center gap-6 hover:bg-gray-50 transition-colors cursor-pointer group"
                                            >
                                                <div className={`w - 14 h - 14 rounded - [12px] flex items - center justify - center shrink - 0 ${typeConfig.bg} ${typeConfig.text} `}>
                                                    <typeConfig.icon size={24} />
                                                </div>

                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-900 text-base">{typeConfig.label}</h3>
                                                    <div className="flex items-center gap-4 text-[12px] font-medium text-gray-500 mt-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={13} />
                                                            {new Date(session.practice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={13} />
                                                            {formatPracticeTimeRange(session.practice_start_time, session.practice_end_time)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="w-32 hidden md:block">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Attendance</span>
                                                        <span className="text-[11px] font-bold text-gray-900">{session.members_present}/{sessionRosterCount}</span>
                                                    </div>
                                                    {(session.non_member_attendance || 0) > 0 && (
                                                        <p className="text-[10px] font-bold text-blue-600 mb-1 text-right">
                                                            +{session.non_member_attendance} guest{session.non_member_attendance === 1 ? '' : 's'}
                                                        </p>
                                                    )}
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div className={`h - 1.5 rounded - full ${isLow ? 'bg-orange-400' : 'bg-green-500'} `} style={{ width: `${attendanceRatio * 100}% ` }}></div>
                                                    </div>
                                                </div>

                                                <button className="bg-[#f8f9fa] border border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 px-4 py-2 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-colors shrink-0">
                                                    Edit Details
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Needs Attention */}
                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6">
                                <h3 className="font-bold text-gray-900 text-sm mb-6">Needs Attention</h3>
                                <div className="space-y-6">
                                    {needsAttention.length > 0 ? needsAttention.map((item, i) => (
                                        <div key={i} className="flex items-start gap-4">
                                            <div className={`w - 8 h - 8 rounded - [10px] flex items - center justify - center shrink - 0 border mt - 0.5 ${item.colorClass} `}>
                                                {item.node}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 leading-tight">{item.title}</p>
                                                <p className="text-[11px] font-medium text-gray-500 mt-1">{item.desc}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-4">
                                            <p className="text-sm font-bold text-gray-500">All caught up!</p>
                                            <p className="text-xs text-gray-400 mt-1">No alerts at this time.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
                    <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-[500px] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Body */}
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <h2 className="text-xl font-bold flex items-center gap-4 text-gray-900 border-b border-gray-100 pb-6">
                                <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-blue-600">
                                    <Music size={20} />
                                </div>
                                {form.id ? 'Edit Practice Record' : 'Log New Practice'}
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Type</label>
                                    <div className="relative">
                                        <select
                                            value={form.practice_type}
                                            onChange={(e) => setForm({ ...form, practice_type: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                                        >
                                            <option value="choir">Choir Practice</option>
                                            <option value="mini_ensemble">Mini Ensemble Practice</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Date</label>
                                    <input
                                        type="date"
                                        value={form.practice_date}
                                        onChange={(e) => setForm({ ...form, practice_date: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Start Time</label>
                                    <input
                                        type="time"
                                        value={normalizeTimeInputValue(form.practice_start_time, DEFAULT_PRACTICE_START_TIME)}
                                        onChange={(e) => setForm({ ...form, practice_start_time: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">End Time</label>
                                    <input
                                        type="time"
                                        value={normalizeTimeInputValue(form.practice_end_time, DEFAULT_PRACTICE_END_TIME)}
                                        onChange={(e) => setForm({ ...form, practice_end_time: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Non-Members</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.non_member_attendance || ''}
                                        onChange={(e) => setForm({ ...form, non_member_attendance: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <MemberAttendancePicker
                                    label="Mark Attendance"
                                    members={formMembers}
                                    selectedIds={selectedMemberIds}
                                    onChange={setSelectedMemberIds}
                                    tardyIds={tardyMemberIds}
                                    onTardyChange={setTardyMemberIds}
                                    searchTerm={memberSearchTerm}
                                    onSearchTermChange={setMemberSearchTerm}
                                    maxHeightClass="max-h-[300px]"
                                />
                                {formMembers.length === 0 && hasGroupedRosters && (
                                    <p className="text-xs font-semibold text-amber-700 mt-3">
                                        No members are assigned to this group yet. Add members in Ministry Directory first.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Sticky Footer */}
                        <div className="bg-[#1e2333] p-4 px-6 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] relative z-10 transition-colors">
                            <div className="flex gap-2">
                                {form.id && (
                                    <button
                                        onClick={() => setConfirmDelete({ isOpen: true, id: form.id as string })}
                                        className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors text-xs font-bold uppercase tracking-widest"
                                        title="Delete Record"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-4 items-center w-full justify-end">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2 px-4"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)] rounded-lg px-8 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : (form.id ? 'Save Changes' : 'Submit Practice')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SuccessModal
                isOpen={showSuccessModal}
                onDone={() => setShowSuccessModal(false)}
                onView={() => setShowSuccessModal(false)}
            />
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title="Delete Session"
                message="Are you sure you want to PERMANENTLY delete this practice record? This will also remove all associated attendance logs."
                confirmText="Delete Record"
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
            />
        </div>
    );
};

export default MusicMinistry;
