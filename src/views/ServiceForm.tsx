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
import ServiceRolesPanel from "@/components/ServiceForm/ServiceRolesPanel";
import ServiceStatsPanel from "@/components/ServiceForm/ServiceStatsPanel";
import { MULTI_MEMBER_ROLES } from "@/components/ServiceForm/constants";
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

const getServiceDateWarning = (serviceType?: string, serviceDate?: string) => {
    if (!serviceType || !serviceDate) return "";
    const day = new Date(`${serviceDate}T00:00:00`).getDay();
    if ((serviceType === 'sunday_morning' || serviceType === 'sunday_afternoon') && day !== 0) {
        return "This is marked as a Sunday service, but the selected date is not a Sunday.";
    }
    if (serviceType === 'wednesday_prayer' && day !== 3) {
        return "This is marked as Wednesday Prayer, but the selected date is not a Wednesday.";
    }
    return "";
};



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
    const [tardyMemberIds, setTardyMemberIds, clearTardyDraft] = useSessionValue<string[]>(
        isEditMode ? `service-tardy-edit-${id}` : 'service-tardy-new',
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
        () => new Set(members.filter((m) => m.is_regular_member === false).map((m) => m.id)),
        [members]
    );
    const isPrimaryService = isPrimaryServiceType(service.service_type);
    const serviceDateWarning = getServiceDateWarning(service.service_type, service.service_date);

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

            // Extract tardy member IDs
            const tardyIds = (data || []).filter((d: any) => d.was_tardy === true).map((d: any) => d.member_id);
            setTardyMemberIds(tardyIds);

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
            const tardySet = new Set(tardyIds);
            const remaining = memberIds.filter(mid => !registeredMemberIds.includes(mid) && !tardySet.has(mid));
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
        const tardyCount = tardyMemberIds.filter((id) => !visitorMemberIds.has(id)).length;
        update('members_present', regularMemberCount + tardyCount);
    }, [selectedMemberIds, tardyMemberIds, visitorMemberIds]);

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

        if (serviceDateWarning && !window.confirm(`${serviceDateWarning}\n\nDo you want to save it anyway?`)) {
            return;
        }

        setSaving(true);

        try {
            const supportsVisitorsAndSouls = isPrimaryServiceType(service.service_type);
            const preparedVisitors = supportsVisitorsAndSouls ? normalizeDraftVisitors(newVisitors) : [];
            const invalidCardIndex = preparedVisitors.findIndex(visitor =>
                !visitor.name || !visitor.date_of_birth
            );

            if (invalidCardIndex >= 0) {
                throw new Error(`Visitor card #${invalidCardIndex + 1} is incomplete. Name and Date of Birth are required.`);
            }

            const selectedVisitorIds = selectedMemberIds.filter((id) => visitorMemberIds.has(id));
            const selectedRegularIds = selectedMemberIds.filter((id) => !visitorMemberIds.has(id));
            const tardyRegularIds = tardyMemberIds.filter((id) => !visitorMemberIds.has(id));

            const manualVisitorsInput = supportsVisitorsAndSouls ? (parseInt(service.visitors_present as any) || 0) : 0;
            const visitorsPresentCount = supportsVisitorsAndSouls
                ? Math.max(
                    selectedVisitorIds.length,
                    preparedVisitors.length > 0 ? preparedVisitors.length : manualVisitorsInput
                )
                : 0;
            const membersPresentCount = selectedRegularIds.length + tardyRegularIds.length;
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

                    // Immediately clear the automatically generated member number for the visitor shadow record
                    await memberService.updateMember(memberData.id, {
                        member_number: null as any,
                        member_number_year: null as any,
                        member_number_seq: null as any
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
            const finalMembersCount = uniqueRegularIds.length + tardyRegularIds.length;
            const allPresentMemberIds = Array.from(new Set([...uniqueRegularIds, ...uniqueVisitorIds]));
            const allMemberIds = Array.from(new Set([...allPresentMemberIds, ...tardyRegularIds]));
            const tardySet = new Set(tardyRegularIds);

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
                    was_present: true,
                    was_tardy: tardySet.has(mid)
                }));
                await serviceService.createAttendanceLogs(logs);
            }

            if (!id) {
                clearServiceDraft();
                clearMembersDraft();
                clearTardyDraft();
                clearVisitorsDraft();
                clearAssignmentsDraft();
                setShowSuccessModal(true);
            } else {
                clearServiceDraft();
                clearMembersDraft();
                clearTardyDraft();
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
                setAssignments(prev => prev.filter(a => !(a.role === role && a.member_id === memberId)));
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
            setShowRoleSearch(null);
        }
    };

    const removeAssignment = (memberId: string, role: string) => {
        setAssignments(prev => prev.filter(a => !(a.member_id === memberId && a.role === role)));
    };

    const updateAssignmentNotes = (memberId: string, role: string, notes: string) => {
        setAssignments(prev => prev.map(a =>
            (a.member_id === memberId && a.role === role) ? { ...a, notes } : a
        ));
    };

    const handleMarkAllPresent = () => {
        const regularMemberIds = members.filter(m => m.is_regular_member !== false).map(m => m.id);
        const nonRegularSelected = selectedMemberIds.filter(id => visitorMemberIds.has(id));
        setSelectedMemberIds(Array.from(new Set([...regularMemberIds, ...nonRegularSelected])));
        setTardyMemberIds([]);
    };

    if (loading) return <div className="p-8 text-center text-[var(--color-text-muted)]">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-none transition-colors text-[var(--color-text-main)]"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-serif tracking-tight text-[var(--color-text-main)]">
                            {isEditMode ? "Edit Service Record" : "Log New Service"}
                        </h1>
                        <p className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)] mt-1">
                            {new Date().toDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {isEditMode && (
                        <button
                            onClick={() => setShowConfirmDelete(true)}
                            className="bg-white border border-[var(--color-border)] text-red-600 px-5 py-2.5 rounded-lg font-bold uppercase tracking-wider text-xs shadow-sm hover:bg-red-50 hover:border-red-200 transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 py-2.5 rounded-lg font-mono uppercase tracking-widest text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Record'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
                {/* Left Column: Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-5">
                        <h3 className="text-lg font-serif text-[var(--color-text-main)] flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
                            <Calendar className="text-[var(--color-text-muted)]" size={18} />
                            Service Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] block">Service Type</label>
                                <select
                                    value={service.service_type}
                                    onChange={(e) => update('service_type', e.target.value)}
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-main)] rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-[var(--color-text-main)]/10 focus:border-[var(--color-text-main)] outline-none shadow-sm transition-all"
                                >
                                    <option value="sunday_morning">Sunday Morning</option>
                                    <option value="sunday_afternoon">Sunday Afternoon</option>
                                    <option value="wednesday_prayer">Wednesday Prayer</option>
                                    <option value="pre_service">Pre-Service</option>
                                    <option value="funeral">Funeral</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] block">Date & Time</label>
                                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
                                    <input
                                        type="date"
                                        value={service.service_date}
                                        onChange={(e) => update('service_date', e.target.value)}
                                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-main)] rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-[var(--color-text-main)]/10 focus:border-[var(--color-text-main)] outline-none shadow-sm transition-all min-w-0"
                                        required
                                    />
                                    <input
                                        type="time"
                                        value={service.service_time?.substring(0, 5)} // Handle HH:MM:SS from DB
                                        onChange={(e) => update('service_time', e.target.value)}
                                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-main)] rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-[var(--color-text-main)]/10 focus:border-[var(--color-text-main)] outline-none shadow-sm transition-all min-w-0"
                                    />
                                </div>
                                {serviceDateWarning && (
                                    <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                        {serviceDateWarning}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <ServiceRolesPanel
                        assignments={assignments}
                        onAssign={setShowRoleSearch}
                        onRemove={removeAssignment}
                        onUpdateNotes={updateAssignmentNotes}
                    />

                    {/* Sermon */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-5">
                        <h3 className="text-lg font-serif text-[var(--color-text-main)] flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
                            <BookOpen className="text-[var(--color-text-muted)]" size={18} />
                            Message / Word
                        </h3>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] block">Sermon Title</label>
                                <input
                                    type="text"
                                    value={service.sermon_title || ''}
                                    onChange={(e) => update('sermon_title', e.target.value)}
                                    placeholder="e.g. Walking by Faith"
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-main)] rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-[var(--color-text-main)]/10 focus:border-[var(--color-text-main)] outline-none shadow-sm transition-all placeholder-[var(--color-text-muted)]"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] block">Notes / Key Verses</label>
                                <textarea
                                    value={service.sermon_notes || ''}
                                    onChange={(e) => update('sermon_notes', e.target.value)}
                                    placeholder="e.g. Hebrews 11:1..."
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-main)] rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-[var(--color-text-main)]/10 focus:border-[var(--color-text-main)] outline-none shadow-sm transition-all min-h-[120px] placeholder-[var(--color-text-muted)]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Stats */}
                <ServiceStatsPanel
                    service={service}
                    isPrimaryService={isPrimaryService}
                    newVisitors={newVisitors}
                    onUpdate={update}
                    onMarkAllPresent={handleMarkAllPresent}
                    onOpenAttendance={() => setIsAttendanceModalOpen(true)}
                />

                {/* New Visitors Panel */}
                {isPrimaryService && (
                    <div className="lg:col-span-3">
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6">
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
                tardyIds={tardyMemberIds}
                onSave={(ids, tardy) => {
                    setSelectedMemberIds(ids);
                    if (tardy) setTardyMemberIds(tardy);
                }}
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
                selectedIds={showRoleSearch ? assignments.filter(a => a.role === showRoleSearch).map(a => a.member_id!) : []}
                isMulti={showRoleSearch ? MULTI_MEMBER_ROLES.includes(showRoleSearch) : false}
            />
        </div >
    );
};

export default ServiceForm;
