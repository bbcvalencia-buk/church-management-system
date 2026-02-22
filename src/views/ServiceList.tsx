
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Service } from "@/types";
import {
    Plus,
    Calendar,
    Users,
    Heart,
    BookOpen,
    Clock,
    Search,
    Filter,
    Trash2
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

// Helper to format service type
const formatServiceType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const ServiceList: React.FC = () => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null; title: string }>({
        isOpen: false,
        id: null,
        title: ''
    });

    useEffect(() => {
        fetchServices();
    }, []);

    const handleDelete = async () => {
        if (!confirmDelete.id) return;
        try {
            const id = confirmDelete.id;
            await supabase.from('attendance_log').delete().eq('event_id', id).eq('event_type', 'service');
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (error) throw error;
            setConfirmDelete({ isOpen: false, id: null, title: '' });
            fetchServices();
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    const fetchServices = async () => {
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .order('service_date', { ascending: false });

            if (error) throw error;
            setServices(data as Service[]);
        } catch (err) {
            console.error("Error fetching services:", err);
        } finally {
            setLoading(false);
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
                    <Link
                        to="/services/new"
                        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 font-medium"
                    >
                        <Plus size={18} />
                        <span>Log Service</span>
                    </Link>
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
                {loading ? (
                    <div className="text-center py-12 text-[var(--color-text-muted)]">Loading services...</div>
                ) : filteredServices.length === 0 ? (
                    <div className="text-center py-12 text-[var(--color-text-muted)]">No service records found.</div>
                ) : (
                    filteredServices.map(service => (
                        <div key={service.id} className="card-panel p-0 overflow-hidden group hover:shadow-md transition-all relative bg-white">
                            <button
                                onClick={() => setConfirmDelete({
                                    isOpen: true,
                                    id: service.id,
                                    title: service.sermon_title || "Untitled Service"
                                })}
                                className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-gray-100/50 hover:bg-red-50 rounded-full"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                            <div className="p-4 md:p-6 flex flex-col md:flex-row gap-6">
                                {/* Date Block */}
                                <div className="flex-shrink-0 flex flex-row md:flex-col items-center justify-center bg-blue-50 border border-blue-100 rounded-lg p-3 w-full md:w-24 gap-3 md:gap-0">
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
                                            ${service.service_type.includes('sunday') ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}
                                        `}>
                                            {formatServiceType(service.service_type)}
                                        </span>
                                        {service.service_time && (
                                            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                                <Clock size={12} /> {service.service_time}
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="text-lg font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                                        {service.sermon_title || "No Title Recorded"}
                                    </h3>

                                    {service.sermon_notes && (
                                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">
                                            {service.sermon_notes}
                                        </p>
                                    )}

                                    {/* Stats Row */}
                                    <div className="flex flex-wrap gap-4 pt-2 text-sm">
                                        <div className="flex items-center gap-1.5 text-blue-600" title="Total Attendance">
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

                                <div className="flex md:flex-col justify-end gap-2">
                                    <Link
                                        to={`/services/${service.id}`}
                                        className="btn btn-ghost px-4 py-2 text-sm whitespace-nowrap text-[var(--color-primary)] hover:bg-blue-50"
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))
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
