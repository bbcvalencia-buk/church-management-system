import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as serviceService from "@/services/serviceService";
import * as memberService from "@/services/memberService";
import * as visitorService from "@/services/visitorService";
import { getLatestSundayISODate } from "@/lib/date";
import type { Service, ServiceRole, ServiceAssignment } from "@/types";
import {
    Calendar,
    BookOpen,
    Users,
    Heart,
    ArrowLeft,
    Save,
    Trash2,
    Shield,
    Music,
    UserCheck,
    X as IconX,
    Plus,
    Mic
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import ImageUpload from "@/components/ImageUpload";
import QuickVisitorRegistration, { type DraftVisitor } from "@/components/QuickVisitorRegistration";
import AttendanceReportModal from "@/components/AttendanceReportModal";
import { deleteFile } from "@/lib/storage";
import { findExistingMemberForVisitor, splitVisitorName } from "@/lib/visitorDedup";
import SuccessModal from "@/components/SuccessModal";
import { SearchMemberModal } from "@/components/SearchMemberModal";
import { useSessionDraft, useSessionValue } from "@/hooks/useSessionDraft";

// Initial state for a new service
const INITIAL_STATE: Partial<Service> = {
    service_type: 'sunday_morning',
    service_date: getLatestSundayISODate(),
    service_time: '10:00',
    members_present: 0,
    total_attendance: 0,
    visitors_present: 0,
    visitors_saved: 0,
    souls_saved: 0,
    prospects_for_baptism: 0,
    members_who_prayed: 0,
    sermon_title: '',
    sermon_notes: ''
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
    sunday_morning: 'Sunday Morning Service',
    sunday_afternoon: 'Sunday Afternoon Service',
    wednesday_prayer: 'Wednesday Prayer Meeting',
    pre_service: 'Pre-Service',
    funeral: 'Funeral Service'
};

const getServiceTypeLabel = (serviceType?: string) =>
    serviceType ? (SERVICE_TYPE_LABELS[serviceType] || serviceType.replace(/_/g, ' ')) : 'Service';

const PRIMARY_SERVICE_TYPES = new Set(['sunday_morning', 'sunday_afternoon', 'wednesday_prayer']);
const isPrimaryServiceType = (serviceType?: string) => PRIMARY_SERVICE_TYPES.has(serviceType || '');

const ROLE_LABELS: Record<ServiceRole, string> = {
    songleader: 'Songleader',
    pastor: 'Pastor',
    moderator: 'Moderator',
    pianist: 'Pianist',
    technicals: 'Technicals',
    mini_ensemble: 'Mini Ensemble',
    usher: 'Usher',
    choir: 'Choir',
    preacher: 'Preacher',
    other: 'Other'
};

const MULTI_MEMBER_ROLES: ServiceRole[] = ['choir', 'mini_ensemble', 'usher', 'technicals'];

const inferVisitTimeFromService = (serviceType?: string): 'AM' | 'PM' =>
    serviceType === 'sunday_afternoon' ? 'PM' : 'AM';

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

const ServiceForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const [service, setService, clearServiceDraft] = useSessionDraft<Partial<Service>>(
        isEditMode ? `service-form-edit-${id}` : 'service-form-new',
        INITIAL_STATE
    );
    const [members, setMembers] = useState<any[]>([]);
    const [selectedMemberIds, setSelectedMemberIds, clearMembersDraft] = useSessionValue<string[]>(
        isEditMode ? `service-members-edit-${id}` : 'service-members-new',
        []
    );
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [newVisitors, setNewVisitors, clearVisitorsDraft] = useSessionValue<DraftVisitor[]>(
        isEditMode ? `service-visitors-edit-${id}` : 'service-visitors-new',
        []
    );
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const [assignments, setAssignments, clearAssignmentsDraft] = useSessionValue<Partial<ServiceAssignment>[]>(
        isEditMode ? `service-assignments-edit-${id}` : 'service-assignments-new',
        []
    );
    const [showRoleSearch, setShowRoleSearch] = useState<ServiceRole | null>(null);

    const visitorMemberIds = useMemo(
        () => new Set(members.filter(() => false).map((m) => m.id)),
        [members]
    );
    const isPrimaryService = isPrimaryServiceType(service.service_type);

    useEffect(() => {
        fetchMembers();
        if (isEditMode) {
            fetchService().then(data => {
                if (data) {
                    fetchServiceAttendance(data.service_date, data.service_type);
                    fetchAssignments(data.id);
                }
            });
        }
    }, [id]);

    const fetchMembers = async () => {
        try {
            const data = await memberService.getAllMembers();
            if (data) setMembers(data);
        } catch (error) {
            console.error("Error fetching members:", error);
        }
    };

    const fetchAssignments = async (serviceId: string) => {
        try {
            const data = await serviceService.getServiceAssignments(serviceId);
            if (data) setAssignments(data);
        } catch (error) {
            console.error("Error fetching assignments:", error);
        }
    };

    const fetchServiceAttendance = async (refDate: string, serviceType?: string) => {
        try {
            const data = await serviceService.getAttendanceLogsByEvent(id!);
            const memberIds = data?.map(d => d.member_id) || [];

            // Primary linkage for newer records
            let registeredVisitors: any[] = [];
            if (id) {
                // Here we might need a visitorService.getVisitorsByService
                // I'll check if I should add it or use raw for complex joins
                // But for now let's see if I can find it in visitors table
                // I will add getVisitorsByService to visitorService
                const linkedVisitors = await visitorService.getVisitorsByService(id);
                if (linkedVisitors?.length) {
                    registeredVisitors = linkedVisitors;
                }
            }

            // Backward compatibility for older records
            if (!registeredVisitors.length && memberIds.length > 0) {
                const allVisitors = await visitorService.getVisitors();
                registeredVisitors = allVisitors.filter(v => v.member_id && memberIds.includes(v.member_id) && v.visit_date === refDate);
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
                visit_time: (v.visit_time as 'AM' | 'PM') || inferVisitTimeFromService(serviceType || service.service_type),
                visit_date: v.visit_date || refDate,
                images: v.visitor_card_images || (v.visitor_card_image_url ? [v.visitor_card_image_url] : [])
            }));

            setNewVisitors(drafts);

            const registeredMemberIds = registeredVisitors.map(v => v.member_id);
            const remaining = memberIds.filter(mid => !registeredMemberIds.includes(mid));
            setSelectedMemberIds(remaining);
        } catch (error) {
            console.error("Error fetching service attendance:", error);
        }
    };

    const fetchService = async () => {
        setLoading(true);
        try {
            const data = await serviceService.getServiceById(id!);
            setService(data);
            return data;
        } catch (err) {
            console.error("Error fetching service:", err);
            alert("Failed to load service details.");
            navigate('/services');
        } finally {
            setLoading(false);
        }
    };

    const update = (field: keyof Service, value: any) => {
        setService(prev => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (isPrimaryService) return;

        setSelectedMemberIds((prev) => {
            const filtered = prev.filter((memberId) => !visitorMemberIds.has(memberId));
            return filtered.length === prev.length ? prev : filtered;
        });

        setNewVisitors((prev) => (prev.length > 0 ? [] : prev));

        setService((prev) => {
            const next = { ...prev };
            let changed = false;

            if ((Number(prev.visitors_present) || 0) !== 0) {
                next.visitors_present = 0;
                changed = true;
            }
            if ((Number(prev.souls_saved) || 0) !== 0) {
                next.souls_saved = 0;
                changed = true;
            }
            if ((Number(prev.visitors_saved) || 0) !== 0) {
                next.visitors_saved = 0;
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [isPrimaryService, visitorMemberIds]);

    // Calculate total if members/visitors change
    useEffect(() => {
        const regularMemberCount = selectedMemberIds.filter((id) => !visitorMemberIds.has(id)).length;
        update('members_present', regularMemberCount);
    }, [selectedMemberIds, visitorMemberIds]);

    useEffect(() => {
        const membersCount = parseInt(service.members_present as any) || 0;
        const visitors = parseInt(service.visitors_present as any) || 0;
        update('total_attendance', membersCount + visitors);
    }, [service.members_present, service.visitors_present]);

    const selectedVisitorCountForReport = selectedMemberIds.filter((id) =>
        visitorMemberIds.has(id)
    ).length;
    const visitorsCountForReport = isPrimaryService
        ? Math.max(
            parseInt(service.visitors_present as any) || 0,
            newVisitors.length,
            selectedVisitorCountForReport
        )
        : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const supportsVisitorsAndSouls = isPrimaryServiceType(service.service_type);
            const preparedVisitors = supportsVisitorsAndSouls ? normalizeDraftVisitors(newVisitors) : [];
            const invalidCardIndex = preparedVisitors.findIndex(visitor =>
                !visitor.name || !visitor.address || !visitor.contact
            );

            if (invalidCardIndex >= 0) {
                throw new Error(`Visitor card #${invalidCardIndex + 1} is incomplete. Name, Address, and Contact No. are required.`);
            }

            const selectedVisitorIds = selectedMemberIds.filter((id) => visitorMemberIds.has(id));
            const selectedRegularIds = selectedMemberIds.filter((id) => !visitorMemberIds.has(id));

            const manualVisitorsInput = supportsVisitorsAndSouls ? (parseInt(service.visitors_present as any) || 0) : 0;
            const visitorsPresentCount = supportsVisitorsAndSouls
                ? Math.max(
                    selectedVisitorIds.length,
                    preparedVisitors.length > 0 ? preparedVisitors.length : manualVisitorsInput
                )
                : 0;
            const membersPresentCount = selectedRegularIds.length;
            const soulsSaved = supportsVisitorsAndSouls ? (parseInt(service.souls_saved as any) || 0) : 0;
            const visitorsSaved = supportsVisitorsAndSouls ? (parseInt(service.visitors_saved as any) || 0) : 0;

            // 1. Save Service
            const savedService = await serviceService.upsertService({
                ...service,
                members_present: membersPresentCount,
                visitors_present: visitorsPresentCount,
                souls_saved: soulsSaved,
                visitors_saved: visitorsSaved,
                total_attendance: membersPresentCount + visitorsPresentCount
            });

            // 1b. Save Service Assignments
            await serviceService.deleteServiceAssignments(savedService.id);
            if (assignments.length > 0) {
                const assignmentData = assignments.map(a => ({
                    service_id: savedService.id,
                    member_id: a.member_id,
                    role: a.role,
                    notes: a.notes
                }));
                await serviceService.createServiceAssignments(assignmentData);
            }

            if (!supportsVisitorsAndSouls) {
                // Clear linked visitors if not supported
                const serviceVisitors = await visitorService.getVisitorsByService(savedService.id);
                for (const v of serviceVisitors) {
                    await visitorService.upsertVisitor({ ...v, service_id: null as any });
                }
            }

            // 2. Process New Visitors (Auto-Register with smart duplicate detection)
            const cardVisitorMemberIds: string[] = [];
            const cardRegularMemberIds: string[] = [];

            for (const v of preparedVisitors) {
                // If it has a UUID, it's an existing visitor -> Update
                if (v.id && v.id.length > 20) {
                    const vRecord = await visitorService.getVisitorById(v.id);
                    if (vRecord && vRecord.member_id) {
                        // Update Visitor
                        await visitorService.upsertVisitor({
                            id: v.id,
                            name: v.name,
                            contact_number: v.contact || '',
                            age: v.age,
                            gender: v.gender,
                            visit_time: v.visit_time || inferVisitTimeFromService(savedService.service_type),
                            visit_date: v.visit_date || savedService.service_date,
                            marital_status: v.marital_status || 'Single',
                            visitor_card_images: v.images || [],
                            address: v.address || '',
                            office_address: v.office_address || '',
                            church_name: v.church_name || '',
                            date_of_birth: v.date_of_birth,
                            invited_by: v.invited_by || '',
                            service_id: savedService.id,
                            sunday_school_session_id: null as any
                        });

                        // Update Shadow Member
                        const parsedName = splitVisitorName(v.name);
                        await memberService.updateMember(vRecord.member_id, {
                            first_name: parsedName.firstName || 'Visitor',
                            surname: parsedName.surname || '',
                            home_address: v.address || 'Unknown',
                            phone_number: v.contact || 'N/A',
                            gender: v.gender,
                            civil_status: v.marital_status || 'Single',
                            date_of_birth: v.date_of_birth || new Date().toISOString().split('T')[0]
                        });

                        const isVisitor = await memberService.isVisitorMember(vRecord.member_id);
                        if (isVisitor) cardVisitorMemberIds.push(vRecord.member_id);
                        else cardRegularMemberIds.push(vRecord.member_id);
                    }
                } else {
                    const matchedMember = await findExistingMemberForVisitor({
                        name: v.name,
                        contact: v.contact,
                        date_of_birth: v.date_of_birth,
                        gender: v.gender
                    });

                    if (matchedMember) {
                        // Existing regular member detected from visitor card.
                        cardRegularMemberIds.push(matchedMember.id);
                        continue;
                    }

                    const parsedName = splitVisitorName(v.name);

                    // Create Shadow Member
                    const memberData = await memberService.createMember({
                        first_name: parsedName.firstName || 'Visitor',
                        surname: parsedName.surname || '',
                        is_regular_member: false,
                        membership_status: 'active',
                        home_address: v.address || 'Unknown',
                        phone_number: v.contact || 'N/A',
                        gender: v.gender,
                        civil_status: v.marital_status || 'Single',
                        date_of_birth: v.date_of_birth || new Date().toISOString().split('T')[0]
                    });

                    cardVisitorMemberIds.push(memberData.id);

                    // Create Visitor Record
                    await visitorService.upsertVisitor({
                        member_id: memberData.id,
                        name: v.name,
                        contact_number: v.contact || '',
                        age: v.age,
                        gender: v.gender,
                        visit_date: v.visit_date || savedService.service_date,
                        visit_time: v.visit_time || inferVisitTimeFromService(savedService.service_type),
                        marital_status: v.marital_status || 'Single',
                        visitor_card_images: v.images || [],
                        address: v.address || '',
                        office_address: v.office_address || '',
                        church_name: v.church_name || '',
                        date_of_birth: v.date_of_birth,
                        invited_by: v.invited_by || '',
                        service_id: savedService.id,
                        sunday_school_session_id: null as any,
                        is_saved: false,
                        is_prospect_for_baptism: false,
                        follow_up_status: 'pending'
                    });
                }
            }

            // 2. Clear old attendance
            await serviceService.deleteAttendanceLogs(savedService.id);

            // 4. Save new attendance (Existing + New)
            const uniqueVisitorIds = supportsVisitorsAndSouls
                ? Array.from(new Set([...selectedVisitorIds, ...cardVisitorMemberIds]))
                : [];
            const uniqueRegularIds = Array.from(new Set([...selectedRegularIds, ...cardRegularMemberIds]));
            const finalVisitorsCount = supportsVisitorsAndSouls
                ? Math.max(uniqueVisitorIds.length, manualVisitorsInput)
                : 0;
            const finalMembersCount = uniqueRegularIds.length;
            const allMemberIds = Array.from(new Set([...uniqueRegularIds, ...uniqueVisitorIds]));

            await serviceService.upsertService({
                ...savedService,
                members_present: finalMembersCount,
                visitors_present: finalVisitorsCount,
                souls_saved: soulsSaved,
                visitors_saved: visitorsSaved,
                total_attendance: finalMembersCount + finalVisitorsCount
            });

            if (allMemberIds.length > 0) {
                const logs = allMemberIds.map(mid => ({
                    member_id: mid,
                    event_type: 'service',
                    event_id: savedService.id,
                    event_date: savedService.service_date,
                    was_present: true
                }));
                await serviceService.createAttendanceLogs(logs);
            }

            if (!id) {
                clearServiceDraft();
                clearMembersDraft();
                clearVisitorsDraft();
                clearAssignmentsDraft();
                setShowSuccessModal(true);
            } else {
                clearServiceDraft();
                clearMembersDraft();
                clearVisitorsDraft();
                clearAssignmentsDraft();
                navigate('/services');
            }
        } catch (err: any) {
            console.error("Error saving service:", err);
            alert(`Failed to save service: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            // Delete file from R2 if exists
            if (service.visitor_card_url) {
                await deleteFile(service.visitor_card_url).catch(console.warn);
            }

            await serviceService.deleteService(id!);
            navigate('/services');
        } catch (err: any) {
            console.error("Error deleting service:", err);
            alert("Delete failed: " + err.message);
        }
    };

    const handleSelectMemberForRole = (memberId: string) => {
        if (!showRoleSearch) return;

        const role = showRoleSearch;
        const member = members.find(m => m.id === memberId);

        if (MULTI_MEMBER_ROLES.includes(role)) {
            // Check if already assigned this role
            if (assignments.some(a => a.role === role && a.member_id === memberId)) {
                setShowRoleSearch(null);
                return;
            }
            setAssignments(prev => [...prev, {
                member_id: memberId,
                role: role,
                member: member
            }]);
        } else {
            // Replace existing single assignment for this role
            setAssignments(prev => [
                ...prev.filter(a => a.role !== role),
                {
                    member_id: memberId,
                    role: role,
                    member: member
                }
            ]);
        }
        setShowRoleSearch(null);
    };

    const removeAssignment = (memberId: string, role: string) => {
        setAssignments(prev => prev.filter(a => !(a.member_id === memberId && a.role === role)));
    };

    const updateAssignmentNotes = (memberId: string, role: string, notes: string) => {
        setAssignments(prev => prev.map(a =>
            (a.member_id === memberId && a.role === role) ? { ...a, notes } : a
        ));
    };

    if (loading) return <div className="p-8 text-center text-[var(--color-text-muted)]">Loading...</div>;

    const ROLES: ServiceRole[] = ['pastor', 'preacher', 'songleader', 'moderator', 'pianist', 'technicals', 'choir', 'mini_ensemble', 'usher', 'other'];

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[var(--color-text-main)]"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-[1.95rem] leading-tight font-semibold tracking-tight text-[var(--color-text-main)]">
                            {isEditMode ? "Edit Service Record" : "Log New Service"}
                        </h1>
                        <p className="text-sm leading-5 text-[var(--color-text-muted)]">
                            {new Date().toDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {isEditMode && (
                        <button
                            onClick={() => setShowConfirmDelete(true)}
                            className="btn btn-ghost text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="btn btn-primary disabled:opacity-50"
                    >
                        <Save size={18} /> {saving ? 'Saving...' : 'Save Record'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <div className="card-panel p-6 space-y-4 bg-white">
                        <h3 className="text-[1.22rem] leading-6 font-semibold tracking-tight flex items-center gap-2 mb-4 text-[var(--color-text-main)]">
                            <Calendar className="text-[var(--color-primary)]" size={20} />
                            Service Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="form-label">Service Type</label>
                                <select
                                    value={service.service_type}
                                    onChange={(e) => update('service_type', e.target.value)}
                                    className="form-control"
                                >
                                    <option value="sunday_morning">Sunday Morning</option>
                                    <option value="sunday_afternoon">Sunday Afternoon</option>
                                    <option value="wednesday_prayer">Wednesday Prayer</option>
                                    <option value="pre_service">Pre-Service</option>
                                    <option value="funeral">Funeral</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="form-label">Date & Time</label>
                                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
                                    <input
                                        type="date"
                                        value={service.service_date}
                                        onChange={(e) => update('service_date', e.target.value)}
                                        className="form-control min-w-0"
                                        required
                                    />
                                    <input
                                        type="time"
                                        value={service.service_time?.substring(0, 5)} // Handle HH:MM:SS from DB
                                        onChange={(e) => update('service_time', e.target.value)}
                                        className="form-control min-w-0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Service Roles */}
                    <div className="card-panel p-6 space-y-4 bg-white">
                        <h3 className="text-[1.22rem] leading-6 font-semibold tracking-tight flex items-center gap-2 mb-4 text-[var(--color-text-main)]">
                            <UserCheck className="text-[var(--color-primary)]" size={20} />
                            Service Roles / Roster
                        </h3>

                        <div className="space-y-6">
                            {ROLES.map(role => {
                                const roleAssignments = assignments.filter(a => a.role === role);
                                const isMulti = MULTI_MEMBER_ROLES.includes(role);

                                return (
                                    <div key={role} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                                {role === 'pastor' && <Shield size={14} className="text-blue-500" />}
                                                {role === 'preacher' && <BookOpen size={14} className="text-purple-500" />}
                                                {role === 'choir' && <Music size={14} className="text-indigo-500" />}
                                                {role === 'songleader' && <Mic size={14} className="text-pink-500" />}
                                                {ROLE_LABELS[role]}
                                            </label>
                                            {(isMulti || roleAssignments.length === 0) && (
                                                <button
                                                    onClick={() => setShowRoleSearch(role)}
                                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Plus size={12} /> Assign {isMulti ? 'More' : ''}
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {roleAssignments.map((a, idx) => (
                                                <div key={`${a.member_id}-${idx}`} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 border border-white shadow-sm">
                                                                {a.member?.profile_picture_url ? (
                                                                    <img src={a.member.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                        <Users size={14} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-sm font-bold text-gray-900">
                                                                {a.member?.first_name} {a.member?.surname}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeAssignment(a.member_id!, role)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <IconX size={14} />
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Notes/Assignments (e.g. Lead, Alto, etc.)"
                                                        value={a.notes || ''}
                                                        onChange={(e) => updateAssignmentNotes(a.member_id!, role, e.target.value)}
                                                        className="text-xs bg-white border border-gray-100 rounded-lg px-2 py-1.5 focus:border-blue-200 outline-none placeholder:text-gray-300"
                                                    />
                                                </div>
                                            ))}
                                            {roleAssignments.length === 0 && (
                                                <div className="text-[11px] italic text-gray-400 pl-1">No one assigned</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sermon */}
                    <div className="card-panel p-6 space-y-4 bg-white">
                        <h3 className="text-[1.22rem] leading-6 font-semibold tracking-tight flex items-center gap-2 mb-4 text-[var(--color-text-main)]">
                            <BookOpen className="text-[var(--color-primary)]" size={20} />
                            Message / Word
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="form-label">Sermon Title</label>
                                <input
                                    type="text"
                                    value={service.sermon_title || ''}
                                    onChange={(e) => update('sermon_title', e.target.value)}
                                    placeholder="e.g. Walking by Faith"
                                    className="form-control"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="form-label">Notes / Key Verses</label>
                                <textarea
                                    value={service.sermon_notes || ''}
                                    onChange={(e) => update('sermon_notes', e.target.value)}
                                    placeholder="e.g. Hebrews 11:1..."
                                    className="form-control form-textarea"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card-panel p-6 space-y-6 bg-white">
                        <h3 className="text-[1.16rem] leading-6 font-semibold tracking-tight flex items-center gap-2 text-[var(--color-text-main)]">
                            <Users className="text-[var(--color-primary)]" size={20} />
                            Attendance Stats
                        </h3>

                        <div className="space-y-4">
                            <div className="p-4 bg-[var(--color-primary)]/10 rounded-lg border border-[var(--color-primary)]/20 text-center">
                                <p className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-semibold mb-1">Total Attendance</p>
                                <p className="text-4xl font-bold text-[var(--color-primary-dark)] tracking-tight tabular-nums">{service.total_attendance}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center gap-3 px-1">
                                    <label className="text-[0.7rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.1em] min-w-[7.6rem] leading-tight">Members Present</label>
                                    <span className="text-lg font-semibold text-[var(--color-primary-dark)] whitespace-nowrap tabular-nums">{Number(service.members_present) || 0} Checked In</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAttendanceModalOpen(true)}
                                    className="w-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 px-3"
                                >
                                    <Users size={18} className="shrink-0" /> <span>Manage Attendance Report</span>
                                </button>
                                <div className="space-y-1 pt-2 border-t border-[var(--color-border)]">
                                    <label className="text-[0.7rem] text-[var(--color-text-muted)] uppercase font-semibold px-1 tracking-[0.1em]">Visitors / Non-Members Present</label>
                                    <input
                                        type="number"
                                        value={isPrimaryService ? service.visitors_present : 0}
                                        onChange={(e) => update('visitors_present', parseInt(e.target.value) || 0)}
                                        className="form-control text-center text-2xl font-semibold tabular-nums text-[var(--color-primary-dark)] px-3 disabled:opacity-60 disabled:bg-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        min="0"
                                        disabled={!isPrimaryService}
                                    />
                                    <p className="text-[11px] text-[var(--color-text-muted)] font-semibold px-1 mt-1">
                                        {isPrimaryService
                                            ? `Visitor cards encoded: ${newVisitors.length}`
                                            : "Visitors can only be recorded for Sunday Morning, Sunday Afternoon, and Wednesday Prayer Meeting."}
                                    </p>
                                </div>
                                {isPrimaryService && (
                                    <div className="space-y-1 pt-2">
                                        <label className="text-[0.7rem] text-[var(--color-text-muted)] uppercase font-semibold px-1 tracking-[0.1em]">Visitor Card URL (Image)</label>
                                        <ImageUpload
                                            value={(service as any).visitor_card_url || ''}
                                            onChange={(url) => update('visitor_card_url', url)}
                                            folder={`services/${service.service_type || 'general'}`}
                                            label=""
                                            description="Upload visitor card or service photo"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card-panel p-6 space-y-6 bg-white">
                        <h3 className="text-[1.16rem] leading-6 font-semibold tracking-tight flex items-center gap-2 text-[var(--color-text-main)]">
                            <Heart className="text-red-400" size={20} />
                            Spiritual Results
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="form-label">Souls Saved</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        value={isPrimaryService ? service.souls_saved : 0}
                                        onChange={(e) => update('souls_saved', parseInt(e.target.value) || 0)}
                                        className="form-control text-right font-semibold tabular-nums disabled:opacity-60 disabled:bg-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        disabled={!isPrimaryService}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="form-label">Members who Prayed</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        value={service.members_who_prayed}
                                        onChange={(e) => update('members_who_prayed', parseInt(e.target.value) || 0)}
                                        className="form-control text-right font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="form-label">Baptism Prospects</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        value={service.prospects_for_baptism}
                                        onChange={(e) => update('prospects_for_baptism', parseInt(e.target.value) || 0)}
                                        className="form-control text-right font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="form-label">Visitors Saved</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        value={isPrimaryService ? service.visitors_saved : 0}
                                        onChange={(e) => update('visitors_saved', parseInt(e.target.value) || 0)}
                                        className="form-control text-right font-semibold tabular-nums disabled:opacity-60 disabled:bg-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        disabled={!isPrimaryService}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* New Visitors Panel */}
                {isPrimaryService && (
                    <div className="lg:col-span-3">
                        <div className="card-panel p-6 bg-white">
                            <QuickVisitorRegistration
                                visitors={newVisitors}
                                onChange={setNewVisitors}
                                folderPath={`services/${service.service_type || 'general'}/cards`}
                                defaultVisitDate={service.service_date}
                                contextLabel={`${getServiceTypeLabel(service.service_type)}${service.service_date ? ` | ${service.service_date}` : ''}`}
                            />
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={showConfirmDelete}
                title="Delete Service Record"
                message="Are you sure you want to PERMANENTLY delete this service record and all associated attendance logs?"
                confirmText="Delete Service"
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setShowConfirmDelete(false)}
            />

            <AttendanceReportModal
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                title={`${service.service_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${new Date(service.service_date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                subtitle="ATTENDANCE REPORT"
                members={members}
                selectedMemberIds={selectedMemberIds}
                onSave={(ids) => setSelectedMemberIds(ids)}
                visitorsCount={visitorsCountForReport}
            />

            <SuccessModal
                isOpen={showSuccessModal}
                onDone={() => navigate('/services')}
                onView={() => navigate(`/services`)}
            />

            <SearchMemberModal
                isOpen={!!showRoleSearch}
                onClose={() => setShowRoleSearch(null)}
                onSelect={handleSelectMemberForRole}
            />
        </div >
    );
};

export default ServiceForm;
