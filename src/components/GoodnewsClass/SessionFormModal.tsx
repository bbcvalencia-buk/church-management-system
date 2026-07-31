import React from 'react';
import { ClipboardList, X, Users, Heart } from 'lucide-react';
import type { GoodnewsSession, GoodnewsSessionRole } from '@/types';
import { ROLES, ROLE_LABELS } from '@/views/GoodnewsClass';

interface SessionFormModalProps {
    sessionForm: Partial<GoodnewsSession>;
    setSessionForm: (form: Partial<GoodnewsSession>) => void;
    sessionMembers: any[];
    setSessionMembers: (members: any[]) => void;
    members: any[];
    submitting: boolean;
    onClose: () => void;
    onSave: () => void;
}

const SessionFormModal: React.FC<SessionFormModalProps> = ({
    sessionForm,
    setSessionForm,
    sessionMembers,
    setSessionMembers,
    members,
    submitting,
    onClose,
    onSave
}) => {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
            <div className="bg-[var(--color-surface)] rounded-none shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-[var(--color-border)]">
                <div className="px-6 py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-text-main)]">
                        <ClipboardList size={20} className="text-[var(--color-primary)]" />
                        {sessionForm.id ? 'Edit Session' : 'Add New Session'}
                    </h2>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors p-1 bg-[var(--color-surface)] rounded-none border border-[var(--color-border)]">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 bg-[var(--color-surface)]">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Session Number</label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={sessionForm.session_number || ''}
                                onChange={(e) => setSessionForm({ ...sessionForm, session_number: parseInt(e.target.value) || 1 })}
                                className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-lg font-bold text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Date</label>
                            <input
                                type="date"
                                required
                                value={sessionForm.date || ''}
                                onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                                className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Lesson Topic (Optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. Creation"
                            value={sessionForm.lesson_topic || ''}
                            onChange={(e) => setSessionForm({ ...sessionForm, lesson_topic: e.target.value })}
                            className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6 p-4 rounded-none border border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                        <div>
                            <label className="block text-[10px] items-center gap-1 font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1.5 flex"><Users size={12} /> Children Attendance</label>
                            <input
                                type="number"
                                min="0"
                                value={sessionForm.children_count === 0 && !sessionForm.id ? '' : sessionForm.children_count}
                                onChange={(e) => setSessionForm({ ...sessionForm, children_count: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-none p-3 text-center text-2xl font-black text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] items-center gap-1 font-bold text-rose-600 uppercase tracking-widest mb-1.5 flex"><Heart size={12} /> Souls Saved</label>
                            <input
                                type="number"
                                min="0"
                                value={sessionForm.souls_saved_count === 0 && !sessionForm.id ? '' : sessionForm.souls_saved_count}
                                onChange={(e) => setSessionForm({ ...sessionForm, souls_saved_count: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[var(--color-surface)] border border-rose-200 rounded-none p-3 text-center text-2xl font-black text-rose-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none shadow-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5">Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Additional session details..."
                            value={sessionForm.notes || ''}
                            onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                            className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-none p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                        />
                    </div>

                    {/* Member Selection for Session */}
                    <div className="border-t border-[var(--color-border)] pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2"><Users size={16} className="text-[var(--color-primary)]" /> Church Members Participating</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setSessionMembers([...sessionMembers, { member_id: '', role: 'teacher', notes: '' }]);
                                }}
                                className="text-[10px] font-bold text-[var(--color-text-main)] uppercase tracking-widest bg-[var(--color-surface-hover)] px-3 py-1.5 rounded-none border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors"
                            >
                                + Add Member
                            </button>
                        </div>

                        <div className="space-y-3">
                            {sessionMembers.length === 0 ? (
                                <p className="text-xs text-[var(--color-text-muted)] italic text-center p-4 border border-dashed border-[var(--color-border)] rounded-none bg-[var(--color-surface-hover)]">No members added to this session yet.</p>
                            ) : (
                                sessionMembers.map((sm, index) => (
                                    <div key={index} className="flex gap-2 items-start bg-[var(--color-surface-hover)] p-2.5 rounded-none border border-[var(--color-border)] group">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2">
                                                <select
                                                    value={sm.member_id}
                                                    onChange={(e) => {
                                                        const newMembers = [...sessionMembers];
                                                        newMembers[index].member_id = e.target.value;
                                                        setSessionMembers(newMembers);
                                                    }}
                                                    className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-none p-2 text-xs font-bold text-[var(--color-text-main)]"
                                                >
                                                    <option value="" disabled>Select Member...</option>
                                                    {members.map(m => (
                                                        <option key={m.id} value={m.id}>{m.surname}, {m.first_name}</option>
                                                    ))}
                                                </select>

                                                <select
                                                    value={sm.role}
                                                    onChange={(e) => {
                                                        const newMembers = [...sessionMembers];
                                                        newMembers[index].role = e.target.value as any;
                                                        setSessionMembers(newMembers);
                                                    }}
                                                    className="w-[120px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-none p-2 text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wide"
                                                >
                                                    {ROLES.map(r => (
                                                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Role notes (optional)"
                                                value={sm.notes || ''}
                                                onChange={(e) => {
                                                    const newMembers = [...sessionMembers];
                                                    newMembers[index].notes = e.target.value;
                                                    setSessionMembers(newMembers);
                                                }}
                                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-none p-2 text-xs text-[var(--color-text-main)]"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newMembers = [...sessionMembers];
                                                newMembers.splice(index, 1);
                                                setSessionMembers(newMembers);
                                            }}
                                            className="p-2 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 rounded-none transition-colors mt-0.5"
                                            title="Remove"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 px-6 border-t border-[var(--color-border)] flex items-center justify-end gap-3 bg-[var(--color-surface-hover)]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-none transition-colors border border-transparent"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={submitting || !sessionForm.date || sessionMembers.some(sm => !sm.member_id)}
                        className="btn-primary px-6 py-2.5 rounded-none font-bold shadow-sm disabled:opacity-50"
                    >
                        {submitting ? 'Saving...' : 'Save Session'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionFormModal;
