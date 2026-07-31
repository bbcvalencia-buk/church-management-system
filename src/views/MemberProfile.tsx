import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    User, Heart, Shield, Users, ArrowLeft, Save, Upload, Trash2,
    MapPin, TrendingUp, Star, Mail, Edit3, Printer, CheckCircle2, Phone, Home, BookOpen, Clock, Activity, FileText, Calendar, Eye, MessageSquare, AlertCircle, Mic, Lock
} from "lucide-react";

import { uploadFile, deleteFile } from "../lib/storage";
import { supabase } from "../lib/supabase";
import * as memberService from "../services/memberService";
import * as financeService from "../services/financeService";
import * as serviceService from "../services/serviceService";
import * as sundaySchoolService from "../services/sundaySchoolService";
import * as goodnewsService from "../services/goodnewsService";
import * as requestService from "../services/requestService";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import Skeleton from "@/components/Skeleton";
import { UserRole, type Member } from "@/types";

import ProfileHeader from "../components/MemberProfile/ProfileHeader";
import PersonalDetailsForm from "../components/MemberProfile/PersonalDetailsForm";
import ActivityHistory from "../components/MemberProfile/ActivityHistory";
import FinancialSummary from "../components/MemberProfile/FinancialSummary";

import BioForm from "../components/members/BioForm";
import ContactForm from "../components/members/ContactForm";
import SpiritualForm from "../components/members/SpiritualForm";
import PositionsForm from "../components/members/PositionsForm";
import FamilyForm from "../components/members/FamilyForm";
import FaithPromiseForm from "../components/members/FaithPromiseForm";
import EditRequestModal from "@/components/MemberProfile/EditRequestModal";
import MinistryMatesModal from "@/components/MemberProfile/MinistryMatesModal";

const MINISTRY_CATEGORY_LABELS: Record<string, string> = {
    leadership: "Pastoral & Admin",
    music_ministry: "Music & Creatives",
    sunday_school_adult: "Sunday School & Ed.",
    sunday_school_children: "Sunday School & Ed.",
    beginners_class: "Sunday School & Ed.",
    other_ministries: "Operations & Support",
};

const MINISTRY_DEPARTMENT_LABELS: Record<string, string> = {
    adult: "Sunday School Adult",
    beginners: "Sunday School Beginners Class",
    nursery: "Sunday School Nursery/Toddler",
    kinder: "Sunday School Kindergarten",
    primary: "Sunday School Primary",
    junior: "Sunday School Junior",
};

const formatMinistryCategory = (category?: string | null) => {
    if (!category || category === "null") return "General";
    return MINISTRY_CATEGORY_LABELS[category] || category.replace(/_/g, " ");
};

const formatMinistryDepartment = (department?: string | null) => {
    if (!department) return "";
    return MINISTRY_DEPARTMENT_LABELS[department] || department;
};

interface AttendanceInsights {
    sundayMorningNet: number;
    sundayMorningRaw: number;
    sundayMorningDedupe: number;
    childrenDepartmentDates: number;
    sundayAfternoon: number;
    wednesdayPrayer: number;
    totalPrimaryServices: number;
}

const emptyAttendanceInsights: AttendanceInsights = {
    sundayMorningNet: 0,
    sundayMorningRaw: 0,
    sundayMorningDedupe: 0,
    childrenDepartmentDates: 0,
    sundayAfternoon: 0,
    wednesdayPrayer: 0,
    totalPrimaryServices: 0,
};

const MemberProfile: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const { roles, member: currentMember } = useAuth();

    // View State
    const [isViewing, setIsViewing] = useState(isEditMode);
    const [activeTab, setActiveTab] = useState('Overview');

    const DEFAULT_FORM_DATA = {
        member: {
            first_name: "", middle_name: "", surname: "", name_ext: "", nickname: "",
            date_of_birth: "", gender: "Male", civil_status: "Single", nationality: "Filipino",
            home_address: "", phone_number: "", membership_status: "active",
            is_regular_member: true, attachment_url: "", profile_picture_url: ""
        } as Partial<Member>,
        positionsData: {
            positions: [] as any[],
            newPosition: {
                position_name: '', department: '', position_category: 'sunday_school_adult',
                assignment_reason: '', is_ministry_head: false, start_date: new Date().toISOString().split('T')[0], is_active: true
            }
        },
        familyData: {
            relationships: [] as any[],
            newRelationName: '',
            relationType: 'spouse'
        },
        faithPromiseData: {
            commitments: [] as any[],
            financials: [] as any[],
            formYear: new Date().getFullYear(),
            formAmount: 0,
            editingId: null as string | null
        }
    };

    const cloneFormData = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

    const [formData, setFormData] = useState(() => cloneFormData(DEFAULT_FORM_DATA));
    const [savedData, setSavedData] = useState(() => cloneFormData(DEFAULT_FORM_DATA));
    const [draftFound, setDraftFound] = useState<any>(null);
    const { showToast } = useToast();
    const lastAutosaveAtRef = useRef(0);

    const isDirty = JSON.stringify(formData) !== JSON.stringify(savedData);
    const DRAFT_KEY = `member_draft_${id || 'new'}`;

    const updateFormData = (section: keyof typeof formData, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    // Derived aliases for backward compatibility in render
    const member = formData.member;
    const positions = formData.positionsData.positions;
    const family = formData.familyData.relationships;

    const [initialPositionIds, setInitialPositionIds] = useState<string[]>([]);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [attendanceInsights, setAttendanceInsights] = useState<AttendanceInsights>(emptyAttendanceInsights);
    const [activeSection, setActiveSection] = useState<"bio" | "contact" | "spiritual" | "positions" | "family" | "faith_promise">("bio");

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                if (parsed.timestamp && parsed.formData) {
                    setDraftFound(parsed);
                }
            } catch (e) { }
        }
    }, [DRAFT_KEY]);

    useEffect(() => {
        if (!isViewing && isDirty) {
            const timer = setInterval(() => {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, timestamp: Date.now() }));
                if (Date.now() - lastAutosaveAtRef.current >= 30000) {
                    lastAutosaveAtRef.current = Date.now();
                    showToast("Draft auto-saved.", 'success');
                }
            }, 30000);
            return () => clearInterval(timer);
        } else if (!isDirty && localStorage.getItem(DRAFT_KEY)) {
            // Optional: clean up if no longer dirty?
        }
    }, [formData, isDirty, DRAFT_KEY, isViewing, showToast]);

    const handleRestoreDraft = () => {
        if (draftFound && draftFound.formData) {
            setFormData(cloneFormData(draftFound.formData));
            setIsViewing(false);
            setDraftFound(null);
            showToast("Draft restored.", 'success');
        }
    };

    const handleDiscardChanges = () => {
        setFormData(cloneFormData(savedData));
        localStorage.removeItem(DRAFT_KEY);
        setDraftFound(null);
        showToast("Changes discarded.", 'success');
    };

    useEffect(() => {
        if (isViewing || !isDirty) return;

        const handleInAppNavigation = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
            if (!anchor) return;

            const hrefAttr = anchor.getAttribute('href');
            if (!hrefAttr) return;
            if (hrefAttr.startsWith('#') || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) return;
            if (anchor.target === '_blank') return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const nextUrl = new URL(anchor.href, window.location.href);
            const currentUrl = new URL(window.location.href);
            const isSameRoute = nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search && nextUrl.hash === currentUrl.hash;
            const isExternal = nextUrl.origin !== currentUrl.origin;

            if (isSameRoute || isExternal) return;

            const shouldLeave = window.confirm("You have unsaved changes. Are you sure you want to leave this page?");
            if (!shouldLeave) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        document.addEventListener('click', handleInAppNavigation, true);
        return () => document.removeEventListener('click', handleInAppNavigation, true);
    }, [isDirty, isViewing]);
    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    const [profileImage, setProfileImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [showEditRequestModal, setShowEditRequestModal] = useState(false);
    const [editRequestMessage, setEditRequestMessage] = useState("");
    const [submittingEditRequest, setSubmittingEditRequest] = useState(false);
    const [sendingInvite, setSendingInvite] = useState(false);
    const [hasSystemAccess, setHasSystemAccess] = useState(false);
    const [loadingMates, setLoadingMates] = useState(false);
    const [showMinistryMatesModal, setShowMinistryMatesModal] = useState(false);
    const [selectedMinistryName, setSelectedMinistryName] = useState("");
    const [selectedMinistryMates, setSelectedMinistryMates] = useState<any[]>([]);
    const [serviceAssignments, setServiceAssignments] = useState<any[]>([]);
    const [goodnewsAssignments, setGoodnewsAssignments] = useState<any[]>([]);


    const canManageProfiles = roles.includes(UserRole.CHURCH_ADMINISTRATOR) || roles.includes(UserRole.CHURCH_CLERK);
    const isOwnProfile = Boolean(id && currentMember?.id === id);

    useEffect(() => {
        if (isEditMode && id) {
            fetchMemberData(id);
            fetchServiceAssignments(id);
            fetchGoodnewsAssignments(id);
            checkSystemAccess(id);
        }
    }, [isEditMode, id]);

    useEffect(() => {
        if (isEditMode && !canManageProfiles) {
            setIsViewing(true);
        }
    }, [isEditMode, canManageProfiles]);

    const handleViewMinistryMates = async (department: string) => {
        if (!department) return;
        setSelectedMinistryName(department);
        setShowMinistryMatesModal(true);
        setLoadingMates(true);
        try {
            const data = await memberService.getTeammates(department);

            // Render only mates (exclude current member)
            const mates = data?.filter((d: any) => d.members?.id !== (id || currentMember?.id)).map((d: any) => ({
                id: d.members.id,
                name: `${d.members.first_name} ${d.members.surname}`,
                position: d.position_name,
                isHead: d.is_ministry_head,
                avatar: d.members.profile_picture_url
            })) || [];

            setSelectedMinistryMates(mates);
        } catch (err) {
            console.error("Failed to load ministry teammates:", err);
            setSelectedMinistryMates([]);
        } finally {
            setLoadingMates(false);
        }
    };

    const computeAttendanceInsights = async (logs: any[]) => {
        const presentLogs = (logs || []).filter((log) => log?.was_present !== false);
        if (presentLogs.length === 0) {
            setAttendanceInsights(emptyAttendanceInsights);
            return;
        }

        const serviceIds = Array.from(
            new Set(
                presentLogs
                    .filter((log) => log.event_type === "service")
                    .map((log) => log.event_id)
                    .filter(Boolean)
            )
        );

        const sundaySchoolIds = Array.from(
            new Set(
                presentLogs
                    .filter((log) => log.event_type === "sunday_school")
                    .map((log) => log.event_id)
                    .filter(Boolean)
            )
        );

        try {
            const [services, sundaySchoolSessions] = await Promise.all([
                serviceIds.length > 0
                    ? serviceService.getServicesByIds(serviceIds)
                    : Promise.resolve([] as any[]),
                sundaySchoolIds.length > 0
                    ? sundaySchoolService.getSundaySchoolSessionsByIds(sundaySchoolIds)
                    : Promise.resolve([] as any[])
            ]);
            const childDepartments = new Set(["beginners", "nursery", "kinder", "primary", "junior"]);

            const sundayMorningServiceDates = new Set(
                services
                    .filter((service: any) => service.service_type === "sunday_morning")
                    .map((service: any) => service.service_date)
                    .filter(Boolean)
            );

            const sundayAfternoonDates = new Set(
                services
                    .filter((service: any) => service.service_type === "sunday_afternoon")
                    .map((service: any) => service.service_date)
                    .filter(Boolean)
            );

            const wednesdayPrayerDates = new Set(
                services
                    .filter((service: any) => service.service_type === "wednesday_prayer")
                    .map((service: any) => service.service_date)
                    .filter(Boolean)
            );

            const childrenDepartmentDates = new Set(
                sundaySchoolSessions
                    .filter((session: any) => childDepartments.has(session.department))
                    .map((session: any) => session.session_date)
                    .filter(Boolean)
            );

            const sundayMorningNetDates = new Set([...sundayMorningServiceDates, ...childrenDepartmentDates]);
            let overlapCount = 0;
            sundayMorningServiceDates.forEach((date) => {
                if (childrenDepartmentDates.has(date)) overlapCount += 1;
            });

            const sundayMorningRaw = sundayMorningServiceDates.size + childrenDepartmentDates.size;
            const sundayMorningNet = sundayMorningNetDates.size;

            setAttendanceInsights({
                sundayMorningNet,
                sundayMorningRaw,
                sundayMorningDedupe: Math.max(sundayMorningRaw - sundayMorningNet, 0),
                childrenDepartmentDates: childrenDepartmentDates.size,
                sundayAfternoon: sundayAfternoonDates.size,
                wednesdayPrayer: wednesdayPrayerDates.size,
                totalPrimaryServices: sundayMorningNet + sundayAfternoonDates.size + wednesdayPrayerDates.size,
            });
        } catch (err) {
            console.error("Failed to compute attendance insights:", err);
            setAttendanceInsights(emptyAttendanceInsights);
        }
    };

    const fetchServiceAssignments = async (memberId: string) => {
        const data = await serviceService.getServiceAssignmentsByMember(memberId);
        if (data) setServiceAssignments(data);
    };

    const fetchGoodnewsAssignments = async (memberId: string) => {
        const data = await goodnewsService.getGoodnewsAssignmentsByMember(memberId);
        if (data) setGoodnewsAssignments(data);
    };

    const checkSystemAccess = async (memberId: string) => {
        try {
            const { data, error } = await supabase.from('user_roles').select('id').eq('member_id', memberId).limit(1);
            if (!error && data && data.length > 0) {
                setHasSystemAccess(true);
            } else {
                setHasSystemAccess(false);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendInvite = async () => {
        if (!member.email || !id) return;
        setSendingInvite(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Unauthorized context");

            const response = await fetch('/.netlify/functions/invite-member', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ member_id: id, email: member.email })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to send invite");
            showToast(`Invite sent to ${member.email}`, "success");
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setSendingInvite(false);
        }
    };

    const fetchMemberData = async (memberId: string) => {
        setLoading(true);
        try {
            const data = await memberService.getMemberById(memberId);
            if (data.profile_picture_url) setPreviewUrl(data.profile_picture_url);
            if (data.attachment_url) setAttachmentPreview(data.attachment_url);

            const posData = await memberService.getMemberPositions(memberId);
            const famData = await memberService.getFamilyRelationships(memberId);

            const commData = await financeService.getFaithPromiseCommitments(memberId);
            const finData = await financeService.getFaithPromiseGiving(memberId);

            const summary: Record<number, number> = {};
            finData?.forEach((record: any) => {
                const year = new Date(record.transaction_date).getFullYear();
                summary[year] = (summary[year] || 0) + Number(record.amount);
            });
            const financials = Object.entries(summary).map(([year, total]) => ({ year: Number(year), total_given: total }));

            const loadedData = {
                member: data,
                positionsData: {
                    positions: posData || [],
                    newPosition: DEFAULT_FORM_DATA.positionsData.newPosition
                },
                familyData: {
                    relationships: famData || [],
                    newRelationName: '',
                    relationType: 'spouse'
                },
                faithPromiseData: {
                    commitments: commData || [],
                    financials,
                    formYear: new Date().getFullYear(),
                    formAmount: 0,
                    editingId: null
                }
            };

            setFormData(cloneFormData(loadedData));
            setSavedData(cloneFormData(loadedData));

            if (posData) {
                setInitialPositionIds(posData.map((p: any) => p.id).filter(Boolean));
            } else {
                setInitialPositionIds([]);
            }

            const attData = await memberService.getMemberAttendanceLogs(memberId);
            if (attData) {
                setAttendance(attData);
                await computeAttendanceInsights(attData);
            } else {
                setAttendance([]);
                setAttendanceInsights(emptyAttendanceInsights);
            }
        } catch (err: any) {
            console.error(err);
            showToast("Failed to load member data.", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setProfileImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!canManageProfiles) {
            showToast("Read-only profile. You are not allowed to edit profile data.", 'error');
            return;
        }
        setSaving(true);
        const requiredFields = {
            'First Name': member.first_name,
            'Surname': member.surname,
            'Date of Birth': member.date_of_birth,
            'Home Address': member.home_address,
            'Phone Number': member.phone_number
        };

        const missing = Object.entries(requiredFields).filter(([_, value]) => !value || value.toString().trim() === '').map(([label]) => label);
        if (missing.length > 0) {
            showToast(`Please fill in required fields: ${missing.join(', ')}.`, 'error');
            setSaving(false); return;
        }

        try {
            let imageUrl = member.profile_picture_url;
            if (profileImage) {
                if (imageUrl) try { await deleteFile(imageUrl); } catch (e) { }
                imageUrl = await uploadFile(profileImage, "profiles");
            }

            let attachmentUrl = member.attachment_url;
            if (attachmentFile) {
                if (attachmentUrl) try { await deleteFile(attachmentUrl); } catch (e) { }
                attachmentUrl = await uploadFile(attachmentFile, "documents");
            }

            const memberData = { ...member, profile_picture_url: imageUrl, attachment_url: attachmentUrl, updated_at: new Date().toISOString() };
            const savedMember = await memberService.upsertMember(memberData);

            const sanitizedPositions = positions
                .map((pos: any) => ({
                    ...pos,
                    position_name: pos.position_name?.trim() || '',
                    department: pos.department?.trim() || '',
                    assignment_reason: pos.assignment_reason?.trim() || null
                }))
                .filter((pos: any) => pos.position_name && pos.department);

            for (const pos of sanitizedPositions) {
                const payload = { ...pos, member_id: savedMember.id };
                await memberService.upsertChurchPosition(payload);
            }

            const keptIds = new Set(
                sanitizedPositions
                    .map((pos: any) => pos.id)
                    .filter(Boolean)
            );
            const removedPositionIds = initialPositionIds.filter((posId) => !keptIds.has(posId));

            if (removedPositionIds.length > 0) {
                await memberService.deleteChurchPositions(savedMember.id, removedPositionIds);
            }

            const savedFamilyIds = savedData.familyData.relationships.map((f: any) => f.id).filter(Boolean);
            const currentFamilyIds = formData.familyData.relationships.map((f: any) => f.id).filter(Boolean);
            const removedFamilyIds = savedFamilyIds.filter((id: string) => !currentFamilyIds.includes(id));
            if (removedFamilyIds.length > 0) {
                await memberService.deleteFamilyRelationships(removedFamilyIds);
            }

            for (const rel of family) {
                if (!rel.member_id) rel.member_id = savedMember.id;
                await memberService.upsertFamilyRelationship(rel);
            }

            const latestPosData = await memberService.getMemberPositions(savedMember.id);
            if (latestPosData) {
                setInitialPositionIds(latestPosData.map((p: any) => p.id).filter(Boolean));
            }

            // Sync Faith Promise
            const savedCommitments = savedData.faithPromiseData.commitments.map((c: any) => c.id).filter(Boolean);
            const currentCommitmentIds = formData.faithPromiseData.commitments.map((c: any) => c.id).filter(Boolean);
            const removedCommitments = savedCommitments.filter((id: string) => !currentCommitmentIds.includes(id));

            if (removedCommitments.length > 0) {
                await financeService.deleteFaithPromiseCommitments(removedCommitments);
            }

            const commitmentsToSave = formData.faithPromiseData.commitments;
            for (const comm of commitmentsToSave) {
                const payload = { member_id: savedMember.id, year: comm.year, promised_amount: comm.promised_amount };
                if (comm.id && !comm.id.startsWith('temp_')) {
                    (payload as any).id = comm.id;
                }
                await financeService.upsertFaithPromiseCommitment(payload);
            }

            await fetchMemberData(savedMember.id);

            localStorage.removeItem(DRAFT_KEY);

            showToast("Member saved successfully!", 'success');
            if (!isEditMode) setTimeout(() => navigate(`/members/${savedMember.id}`), 1500);
            else setIsViewing(true);
        } catch (err: any) {
            console.error(err);
            showToast(`Error saving member: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!canManageProfiles) {
            showToast("Read-only profile. You are not allowed to delete this profile.", 'error');
            return;
        }
        if (!id) return;

        setSaving(true);
        try {
            if (member.profile_picture_url) await deleteFile(member.profile_picture_url);
            if (member.attachment_url) await deleteFile(member.attachment_url);
            await memberService.deleteMember(id);
            showToast("Member deleted successfully.", 'success');
            navigate('/members');
        } catch (err: any) {
            showToast("Delete failed: " + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleRequestEdit = async () => {
        if (!id) {
            showToast("Member ID missing.", 'error');
            return;
        }

        const message = editRequestMessage.trim();
        if (!message) {
            showToast("Please provide details for your edit request.", 'error');
            return;
        }

        setSubmittingEditRequest(true);
        try {
            await requestService.createEditRequest({
                target_member_id: id,
                requested_by_member_id: currentMember?.id || null,
                request_message: message
            });

            setShowEditRequestModal(false);
            setEditRequestMessage("");
            showToast("Edit request sent to admin for review.", 'success');
        } catch (err: any) {
            if (err?.code === "23505") {
                showToast("You already have a pending edit request.", 'error');
            } else if (err?.code === "42P01") {
                showToast("Request table missing. Run the migration first.", 'error');
            } else {
                showToast("Failed to submit request: " + err.message, 'error');
            }
        } finally {
            setSubmittingEditRequest(false);
        }
    };

    const sections = [
        { id: "bio", label: "Biographical", icon: User },
        { id: "contact", label: "Contact Info", icon: MapPin },
        { id: "spiritual", label: "Spiritual", icon: Heart },
        { id: "positions", label: "Ministries", icon: Shield },
        { id: "family", label: "Family", icon: Users },
        { id: "faith_promise", label: "Faith Promise", icon: TrendingUp },
    ];

    if (loading) return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-pulse">
            <Skeleton className="w-full h-48 rounded-none" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-96 rounded-none" /><Skeleton className="h-96 rounded-none" /><Skeleton className="h-96 rounded-none" /></div>
        </div>
    );

    // ======== VIEW MODE UI ========
    if (isViewing) {
        return (
            <div className="max-w-[1200px] mx-auto space-y-6 pb-20 font-sans">
                <ProfileHeader
                    member={member}
                    previewUrl={previewUrl}
                    family={family}
                    canManageProfiles={canManageProfiles}
                    id={id}
                    setIsViewing={setIsViewing}
                    setShowEditRequestModal={setShowEditRequestModal}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />

                {activeTab === 'Overview' ? (
                    <div className="space-y-6">
                        <PersonalDetailsForm
                            member={member}
                            positions={positions}
                            handleViewMinistryMates={handleViewMinistryMates}
                            formatMinistryCategory={formatMinistryCategory}
                            formatMinistryDepartment={formatMinistryDepartment}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FinancialSummary financials={formData.faithPromiseData.financials} />
                        </div>
                    </div>
                ) : (
                    <ActivityHistory
                        serviceAssignments={serviceAssignments}
                        goodnewsAssignments={goodnewsAssignments}
                        attendanceInsights={attendanceInsights}
                        canManageProfiles={canManageProfiles}
                        hasSystemAccess={hasSystemAccess}
                        member={member}
                        sendingInvite={sendingInvite}
                        handleSendInvite={handleSendInvite}
                    />
                )}

                {showEditRequestModal && (
                    <EditRequestModal
                        editRequestMessage={editRequestMessage}
                        onChange={setEditRequestMessage}
                        submitting={submittingEditRequest}
                        onSubmit={handleRequestEdit}
                        onClose={() => { setShowEditRequestModal(false); setEditRequestMessage(""); }}
                    />
                )}

                {showMinistryMatesModal && (
                    <MinistryMatesModal
                        ministryName={selectedMinistryName}
                        mates={selectedMinistryMates}
                        loading={loadingMates}
                        onClose={() => setShowMinistryMatesModal(false)}
                    />
                )}
            </div>
        );
    }
    // ======== EDIT MODE UI ========
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans relative">
            {isDirty && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-none flex items-center justify-between shadow-sm sticky top-4 z-40">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <AlertCircle size={18} className="text-amber-500" />
                        You have unsaved changes
                    </div>
                    <button onClick={handleDiscardChanges} className="text-xs font-bold text-amber-900 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-none transition-colors bg-white">
                        Discard Changes
                    </button>
                </div>
            )}

            {draftFound && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-none flex items-center justify-between shadow-sm sticky top-4 z-40">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <AlertCircle size={18} className="text-yellow-600" />
                        You have an unsaved draft from {new Date(draftFound.timestamp).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleRestoreDraft} className="text-xs font-bold bg-yellow-400 text-yellow-900 hover:bg-yellow-500 px-3 py-1.5 rounded-none transition-colors">
                            Restore Draft
                        </button>
                        <button onClick={handleDiscardChanges} className="text-xs font-bold border border-yellow-300 hover:bg-yellow-200 px-3 py-1.5 rounded-none transition-colors bg-white text-yellow-800">
                            Discard
                        </button>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => isEditMode ? setIsViewing(true) : navigate(-1)} className="p-2.5 hover:bg-gray-100 rounded-none transition-colors group">
                        <ArrowLeft size={20} className="text-gray-900 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-[26px] font-bold text-[#1e2333] leading-tight flex items-center gap-3">
                            {isEditMode ? "Edit Member Profile" : "New Member Profile"}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">{isEditMode ? `Editing ${member.first_name} ${member.surname}` : "Create a new member record"}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isEditMode ? (
                        <>
                            {canManageProfiles && (
                                <button onClick={() => setShowConfirmDelete(true)} className="px-6 py-2.5 bg-white border border-red-200 rounded-[12px] shadow-sm text-sm font-bold text-red-600 hover:bg-red-50 hover:border-red-300 flex items-center gap-2 transition-all">
                                    <Trash2 size={16} /> Delete
                                </button>
                            )}
                            <button onClick={() => setIsViewing(true)} className="px-6 py-2.5 bg-white border border-gray-200 rounded-[12px] shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-all">
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button onClick={() => navigate(-1)} className="px-6 py-2.5 bg-white border border-gray-200 rounded-[12px] shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-all">
                            Cancel
                        </button>
                    )}
                    <button className="px-7 py-2.5 bg-[#4c1d95] text-[var(--color-text-main)] rounded-[12px] shadow-sm text-sm font-bold hover:bg-[#3b1773] flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSave} disabled={saving || !canManageProfiles}>
                        {saving ? <>Saving...</> : <><Save size={18} /> Save Member</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Sidebar - Navigation & Photo */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Profile Photo Card */}
                    <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-5 text-center transition-all hover:shadow-md">
                        <label className="w-32 h-32 rounded-none bg-gray-50/50 border-[2px] border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-blue-400 hover:bg-gray-50/30 transition-all">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Upload size={28} className="text-gray-400 group-hover:text-blue-500 transition-colors" strokeWidth={1.5} />
                            )}
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <span className="text-xs font-bold text-[var(--color-text-main)] tracking-wide">Change Photo</span>
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>
                        <div className="space-y-1">
                            <p className="text-sm font-extrabold text-[#1e2333]">Profile Photo</p>
                            <p className="text-xs font-medium text-gray-400">Supports JPG, PNG</p>
                        </div>
                    </div>


                    {/* Navigation Menu */}
                    <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-3 space-y-1.5 transition-all hover:shadow-md">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id as any)}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-none text-sm font-bold transition-all ${activeSection === section.id
                                    ? "bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] text-[var(--color-text-main)] shadow-md "
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                            >
                                <section.icon size={18} className={activeSection === section.id ? "text-[var(--color-text-main)]" : "text-gray-400"} strokeWidth={activeSection === section.id ? 2.5 : 2} />
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-9 bg-white rounded-[24px] shadow-sm border border-gray-100 p-8 min-h-[600px] transition-all hover:shadow-md">
                    <h2 className="text-[18px] font-extrabold text-[#111827] mb-6 pb-6 border-b border-gray-100 flex items-center gap-3">
                        {sections.find((s) => s.id === activeSection)?.icon &&
                            React.createElement(sections.find((s) => s.id === activeSection)!.icon, {
                                size: 24,
                                className: "text-[var(--color-text-main)]",
                                strokeWidth: 2.5
                            })
                        }
                        {sections.find((s) => s.id === activeSection)?.label} Information
                    </h2>
                    <div className="animate-in fade-in duration-300">
                        {activeSection === 'bio' && <BioForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />}
                        {activeSection === 'contact' && <ContactForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />}
                        {activeSection === 'spiritual' && <SpiritualForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />}
                        {activeSection === 'positions' && <PositionsForm data={formData.positionsData} onChange={(f, v) => updateFormData('positionsData', f, v)} />}
                        {activeSection === 'family' && <FamilyForm data={formData.familyData} onChange={(f, v) => updateFormData('familyData', f, v)} />}
                        {activeSection === 'faith_promise' && <FaithPromiseForm data={formData.faithPromiseData} onChange={(f, v) => updateFormData('faithPromiseData', f, v)} />}
                    </div>
                </div>
            </div>
            {showEditRequestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-none border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <MessageSquare size={18} className="text-amber-600" />
                            Request Profile Edit
                        </h3>
                        <p className="text-sm text-gray-600">
                            Describe what needs to be corrected. Admin will review this request.
                        </p>
                        <textarea
                            value={editRequestMessage}
                            onChange={(e) => setEditRequestMessage(e.target.value)}
                            rows={5}
                            className="w-full rounded-none border border-gray-200 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                            placeholder="Example: Please update my phone number and home address."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowEditRequestModal(false);
                                    setEditRequestMessage("");
                                }}
                                className="px-4 py-2 rounded-none border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRequestEdit}
                                disabled={submittingEditRequest || !editRequestMessage.trim()}
                                className="px-4 py-2 rounded-none bg-amber-600 text-[var(--color-text-main)] text-sm font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submittingEditRequest ? "Submitting..." : "Send Request"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showMinistryMatesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-none border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-[18px] font-bold text-gray-900">
                                Ministry: {formatMinistryDepartment(selectedMinistryName) || selectedMinistryName}
                            </h3>
                            <button onClick={() => setShowMinistryMatesModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                            {loadingMates ? (
                                <div className="text-center py-6 text-gray-400 animate-pulse font-medium text-sm">Loading members...</div>
                            ) : selectedMinistryMates.length > 0 ? (
                                selectedMinistryMates.map((mate, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 rounded-none border border-gray-100 bg-gray-50/50">
                                        <div className="w-10 h-10 rounded-none overflow-hidden bg-gray-200 shrink-0">
                                            {mate.avatar ? (
                                                <img src={mate.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><User size={20} className="text-gray-400" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 text-sm truncate">{mate.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{mate.position}</p>
                                        </div>
                                        {mate.isHead && (
                                            <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-none px-2 py-1 uppercase">Head</span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 px-4">
                                    <div className="w-12 h-12 rounded-none bg-gray-50 flex items-center justify-center mx-auto mb-3">
                                        <Users size={20} className="text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No other mates found in this ministry yet.</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <button onClick={() => setShowMinistryMatesModal(false)} className="w-full py-2.5 bg-gray-100 text-gray-700 font-bold rounded-none text-sm hover:bg-gray-200 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal isOpen={showConfirmDelete} title="Delete Member" message={`Are you sure you want to PERMANENTLY delete ${member.first_name} ${member.surname}?`} confirmText="Delete Member" isDanger={true} onConfirm={handleDelete} onCancel={() => setShowConfirmDelete(false)} />
        </div>
    );
};

export default MemberProfile;
