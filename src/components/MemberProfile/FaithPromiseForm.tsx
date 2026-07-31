
import React, { useState } from 'react';
import { Plus, Trash2, TrendingUp, AlertCircle, CheckCircle, Save } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

interface FaithPromiseFormProps {
    data: any;
    onChange: (field: string, value: any) => void;
}

const FaithPromiseForm: React.FC<FaithPromiseFormProps> = ({ data, onChange }) => {
    const { commitments = [], financials = [], formYear = new Date().getFullYear(), formAmount = 0, editingId = null } = data;

    const [showConfirm, setShowConfirm] = useState<{ isOpen: boolean; id: string | null; index: number | null }>({ isOpen: false, id: null, index: null });

    const handleSave = () => {
        if (formAmount <= 0) {
            alert("Amount must be greater than 0.");
            return;
        }

        const newCommitments = [...commitments];

        if (editingId) {
            // Edit existing
            const index = newCommitments.findIndex(c => c.id === editingId);
            if (index !== -1) {
                newCommitments[index] = {
                    ...newCommitments[index],
                    year: formYear,
                    promised_amount: formAmount
                };
            } else {
                // If id is local only
                const idx = newCommitments.findIndex(c => c.localId === editingId);
                if (idx !== -1) {
                    newCommitments[idx] = {
                        ...newCommitments[idx],
                        year: formYear,
                        promised_amount: formAmount
                    };
                }
            }
        } else {
            // Add new
            newCommitments.push({
                localId: Date.now().toString(), // temporary id for local state
                year: formYear,
                promised_amount: formAmount,
                isNew: true
            });
        }

        onChange('commitments', newCommitments);
        onChange('formAmount', 0);
        onChange('editingId', null);
    };

    const handleDelete = () => {
        if (showConfirm.index !== null) {
            const newCommitments = [...commitments];
            newCommitments.splice(showConfirm.index, 1);
            onChange('commitments', newCommitments);
        }
        setShowConfirm({ isOpen: false, id: null, index: null });
    };

    const getGivenForYear = (year: number) => {
        return financials.find((f: any) => f.year === year)?.total_given || 0;
    };

    return (
        <div className="space-y-8 font-sans">
            <h2 className="text-[18px] font-extrabold text-[#111827] flex items-center gap-3">
                <TrendingUp className="text-[var(--color-text-main)]" size={24} strokeWidth={2.5} /> Faith Promise Commitments
            </h2>

            {/* Form */}
            <div className="space-y-4">
                <h3 className="text-[11px] font-extrabold uppercase text-gray-400 tracking-widest">
                    {editingId ? "Edit Commitment" : "Add New Commitment"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 block mb-2">Year</label>
                        <input
                            type="number"
                            value={formYear}
                            onChange={(e) => onChange('formYear', parseInt(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all outline-none shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 block mb-2">Promised Amount</label>
                        <input
                            type="number"
                            min="0"
                            value={formAmount || ''}
                            onChange={(e) => onChange('formAmount', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all outline-none shadow-sm pb-2.5"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleSave}
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] rounded-none h-[46px] flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-sm hover:-translate-y-0.5"
                        >
                            <Save size={16} /> Save Commitment
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="space-y-5 mt-8">
                {commitments.length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-sm font-medium">No commitments recorded yet.</p>
                ) : (
                    commitments.map((comm: any, idx: number) => {
                        const given = getGivenForYear(comm.year);
                        const progress = Math.min((given / comm.promised_amount) * 100, 100);

                        return (
                            <div key={comm.id || comm.localId || idx} className="bg-white border border-gray-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{comm.year} Commitment</span>
                                            {given >= comm.promised_amount && comm.promised_amount > 0 && (
                                                <span className="bg-green-50 text-green-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded-none border border-green-100">Completed</span>
                                            )}
                                            {comm.isNew && (
                                                <span className="bg-gray-50 text-[var(--color-text-main)] text-[10px] uppercase font-bold px-2 py-0.5 rounded-none border border-[var(--color-primary-light)]">Unsaved</span>
                                            )}
                                        </div>
                                        <div className="text-2xl font-bold text-gray-900 leading-none">
                                            ₱{comm.promised_amount.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => {
                                                onChange('formYear', comm.year);
                                                onChange('formAmount', comm.promised_amount);
                                                onChange('editingId', comm.id || comm.localId);
                                            }}
                                            className="text-[11px] font-bold text-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors uppercase tracking-widest"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => setShowConfirm({ isOpen: true, id: comm.id || comm.localId, index: idx })}
                                            className="text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-2 mt-2">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-gray-500">Given: <span className="text-red-500">₱{given.toLocaleString()}</span></span>
                                        <span className="text-gray-400">Remaining: ₱{Math.max(0, comm.promised_amount - given).toLocaleString()}</span>
                                    </div>
                                    <div className="h-[7px] bg-gray-100 rounded-none overflow-hidden">
                                        <div
                                            className={`h-full rounded-none transition-all duration-500 ${given >= comm.promised_amount && comm.promised_amount > 0 ? 'bg-green-500' : 'bg-[var(--color-primary)]'}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <ConfirmModal
                isOpen={showConfirm.isOpen}
                title="Delete Commitment"
                message="Are you sure you want to delete this faith promise commitment?"
                confirmText="Delete"
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setShowConfirm({ isOpen: false, id: null, index: null })}
            />
        </div>
    );
};

export default FaithPromiseForm;
