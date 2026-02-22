
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, TrendingUp, AlertCircle, CheckCircle, Save } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

interface FaithPromiseFormProps {
    memberId: string;
}

interface Commitment {
    id: string;
    year: number;
    promised_amount: number;
}

interface FinancialSummary {
    year: number;
    total_given: number;
}

const FaithPromiseForm: React.FC<FaithPromiseFormProps> = ({ memberId }) => {
    const [commitments, setCommitments] = useState<Commitment[]>([]);
    const [financials, setFinancials] = useState<FinancialSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [formYear, setFormYear] = useState(new Date().getFullYear());
    const [formAmount, setFormAmount] = useState<number>(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (memberId) {
            fetchData();
        }
    }, [memberId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Commitments
            const { data: commData, error: commError } = await supabase
                .from('faith_promise_commitments')
                .select('*')
                .eq('member_id', memberId)
                .order('year', { ascending: false });

            if (commError) throw commError;
            setCommitments(commData || []);

            // 2. Fetch Financial Records (Faith Promise) for this member
            const { data: finData, error: finError } = await supabase
                .from('financial_records')
                .select('amount, transaction_date')
                .eq('member_id', memberId)
                .eq('transaction_type', 'faith_promise');

            if (finError) throw finError;

            // Aggregate by year
            const summary: Record<number, number> = {};
            finData?.forEach((record: any) => {
                const year = new Date(record.transaction_date).getFullYear();
                summary[year] = (summary[year] || 0) + Number(record.amount);
            });

            const summaryArray = Object.entries(summary).map(([year, total]) => ({
                year: Number(year),
                total_given: total
            }));
            setFinancials(summaryArray);

        } catch (err: any) {
            console.error(err);
            setError("Failed to load faith promise data.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setError(null);
        setSuccess(null);

        if (formAmount <= 0) {
            setError("Amount must be greater than 0.");
            return;
        }

        try {
            const payload: any = {
                member_id: memberId,
                year: formYear,
                promised_amount: formAmount,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                payload.id = editingId;
            }

            const { error } = await supabase
                .from('faith_promise_commitments')
                .upsert(payload, { onConflict: editingId ? 'id' : 'member_id, year' });

            if (error) throw error;

            setSuccess("Commitment saved successfully!");
            setFormAmount(0);
            setEditingId(null);
            fetchData();
        } catch (err: any) {
            setError("Failed to save: " + err.message);
        }
    };

    const handleDelete = async () => {
        if (!showConfirm.id) return;
        try {
            const { error } = await supabase
                .from('faith_promise_commitments')
                .delete()
                .eq('id', showConfirm.id);

            if (error) throw error;
            setSuccess("Commitment deleted.");
            setShowConfirm({ isOpen: false, id: null });
            fetchData();
        } catch (err: any) {
            setError("Delete failed: " + err.message);
        }
    };

    const getGivenForYear = (year: number) => {
        return financials.find(f => f.year === year)?.total_given || 0;
    };

    const getProgressColor = (given: number, promised: number) => {
        const percentage = (given / promised) * 100;
        if (percentage >= 100) return 'text-green-400';
        if (percentage >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    if (loading) return <div className="text-center py-4 text-[var(--color-text-muted)]">Loading faith promise data...</div>;

    return (
        <div className="space-y-8 font-sans">
            <h2 className="text-[18px] font-extrabold text-[#111827] flex items-center gap-3">
                <TrendingUp className="text-blue-600" size={24} strokeWidth={2.5} /> Faith Promise Commitments
            </h2>

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold">
                    <AlertCircle size={18} /> {error}
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-100 text-green-700 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold">
                    <CheckCircle size={18} /> {success}
                </div>
            )}

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
                            onChange={(e) => setFormYear(parseInt(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 block mb-2">Promised Amount</label>
                        <input
                            type="number"
                            min="0"
                            value={formAmount}
                            onChange={(e) => setFormAmount(parseFloat(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm pb-2.5"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleSave}
                            className="w-full bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl h-[46px] flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-sm hover:-translate-y-0.5 disabled:opacity-50"
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
                    commitments.map(comm => {
                        const given = getGivenForYear(comm.year);
                        const progress = Math.min((given / comm.promised_amount) * 100, 100);

                        return (
                            <div key={comm.id} className="bg-white border border-gray-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{comm.year} Commitment</span>
                                            {given >= comm.promised_amount && (
                                                <span className="bg-green-50 text-green-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border border-green-100">Completed</span>
                                            )}
                                        </div>
                                        <div className="text-2xl font-bold text-gray-900 leading-none">
                                            ₱{comm.promised_amount.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => {
                                                setFormYear(comm.year);
                                                setFormAmount(comm.promised_amount);
                                                setEditingId(comm.id);
                                            }}
                                            className="text-[11px] font-bold text-blue-500 hover:text-blue-700 transition-colors uppercase tracking-widest"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => setShowConfirm({ isOpen: true, id: comm.id })}
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
                                    <div className="h-[7px] bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${given >= comm.promised_amount ? 'bg-green-500' : 'bg-[#2563eb]'}`}
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
                onCancel={() => setShowConfirm({ isOpen: false, id: null })}
            />
        </div>
    );
};

export default FaithPromiseForm;
