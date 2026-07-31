import React from 'react';
import { BookOpen, X } from 'lucide-react';
import type { GoodnewsSeries } from '@/types';

interface SeriesFormModalProps {
    seriesForm: Partial<GoodnewsSeries>;
    setSeriesForm: (form: Partial<GoodnewsSeries>) => void;
    members: any[];
    submitting: boolean;
    onClose: () => void;
    onSave: () => void;
    onDelete?: () => void;
}

const SeriesFormModal: React.FC<SeriesFormModalProps> = ({
    seriesForm,
    setSeriesForm,
    members,
    submitting,
    onClose,
    onSave,
    onDelete
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
            <div className="bg-[var(--color-surface)] rounded-none shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-[var(--color-border)]">
                <div className="px-6 py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-text-main)]">
                        <BookOpen size={20} className="text-[var(--color-primary)]" />
                        {seriesForm.id ? 'Edit Goodnews Area' : 'Create Goodnews Area'}
                    </h2>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors p-1 bg-[var(--color-surface)] rounded-none border border-[var(--color-border)]">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 bg-[var(--color-surface)]">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Area/Barangay *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Bagontaas"
                                value={seriesForm.area || ''}
                                onChange={(e) => setSeriesForm({ ...seriesForm, area: e.target.value })}
                                className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Specific Location</label>
                            <input
                                type="text"
                                placeholder="e.g. Purok 5 Covered Court"
                                value={seriesForm.location || ''}
                                onChange={(e) => setSeriesForm({ ...seriesForm, location: e.target.value })}
                                className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Lead Teacher</label>
                            <select
                                value={seriesForm.lead_member_id || ''}
                                onChange={(e) => setSeriesForm({ ...seriesForm, lead_member_id: e.target.value || undefined })}
                                className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                            >
                                <option value="">-- Unassigned --</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.first_name} {m.surname}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Status</label>
                            <select
                                value={seriesForm.status || 'ongoing'}
                                onChange={(e) => setSeriesForm({ ...seriesForm, status: e.target.value as any })}
                                className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all font-bold"
                            >
                                <option value="ongoing">Ongoing</option>
                                <option value="paused">Paused</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Start Date *</label>
                            <input
                                type="date"
                                required
                                value={seriesForm.start_date || ''}
                                onChange={(e) => setSeriesForm({ ...seriesForm, start_date: e.target.value })}
                                className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">End Date</label>
                            <input
                                type="date"
                                disabled={seriesForm.status !== 'completed'}
                                value={seriesForm.end_date || ''}
                                onChange={(e) => setSeriesForm({ ...seriesForm, end_date: e.target.value })}
                                className="w-full disabled:opacity-50 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Notes / Description</label>
                        <textarea
                            rows={3}
                            placeholder="Any additional information..."
                            value={seriesForm.notes || ''}
                            onChange={(e) => setSeriesForm({ ...seriesForm, notes: e.target.value })}
                            className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="p-4 px-6 border-t border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-hover)]">
                    {seriesForm.id && onDelete ? (
                        <button
                            onClick={onDelete}
                            className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest"
                        >
                            Delete
                        </button>
                    ) : <div></div>}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] rounded-none transition-colors border border-transparent"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            disabled={submitting || !seriesForm.area || !seriesForm.start_date}
                            className="btn-primary px-6 py-2 rounded-none font-bold shadow-sm disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : 'Save Area'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SeriesFormModal;
