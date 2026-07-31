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
    ChevronUp
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
            <div className="card-panel p-4 flex flex-col md:flex-row gap-4 items-center bg-white">
                <div className="relative flex-1 w-full">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search sermon titles..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-main)] placeholder-gray-400 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] rounded-lg py-2 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={18} className="text-[var(--color-text-muted)]" />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] rounded-lg py-2 px-3 transition-all"
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
            <div className="space-y-4">
                <button
                    onClick={() => setShowServicesList(!showServicesList)}
                    className="w-full flex items-center justify-between p-4 bg-white border border-[var(--color-border)] rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                >
                    <span className="font-bold text-[var(--color-text-main)]">
                        {showServicesList ? "Hide Services List" : "View Services List"}
                    </span>
                    <span className="text-[var(--color-text-muted)] text-sm">
                        {filteredServices.length} records found
                    </span>
                </button>

                {showServicesList && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-12 text-[var(--color-text-muted)]">Loading services...</div>
                        ) : filteredServices.length === 0 ? (
                            <div className="text-center py-12 text-[var(--color-text-muted)]">No service records found.</div>
                        ) : (
                            filteredServices.map(service => {
                        const isExpanded = expandedServiceId === service.id;
                        const serviceAssignments = assignments[service.id] || [];

                        return (
                            <div key={service.id} className="card-panel p-0 overflow-hidden group hover:shadow-md transition-all relative bg-white">
                                <div className="p-4 md:p-6 pb-2">
                                    {canManageServices && (
                                        <button
                                            onClick={() => setConfirmDelete({
                                                isOpen: true,
                                                id: service.id,
                                                title: service.sermon_title || "Untitled Service"
                                            })}
                                            className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-gray-100/50 hover:bg-red-50 rounded-lg z-10"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Date Block */}
                                        <div className="flex-shrink-0 flex flex-row md:flex-col items-center justify-center bg-gray-50 border border-blue-100 rounded-lg p-3 w-full md:w-24 gap-3 md:gap-0">
                                            <div className="text-xs uppercase font-bold text-[var(--color-primary)]">
                                                {new Date(service.service_date).toLocaleString('default', { month: 'short' }).toUpperCase()}
                                            </div>
                                            <div className="text-2xl md:text-3xl font-bold text-[var(--color-text-main)] leading-none">
                                                {new Date(service.service_date).getDate()}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-muted)]">
                                                {new Date(service.service_date).getFullYear()}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <span className={`
                                                    px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                                                    ${'bg-[var(--color-primary)] text-[var(--color-bg)]'}
                                                `}>
                                                    {formatServiceType(service.service_type)}
                                                </span>
                                                {service.service_time && (
                                                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                                        <Clock size={12} /> {service.service_time}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">
                                                {service.sermon_title || "No Title Recorded"}
                                            </h3>

                                            {service.sermon_notes && (
                                                <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">
                                                    {service.sermon_notes}
                                                </p>
                                            )}

                                            {/* Stats Row */}
                                            <div className="flex flex-wrap gap-4 pt-2 text-sm">
                                                <div className="flex items-center gap-1.5 text-[var(--color-text-main)]" title="Total Attendance">
                                                    <Users size={16} />
                                                    <span className="font-bold">{service.total_attendance}</span>
                                                    <span className="opacity-70 text-xs hidden sm:inline text-[var(--color-text-muted)]">Attended</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-green-600" title="Members Present">
                                                    <Users size={16} className="opacity-70" />
                                                    <span className="font-bold">{service.members_present}</span>
                                                    <span className="opacity-70 text-xs hidden sm:inline text-[var(--color-text-muted)]">Members</span>
                                                </div>
                                                {service.visitors_present > 0 && (
                                                    <div className="flex items-center gap-1.5 text-yellow-600" title="Visitors">
                                                        <Users size={16} className="opacity-70" />
                                                        <span className="font-bold">{service.visitors_present}</span>
                                                        <span className="opacity-70 text-xs hidden sm:inline text-[var(--color-text-muted)]">Visitors</span>
                                                    </div>
                                                )}
                                                {(service.souls_saved > 0 || service.visitors_saved > 0) && (
                                                    <div className="flex items-center gap-1.5 text-red-600 ml-auto" title="Souls Saved">
                                                        <Heart size={16} fill="currentColor" className="opacity-80" />
                                                        <span className="font-bold">{service.souls_saved}</span>
                                                        <span className="opacity-70 text-xs hidden sm:inline text-[var(--color-text-muted)]">Saved</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex md:flex-col justify-end gap-2 shrink-0">
                                            {canManageServices && (
                                                <Link
                                                    to={`/services/${service.id}`}
                                                    className="btn btn-ghost px-4 py-2 text-sm whitespace-nowrap text-[var(--color-text-main)] hover:bg-gray-50"
                                                >
                                                    Edit Record
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => toggleServiceExpansion(service.id)}
                                                className={`flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${isExpanded
                                                    ? 'bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] text-[var(--color-text-main)] border-[var(--color-border)]'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                {isExpanded ? 'Hide Roster' : 'View Roster'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Roster View */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top duration-300">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                            <UserCircle size={14} className="text-blue-500" />
                                            Service Roster / Participation
                                        </h4>

                                        {loadingAssignments[service.id] ? (
                                            <div className="flex items-center justify-center py-4">
                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                                            </div>
                                        ) : serviceAssignments.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {serviceAssignments.map((a, idx) => {
                                                    const Icon = ROLE_ICONS[a.role] || UserCircle;
                                                    return (
                                                        <div key={`${a.id}-${idx}`} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[var(--color-border)] shadow-sm transition-all hover:border-[var(--color-primary)] group">
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-[var(--color-border)]">
                                                                {a.member?.profile_picture_url ? (
                                                                    <img src={a.member.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-300"> <Users size={16} /> </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-black uppercase text-[var(--color-text-main)] tracking-tighter truncate flex items-center gap-1">
                                                                    <Icon size={10} /> {a.role.replace('_', ' ')}
                                                                </p>
                                                                <Link to={`/members/${a.member_id}`} className="text-[13px] font-bold text-gray-900 group-hover:text-blue-700 truncate block">
                                                                    {a.member?.first_name} {a.member?.surname}
                                                                </Link>
                                                                {a.notes && (
                                                                    <p className="text-[11px] text-gray-400 italic truncate" title={a.notes}>"{a.notes}"</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 bg-white border border-[var(--color-border)] rounded-lg">
                                                <p className="text-sm text-gray-400 font-medium">No service roles assigned for this date.</p>
                                                {canManageServices && <Link to={`/services/${service.id}`} className="text-xs text-blue-500 font-bold hover:underline mt-1 inline-block">Click here to assign roles</Link>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
                    </div>
                )}
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
