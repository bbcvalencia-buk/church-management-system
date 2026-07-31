import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as serviceService from "@/services/serviceService";
import type { Service, ServiceAssignment } from "@/types";
import {
    Plus,
    Calendar,
    Users,
    Heart,
    BookOpen,
    Clock,
    Search,
    Filter,
    Trash2,
    ArrowLeft,
    X as IconX,
    UserCircle,
    Mic,
    Shield,
    Music,
    ChevronDown,
    ChevronUp,
    Edit
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

// Helper to format service type
const formatServiceType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const ROLE_ICONS: Record<string, any> = {
    songleader: Mic,
    pastor: Shield,
    preacher: BookOpen,
    choir: Music,
    pianist: Music, // Using Music icon as fallback
};

const ServiceList: React.FC = () => {
    const { roles } = useAuth();
    const canManageServices =
        roles.includes(UserRole.CHURCH_ADMINISTRATOR) ||
        roles.includes(UserRole.CHURCH_CLERK) ||
        roles.includes(UserRole.RECORDING_SECRETARY);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null; title: string }>({
        isOpen: false,
        id: null,
        title: ''
    });
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<Record<string, ServiceAssignment[]>>({});
    const [loadingAssignments, setLoadingAssignments] = useState<Record<string, boolean>>({});
    const [showServicesList, setShowServicesList] = useState(false);

    useEffect(() => {
        fetchServices();
    }, []);

    const handleDelete = async () => {
        if (!canManageServices) {
            alert("You have read-only access.");
            return;
        }
        if (!confirmDelete.id) return;
        try {
            await serviceService.deleteService(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null, title: '' });
            fetchServices();
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    const fetchServices = async () => {
        try {
            const data = await serviceService.getServices();
            setServices(data);
        } catch (err) {
            console.error("Error fetching services:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchServiceRoster = async (serviceId: string) => {
        if (assignments[serviceId]) return; // Already loaded

        setLoadingAssignments(prev => ({ ...prev, [serviceId]: true }));
        try {
            const data = await serviceService.getServiceAssignments(serviceId);
            setAssignments(prev => ({ ...prev, [serviceId]: data }));
        } catch (err) {
            console.error("Error fetching assignments:", err);
        } finally {
            setLoadingAssignments(prev => ({ ...prev, [serviceId]: false }));
        }
    };

    const toggleServiceExpansion = (id: string) => {
        if (expandedServiceId === id) {
            setExpandedServiceId(null);
        } else {
            setExpandedServiceId(id);
            fetchServiceRoster(id);
        }
    };

    const filteredServices = services.filter(service => {
        const matchesType = filterType === 'all' || service.service_type === filterType;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
            (service.sermon_title?.toLowerCase().includes(searchLower)) ||
            (service.sermon_notes?.toLowerCase().includes(searchLower));

        return matchesType && matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)]">
                        Service Records
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Track attendance, sermons, and spiritual decisions.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        to="/announcements"
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
                    >
                        <Calendar size={18} className="text-gray-500" />
                        <span className="hidden sm:inline">Announcements</span>
                    </Link>
                    {canManageServices && (
                        <Link
                            to="/services/new"
                            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-text-main)] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg  font-medium"
                        >
                            <Plus size={18} />
                            <span>Log Service</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="py-4 border-b border-black flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full">
                    <Search
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-black"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="SEARCH SERMON TITLES..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 bg-transparent border-none text-black placeholder-gray-400 focus:ring-0 text-xs font-mono uppercase tracking-widest py-2 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Type</span>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-transparent border-none text-xs font-mono uppercase tracking-widest text-black focus:ring-0 cursor-pointer p-0"
                    >
                        <option value="all">All Services</option>
                        <option value="sunday_morning">Sunday Morning</option>
                        <option value="sunday_afternoon">Sunday Afternoon</option>
                        <option value="wednesday_prayer">Wednesday Prayer</option>
                        <option value="pre_service">Pre-Service</option>
                        <option value="funeral">Funeral</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="mt-8">
                <div className="mb-6 text-[11px] font-mono uppercase tracking-widest text-gray-400">
                    {filteredServices.length} records found
                </div>

                <div className="relative border-l-2 border-gray-100 ml-3 pl-8 space-y-12 py-4">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400 font-mono text-xs uppercase tracking-widest">Loading services...</div>
                    ) : filteredServices.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 font-mono text-xs uppercase tracking-widest">No service records found.</div>
                    ) : (
                        filteredServices.map(service => {
                            const isExpanded = expandedServiceId === service.id;
                            const serviceAssignments = assignments[service.id] || [];
                            const dateObj = new Date(service.service_date);

                            return (
                                <div key={service.id} className="relative group">
                                    {/* Timeline dot */}
                                    <div className="absolute -left-[41px] top-1 w-4 h-4 rounded-full bg-white border-2 border-gray-200 group-hover:border-[var(--color-primary)] transition-colors z-10" />
                                    
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        {/* Date Info */}
                                        <div className="flex-shrink-0 w-32 pt-0.5">
                                            <div className="text-3xl font-light text-black tracking-tighter leading-none" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                                                {dateObj.getDate()}
                                            </div>
                                            <div className="text-xs font-mono uppercase tracking-widest text-gray-400 mt-1">
                                                {dateObj.toLocaleString('default', { month: 'short' })} {dateObj.getFullYear()}
                                            </div>
                                            {service.service_time && (
                                                <div className="text-[10px] font-mono text-gray-400 mt-1 flex items-center gap-1">
                                                    <Clock size={10} /> {service.service_time}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-primary)] mb-2 block">
                                                        {formatServiceType(service.service_type)}
                                                    </span>
                                                    <h3 className="text-xl text-black font-medium leading-tight">
                                                        {service.sermon_title || "No Title Recorded"}
                                                    </h3>
                                                </div>

                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canManageServices && (
                                                        <>
                                                            <Link
                                                                to={`/services/${service.id}`}
                                                                className="p-1.5 text-gray-400 hover:text-black transition-colors"
                                                                title="Edit Record"
                                                            >
                                                                <Edit size={16} />
                                                            </Link>
                                                            <button
                                                                onClick={() => setConfirmDelete({
                                                                    isOpen: true,
                                                                    id: service.id,
                                                                    title: service.sermon_title || "Untitled Service"
                                                                })}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {service.sermon_notes && (
                                                <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
                                                    {service.sermon_notes}
                                                </p>
                                            )}

                                            {/* Stats */}
                                            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-lg font-medium text-black">{service.total_attendance}</span>
                                                    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Total</span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-lg font-medium text-gray-700">{service.members_present}</span>
                                                    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Members</span>
                                                </div>
                                                {service.visitors_present > 0 && (
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-lg font-medium text-gray-700">{service.visitors_present}</span>
                                                        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Visitors</span>
                                                    </div>
                                                )}
                                                {(service.souls_saved > 0 || service.visitors_saved > 0) && (
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-lg font-medium text-red-600">{service.souls_saved}</span>
                                                        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Saved</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Roster Toggle */}
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => toggleServiceExpansion(service.id)}
                                                    className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-primary)] hover:text-black transition-colors flex items-center gap-1"
                                                >
                                                    {isExpanded ? '− Hide Roster' : '+ View Roster'}
                                                </button>
                                            </div>

                                            {/* Expanded Roster View */}
                                            {isExpanded && (
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    {loadingAssignments[service.id] ? (
                                                        <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Loading roster...</div>
                                                    ) : serviceAssignments.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {serviceAssignments.map((a, idx) => {
                                                                const Icon = ROLE_ICONS[a.role] || UserCircle;
                                                                return (
                                                                    <div key={`${a.id}-${idx}`} className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-50 shrink-0">
                                                                            {a.member?.profile_picture_url ? (
                                                                                <img src={a.member.profile_picture_url} alt="" className="w-full h-full object-cover grayscale" />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center text-gray-300"> <Users size={12} /> </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <Link to={`/members/${a.member_id}`} className="text-sm font-medium text-black hover:text-[var(--color-primary)] truncate block">
                                                                                {a.member?.first_name} {a.member?.surname}
                                                                            </Link>
                                                                            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 flex items-center gap-1 mt-0.5">
                                                                                <Icon size={10} /> {a.role.replace('_', ' ')}
                                                                            </p>
                                                                            {a.notes && (
                                                                                <p className="text-[11px] text-gray-500 italic truncate mt-0.5">"{a.notes}"</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                                            No roles assigned.
                                                            {canManageServices && <Link to={`/services/${service.id}`} className="text-[var(--color-primary)] hover:text-black">Assign roles</Link>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title="Delete Service Record"
                message={`Are you sure you want to PERMANENTLY delete the service "${confirmDelete.title}"? This will also remove all associated attendance logs.`}
                confirmText="Delete Record"
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete({ isOpen: false, id: null, title: '' })}
            />
        </div>
    );
};

export default ServiceList;
