
import React, { useState, useEffect, useMemo } from "react";
import * as sundaySchoolService from "@/services/sundaySchoolService";
import * as memberService from "@/services/memberService";
import { getLatestSundayISODate } from "@/lib/date";
import type { SundaySchoolSession } from "@/types";
import { UserRole } from "@/types";
import {
    BookOpen,
    Plus,
    Heart,
    Users,
    UserPlus,
    Eye,
    Edit2,
    Calendar,
    ClipboardCheck,
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
import StudentEditorModal from "@/components/SundaySchool/StudentEditorModal";
import AttendanceViewerModal from "@/components/SundaySchool/AttendanceViewerModal";
import SundaySchoolDashboard from "@/components/SundaySchool/SundaySchoolDashboard";
import SundaySchoolTabs from "@/components/SundaySchool/SundaySchoolTabs";
import ClassManager from "@/components/SundaySchool/ClassManager";
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
    const [searchAllRegistry, setSearchAllRegistry] = useState(false);

    // Attendance Viewer State
    const [attendanceViewerOpen, setAttendanceViewerOpen] = useState(false);
    const [attendanceViewerSession, setAttendanceViewerSession] = useState<SundaySchoolSession | null>(null);
    const [attendanceViewerMembers, setAttendanceViewerMembers] = useState<any[]>([]);
    const [attendanceDayCounts, setAttendanceDayCounts] = useState<Record<string, number>>({});
    const [attendanceViewerLoading, setAttendanceViewerLoading] = useState(false);
    const [attendanceViewerSearch, setAttendanceViewerSearch] = useState("");
    const [attendanceViewerScores, setAttendanceViewerScores] = useState<Record<string, number | null>>({});
    const [attendanceViewerScoreStats, setAttendanceViewerScoreStats] = useState<Record<string, { totalScore: number; submissionCount: number }>>({});
    const [attendanceViewerTardyIds, setAttendanceViewerTardyIds] = useState<Set<string>>(new Set());

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
        setSearchAllRegistry(false);
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
        if (!isSundaySchoolAdmin && !managedDepartmentIds.includes(newSession.department!)) {
            alert("You don't have permission to save to this department.");
            return;
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
            alert("Only administrators can delete sessions.");
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

            // Build per-session score map and tardy set
            const sessionScores: Record<string, number | null> = {};
            const tardySet = new Set<string>();
            for (const log of logs) {
                sessionScores[log.member_id] = log.assessment_score ?? null;
                if (log.was_tardy) {
                    tardySet.add(log.member_id);
                }
            }
            setAttendanceViewerScores(sessionScores);
            setAttendanceViewerTardyIds(tardySet);

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
        if (!isSundaySchoolAdmin && teacherDepartments.length === 0) {
            alert("You don't have permission to edit student profiles.");
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

    const attendanceMembers = useMemo(() => {
        if (isSundaySchoolAdmin || searchAllRegistry) return members;
        const deptStudents = membersByDepartment[(newSession.department || "") as string] || [];
        const visitors = (members || []).filter((m: any) => m.is_regular_member === false);
        
        // Ensure that already selected or tardy members are kept in the list so their selection state is not wiped out
        const activeIds = new Set([
            ...selectedMemberIds,
            ...tardyMemberIds
        ]);
        const selectedMembersList = (members || []).filter(m => activeIds.has(m.id));

        const combined = [...deptStudents, ...visitors, ...selectedMembersList];
        const seen = new Set();
        return combined.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });
    }, [isSundaySchoolAdmin, searchAllRegistry, members, membersByDepartment, newSession.department, selectedMemberIds, tardyMemberIds]);

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
            <SundaySchoolDashboard
                currentMember={currentMember}
                isSundaySchoolAdmin={isSundaySchoolAdmin}
                teacherDepartments={teacherDepartments}
                latestDate={latestDate}
                totalAttendanceToday={totalAttendanceToday}
                thisMonthAttendance={thisMonthAttendance}
                thisMonthVisitors={thisMonthVisitors}
                thisMonthSaved={thisMonthSaved}
            />

            <SundaySchoolTabs
                isChildTeacherOnly={isChildTeacherOnly}
                DEPARTMENTS={DEPARTMENTS}
                managedDepartmentIds={managedDepartmentIds}
                latestChildrenAttendance={latestChildrenAttendance}
                latestDeptStats={latestDeptStats}
            />

            <ClassManager
                isChildTeacherOnly={isChildTeacherOnly}
                CHILDREN_DEPARTMENTS={CHILDREN_DEPARTMENTS}
                DEPARTMENTS={DEPARTMENTS}
                DEPARTMENT_GROUPS={DEPARTMENT_GROUPS}
                managedDepartmentIds={managedDepartmentIds}
                sessions={sessions}
                childrenSessions={childrenSessions}
                handleOpenModal={handleOpenModal}
                handleOpenAttendanceViewer={handleOpenAttendanceViewer}
                setNewSession={setNewSession}
                setSelectedMemberIds={setSelectedMemberIds}
                setNewVisitors={setNewVisitors}
                setIsModalOpen={setIsModalOpen}
            />

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
                                    {!isSundaySchoolAdmin && members.length <= 1 && (
                                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm font-medium">
                                            <p className="font-bold mb-1">⚠️ Database Policy Restriction</p>
                                            <p className="text-xs leading-relaxed">
                                                Only your profile is visible. The Supabase security policy (RLS) is restricting access to students and visitor profiles. Please ensure you have executed the contents of the <strong>fix_sunday_school_roles_rls.sql</strong> patch in your Supabase SQL Editor.
                                            </p>
                                        </div>
                                    )}

                                    {!isSundaySchoolAdmin && (
                                        <label className="inline-flex items-center gap-2 text-xs text-gray-700 font-bold bg-gray-50 border border-gray-100 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors w-full">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                                checked={searchAllRegistry}
                                                onChange={(e) => setSearchAllRegistry(e.target.checked)}
                                            />
                                            <span>Search entire church registry (for unassigned members/students)</span>
                                        </label>
                                    )}

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
                                        emptyMessage={searchAllRegistry ? undefined : "No students are assigned to this department yet."}
                                    />
                                    {!isSundaySchoolAdmin && !searchAllRegistry && attendanceMembers.length === 0 && (
                                        <p className="text-xs font-semibold text-amber-700 leading-relaxed">
                                            No students are assigned to this department yet. Add student assignments in Ministry Directory, or check the box above to search and select any member from the registry.
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

            {isStudentEditorOpen && editingStudent && (
                <StudentEditorModal
                    editingStudent={editingStudent}
                    studentSaving={studentSaving}
                    onClose={() => { setIsStudentEditorOpen(false); setEditingStudent(null); }}
                    onSave={handleSaveStudentProfile}
                    onChange={setEditingStudent}
                />
            )}

            {/* Attendance Viewer Modal */}
            {attendanceViewerOpen && attendanceViewerSession && (
                <AttendanceViewerModal
                    session={attendanceViewerSession}
                    members={attendanceViewerMembers}
                    loading={attendanceViewerLoading}
                    search={attendanceViewerSearch}
                    onSearchChange={setAttendanceViewerSearch}
                    scores={attendanceViewerScores}
                    scoreStats={attendanceViewerScoreStats}
                    tardyIds={attendanceViewerTardyIds}
                    dayCounts={attendanceDayCounts}
                    onClose={() => { setAttendanceViewerOpen(false); setAttendanceViewerSession(null); }}
                />
            )}

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
