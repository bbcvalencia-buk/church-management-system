
import React, { useState, useEffect, useMemo } from "react";
import * as sundaySchoolService from "@/services/sundaySchoolService";
import * as memberService from "@/services/memberService";
import { getLatestSundayISODate } from "@/lib/date";
import type { SundaySchoolSession } from "@/types";
import { UserRole } from "@/types";
import {
    BookOpen,
    Plus,
    TrendingUp,
    Heart,
    Users,
    UserPlus,
    Search,
    Eye,
    Edit2,
    ChevronLeft,
    ChevronRight,
    Calendar,
    X,
    CheckCircle2,
    Hash,
    ClipboardCheck,
    Star
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import ImageUpload from "@/components/ImageUpload";
import type { DraftVisitor } from "@/components/QuickVisitorRegistration";
import QuickVisitorRegistration from "@/components/QuickVisitorRegistration";
import { deleteFile } from "@/lib/storage";
import SuccessModal from "@/components/SuccessModal";
import MemberAttendancePicker from "@/components/MemberAttendancePicker";
import { findExistingMemberForVisitor, splitVisitorName } from "@/lib/visitorDedup";
import { useAuth } from "@/contexts/AuthContext";
import {
    CHILDREN_DEPARTMENTS,
    deriveTeacherDepartments,
    getSundaySchoolScopeLabel,
    isSundaySchoolTeacherAssignment,
    normalizeSundaySchoolDepartment,
    SUNDAY_SCHOOL_POSITION_CATEGORIES,
    type SundaySchoolDepartmentId
} from "@/lib/sundaySchoolAccess";

type DepartmentMeta = {
    id: SundaySchoolDepartmentId;
    label: string;
    color: string;
};

const DEPARTMENTS: DepartmentMeta[] = [
    { id: 'adult', label: 'Adult Department', color: '#8884d8' },
    { id: 'beginners', label: 'Beginners Class', color: '#ffc658' },
    { id: 'nursery', label: 'Nursery/Toddler', color: '#ff8042' },
    { id: 'kinder', label: 'Kindergarten', color: '#ffc658' },
    { id: 'primary', label: 'Primary', color: '#8dd1e1' },
    { id: 'junior', label: 'Junior Department', color: '#0088FE' },
];

const DEPARTMENT_GROUPS: { id: string; label: string; departments: SundaySchoolDepartmentId[] }[] = [
    { id: 'adult', label: 'Adult', departments: ['adult'] },
    { id: 'beginners', label: 'Beginners Class', departments: ['beginners'] },
    { id: 'children', label: 'Children', departments: ['nursery', 'kinder', 'primary', 'junior'] },
];

const VISITOR_CARD_DEPARTMENTS = ['nursery', 'kinder', 'primary', 'junior'];
const SOULS_SAVED_DEPARTMENTS = ['beginners', 'nursery', 'kinder', 'primary', 'junior'];

const isVisitorCardDepartment = (department?: string) =>
    Boolean(department && VISITOR_CARD_DEPARTMENTS.includes(department));

const isSoulsSavedDepartment = (department?: string) =>
    Boolean(department && SOULS_SAVED_DEPARTMENTS.includes(department));

const normalizeDraftVisitors = (visitors: DraftVisitor[]) => {
    return visitors
        .map((visitor) => ({
            ...visitor,
            name: visitor.name.trim(),
            address: (visitor.address || '').trim(),
            office_address: (visitor.office_address || '').trim(),
            contact: (visitor.contact || '').trim(),
            church_name: (visitor.church_name || '').trim(),
            invited_by: (visitor.invited_by || '').trim(),
            visit_date: visitor.visit_date || undefined
        }))
        .filter((visitor) => {
            return Boolean(
                visitor.name ||
                visitor.address ||
                visitor.office_address ||
                visitor.contact ||
                visitor.church_name ||
                visitor.invited_by ||
                (visitor.images || []).length > 0
            );
        });
};

const SundaySchool: React.FC = () => {
    const { member: currentMember, roles, loading: authLoading } = useAuth();
    const isPastor = roles.includes(UserRole.PASTOR);
    const isSundaySchoolAdmin =
        roles.includes(UserRole.CHURCH_ADMINISTRATOR) || roles.includes(UserRole.SUNDAY_SCHOOL_ADMIN);

    const [sessions, setSessions] = useState<SundaySchoolSession[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [membersByDepartment, setMembersByDepartment] = useState<Record<string, any[]>>({});
    const [teacherDepartments, setTeacherDepartments] = useState<SundaySchoolDepartmentId[]>([]);
    const [accessLoading, setAccessLoading] = useState(true);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [tardyMemberIds, setTardyMemberIds] = useState<string[]>([]);
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Pagination and Search
    const [departmentSearchTerm, setDepartmentSearchTerm] = useState(() => {
        try {
            const saved = sessionStorage.getItem('sundayschool-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.departmentSearchTerm) return parsed.departmentSearchTerm;
            }
        } catch (e) { console.error(e); }
        return "";
    });
    const [currentPage, setCurrentPage] = useState(() => {
        try {
            const saved = sessionStorage.getItem('sundayschool-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.currentPage) return Number(parsed.currentPage);
            }
        } catch (e) { console.error(e); }
        return 1;
    });
    const itemsPerPage = 8;

    // Deletion Modal State
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });

    // New Session Form State
    const [newSession, setNewSession] = useState<Partial<SundaySchoolSession>>(() => {
        let dept = 'adult';
        try {
            const saved = sessionStorage.getItem('sundayschool-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.activeDepartment) dept = parsed.activeDepartment;
            }
        } catch (e) { console.error(e); }

        return {
            session_date: getLatestSundayISODate(),
            department: dept as any,
            members_present: 0,
            visitors_present: 0,
            total_attendance: 0,
            souls_saved: 0
        };
    });

    // Add debug mount/unmount logging
    useEffect(() => {
        console.log('[SundaySchool] Mounted! State restored:', { departmentSearchTerm, currentPage, activeDepartment: newSession.department });
        return () => {
            console.log('[SundaySchool] Unmounted!');
        };
    }, []);

    useEffect(() => {
        console.log('[SundaySchool] State Changed:', { departmentSearchTerm, currentPage, activeDepartment: newSession.department });
        try {
            sessionStorage.setItem('sundayschool-state', JSON.stringify({
                departmentSearchTerm,
                currentPage,
                activeDepartment: newSession.department
            }));
        } catch (e) { console.error(e); }
    }, [departmentSearchTerm, currentPage, newSession.department]);
    const [newVisitors, setNewVisitors] = useState<DraftVisitor[]>([]);
    const [isStudentEditorOpen, setIsStudentEditorOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<any | null>(null);
    const [studentSaving, setStudentSaving] = useState(false);

    // Attendance Viewer State
    const [attendanceViewerOpen, setAttendanceViewerOpen] = useState(false);
    const [attendanceViewerSession, setAttendanceViewerSession] = useState<SundaySchoolSession | null>(null);
    const [attendanceViewerMembers, setAttendanceViewerMembers] = useState<any[]>([]);
    const [attendanceDayCounts, setAttendanceDayCounts] = useState<Record<string, number>>({});
    const [attendanceViewerLoading, setAttendanceViewerLoading] = useState(false);
    const [attendanceViewerSearch, setAttendanceViewerSearch] = useState("");
    const [attendanceViewerScores, setAttendanceViewerScores] = useState<Record<string, number | null>>({});
    const [attendanceViewerScoreStats, setAttendanceViewerScoreStats] = useState<Record<string, { totalScore: number; submissionCount: number }>>({});

    // Assessment scores per member in the report modal
    const [memberAssessmentScores, setMemberAssessmentScores] = useState<Record<string, number | null>>({});

    const visitorMemberIds = useMemo(() => {
        return new Set((members || []).filter((m: any) => m.is_regular_member === false).map((m: any) => m.id));
    }, [members]);

    const managedDepartmentIds: SundaySchoolDepartmentId[] = (isSundaySchoolAdmin || isPastor)
        ? DEPARTMENTS.map((d) => d.id as SundaySchoolDepartmentId)
        : teacherDepartments;
    const hasSundaySchoolAccess = isSundaySchoolAdmin || isPastor || teacherDepartments.length > 0;

    useEffect(() => {
        const resolveTeacherAccess = async () => {
            if (authLoading) return;

            if (isSundaySchoolAdmin) {
                setTeacherDepartments([]);
                setAccessLoading(false);
                return;
            }

            if (!currentMember?.id) {
                setTeacherDepartments([]);
                setAccessLoading(false);
                return;
            }

            setAccessLoading(true);
            try {
                const data = await sundaySchoolService.getTeacherAssignments(currentMember.id, [...SUNDAY_SCHOOL_POSITION_CATEGORIES]);
                setTeacherDepartments(deriveTeacherDepartments((data || []) as any[]));
            } catch (error) {
                console.error("Error resolving Sunday School teacher departments:", error);
                setTeacherDepartments([]);
            } finally {
                setAccessLoading(false);
            }
        };

        resolveTeacherAccess();
    }, [authLoading, isSundaySchoolAdmin, currentMember?.id]);

    useEffect(() => {
        if (accessLoading || !hasSundaySchoolAccess) return;
        fetchSessions();
        fetchMembers();
    }, [accessLoading, hasSundaySchoolAccess, isSundaySchoolAdmin, teacherDepartments.join("|")]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data = await sundaySchoolService.getSundaySchoolSessions(managedDepartmentIds, isSundaySchoolAdmin);
            setSessions(data);
        } catch (err) {
            console.error("Error fetching sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const [allMembers, studentAssignments] = await Promise.all([
                memberService.getAllMembers(),
                sundaySchoolService.getSundaySchoolStudentAssignments([...SUNDAY_SCHOOL_POSITION_CATEGORIES])
            ]);

            setMembers(allMembers || []);

            const idsByDepartment = new Map<string, Set<string>>();
            const allStudentIds = new Set<string>();

            const scopeDepartmentIds = isSundaySchoolAdmin
                ? DEPARTMENTS.map((department) => department.id)
                : managedDepartmentIds;

            for (const row of (studentAssignments || [])) {
                const department = normalizeSundaySchoolDepartment(row);
                if (!department || !scopeDepartmentIds.includes(department)) continue;
                if (isSundaySchoolTeacherAssignment(row)) continue;
                if (!row.member_id) continue;

                if (!idsByDepartment.has(department)) {
                    idsByDepartment.set(department, new Set<string>());
                }
                idsByDepartment.get(department)!.add(row.member_id);
                allStudentIds.add(row.member_id);
            }

            const studentById = new Map(allMembers.map((row: any) => [row.id, row]));
            const nextByDepartment: Record<string, any[]> = {};

            idsByDepartment.forEach((idSet, department) => {
                nextByDepartment[department] = Array.from(idSet)
                    .map((id) => studentById.get(id))
                    .filter(Boolean)
                    .sort((a: any, b: any) => `${a.surname || ""} ${a.first_name || ""}`.localeCompare(`${b.surname || ""} ${b.first_name || ""}`));
            });

            setMembersByDepartment(nextByDepartment);

        } catch (err) {
            console.error("Error fetching members/assignments:", err);
            setMembers([]);
            setMembersByDepartment({});
        }
    };

    const handleOpenModal = async (session?: SundaySchoolSession) => {
        setMemberSearchTerm("");
        setMemberAssessmentScores({});
        if (session) {
            setNewSession(session);

            // Fetch attendance logs (with scores)
            const logs = await sundaySchoolService.getAttendanceLogs(session.id, 'sunday_school');
            const memberIds = logs?.map((l: any) => l.member_id) || [];

            // Load existing assessment scores
            const existingScores: Record<string, number | null> = {};
            for (const log of (logs || [])) {
                if (log.assessment_score != null) {
                    existingScores[log.member_id] = log.assessment_score;
                }
            }
            setMemberAssessmentScores(existingScores);

            // Load tardy member IDs
            const tardyIds = (logs || []).filter((l: any) => l.was_tardy === true).map((l: any) => l.member_id);
            setTardyMemberIds(tardyIds);

            // Primary linkage for newer records
            let registeredVisitors: any[] = [];
            const linkedVisitors = await sundaySchoolService.getVisitorsBySessionId(session.id);

            if (linkedVisitors?.length) {
                registeredVisitors = linkedVisitors;
            }

            // Backward compatibility for older records
            if (!registeredVisitors.length && memberIds.length > 0) {
                const visitorsData = await sundaySchoolService.getVisitorsByMemberIds(memberIds);
                registeredVisitors = visitorsData?.filter((v: any) => v.visit_date === session.session_date) || [];
            }

            const drafts: DraftVisitor[] = registeredVisitors.map(v => ({
                id: v.id,
                name: v.name,
                address: v.address,
                office_address: v.office_address,
                contact: v.contact_number,
                age: v.age,
                date_of_birth: v.date_of_birth,
                gender: v.gender,
                marital_status: v.marital_status as any,
                church_name: v.church_name,
                invited_by: v.invited_by,
                visit_time: (v.visit_time as 'AM' | 'PM') || 'AM',
                visit_date: v.visit_date || session.session_date,
                images: v.visitor_card_images || (v.visitor_card_image_url ? [v.visitor_card_image_url] : [])
            }));

            setNewVisitors(drafts);

            const registeredMemberIds = registeredVisitors.map(v => v.member_id);
            const tardySet = new Set(tardyIds);
            const remaining = memberIds.filter(mid => !registeredMemberIds.includes(mid) && !tardySet.has(mid));
            setSelectedMemberIds(remaining);
        } else {
            const defaultDepartment = managedDepartmentIds[0] || 'adult';
            setNewSession({
                session_date: getLatestSundayISODate(),
                department: defaultDepartment as any,
                members_present: 0,
                visitors_present: 0,
                total_attendance: 0,
                souls_saved: 0
            });
            setSelectedMemberIds([]);
            setTardyMemberIds([]);
            setNewVisitors([]); // Clear visitors for new session
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!isSundaySchoolAdmin) {
            alert("You have read-only access.");
            return;
        }
        if (!isSundaySchoolAdmin && !managedDepartmentIds.includes(newSession.department!)) {
            return alert("You don't have permission to save to this department.");
        }

        setSaving(true);
        try {
            const preparedVisitors = normalizeDraftVisitors(newVisitors);
            const invalidCardIndex = preparedVisitors.findIndex(visitor =>
                !visitor.name || !visitor.date_of_birth
            );
            if (invalidCardIndex >= 0) {
                throw new Error(`Visitor card #${invalidCardIndex + 1} is incomplete. Name and Date of Birth are required.`);
            }


            const selectedVisitorIds = selectedMemberIds.filter((id) => visitorMemberIds.has(id));
            const selectedRegularIds = selectedMemberIds.filter((id) => !visitorMemberIds.has(id));

            const manualVisitorsInput = Number(newSession.visitors_present) || 0;
            const visitorsPresent = Math.max(
                selectedVisitorIds.length,
                preparedVisitors.length > 0 ? preparedVisitors.length : manualVisitorsInput
            );
            const membersPresent = selectedRegularIds.length + tardyMemberIds.filter((id) => !visitorMemberIds.has(id)).length;
            const total = membersPresent + visitorsPresent;

            const sessionToSave = {
                ...newSession,
                members_present: membersPresent,
                visitors_present: visitorsPresent,
                total_attendance: total
            };

            const savedSession = await sundaySchoolService.upsertSundaySchoolSession(sessionToSave);

            // Clear old attendance
            await sundaySchoolService.deleteAttendanceLogs(savedSession.id, 'sunday_school');

            // Process New Visitors (Auto-Register with smart duplicate detection)
            const cardVisitorMemberIds: string[] = [];
            const cardRegularMemberIds: string[] = [];

            for (const visitor of preparedVisitors) {
                if (visitor.id && visitor.id.length > 20) { // Assuming UUIDs are longer than 20 chars
                    const vRecord = await sundaySchoolService.getVisitorById(visitor.id);
                    if (vRecord) {
                        // Update Visitor
                        await sundaySchoolService.updateVisitor({
                            id: visitor.id,
                            name: visitor.name,
                            contact_number: visitor.contact || '',
                            age: visitor.age,
                            gender: visitor.gender,
                            visit_date: visitor.visit_date || savedSession.session_date,
                            visit_time: visitor.visit_time || 'AM',
                            marital_status: visitor.marital_status || 'Single',
                            visitor_card_images: visitor.images || [],
                            address: visitor.address || '',
                            office_address: visitor.office_address || '',
                            church_name: visitor.church_name || '',
                            date_of_birth: visitor.date_of_birth,
                            invited_by: visitor.invited_by || '',
                            service_id: null,
                            sunday_school_session_id: savedSession.id
                        });

                        // Update Shadow Member
                        await memberService.updateMember(vRecord.member_id, {
                            first_name: visitor.name.split(' ')[0] || 'Visitor',
                            surname: visitor.name.split(' ').slice(1).join(' ') || '',
                            home_address: visitor.address || 'Unknown',
                            phone_number: visitor.contact || 'N/A',
                            gender: visitor.gender,
                            civil_status: visitor.marital_status || 'Single',
                            date_of_birth: visitor.date_of_birth || new Date().toISOString().split('T')[0]
                        });

                        const isVisitorMember = await memberService.isVisitorMember(vRecord.member_id);
                        if (isVisitorMember) cardVisitorMemberIds.push(vRecord.member_id);
                        else cardRegularMemberIds.push(vRecord.member_id);
                    }
                } else {
                    const matchedMember = await findExistingMemberForVisitor({
                        name: visitor.name,
                        contact: visitor.contact,
                        date_of_birth: visitor.date_of_birth,
                        gender: visitor.gender
                    });

                    if (matchedMember) {
                        // Existing regular member detected
                        cardRegularMemberIds.push(matchedMember.id);
                        continue;
                    }

                    const parsedName = splitVisitorName(visitor.name);

                    // Create New Member
                    const memberData = await memberService.createMember({
                        first_name: parsedName.firstName || 'Visitor',
                        surname: parsedName.surname || '',
                        is_regular_member: false,
                        membership_status: 'active',
                        home_address: visitor.address || 'Unknown',
                        phone_number: visitor.contact || 'N/A',
                        gender: visitor.gender,
                        civil_status: visitor.marital_status || 'Single',
                        date_of_birth: visitor.date_of_birth || new Date().toISOString().split('T')[0]
                    });

                    // Immediately clear the automatically generated member number for the visitor shadow record
                    await memberService.updateMember(memberData.id, {
                        member_number: null as any,
                        member_number_year: null as any,
                        member_number_seq: null as any
                    });

                    cardVisitorMemberIds.push(memberData.id);

                    await sundaySchoolService.createVisitor({
                        member_id: memberData.id,
                        name: visitor.name,
                        contact_number: visitor.contact || '',
                        age: visitor.age,
                        gender: visitor.gender,
                        visit_date: visitor.visit_date || savedSession.session_date,
                        visit_time: visitor.visit_time || 'AM',
                        marital_status: visitor.marital_status || 'Single',
                        visitor_card_images: visitor.images || [],
                        address: visitor.address || '',
                        office_address: visitor.office_address || '',
                        church_name: visitor.church_name || '',
                        date_of_birth: visitor.date_of_birth,
                        invited_by: visitor.invited_by || '',
                        service_id: null,
                        sunday_school_session_id: savedSession.id,
                        is_saved: false,
                        is_prospect_for_baptism: false,
                        follow_up_status: 'pending'
                    });
                }
            }

            // Save new attendance (Existing + New)
            const uniqueVisitorIds = Array.from(new Set([...selectedVisitorIds, ...cardVisitorMemberIds]));
            const uniqueRegularIds = Array.from(new Set([...selectedRegularIds, ...cardRegularMemberIds]));
            const tardyRegularIds = tardyMemberIds.filter((id) => !visitorMemberIds.has(id));
            const finalVisitorsCount = Math.max(uniqueVisitorIds.length, manualVisitorsInput);
            const finalMembersCount = uniqueRegularIds.length + tardyRegularIds.length;
            const allPresentMemberIds = Array.from(new Set([...uniqueRegularIds, ...uniqueVisitorIds]));
            const allMemberIds = Array.from(new Set([...allPresentMemberIds, ...tardyRegularIds]));

            await sundaySchoolService.updateSundaySchoolSession(savedSession.id, {
                members_present: finalMembersCount,
                visitors_present: finalVisitorsCount,
                total_attendance: finalMembersCount + finalVisitorsCount
            });

            if (allMemberIds.length > 0) {
                await sundaySchoolService.updateSundaySchoolAttendanceLogs(
                    savedSession.id,
                    savedSession.session_date,
                    allMemberIds,
                    memberAssessmentScores,
                    tardyMemberIds
                );
            }

            setIsModalOpen(false);
            setNewVisitors([]); // Reset
            setMemberAssessmentScores({});
            fetchSessions();
            if (!newSession.id) {
                setShowSuccessModal(true);
            }
        } catch (err: any) {
            alert("Error saving report: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!isSundaySchoolAdmin) {
            alert("You have read-only access.");
            return;
        }
        if (!confirmDelete.id) return;
        setSaving(true);
        try {
            await sundaySchoolService.deleteSundaySchoolSession(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null });
            setIsModalOpen(false);
            fetchSessions();
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleOpenAttendanceViewer = async (session: SundaySchoolSession) => {
        setAttendanceViewerSession(session);
        setAttendanceViewerLoading(true);
        setAttendanceViewerMembers([]);
        setAttendanceDayCounts({});
        setAttendanceViewerSearch("");
        setAttendanceViewerScores({});
        setAttendanceViewerScoreStats({});
        setAttendanceViewerOpen(true);

        try {
            // Get who was present for this specific session (with scores)
            const logs = await sundaySchoolService.getAttendanceLogsBySessionIds([session.id]);
            const presentMemberIds = logs.map((l) => l.member_id);

            // Build per-session score map
            const sessionScores: Record<string, number | null> = {};
            for (const log of logs) {
                sessionScores[log.member_id] = log.assessment_score ?? null;
            }
            setAttendanceViewerScores(sessionScores);

            // Get total days present for this department
            const dayCounts = await sundaySchoolService.getAttendanceCountsByDepartment(session.department);
            setAttendanceDayCounts(dayCounts);

            // Get assessment score stats for this department
            const scoreStats = await sundaySchoolService.getAssessmentScoresByDepartment(session.department);
            setAttendanceViewerScoreStats(scoreStats);

            // Resolve member details
            const allMembers = members.length > 0 ? members : await memberService.getAllMembers();
            const presentMembers = presentMemberIds
                .map((id) => allMembers.find((m: any) => m.id === id))
                .filter(Boolean)
                .sort((a: any, b: any) => `${a.surname || ""} ${a.first_name || ""}`.localeCompare(`${b.surname || ""} ${b.first_name || ""}`));

            setAttendanceViewerMembers(presentMembers);
        } catch (err) {
            console.error("Error loading attendance viewer:", err);
        } finally {
            setAttendanceViewerLoading(false);
        }
    };

    const handleOpenStudentEditor = (student: any) => {
        setEditingStudent({
            id: student.id,
            first_name: student.first_name || "",
            surname: student.surname || "",
            phone_number: student.phone_number || "",
            home_address: student.home_address || "",
            date_of_birth: student.date_of_birth || "",
            gender: student.gender || "Male",
            civil_status: student.civil_status || "Single",
        });
        setIsStudentEditorOpen(true);
    };

    const handleSaveStudentProfile = async () => {
        if (!isSundaySchoolAdmin) {
            alert("You have read-only access.");
            return;
        }
        if (!editingStudent?.id) return;

        setStudentSaving(true);
        try {
            const payload = {
                first_name: (editingStudent.first_name || "").trim(),
                surname: (editingStudent.surname || "").trim(),
                phone_number: (editingStudent.phone_number || "").trim(),
                home_address: (editingStudent.home_address || "").trim(),
                date_of_birth: editingStudent.date_of_birth || null,
                gender: editingStudent.gender || "Male",
                civil_status: editingStudent.civil_status || "Single",
            };

            if (!payload.first_name || !payload.surname) {
                throw new Error("First name and surname are required.");
            }

            await memberService.updateMember(editingStudent.id, payload as any);

            setIsStudentEditorOpen(false);
            setEditingStudent(null);
            await fetchMembers();
        } catch (err: any) {
            alert("Error saving student profile: " + err.message);
        } finally {
            setStudentSaving(false);
        }
    };

    const attendanceMembers = isSundaySchoolAdmin
        ? members
        : (membersByDepartment[(newSession.department || "") as string] || []);

    const latestDate = sessions.length > 0 ? sessions[0].session_date : null;
    const latestSessions = sessions.filter(s => s.session_date === latestDate);

    const totalAttendanceToday = latestSessions.reduce((sum, s) => sum + s.total_attendance, 0);
    const newVisitorsToday = latestSessions.reduce((sum, s) => sum + (s.visitors_present || 0), 0);
    const soulsSavedToday = latestSessions.reduce((sum, s) => sum + (s.souls_saved || 0), 0);

    // Calculate this month's summary
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthSessions = sessions.filter(s => {
        const d = new Date(s.session_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const thisMonthAttendance = thisMonthSessions.reduce((sum, s) => sum + s.total_attendance, 0);
    const thisMonthVisitors = thisMonthSessions.reduce((sum, s) => sum + (s.visitors_present || 0), 0);
    const thisMonthSaved = thisMonthSessions.reduce((sum, s) => sum + (s.souls_saved || 0), 0);

    // Department wise latest stats
    const latestDeptStats = DEPARTMENTS.reduce((acc, dept) => {
        const session = latestSessions.find(s => s.department === dept.id);
        if (session) {
            acc[dept.id] = { attendance: session.total_attendance, trend: session.total_attendance > 0 ? '+inc' : 'same' };
        } else {
            acc[dept.id] = { attendance: 0, trend: 'same' };
        }
        return acc;
    }, {} as Record<string, { attendance: number, trend: string }>);

    const latestChildrenAttendance = CHILDREN_DEPARTMENTS.reduce((sum, deptId) => sum + (latestDeptStats[deptId]?.attendance || 0), 0);
    const childrenSessions = sessions.filter((s) => CHILDREN_DEPARTMENTS.includes(s.department));

    const isChildTeacherOnly = !isSundaySchoolAdmin && !isPastor && managedDepartmentIds.some((id) => CHILDREN_DEPARTMENTS.includes(id)) && !managedDepartmentIds.includes('adult') && !managedDepartmentIds.includes('beginners');

    // List filtering
    const filteredSessions = sessions.filter(session => {
        const deptLabel = DEPARTMENTS.find(d => d.id === session.department)?.label || '';
        return deptLabel.toLowerCase().includes(departmentSearchTerm.toLowerCase());
    });

    const paginatedSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
    const selectedVisitorCountInModal = selectedMemberIds.filter((id) => visitorMemberIds.has(id)).length;
    const selectedRegularCountInModal = selectedMemberIds.length - selectedVisitorCountInModal;
    const visitorsCountInModalBase = newVisitors.length > 0 ? newVisitors.length : (Number(newSession.visitors_present) || 0);
    const visitorsCountInModal = Math.max(visitorsCountInModalBase, selectedVisitorCountInModal);
    const supportsVisitorCards = isVisitorCardDepartment(newSession.department);
    const supportsSoulsSaved = isSoulsSavedDepartment(newSession.department);
    const selectedDepartmentLabel = DEPARTMENTS.find(d => d.id === newSession.department)?.label || 'Selected Department';
    const availableDepartments = DEPARTMENTS.filter((dept) => managedDepartmentIds.includes(dept.id));

    useEffect(() => {
        if (!isModalOpen) return;
        const allowedIds = new Set(attendanceMembers.map((row) => row.id));
        setSelectedMemberIds((prev) => {
            const filtered = prev.filter((id) => allowedIds.has(id));
            return filtered.length === prev.length ? prev : filtered;
        });
    }, [isModalOpen, attendanceMembers]);

    useEffect(() => {
        if (managedDepartmentIds.length === 0) return;
        const currentDepartment = newSession.department as SundaySchoolDepartmentId | undefined;
        const hasCurrent = Boolean(currentDepartment && managedDepartmentIds.includes(currentDepartment));
        if (!hasCurrent) {
            setNewSession((prev) => ({ ...prev, department: managedDepartmentIds[0] as any }));
        }
    }, [managedDepartmentIds.join("|"), newSession.department]);

    if (authLoading || accessLoading) {
        return (
            <div className="space-y-8 p-6 lg:p-10 max-w-7xl mx-auto">
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                    Loading Sunday School access...
                </div>
            </div>
        );
    }

    if (!hasSundaySchoolAccess) {
        return (
            <div className="space-y-8 p-6 lg:p-10 max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl border border-red-100 p-8">
                    <h1 className="text-2xl font-bold text-red-600">Access Restricted</h1>
                    <p className="text-sm text-gray-600 mt-2">
                        You are unable to access this section. Please contact the administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6 lg:p-10 max-w-7xl mx-auto">
            {/* Simplified Overview Dashboard */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                {/* Header bar */}
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <BookOpen size={20} className="text-blue-600" /> Sunday School Overview
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Logged in as <span className="text-blue-600 font-semibold">{currentMember?.first_name} {currentMember?.surname}</span>
                            {!isSundaySchoolAdmin ? (
                                <span> — {getSundaySchoolScopeLabel(teacherDepartments as any[])} Teacher</span>
                            ) : (
                                <span> — Admin</span>
                            )}
                        </p>
                    </div>
                    {latestDate && (
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Latest: {new Date(latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                    )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                    <div className="px-5 py-4">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><Users size={12} /> Latest Sunday</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{totalAttendanceToday}</p>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><Calendar size={12} /> This Month</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{thisMonthAttendance}</p>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><UserPlus size={12} /> Visitors</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{thisMonthVisitors}</p>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><Heart size={12} /> Souls Saved</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{thisMonthSaved}</p>
                    </div>
                </div>

                {/* Department quick links */}
                <div className="px-6 py-3 flex flex-wrap gap-2">
                    {(isChildTeacherOnly ? [{ id: 'children' as const, label: 'Children', color: '#0088FE' }] : DEPARTMENTS.filter((dept) => managedDepartmentIds.includes(dept.id))).map((dept) => {
                        const stats = dept.id === 'children'
                            ? { attendance: latestChildrenAttendance }
                            : latestDeptStats[dept.id];
                        return (
                            <button
                                key={dept.id}
                                onClick={() => document.getElementById(dept.id === 'children' ? 'dept-children' : `dept-${dept.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border hover:shadow-sm"
                                style={{
                                    backgroundColor: `${dept.color}10`,
                                    borderColor: `${dept.color}30`,
                                    color: dept.color
                                }}
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
                                {dept.label}
                                <span className="bg-white/80 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-black">
                                    {stats.attendance}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Isolated Departments */}
            <div className="space-y-10">
                {isChildTeacherOnly ? (
                    <div key="children">
                        <div id="dept-children" className="px-3 py-2 text-sm font-bold uppercase tracking-widest text-gray-500">
                            Children
                        </div>
                        <div className="space-y-8">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-300 overflow-hidden">
                                <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style={{ backgroundColor: '#0088FE15', borderColor: '#0088FE30' }}>
                                    <div>
                                        <h3 className="text-xl font-bold flex items-center gap-3 text-[#0088FE]">
                                            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: '#0088FE' }} />
                                            Children
                                        </h3>
                                        <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-widest">Read-Only Mode</p>
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => {
                                                setNewSession({
                                                    session_date: getLatestSundayISODate(),
                                                    department: CHILDREN_DEPARTMENTS[0] as any,
                                                    members_present: 0,
                                                    visitors_present: 0,
                                                    total_attendance: 0,
                                                    souls_saved: 0
                                                });
                                                setSelectedMemberIds([]);
                                                setNewVisitors([]);
                                                setIsModalOpen(true);
                                            }}
                                            className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm bg-white hover:bg-gray-50"
                                            style={{ color: '#0088FE', border: '1px solid rgba(0, 136, 254, 0.25)' }}
                                        >
                                            <Plus size={16} /> File Children Report
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[700px]">
                                        <thead className="bg-gray-50/50">
                                            <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                <th className="p-4 pl-6">Date</th>
                                                <th className="p-4">Department</th>
                                                <th className="p-4 text-center">Members</th>
                                                <th className="p-4 text-center">Visitors</th>
                                                <th className="p-4 text-center">Total</th>
                                                <th className="p-4 text-center">Saved</th>
                                                <th className="p-4 pr-6 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {childrenSessions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="p-8 text-center text-gray-400 font-medium">No reports filed for Children yet.</td>
                                                </tr>
                                            ) : (
                                                childrenSessions.map((session) => {
                                                    const dept = DEPARTMENTS.find((item) => item.id === session.department);
                                                    return (
                                                        <tr key={session.id} className="hover:bg-gray-50/50 transition-colors text-sm group">
                                                            <td className="p-4 pl-6 font-semibold text-gray-900">
                                                                {new Date(session.session_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}
                                                            </td>
                                                            <td className="p-4 text-gray-500">{dept?.label || session.department}</td>
                                                            <td className="p-4 text-center text-gray-500 font-medium">{session.members_present}</td>
                                                            <td className="p-4 text-center text-gray-500 font-medium">{session.visitors_present}</td>
                                                            <td className="p-4 text-center font-bold text-gray-900 bg-gray-50">{session.total_attendance}</td>
                                                            <td className="p-4 text-center">
                                                                {(session.souls_saved || 0) > 0 ? (
                                                                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold inline-block min-w-[28px]">
                                                                        {session.souls_saved}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 pr-6 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleOpenAttendanceViewer(session)}
                                                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-emerald-200"
                                                                        title="View Attendance"
                                                                    >
                                                                        <Eye size={14} /> Attendance
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleOpenModal(session)}
                                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-blue-200"
                                                                        title="Edit Report"
                                                                    >
                                                                        <Edit2 size={14} /> Edit
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    DEPARTMENT_GROUPS.filter((group) => group.departments.some((deptId) => managedDepartmentIds.includes(deptId))).map((group) => (
                        <div key={group.id}>
                            <div className="px-3 py-2 text-sm font-bold uppercase tracking-widest text-gray-500">
                                {group.label}
                            </div>
                            <div className="space-y-8">
                                {group.departments.map((deptId) => {
                                    const dept = DEPARTMENTS.find((item) => item.id === deptId);
                                    if (!dept) return null;
                                    const isManaged = managedDepartmentIds.includes(dept.id);
                                    const deptSessions = sessions.filter((s) => s.department === dept.id);
                                    return (
                                        <div key={dept.id} id={`dept-${dept.id}`} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isManaged ? 'border-gray-300 shadow-md' : 'border-gray-100 opacity-90'}`}>
                                            {/* Department Header */}
                                            <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative" style={{ backgroundColor: `${dept.color}15`, borderColor: `${dept.color}30` }}>
                                                <div className="z-10 relative">
                                                    <h3 className="text-xl font-bold flex items-center gap-3" style={{ color: isManaged ? dept.color : '#4b5563' }}>
                                                        {/* Dot indicator */}
                                                        <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: dept.color }}></span>
                                                        {dept.label}
                                                    </h3>
                                                    {!isManaged && <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-widest">Read-Only Mode</p>}
                                                </div>
                                                <div className="z-10 relative">
                                                    {isManaged && (
                                                        <button
                                                            onClick={() => {
                                                                setNewSession({
                                                                    session_date: getLatestSundayISODate(),
                                                                    department: dept.id as any,
                                                                    members_present: 0,
                                                                    visitors_present: 0,
                                                                    total_attendance: 0,
                                                                    souls_saved: 0
                                                                });
                                                                setSelectedMemberIds([]);
                                                                setNewVisitors([]);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm bg-white hover:bg-gray-50"
                                                            style={{ color: dept.color, border: `1px solid ${dept.color}40` }}
                                                        >
                                                            <Plus size={16} /> File {dept.label} Report
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Department Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-[700px]">
                                                    <thead className="bg-gray-50/50">
                                                        <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                            <th className="p-4 pl-6">Date</th>
                                                            <th className="p-4 text-center">Members</th>
                                                            <th className="p-4 text-center">Visitors</th>
                                                            <th className="p-4 text-center">Total</th>
                                                            <th className="p-4 text-center">Saved</th>
                                                            <th className="p-4 pr-6 text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {deptSessions.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={6} className="p-8 text-center text-gray-400 font-medium">No reports filed for {dept.label} yet.</td>
                                                            </tr>
                                                        ) : (
                                                            deptSessions.slice(0, 5).map((session) => (
                                                                <tr key={session.id} className="hover:bg-gray-50/50 transition-colors text-sm group">
                                                                    <td className="p-4 pl-6 font-semibold text-gray-900">
                                                                        {new Date(session.session_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}
                                                                    </td>
                                                                    <td className="p-4 text-center text-gray-500 font-medium">{session.members_present}</td>
                                                                    <td className="p-4 text-center text-gray-500 font-medium">{session.visitors_present}</td>
                                                                    <td className="p-4 text-center font-bold text-gray-900 bg-gray-50">{session.total_attendance}</td>
                                                                    <td className="p-4 text-center">
                                                                        {(session.souls_saved || 0) > 0 ? (
                                                                            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold inline-block min-w-[28px]">
                                                                                {session.souls_saved}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-gray-300">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4 pr-6 text-right">
                                                                        <div className="flex justify-end gap-2">
                                                                            <button
                                                                                onClick={() => handleOpenAttendanceViewer(session)}
                                                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-emerald-200"
                                                                                title="View Attendance"
                                                                            >
                                                                                <Eye size={14} /> Attendance
                                                                            </button>
                                                                            {isManaged ? (
                                                                                <button
                                                                                    onClick={() => handleOpenModal(session)}
                                                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-blue-200"
                                                                                    title="Edit Report"
                                                                                >
                                                                                    <Edit2 size={14} /> Edit
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setNewSession(session);
                                                                                        setIsModalOpen(true);
                                                                                    }}
                                                                                    className="px-3 py-1.5 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-gray-200"
                                                                                    title="View Report"
                                                                                >
                                                                                    <Eye size={14} /> View
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                            {/* Body */}
                            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                                <h2 className="text-xl font-bold flex items-center gap-3 text-gray-900 border-b border-gray-100 pb-4">
                                    <BookOpen size={24} className="text-blue-600" />
                                    {newSession.id ? 'Edit Report' : 'File New Report'}
                                </h2>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            value={newSession.session_date}
                                            onChange={(e) => setNewSession({ ...newSession, session_date: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Department</label>
                                        {!newSession.id ? (
                                            <select
                                                value={newSession.department}
                                                onChange={(e) => setNewSession({ ...newSession, department: e.target.value as any })}
                                                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm font-sans"
                                            >
                                                {availableDepartments.map((dept) => (
                                                    <option key={dept.id} value={dept.id}>
                                                        {dept.label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-bold text-gray-700 shadow-sm cursor-not-allowed">
                                                {DEPARTMENTS.find(d => d.id === newSession.department)?.label}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Alert Context */}
                                {!isSundaySchoolAdmin ? (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm font-medium">
                                        {newSession.id ? (
                                            <span>You are editing the <span className="font-bold">{DEPARTMENTS.find(d => d.id === newSession.department)?.label}</span> report for <span className="font-bold">{new Date(newSession.session_date || '').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span>. Continue?</span>
                                        ) : (
                                            <span>You are filing a new report for the <span className="font-bold">{DEPARTMENTS.find(d => d.id === newSession.department)?.label}</span> {new Date(newSession.session_date || '').toLocaleDateString()}.</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 text-sm font-medium">
                                        <p>You are viewing this as an <strong>Administrator</strong>.</p>
                                    </div>
                                )}

                                {/* Attendance */}
                                <div className="space-y-4 border-t border-gray-100 pt-6">
                                    <MemberAttendancePicker
                                        label="Members Present"
                                        members={attendanceMembers}
                                        selectedIds={selectedMemberIds}
                                        onChange={setSelectedMemberIds}
                                        tardyIds={tardyMemberIds}
                                        onTardyChange={setTardyMemberIds}
                                        onEditMember={handleOpenStudentEditor}
                                        searchTerm={memberSearchTerm}
                                        onSearchTermChange={setMemberSearchTerm}
                                        maxHeightClass="max-h-[160px]"
                                        showVisitorToggle
                                    />
                                    {!isSundaySchoolAdmin && attendanceMembers.length === 0 && (
                                        <p className="text-xs font-semibold text-amber-700">
                                            No students are assigned to this department yet. Add student assignments in Ministry Directory.
                                        </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-6 pt-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Visitors / Non-Members Present</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={newSession.visitors_present}
                                                onChange={(e) => setNewSession({ ...newSession, visitors_present: parseInt(e.target.value) || 0 })}
                                                className="w-full border border-gray-200 rounded-lg p-3 text-center text-xl font-bold bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                            />
                                            <p className="text-[10px] text-gray-500 mt-1 font-semibold">
                                                Visitor cards encoded: {newVisitors.length}
                                            </p>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 text-center">Total</label>
                                            <div className="w-full bg-blue-50 text-gray-900 font-bold text-xl rounded-lg p-3 flex items-center justify-center border border-blue-100 shadow-sm h-[54px]">
                                                {selectedRegularCountInModal + visitorsCountInModal}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visitor Card Input for Nursery/Juniors */}
                                    {supportsVisitorCards && (
                                        <div className="space-y-2 pt-6">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Visitor Card Image</label>
                                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-4 items-center transition-colors hover:border-blue-300">
                                                <ImageUpload
                                                    value={newSession.visitor_card_url || ''}
                                                    onChange={(url) => setNewSession({ ...newSession, visitor_card_url: url })}
                                                    folder={`sunday-school/${newSession.department || 'general'}`}
                                                    label=""
                                                    description="Upload photo of visitor card (JPG/PNG)"
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">Visit tracking required for Nursery/Toddler & Primary and Junior departments.</p>
                                        </div>
                                    )}
                                </div>

                                {supportsSoulsSaved && (
                                    <div className="pt-6 border-t border-gray-100">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Souls Saved</label>
                                        <div className="flex items-center gap-4 bg-gray-50 border border-gray-100 p-4 rounded-xl">
                                            <Heart size={20} className="text-red-500 shrink-0" />
                                            <input
                                                type="number"
                                                min="0"
                                                value={newSession.souls_saved ?? 0}
                                                onChange={(e) => setNewSession({ ...newSession, souls_saved: parseInt(e.target.value) || 0 })}
                                                className="w-full border border-gray-200 rounded-lg p-3 text-center text-xl font-bold bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Assessment Review Scores */}
                                {selectedMemberIds.length > 0 && (
                                    <div className="pt-6 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <ClipboardCheck size={13} /> Assessment Review Scores
                                            </label>
                                            <span className="text-[10px] font-semibold text-gray-400">
                                                {Object.values(memberAssessmentScores).filter(v => v != null && v > 0).length}/{selectedMemberIds.length} submitted
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mb-3">
                                            Enter scores for members who submitted their assessment review questions. Leave blank if not submitted.
                                        </p>
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                                            <div className="divide-y divide-gray-100">
                                                {selectedMemberIds.map((memberId) => {
                                                    const member = attendanceMembers.find((m) => m.id === memberId);
                                                    if (!member) return null;
                                                    const score = memberAssessmentScores[memberId];
                                                    return (
                                                        <div key={memberId} className="flex items-center justify-between px-4 py-2 hover:bg-gray-100/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-800 truncate flex-1 mr-3">
                                                                {member.first_name} {member.surname}
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                placeholder="—"
                                                                value={score != null ? score : ""}
                                                                onChange={(e) => {
                                                                    const val = e.target.value === "" ? null : parseInt(e.target.value) || 0;
                                                                    setMemberAssessmentScores(prev => ({
                                                                        ...prev,
                                                                        [memberId]: val
                                                                    }));
                                                                }}
                                                                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm font-bold bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Quick Register Visitors */}
                                {supportsVisitorCards && (
                                    <div className="border border-gray-200 rounded-[16px] overflow-hidden">
                                        <QuickVisitorRegistration
                                            visitors={newVisitors}
                                            onChange={setNewVisitors}
                                            folderPath={`sunday-school/${newSession.department || 'general'}/cards`}
                                            defaultVisitDate={newSession.session_date}
                                            contextLabel={`${selectedDepartmentLabel}${newSession.session_date ? ` | ${newSession.session_date}` : ''}`}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Sticky Footer */}
                            <div className="bg-[#1e2333] p-4 px-6 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] relative z-10 transition-colors">
                                <div className="flex gap-2">
                                    {newSession.id && (
                                        <button
                                            onClick={() => setConfirmDelete({ isOpen: true, id: newSession.id! })}
                                            className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors text-xs font-bold uppercase tracking-widest"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-4 items-center">
                                    <button
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            setSelectedMemberIds([]);
                                        }}
                                        className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2 px-4"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)] rounded-lg px-8 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? 'Saving...' : (newSession.id ? 'Save Changes' : 'Submit Report')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isStudentEditorOpen && editingStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900">Edit Student Profile</h3>
                                <p className="text-xs text-gray-500 mt-1">Update student details for your class roster.</p>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">First Name</label>
                                    <input
                                        type="text"
                                        value={editingStudent.first_name}
                                        onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Surname</label>
                                    <input
                                        type="text"
                                        value={editingStudent.surname}
                                        onChange={(e) => setEditingStudent({ ...editingStudent, surname: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                                    <input
                                        type="text"
                                        value={editingStudent.phone_number}
                                        onChange={(e) => setEditingStudent({ ...editingStudent, phone_number: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={editingStudent.date_of_birth || ""}
                                        onChange={(e) => setEditingStudent({ ...editingStudent, date_of_birth: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Home Address</label>
                                    <input
                                        type="text"
                                        value={editingStudent.home_address}
                                        onChange={(e) => setEditingStudent({ ...editingStudent, home_address: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
                                <button
                                    onClick={() => {
                                        setIsStudentEditorOpen(false);
                                        setEditingStudent(null);
                                    }}
                                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveStudentProfile}
                                    disabled={studentSaving}
                                    className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {studentSaving ? "Saving..." : "Save Student"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Attendance Viewer Modal */}
            {
                attendanceViewerOpen && attendanceViewerSession && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300">
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Users size={20} className="text-emerald-600" />
                                        Attendance Details
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {DEPARTMENTS.find(d => d.id === attendanceViewerSession.department)?.label} — {new Date(attendanceViewerSession.session_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setAttendanceViewerOpen(false); setAttendanceViewerSession(null); }}
                                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Summary bar */}
                            <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-4 text-sm">
                                <span className="font-bold text-emerald-700">
                                    {attendanceViewerMembers.length} present
                                </span>
                                <span className="text-gray-400">|</span>
                                <span className="text-gray-600">
                                    Total: <strong>{attendanceViewerSession.total_attendance}</strong>
                                </span>
                                {(attendanceViewerSession.visitors_present || 0) > 0 && (
                                    <>
                                        <span className="text-gray-400">|</span>
                                        <span className="text-gray-600">
                                            Visitors: <strong>{attendanceViewerSession.visitors_present}</strong>
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Search */}
                            <div className="px-6 py-3 border-b border-gray-100">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        value={attendanceViewerSearch}
                                        onChange={(e) => setAttendanceViewerSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Member List */}
                            <div className="flex-1 overflow-y-auto">
                                {attendanceViewerLoading ? (
                                    <div className="p-8 text-center text-gray-500">Loading attendance data...</div>
                                ) : attendanceViewerMembers.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <Users size={32} className="mx-auto mb-2 opacity-40" />
                                        <p className="font-medium">No attendance records found</p>
                                        <p className="text-xs mt-1">No members were marked present for this session.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {/* Table Header */}
                                        <div className="px-4 py-2.5 bg-gray-50/80 grid grid-cols-20 gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky top-0" style={{ gridTemplateColumns: '24px 1fr 60px 56px 56px' }}>
                                            <div>#</div>
                                            <div>Student Name</div>
                                            <div className="text-center">Status</div>
                                            <div className="text-center">Score</div>
                                            <div className="text-center">Days</div>
                                        </div>
                                        {attendanceViewerMembers
                                            .filter((m) => {
                                                if (!attendanceViewerSearch) return true;
                                                const term = attendanceViewerSearch.toLowerCase();
                                                return `${m.first_name || ''} ${m.surname || ''}`.toLowerCase().includes(term);
                                            })
                                            .map((member, idx) => {
                                                const sessionScore = attendanceViewerScores[member.id];
                                                const scoreStats = attendanceViewerScoreStats[member.id];
                                                return (
                                                    <div
                                                        key={member.id}
                                                        className="px-4 py-2.5 items-center hover:bg-gray-50/50 transition-colors text-sm grid"
                                                        style={{ gridTemplateColumns: '24px 1fr 60px 56px 56px', gap: '8px' }}
                                                    >
                                                        <div className="text-gray-400 font-medium text-xs">{idx + 1}</div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900 text-sm truncate">
                                                                {member.first_name} {member.surname}
                                                            </p>
                                                            {scoreStats && scoreStats.submissionCount > 0 && (
                                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                                    Avg: {Math.round(scoreStats.totalScore / scoreStats.submissionCount)} ({scoreStats.submissionCount}x)
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-center">
                                                            <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                                                <CheckCircle2 size={9} /> Present
                                                            </span>
                                                        </div>
                                                        <div className="text-center">
                                                            {sessionScore != null && sessionScore > 0 ? (
                                                                <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                    <Star size={9} /> {sessionScore}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 text-xs">—</span>
                                                            )}
                                                        </div>
                                                        <div className="text-center">
                                                            <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                <Hash size={9} />
                                                                {attendanceDayCounts[member.id] || 0}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
                                <button
                                    onClick={() => { setAttendanceViewerOpen(false); setAttendanceViewerSession(null); }}
                                    className="px-5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <SuccessModal
                isOpen={showSuccessModal}
                onDone={() => setShowSuccessModal(false)}
                onView={() => setShowSuccessModal(false)} // Usually routes to a view, but close for now
            />
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title="Delete Sunday School Report"
                message="Are you sure you want to PERMANENTLY delete this department report? This will also remove associated attendance logs."
                confirmText="Delete Record"
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
            />
        </div >
    );
};

export default SundaySchool;
