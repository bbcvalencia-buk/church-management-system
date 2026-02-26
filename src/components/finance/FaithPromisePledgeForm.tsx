import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Check } from 'lucide-react';
import type { Member } from '@/types';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

const FaithPromisePledgeForm: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [memberId, setMemberId] = useState<string>('');

    // Form data
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [amount, setAmount] = useState<number | ''>('');
    const [startDate, setStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        const { data } = await supabase.from('members').select('id, first_name, surname, member_number').order('surname');
        if (data) setMembers(data as Member[]);
    };

    const targetWeekly = amount ? (Number(amount) / 52).toFixed(2) : '0.00';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!memberId || !amount || amount <= 0) {
            setError("Please fill out all required fields with valid values.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Check if pledge already exists
            const { data: existing } = await supabase
                .from('faith_promise_commitments')
                .select('id')
                .eq('member_id', memberId)
                .eq('year', year)
                .maybeSingle();

            if (existing) {
                // If exists, update
                const { error: updErr } = await supabase
                    .from('faith_promise_commitments')
                    .update({
                        promised_amount: Number(amount),
                        started_giving_date: startDate
                    })
                    .eq('id', existing.id);
                if (updErr) throw updErr;
            } else {
                // If not, insert
                const { error: insErr } = await supabase
                    .from('faith_promise_commitments')
                    .insert({
                        member_id: memberId,
                        year,
                        promised_amount: Number(amount),
                        started_giving_date: startDate
                    });
                if (insErr) throw insErr;
            }

            onSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save pledge.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">New Faith Promise Pledge</h2>
                        <p className="text-sm text-gray-500 mt-1">Register a commitment for the year.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Member</label>
                        <select
                            required
                            value={memberId}
                            onChange={e => setMemberId(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        >
                            <option value="">-- Select Member --</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.surname}, {m.first_name} {m.member_number ? `(${m.member_number})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Year</label>
                            <input
                                type="number"
                                required
                                value={year}
                                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Start Date</label>
                            <input
                                type="date"
                                required
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Amount (PHP)</label>
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
                                className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 font-mono text-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        {amount && (
                            <p className="text-[11px] font-bold text-blue-600 mt-2 tracking-wide uppercase">
                                This equals PHP {targetWeekly} per Sunday (52 Sundays in {year})
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : <><Check size={18} /> Save Pledge</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FaithPromisePledgeForm;
