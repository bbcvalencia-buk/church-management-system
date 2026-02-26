import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as memberService from "@/services/memberService";
import * as financeService from "@/services/financeService";
import { submitFinancialMutation } from "@/lib/financial";
import { getLatestSundayISODate, getPreviousSundayISODate } from "@/lib/date";
import type { FinancialRecord, Member } from "@/types";
import {
    DollarSign,
    Calendar,
    ArrowLeft,
    Save,
    Search,
    Info
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useSessionDraft, useSessionValue } from "@/hooks/useSessionDraft";

// Form state handles multiple contribution types at once
interface MultiEntryForm {
    transaction_date: string;
    tithe_amount: number | '';
    faith_promise_amount: number | '';
    love_gift_amount: number | '';
    pledge_amount: number | '';
    pledge_purpose: string;
}

const INITIAL_STATE: MultiEntryForm = {
    transaction_date: getLatestSundayISODate(),
    tithe_amount: '',
    faith_promise_amount: '',
    love_gift_amount: '',
    pledge_amount: '',
    pledge_purpose: ''
};

const normalizeIsoDate = (value: string | null | undefined) => {
    if (!value) return '';
    return value.length >= 10 ? value.slice(0, 10) : value;
};

const FinancialRecordForm: React.FC = () => {
    // Note: Edit mode for this multi-entry form is complex because records are stored individually.
    // For now, we will focus on CREATE mode. If editing, we might need a different approach 
    // or passing a specific transaction group ID if we had one.
    // Given the previous simple implementation, I'll support creating new "Batch" entries.

    const navigate = useNavigate();
    const { showToast } = useToast();
    const [form, setForm, clearFormDraft] = useSessionDraft<MultiEntryForm>('financial-record-form', INITIAL_STATE);
    const [saving, setSaving] = useState(false);

    // Member Search State
    const [memberSearch, setMemberSearch] = useState("");
    const [members, setMembers] = useState<Member[]>([]);
    const [showMemberResults, setShowMemberResults] = useState(false);
    const [selectedMember, setSelectedMember, clearMemberDraft] = useSessionValue<Member | null>('financial-record-member', null);
    const [memberRegistryCount, setMemberRegistryCount] = useState<number | null>(null);

    useEffect(() => {
        const initializeTransactionDate = async () => {
            const latestSunday = getLatestSundayISODate();
            try {
                const latestRecordedDate = normalizeIsoDate(await financeService.getLatestFinancialTransactionDate('active'));
                if (latestRecordedDate === latestSunday) {
                    setForm((prev) => ({ ...prev, transaction_date: getPreviousSundayISODate() }));
                } else {
                    setForm((prev) => ({ ...prev, transaction_date: latestSunday }));
                }
            } catch (error) {
                console.error("Error initializing contribution date:", error);
                setForm((prev) => ({ ...prev, transaction_date: latestSunday }));
            }
        };

        initializeTransactionDate();
    }, []);

    useEffect(() => {
        const fetchMemberRegistryCount = async () => {
            try {
                const count = await memberService.getMemberCount();
                setMemberRegistryCount(count);
            } catch (error) {
                console.error("Error counting members:", error);
            }
        };

        fetchMemberRegistryCount();
    }, []);

    // Search Members
    useEffect(() => {
        const query = memberSearch.trim();
        if (selectedMember && query === `${selectedMember.first_name} ${selectedMember.surname}`.trim()) {
            return;
        }

        if (query.length > 0) {
            const timeoutId = setTimeout(async () => {
                try {
                    const data = await memberService.searchMembers(query);
                    setMembers(data as Member[]);
                    setShowMemberResults(true);
                } catch (error) {
                    console.error("Error searching members:", error);
                    setMembers([]);
                    setShowMemberResults(true);
                }
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setMembers([]);
            setShowMemberResults(false);
        }
    }, [memberSearch]);

    const selectMember = (member: Member) => {
        setSelectedMember(member);
        setShowMemberResults(false);
        setMemberSearch(`${member.first_name} ${member.surname}`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMember) {
            showToast("Please select a member.", 'error');
            return;
        }

        const recordsToInsert = [];
        const baseRecord = {
            member_id: selectedMember.id,
            transaction_date: form.transaction_date,
            created_at: new Date().toISOString() // Manual timestamp if needed, otherwise db handles it
        };

        if (Number(form.tithe_amount) > 0) {
            recordsToInsert.push({
                ...baseRecord,
                transaction_type: 'tithe',
                amount: Number(form.tithe_amount)
            });
        }
        if (Number(form.faith_promise_amount) > 0) {
            recordsToInsert.push({
                ...baseRecord,
                transaction_type: 'faith_promise',
                amount: Number(form.faith_promise_amount)
            });
        }
        if (Number(form.love_gift_amount) > 0) {
            recordsToInsert.push({
                ...baseRecord,
                transaction_type: 'love_gift',
                amount: Number(form.love_gift_amount)
            });
        }
        if (Number(form.pledge_amount) > 0) {
            recordsToInsert.push({
                ...baseRecord,
                transaction_type: 'pledge',
                amount: Number(form.pledge_amount),
                pledge_purpose: form.pledge_purpose || 'Unspecified'
            });
        }

        if (recordsToInsert.length === 0) {
            showToast("Please enter at least one contribution amount.", 'error');
            return;
        }

        setSaving(true);
        try {
            await submitFinancialMutation('INSERT', { records: recordsToInsert });

            // Keep the same date for the next entry, but reset amounts
            setForm({
                ...INITIAL_STATE,
                transaction_date: form.transaction_date
            });
            clearMemberDraft();
            setMemberSearch("");
            showToast("Records saved successfully!", 'success');
        } catch (err: any) {
            showToast("Error saving records: " + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold">Record Contribution</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">Log tithes, offerings, and pledges for a member.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="card-panel p-8 space-y-8 border-t-4 border-t-[var(--color-primary)] bg-white">

                {/* Header Section: Member & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[var(--color-border)]">
                    <div className="space-y-2 relative">
                        <label className="text-sm font-bold text-[var(--color-text-muted)]">Member Name</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                            <input
                                type="text"
                                placeholder="Search member..."
                                value={memberSearch}
                                onChange={(e) => {
                                    setMemberSearch(e.target.value);
                                    if (selectedMember && e.target.value !== `${selectedMember.first_name} ${selectedMember.surname}`) {
                                        setSelectedMember(null); // Clear selection if user types
                                    }
                                }}
                                className={`w-full pl-10 bg-[var(--color-bg)] border rounded-lg p-3 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all
                                    ${selectedMember ? 'border-green-500/50' : 'border-[var(--color-border)]'}
                                `}
                            />
                            {showMemberResults && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                                    {members.length > 0 ? (
                                        members.map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => selectMember(m)}
                                                className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 border-b border-[var(--color-border)] last:border-0"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">
                                                    {(m.first_name?.[0] || 'U')}{(m.surname?.[0] || 'M')}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[var(--color-text-main)]">{m.first_name} {m.surname}</p>
                                                    <p className="text-xs text-[var(--color-text-muted)]">ID: {m.id_number}</p>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-3 text-sm text-[var(--color-text-muted)]">
                                            {memberRegistryCount === 0
                                                ? "No members in the registry yet. Add a member first, then try again."
                                                : `No members found for "${memberSearch.trim()}".`}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {memberRegistryCount === 0 && (
                            <p className="text-xs text-amber-700">
                                This is a new system with no member records yet. Add members in the Members Directory first.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--color-text-muted)]">Contribution Date (Sunday)</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                            <input
                                type="date"
                                value={form.transaction_date}
                                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                                className="w-full pl-10 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Amounts Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                    {/* Tithe */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-blue-400 flex items-center gap-2">
                            <Info size={14} /> Tithe Encl.
                        </label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-mono">₱</span>
                            <input
                                type="number"
                                min="0"
                                step="any" // Allow decimals
                                placeholder="0.00"
                                value={form.tithe_amount}
                                onChange={(e) => setForm({ ...form, tithe_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full pl-8 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-[var(--color-text-main)] font-mono focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Faith Promise */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-green-400 flex items-center gap-2">
                            <Info size={14} /> Faith Promise
                        </label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-mono">₱</span>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0.00"
                                value={form.faith_promise_amount}
                                onChange={(e) => setForm({ ...form, faith_promise_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full pl-8 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-[var(--color-text-main)] font-mono focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Love Gift */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-pink-400 flex items-center gap-2">
                            <Info size={14} /> Love Gift
                        </label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-mono">₱</span>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0.00"
                                value={form.love_gift_amount}
                                onChange={(e) => setForm({ ...form, love_gift_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full pl-8 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-[var(--color-text-main)] font-mono focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Specific Pledge */}
                    <div className="md:col-span-2 p-5 bg-yellow-500/5 rounded-xl border border-yellow-500/20 mt-2">
                        <label className="text-sm font-bold text-yellow-500 flex items-center gap-2 mb-3">
                            <TargetIcon /> Specific Pledge
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-mono">₱</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0.00"
                                    value={form.pledge_amount}
                                    onChange={(e) => setForm({ ...form, pledge_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    className="w-full pl-8 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-[var(--color-text-main)] font-mono focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                                />
                            </div>
                            <select
                                value={form.pledge_purpose}
                                onChange={(e) => setForm({ ...form, pledge_purpose: e.target.value })}
                                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-[var(--color-text-main)] focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                            >
                                <option value="" disabled>Select Purpose...</option>
                                <option value="Building Fund">Building Fund</option>
                                <option value="Missions">Missions (General)</option>
                                <option value="Flower Fund">Flower Fund</option>
                                <option value="Youth Ministry">Youth Ministry</option>
                                <option value="Music Ministry">Music Ministry</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                </div>

                <div className="pt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-[var(--color-primary)] hover:bg-violet-600 text-white px-8 py-3 rounded-lg font-medium transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2 disabled:opacity-50 hover:scale-105 active:scale-95"
                    >
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Record'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const TargetIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-target"
    >
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
);

export default FinancialRecordForm;
