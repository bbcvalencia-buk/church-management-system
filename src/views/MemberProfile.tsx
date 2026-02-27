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

import BioForm from "../components/members/BioForm";
import ContactForm from "../components/members/ContactForm";
import SpiritualForm from "../components/members/SpiritualForm";
import PositionsForm from "../components/members/PositionsForm";
import FamilyForm from "../components/members/FamilyForm";
import FaithPromiseForm from "../components/members/FaithPromiseForm";

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
            <Skeleton className="w-full h-48 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>
        </div>
    );

    // ======== VIEW MODE UI ========
    if (isViewing) {
        return (
            <div className="max-w-[1200px] mx-auto space-y-6 pb-20 font-sans">
                {/* Header Card */}
                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8 pb-0 overflow-hidden relative">
                    <div className="flex flex-col md:flex-row gap-8 items-start mb-6">
                        {/* Avatar */}
                        <div className="relative shrink-0 w-[120px] h-[120px]">
                            <div className="w-full h-full rounded-[16px] overflow-hidden bg-gray-50 flex items-center justify-center">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={48} className="text-gray-400" />
                                )}
                            </div>
                            {member.is_regular_member && (
                                <div className="absolute -bottom-2 -right-2 bg-amber-400 text-white p-1.5 rounded-full ring-4 ring-white" title="Regular Member">
                                    <Star size={14} className="fill-white text-white" />
                                </div>
                            )}
                        </div>

                        {/* Info Block */}
                        <div className="flex-1 w-full space-y-4">
                            <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4">
                                <div>
                                    <h1 className="text-[28px] font-extrabold text-[#111827] tracking-tight leading-none mb-3">
                                        {member.first_name} {member.surname}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 mb-4">
                                        <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider ${member.membership_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {member.membership_status} Member
                                        </span>
                                        {member.member_number && (
                                            <span className="bg-indigo-600 text-white px-3 py-1 rounded-md font-bold text-[12px] tracking-wider shadow-sm">
                                                {member.member_number}
                                            </span>
                                        )}
                                        <span className="text-gray-500 text-sm flex items-center gap-1">
                                            <span className="opacity-60">ID:</span> <span className="font-bold">#{member.id_number}</span>
                                        </span>
                                    </div>
                                    <p className="text-gray-500 italic leading-relaxed text-sm max-w-2xl">
                                        "A faithful individual actively participating in our fellowship. Encouraged by their faithfulness in small group."
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => window.location.href = `mailto:${member.email || ''}`} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-sm">
                                        <Mail size={16} className="text-gray-500" /> Email
                                    </button>
                                    {canManageProfiles && (
                                        <button onClick={() => window.open(`/members/${id}/print-id`, '_blank')} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-sm">
                                            <Printer size={16} className="text-gray-500" /> Label
                                        </button>
                                    )}
                                    {canManageProfiles ? (
                                        <button onClick={() => setIsViewing(false)} className="px-5 py-2 bg-[#4f46e5] text-white rounded-lg text-sm font-bold hover:bg-[#4338ca] flex items-center gap-2 transition-colors shadow-sm">
                                            <Edit3 size={16} /> Edit Profile
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="px-5 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold border border-gray-200">
                                                Read Only
                                            </span>
                                            <button
                                                onClick={() => setShowEditRequestModal(true)}
                                                className="px-5 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-bold border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-2"
                                            >
                                                <MessageSquare size={16} />
                                                Request Edit
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex items-center gap-8 mt-4 border-t border-gray-100 px-8">
                        {['Overview', 'Attendance'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 px-1 text-sm font-bold border-b-2 transition-all ${activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'Overview' ? (
                    /* 3 Columns Grid - Overview Tab */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

                        {/* Left Column */}
                        <div className="space-y-6">
                            {/* Biographical */}
                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                        <User size={18} className="text-[#4f46e5]" /> Biographical
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nickname</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.nickname || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Civil Status</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.civil_status || 'Single'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date of Birth</p>
                                        <p className="font-semibold text-gray-900 text-sm">
                                            {member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Not specified'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Gender</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.gender || 'Not specified'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nationality</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.nationality || 'Filipino'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Place of Birth</p>
                                        <p className="font-semibold text-gray-900 text-sm italic">{member.place_of_birth || 'Not specified'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Emergency Contact */}
                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                        <Heart size={18} className="text-red-500" /> Emergency Contact
                                    </h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Name</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.emergency_contact_name || 'Not Listed'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Relationship</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.emergency_contact_relationship || 'Not Listed'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Phone</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.emergency_contact_phone || 'Not Listed'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Middle Column */}
                        <div className="space-y-6">
                            {/* Contact Details */}
                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                        <MapPin size={18} className="text-blue-500" /> Contact Details
                                    </h3>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                            <Home size={14} className="text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Home Address</p>
                                            <p className="font-semibold text-gray-900 text-sm leading-snug">{member.home_address || 'Not specified'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                                            <Phone size={14} className="text-purple-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                                            <p className="font-semibold text-gray-900 text-sm">{member.phone_number || 'Not specified'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                                            <Mail size={14} className="text-green-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
                                            <p className="font-semibold text-gray-900 text-sm break-all">{member.email || 'Not specified'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Spiritual Journey */}
                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                        <Star size={18} className="text-amber-500" /> Spiritual Journey
                                    </h3>
                                </div>

                                <div className="relative pl-3 border-l-2 border-gray-100 space-y-6 mb-8">
                                    <div className="relative">
                                        <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#4f46e5] ring-4 ring-white"></div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Salvation Date</p>
                                        <p className="font-semibold text-gray-900 text-sm">
                                            {member.salvation_date ? new Date(member.salvation_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-gray-300 ring-4 ring-white"></div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Baptism Date</p>
                                        <p className="font-semibold text-gray-500 text-sm italic">
                                            {member.baptism_date ? new Date(member.baptism_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-gray-300 ring-4 ring-white"></div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Membership Date</p>
                                        <p className="font-semibold text-gray-500 text-sm italic">
                                            {member.membership_date ? new Date(member.membership_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-50 space-y-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Previous Religion</p>
                                        <p className="font-semibold text-gray-900 text-sm">{member.previous_religion || 'Catholic'}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Membership Status</p>
                                        <span className="bg-blue-100 text-blue-700 text-[11px] px-3 py-1.5 rounded-md font-bold">
                                            {member.is_regular_member ? 'Regular Member' : 'New Member'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Ministries */}
                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                        <Users size={18} className="text-[#4f46e5]" /> Ministries
                                    </h3>
                                </div>

                                {positions.length > 0 ? (
                                    <div className="space-y-4 mb-6">
                                        {positions.map((pos, i) => (
                                            <div key={i} onClick={() => handleViewMinistryMates(pos.department)} className="group border border-gray-100 rounded-xl p-5 flex flex-col gap-1 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
                                                <h4 className="font-bold text-[#111827] text-[15px] group-hover:text-blue-600 transition-colors">
                                                    {pos.position_name || pos.position_title || 'Ministry Member'}
                                                </h4>
                                                <p className="text-[14px] text-gray-500">
                                                    {formatMinistryCategory(pos.position_category)} - Since {new Date(pos.start_date || pos.created_at || new Date()).toISOString().split('T')[0]}
                                                </p>
                                                <p className="text-[14px] text-gray-500">
                                                    Ministry: {formatMinistryDepartment(pos.department) || pos.department}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[12px] font-semibold text-gray-400 italic mb-6">No ministry involvements recorded yet.</p>
                                )}

                                <Link to="/members" className="w-full py-2.5 border border-blue-200 rounded-xl text-blue-700 text-sm font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                                    <Eye size={15} /> View All Members
                                </Link>
                            </div>

                            {/* Record Info */}
                            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                        <FileText size={18} className="text-gray-500" /> Record Info
                                    </h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Record Created</p>
                                        <p className="font-semibold text-gray-900 text-sm">
                                            {member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Feb 19, 2026'}
                                        </p>
                                        <p className="text-[11px] text-gray-500 mt-1">Information added to the system directory.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Attendance Tab View */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Left/Main Column - Participation History */}
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8 overflow-hidden">
                                <h3 className="text-[18px] font-bold text-gray-900 mb-6 flex items-center gap-3">
                                    <Mic size={22} className="text-indigo-500" /> Detailed Service Participation
                                </h3>

                                {serviceAssignments.length > 0 ? (
                                    <div className="space-y-6">
                                        {/* Detailed Summary */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {Object.entries(serviceAssignments.reduce((acc: any, curr: any) => {
                                                acc[curr.role] = (acc[curr.role] || 0) + 1;
                                                return acc;
                                            }, {})).map(([role, count]: [string, any]) => (
                                                <div key={role} className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl transition-all hover:bg-indigo-50">
                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{role.replace('_', ' ')}</p>
                                                    <p className="text-2xl font-black text-indigo-700">{count}<span className="text-xs ml-1 opacity-60">times</span></p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-gray-100">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Date & Service Type</th>
                                                        <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Assigned Role</th>
                                                        <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest text-right">Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {serviceAssignments.map((a, i) => (
                                                        <tr key={i} className="hover:bg-gray-50/30 transition-colors group">
                                                            <td className="px-6 py-5">
                                                                <p className="font-bold text-gray-900">{a.service?.service_date ? new Date(a.service.service_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : 'N/A'}</p>
                                                                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-tighter mt-0.5">{a.service?.service_type?.replace('_', ' ')}</p>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-black uppercase text-[10px] tracking-tight">{a.role.replace('_', ' ')}</span>
                                                            </td>
                                                            <td className="px-6 py-5 text-right">
                                                                <p className="text-sm text-gray-500 italic font-medium">{a.notes ? `"${a.notes}"` : '—'}</p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                            <Users className="text-gray-300" size={28} />
                                        </div>
                                        <p className="text-gray-900 font-bold">No Service Roles Recorded</p>
                                        <p className="text-sm text-gray-500 mt-1">This member hasn't been assigned to any service roles yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Goodnews Class Participation */}
                            <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8 overflow-hidden">
                                <h3 className="text-[18px] font-bold text-gray-900 mb-6 flex items-center gap-3">
                                    <BookOpen size={22} className="text-green-500" /> Goodnews Class Participation
                                </h3>

                                {goodnewsAssignments.length > 0 ? (
                                    <div className="space-y-6">
                                        {/* Detailed Summary */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-green-50/50 border border-green-100/50 p-4 rounded-2xl transition-all hover:bg-green-50">
                                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Total Sessions Participated</p>
                                                <p className="text-2xl font-black text-green-700">{goodnewsAssignments.length}<span className="text-xs ml-1 opacity-60">sessions</span></p>
                                            </div>
                                            <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-2xl transition-all hover:bg-blue-50">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Unique Series Reached</p>
                                                <p className="text-2xl font-black text-blue-700">{new Set(goodnewsAssignments.map(a => a.session?.series_id)).size}<span className="text-xs ml-1 opacity-60">series</span></p>
                                            </div>
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-gray-100">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Date & Series</th>
                                                        <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Assigned Role</th>
                                                        <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest text-right">Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {goodnewsAssignments.map((a, i) => (
                                                        <tr key={i} className="hover:bg-gray-50/30 transition-colors group">
                                                            <td className="px-6 py-5">
                                                                <p className="font-bold text-gray-900">{a.session?.date ? new Date(a.session.date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : 'N/A'}</p>
                                                                <p className="text-[11px] font-bold text-green-600 uppercase tracking-tighter mt-0.5">{a.session?.series?.title || 'Unknown Series'} - Vol {a.session?.session_number || '?'}</p>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 font-black uppercase text-[10px] tracking-tight">{a.role.replace('_', ' ')}</span>
                                                            </td>
                                                            <td className="px-6 py-5 text-right">
                                                                <p className="text-sm text-gray-500 italic font-medium">{a.notes ? `"${a.notes}"` : '—'}</p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                            <BookOpen className="text-gray-300" size={28} />
                                        </div>
                                        <p className="text-gray-900 font-bold">No Goodnews Class Records</p>
                                        <p className="text-sm text-gray-500 mt-1">This member hasn't participated in any Goodnews Classes yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Attendance Insights */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Activity size={16} className="text-green-500" /> Basic Attendance
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-green-50/50 border border-green-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Sunday Morning</p>
                                            <p className="text-xs text-green-700/60 font-bold">Net Attendance</p>
                                        </div>
                                        <p className="text-3xl font-black text-green-700">{attendanceInsights.sundayMorningNet}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Sunday Afternoon</p>
                                            <p className="text-xs text-blue-700/60 font-bold">Total Services</p>
                                        </div>
                                        <p className="text-3xl font-black text-blue-700">{attendanceInsights.sundayAfternoon}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Wednesday Prayer</p>
                                            <p className="text-xs text-purple-700/60 font-bold">Midweek Service</p>
                                        </div>
                                        <p className="text-3xl font-black text-purple-700">{attendanceInsights.wednesdayPrayer}</p>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between px-2">
                                            <p className="text-xs font-bold text-gray-400">Grand Total Services</p>
                                            <p className="text-lg font-black text-gray-900">{attendanceInsights.totalPrimaryServices}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-600 rounded-[20px] p-6 text-white shadow-lg shadow-indigo-500/20">
                                <h4 className="font-bold flex items-center gap-2 mb-2">
                                    <Star size={18} className="text-indigo-200" /> Engagement Level
                                </h4>
                                <p className="text-xs text-indigo-100 leading-relaxed mb-4">
                                    Member has participated in {serviceAssignments.length} service roles across multiple departments.
                                </p>
                                <div className="h-2 bg-indigo-900/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-200 rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (serviceAssignments.length / 20) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {canManageProfiles && !hasSystemAccess && member.email && activeTab === 'Overview' && (
                                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
                                    <h4 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Lock size={16} /> System Access
                                    </h4>
                                    <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                                        This member has an email address but does not have system access yet. You can invite them to create a password and access the app.
                                    </p>
                                    <button
                                        onClick={handleSendInvite}
                                        disabled={sendingInvite}
                                        className="w-full flex justify-center items-center py-2.5 px-4 border border-blue-200 rounded-xl text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                    >
                                        {sendingInvite ? 'Sending...' : 'Send App Invite'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Edit Request Modal (view mode) */}
                {showEditRequestModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4">
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
                                className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                placeholder="Example: Please update my phone number and home address."
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setShowEditRequestModal(false);
                                        setEditRequestMessage("");
                                    }}
                                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestEdit}
                                    disabled={submittingEditRequest || !editRequestMessage.trim()}
                                    className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submittingEditRequest ? "Submitting..." : "Send Request"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Ministry Mates Modal (view mode) */}
                {showMinistryMatesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
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
                                    selectedMinistryMates.map((mate: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
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
                                                <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 uppercase">Head</span>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 px-4">
                                        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                                            <Users size={20} className="text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 font-medium text-sm">No other mates found in this ministry yet.</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button onClick={() => setShowMinistryMatesModal(false)} className="w-full py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ======== EDIT MODE UI ========
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans relative">
            {isDirty && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm sticky top-4 z-40">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <AlertCircle size={18} className="text-amber-500" />
                        You have unsaved changes
                    </div>
                    <button onClick={handleDiscardChanges} className="text-xs font-bold text-amber-900 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors bg-white">
                        Discard Changes
                    </button>
                </div>
            )}

            {draftFound && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm sticky top-4 z-40">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <AlertCircle size={18} className="text-yellow-600" />
                        You have an unsaved draft from {new Date(draftFound.timestamp).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleRestoreDraft} className="text-xs font-bold bg-yellow-400 text-yellow-900 hover:bg-yellow-500 px-3 py-1.5 rounded-lg transition-colors">
                            Restore Draft
                        </button>
                        <button onClick={handleDiscardChanges} className="text-xs font-bold border border-yellow-300 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors bg-white text-yellow-800">
                            Discard
                        </button>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => isEditMode ? setIsViewing(true) : navigate(-1)} className="p-2.5 hover:bg-gray-100 rounded-full transition-colors group">
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
                    <button className="px-7 py-2.5 bg-[#4c1d95] text-white rounded-[12px] shadow-sm text-sm font-bold hover:bg-[#3b1773] flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSave} disabled={saving || !canManageProfiles}>
                        {saving ? <>Saving...</> : <><Save size={18} /> Save Member</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Sidebar - Navigation & Photo */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Profile Photo Card */}
                    <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-5 text-center transition-all hover:shadow-md">
                        <label className="w-32 h-32 rounded-full bg-gray-50/50 border-[2px] border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Upload size={28} className="text-gray-400 group-hover:text-blue-500 transition-colors" strokeWidth={1.5} />
                            )}
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <span className="text-xs font-bold text-white tracking-wide">Change Photo</span>
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
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl text-sm font-bold transition-all ${activeSection === section.id
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                            >
                                <section.icon size={18} className={activeSection === section.id ? "text-white" : "text-gray-400"} strokeWidth={activeSection === section.id ? 2.5 : 2} />
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
                                className: "text-blue-600",
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
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4">
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
                            className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                            placeholder="Example: Please update my phone number and home address."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowEditRequestModal(false);
                                    setEditRequestMessage("");
                                }}
                                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRequestEdit}
                                disabled={submittingEditRequest || !editRequestMessage.trim()}
                                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submittingEditRequest ? "Submitting..." : "Send Request"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showMinistryMatesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
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
                                    <div key={idx} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
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
                                            <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 uppercase">Head</span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 px-4">
                                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                                        <Users size={20} className="text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No other mates found in this ministry yet.</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <button onClick={() => setShowMinistryMatesModal(false)} className="w-full py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">
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
