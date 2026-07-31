import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as visitorService from "@/services/visitorService";
import type { Visitor } from "../types";
import { Plus, Search, Calendar, Trash2 } from "lucide-react";
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
    const [deleting, setDeleting] = useState(false);

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
            const visitorToDelete = visitors.find(v => v.id === confirmDelete.id);
            if (visitorToDelete?.visitor_card_image_url) {
                try {
                    const { deleteFile } = await import('@/lib/storage');
                    await deleteFile(visitorToDelete.visitor_card_image_url);
                } catch (e) {
                    console.warn("Could not delete legacy visitor card from R2:", e);
                }
            }
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
        return matchesSearch;
    });

    const pending = filteredVisitors.filter(v => v.follow_up_status === 'pending' && !v.converted_to_member && v.status !== 'converted');
    const contacted = filteredVisitors.filter(v => v.follow_up_status === 'contacted' && !v.converted_to_member && v.status !== 'converted');
    const converted = filteredVisitors.filter(v => v.follow_up_status === 'converted' || v.converted_to_member || v.status === 'converted');

    const renderColumn = (title: string, items: Visitor[]) => (
        <div className="flex flex-col gap-4 bg-[var(--color-surface)] p-4 rounded-[0.5rem] border border-[var(--color-border)] min-h-[300px]">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-main)] mb-2 flex justify-between items-center">
                <span>{title}</span>
                <span className="bg-transparent border border-[var(--color-border)] px-2 py-0.5 rounded-[0.5rem] text-[10px]">{items.length}</span>
            </h2>
            {items.length === 0 ? (
                <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] italic p-4 text-center border border-dashed border-[var(--color-border)] rounded-[0.5rem]">No visitors</div>
            ) : (
                items.map(visitor => (
                    <div key={visitor.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[0.5rem] p-4 flex flex-col gap-3 hover:border-[var(--color-primary)] transition-colors group relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <Link to={`/visitors/${visitor.id}`} className="font-bold text-[13px] text-[var(--color-text-main)] hover:text-[var(--color-primary)] uppercase tracking-widest">
                                    {visitor.name}
                                </Link>
                                <div className="text-[11px] font-bold text-[var(--color-text-muted)] mt-1 tracking-widest">{visitor.contact_number || 'NO CONTACT'}</div>
                            </div>
                            <button
                                onClick={() => setConfirmDelete({ isOpen: true, id: visitor.id, name: visitor.name })}
                                className="text-[var(--color-text-muted)] hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border)]">
                            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase flex items-center gap-1 tracking-widest">
                                <Calendar size={12} />
                                {new Date(visitor.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                                {visitor.invited_by ? `BY: ${visitor.invited_by}` : 'WALK-IN'}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--color-surface)] p-6 rounded-[0.5rem] border border-[var(--color-border)]">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)] tracking-tight leading-none mb-1 uppercase">
                        Visitor Management
                    </h1>
                    <p className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                        Track visitors, follow-ups, and conversions.
                    </p>
                </div>
                <Link
                    to="/visitors/new"
                    className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-[0.5rem] flex items-center gap-2 transition-colors font-bold text-[12px] uppercase tracking-widest"
                >
                    <Plus size={16} />
                    <span>New Visitor</span>
                </Link>
            </div>

            <div className="bg-[var(--color-surface)] rounded-[0.5rem] p-4 border border-[var(--color-border)] flex items-center">
                <Search className="text-[var(--color-text-muted)] mr-3" size={18} />
                <input
                    type="text"
                    placeholder="SEARCH VISITORS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-[12px] font-bold text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] outline-none bg-transparent uppercase tracking-widest"
                />
            </div>

            {loading ? (
                <div className="text-center py-12 text-[var(--color-text-muted)] font-bold text-[12px] uppercase tracking-widest">Loading visitors...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    {renderColumn("Needs Follow-up", pending)}
                    {renderColumn("Followed Up", contacted)}
                    {renderColumn("Converted", converted)}
                </div>
            )}

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
