import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Check } from 'lucide-react';
import { submitFinancialMutation } from '@/lib/financial';

interface Props {
    memberId: string;
    memberName: string;
    year: number;
    onClose: () => void;
    onSuccess: () => void;
}

const FaithPromiseQuickAdd: React.FC<Props> = ({ memberId, memberName, year, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!amount || amount <= 0) {
            setError("Amount must be greater than 0.");
            return;
        }

        setSubmitting(true);
        try {
            // Note: Since this is purely an INSERT, and submitFinancialMutation requires a specific payload
            // we use submitFinancialMutation to go through the gateway
            await submitFinancialMutation('INSERT', {
                member_id: memberId,
                transaction_date: date,
                records: [
                    { transaction_type: 'faith_promise', amount: Number(amount) }
                ]
            });
            onSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to add payment.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-none shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Quick Add Payment</h2>
                        <p className="text-sm text-gray-500 mt-1">Faith Promise • {year}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-none transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-none text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Member</label>
                        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-none text-gray-700 font-medium">
                            {memberName}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Transaction Date</label>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]} // Not allowing future
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-none text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount (PHP)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₱</span>
                            <input
                                type="number"
                                required
                                min="1"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || '')}
                                className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-none text-gray-900 font-mono text-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-none font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 text-[var(--color-text-main)] bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] rounded-none font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : <><Check size={18} /> Save Payment</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FaithPromiseQuickAdd;
