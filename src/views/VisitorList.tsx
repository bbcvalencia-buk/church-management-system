import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as visitorService from "@/services/visitorService";
import type { Visitor } from "../types";
import { Plus, Search, Filter, MapPin, Phone, UserPlus, Calendar, Trash2, Download, MoreHorizontal, Mail, ChevronDown, ChevronLeft, ChevronRight, User } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

const VisitorList: React.FC = () => {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null; name: string }>({
        isOpen: false,
        id: null,
        name: ''
    });
    const [deleting, setDeleting] = useState(false); // Added deleting state
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [showConverted, setShowConverted] = useState<boolean>(false);

    useEffect(() => {
        fetchVisitors();
    }, []);

    const fetchVisitors = async () => {
        setLoading(true);
        try {
            const data = await visitorService.getVisitors();
            setVisitors(data || []);
        } catch (err) {
            console.error("Error fetching visitors:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete.id) return;
        setDeleting(true);
        try {
            // The R2 deletion logic should ideally be part of the visitorService.deleteVisitor
            // For now, keeping it here if visitorService doesn't handle it.
            // If visitorService.deleteVisitor handles R2 deletion, this block can be removed.
            const visitorToDelete = visitors.find(v => v.id === confirmDelete.id);

            // Legacy single image
            if (visitorToDelete?.visitor_card_image_url) {
                try {
                    const { deleteFile } = await import('@/lib/storage');
                    await deleteFile(visitorToDelete.visitor_card_image_url);
                } catch (e) {
                    console.warn("Could not delete legacy visitor card from R2:", e);
                }
            }

            // New multiple images
            if (visitorToDelete?.visitor_card_images && visitorToDelete.visitor_card_images.length > 0) {
                try {
                    const { deleteFile } = await import('@/lib/storage');
                    await Promise.all(visitorToDelete.visitor_card_images.map(url => deleteFile(url)));
                } catch (e) {
                    console.warn("Could not delete associated visitor cards from R2:", e);
                }
            }

            await visitorService.deleteVisitor(confirmDelete.id);
            setVisitors(prev => prev.filter(v => v.id !== confirmDelete.id));
            setConfirmDelete({ isOpen: false, id: null, name: "" });
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        } finally {
            setDeleting(false);
        }
    };

    const filteredVisitors = visitors.filter((visitor) => {
        const matchesSearch =
            visitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            visitor.invited_by?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter =
            filterStatus === "all" || visitor.follow_up_status === filterStatus;

        const isConverted = visitor.converted_to_member || visitor.status === 'converted' || visitor.follow_up_status === 'converted';
        const matchesConverted = showConverted || !isConverted;

        return matchesSearch && matchesFilter && matchesConverted;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)]">
                        Visitor Management
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Track visitors, follow-ups, and conversions.
                    </p>
                </div>
                <Link
                    to="/visitors/new"
                    className="bg-[var(--color-primary)] hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20"
                >
                    <Plus size={18} />
                    <span>New Visitor</span>
                </Link>
            </div>

            {/* Filters & Search - Floating Style */}
            <div className="bg-white rounded-[24px] p-5 border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:max-w-md">
                    <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search by name or inviter..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <select
                            className="appearance-none bg-white border border-gray-200 text-sm font-bold text-gray-700 py-2.5 pl-10 pr-10 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        >
                            <option>Last 30 Days</option>
                            <option>Last 3 Months</option>
                            <option>This Year</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="appearance-none bg-white border border-gray-200 text-sm font-bold text-gray-700 py-2.5 pl-10 pr-10 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="contacted">Contacted</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>

                    <label className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors shrink-0">
                        <input
                            type="checkbox"
                            checked={showConverted}
                            onChange={(e) => setShowConverted(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500/20 shadow-sm"
                        />
                        <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Show Converted</span>
                    </label>

                    <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors bg-white">
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white border border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-white text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
                                <th className="p-5 pl-6">Visitor Name</th>
                                <th className="p-5">Visit Date</th>
                                <th className="p-5">Invited By</th>
                                <th className="p-5">Status</th>
                                <th className="p-5 text-right pr-6">Quick Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500 font-semibold">Loading visitors...</td>
                                </tr>
                            ) : filteredVisitors.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400 font-semibold">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center border border-gray-200">
                                                <Search size={20} className="text-gray-400" />
                                            </div>
                                            No visitors found.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredVisitors.map((visitor) => {
                                    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                    const getStatusColor = (status: string) => {
                                        switch (status) {
                                            case 'pending': return 'bg-blue-50 text-blue-600 border-blue-100';
                                            case 'converted': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                            case 'contacted': return 'bg-orange-50 text-orange-600 border-orange-100';
                                            default: return 'bg-purple-50 text-purple-600 border-purple-100';
                                        }
                                    };
                                    const getStatusDot = (status: string) => {
                                        switch (status) {
                                            case 'pending': return 'bg-blue-500';
                                            case 'converted': return 'bg-emerald-500';
                                            case 'contacted': return 'bg-orange-500';
                                            default: return 'bg-purple-500';
                                        }
                                    };
                                    const visitSource = visitor.sunday_school_session_id
                                        ? 'Sunday School'
                                        : `${visitor.visit_time || 'AM'} Service`;

                                    return (
                                        <tr key={visitor.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-5 pl-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                                                        {getInitials(visitor.name)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 text-[14px]">{visitor.name}</div>
                                                        <div className="text-[12px] font-medium text-gray-500 mt-0.5">{visitor.contact_number || 'No contact'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="font-bold text-gray-700 text-[13px]">{new Date(visitor.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                <div className="text-[12px] font-medium text-gray-500 mt-0.5">{visitSource}</div>
                                            </td>
                                            <td className="p-5">
                                                <div className="text-[13px] font-semibold text-gray-700">{visitor.invited_by || 'Walk-in'}</div>
                                            </td>
                                            <td className="p-5">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 w-fit ${getStatusColor(visitor.follow_up_status)}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(visitor.follow_up_status)}`}></span>
                                                    {visitor.follow_up_status === 'pending' ? 'New Visitor' : visitor.follow_up_status}
                                                </span>
                                            </td>
                                            <td className="p-5 pr-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link
                                                        to={`/visitors/${visitor.id}`}
                                                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors font-semibold text-xs flex items-center gap-1"
                                                    >
                                                        View Profile
                                                    </Link>
                                                    <button
                                                        onClick={() => setConfirmDelete({ isOpen: true, id: visitor.id, name: visitor.name })}
                                                        className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
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

                {/* Pagination Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-500">
                        Showing <span className="text-gray-900">1</span> to <span className="text-gray-900">{filteredVisitors.length}</span> of <span className="text-gray-900">{filteredVisitors.length}</span> results
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"><ChevronLeft size={16} /></button>
                        <button className="w-8 h-8 flex items-center justify-center border border-blue-600 bg-blue-50 text-blue-600 font-bold rounded-lg text-sm">1</button>
                        <button className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title="Delete Visitor"
                message={`Are you sure you want to PERMANENTLY delete visitor "${confirmDelete.name}"? This cannot be undone.`}
                confirmText="Delete Visitor"
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete({ isOpen: false, id: null, name: '' })}
            />
        </div>
    );
};

export default VisitorList;
