import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Visitor } from '@/types';

interface Props {
    visitor: Partial<Visitor>;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newMemberId: string) => void;
}

const ConvertToMemberModal: React.FC<Props> = ({ visitor, isOpen, onClose, onSuccess }) => {
    const { session } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [statusType, setStatusType] = useState('Full Member');
    const [dateJoined, setDateJoined] = useState(new Date().toISOString().split('T')[0]);
    const [baptismDate, setBaptismDate] = useState('');
    const [memberNumber, setMemberNumber] = useState('');

    useEffect(() => {
        if (isOpen) {
            suggestMemberNumber();
        }
    }, [isOpen]);

    const suggestMemberNumber = async () => {
        const year = new Date().getFullYear();
        try {
            const { data } = await supabase
                .from('members')
                .select('member_number')
                .ilike('member_number', `BBC-${year}-%`)
                .order('member_number', { ascending: false })
                .limit(1);

            if (data && data.length > 0 && data[0].member_number) {
                const parts = data[0].member_number.split('-');
                const seq = parseInt(parts[2], 10) + 1;
                setMemberNumber(`BBC-${year}-${seq.toString().padStart(3, '0')}`);
            } else {
                setMemberNumber(`BBC-${year}-001`);
            }
        } catch (e) {
            setMemberNumber(`BBC-${year}-XXX`);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const endpoint = import.meta.env.VITE_URL ? `${import.meta.env.VITE_URL}/.netlify/functions/convert-visitor` : '/.netlify/functions/convert-visitor';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    visitorId: visitor.id,
                    membershipStatus: statusType,
                    dateJoined,
                    baptismDate,
                    memberNumber,
                })
            });

            if (!response.ok) {
                const resError = await response.json();
                throw new Error(resError.error || 'Failed to convert visitor');
            }

            const data = await response.json();
            onSuccess(data.member.id);
        } catch (err: any) {
            setError(err.message || 'Error occurred during conversion.');
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm shadow-2xl animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <UserPlus className="text-blue-600" /> Convert to Member
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Convert {visitor.name} to the main member registry.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto w-full">
                    {/* Data to be carried over summary */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6">
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-3">Data to be Migrated</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Name</span>
                                <span className="font-semibold text-gray-900">{visitor.name}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Contact</span>
                                <span className="font-semibold text-gray-900">{visitor.contact_number || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Gender / Civ. Status</span>
                                <span className="font-semibold text-gray-900">{visitor.gender} / {visitor.marital_status}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">DOB</span>
                                <span className="font-semibold text-gray-900">{visitor.date_of_birth || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <form id="convert-form" onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium shadow-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Target Member Number</label>
                            <input
                                type="text"
                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none uppercase font-mono"
                                value={memberNumber}
                                onChange={(e) => setMemberNumber(e.target.value)}
                                placeholder="BBC-YYYY-001"
                            />
                            <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Automatically suggested sequentially</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Membership Status Type</label>
                            <select
                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none"
                                value={statusType}
                                onChange={(e) => setStatusType(e.target.value)}
                            >
                                <option value="Full Member">Full Member (Baptized in BBC)</option>
                                <option value="Affiliate Member">Affiliate Member (Baptized elsewhere)</option>
                                <option value="Under Watch">Under Watch / Candidate</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Date Joined</label>
                                <input
                                    type="date"
                                    required
                                    value={dateJoined}
                                    onChange={(e) => setDateJoined(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Baptism Date (Optional)</label>
                                <input
                                    type="date"
                                    value={baptismDate}
                                    onChange={(e) => setBaptismDate(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none"
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="flex gap-3 justify-end p-6 bg-gray-50/50 border-t border-gray-100 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="convert-form"
                        disabled={submitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center min-w-[140px] gap-2 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                    >
                        {submitting ? 'Converting...' : 'Confirm Conversion'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConvertToMemberModal;
