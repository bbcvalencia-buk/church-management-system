import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { FinancialRecord, Member } from "@/types";
import {
    DollarSign,
    CreditCard,
    PieChart,
    Plus,
    Printer,
    RotateCcw,
    Calendar,
    Edit,
    Save,
    X
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/contexts/ToastContext";

interface FinancialRecordWithMember extends FinancialRecord {
    members?: Pick<Member, 'first_name' | 'surname'> | null;
}

interface AggregatedTransaction {
    key: string;
    member_id: string;
    date: string;
    member_name: string;
    tithe: number;
    faith_promise: number;
    love_gift: number;
    pledge: number;
    pledge_purpose?: string;
    total: number;
}

interface EditTransactionForm {
    tithe_amount: number | '';
    faith_promise_amount: number | '';
    love_gift_amount: number | '';
    pledge_amount: number | '';
    pledge_purpose: string;
}

const EMPTY_EDIT_FORM: EditTransactionForm = {
    tithe_amount: '',
    faith_promise_amount: '',
    love_gift_amount: '',
    pledge_amount: '',
    pledge_purpose: ''
};

const TreasuryDashboard: React.FC = () => {
    const { showToast } = useToast();
    const [rawRecords, setRawRecords] = useState<FinancialRecordWithMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [selectedSunday, setSelectedSunday] = useState('');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

    const [confirmRevert, setConfirmRevert] = useState<{ isOpen: boolean; member_id: string | null; date: string | null; name: string }>({
        isOpen: false,
        member_id: null,
        date: null,
        name: ''
    });

    const [editingRow, setEditingRow] = useState<AggregatedTransaction | null>(null);
    const [editForm, setEditForm] = useState<EditTransactionForm>(EMPTY_EDIT_FORM);

    useEffect(() => {
        fetchRecords();
    }, [selectedYear]);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const startStr = `${selectedYear}-01-01`;
            const endStr = `${selectedYear}-12-31`;

            const { data, error } = await supabase
                .from('financial_records')
                .select('id, member_id, transaction_date, transaction_type, amount, pledge_purpose, members(first_name, surname)')
                .gte('transaction_date', startStr)
                .lte('transaction_date', endStr)
                .order('transaction_date', { ascending: false });

            if (error) throw error;
            setRawRecords((data || []) as unknown as FinancialRecordWithMember[]);
        } catch (err) {
            console.error("Error fetching financial records:", err);
            showToast('Failed to load financial records.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const aggregatedData = useMemo(() => {
        const map = new Map<string, AggregatedTransaction>();

        rawRecords.forEach(record => {
            const recordDate = new Date(record.transaction_date);

            if (selectedMonth !== 'all' && recordDate.getMonth().toString() !== selectedMonth) {
                return;
            }

            if (selectedSunday && record.transaction_date !== selectedSunday) {
                return;
            }

            const key = `${record.member_id}_${record.transaction_date}`;

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    member_id: record.member_id,
                    date: record.transaction_date,
                    member_name: record.members ? `${record.members.first_name} ${record.members.surname}` : 'Unknown',
                    tithe: 0,
                    faith_promise: 0,
                    love_gift: 0,
                    pledge: 0,
                    total: 0,
                    pledge_purpose: ''
                });
            }

            const entry = map.get(key)!;
            const amount = Number(record.amount) || 0;

            if (record.transaction_type === 'tithe') entry.tithe += amount;
            else if (record.transaction_type === 'faith_promise') entry.faith_promise += amount;
            else if (record.transaction_type === 'love_gift') entry.love_gift += amount;
            else if (record.transaction_type === 'pledge') {
                entry.pledge += amount;
                entry.pledge_purpose = record.pledge_purpose || entry.pledge_purpose || '';
            }

            entry.total += amount;
        });

        const rows = Array.from(map.values());
        rows.sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return sortDirection === 'asc' ? dateDiff : -dateDiff;
            return a.member_name.localeCompare(b.member_name);
        });

        return rows;
    }, [rawRecords, selectedMonth, selectedSunday, sortDirection]);

    const totals = useMemo(() => {
        return aggregatedData.reduce((acc, curr) => ({
            tithe: acc.tithe + curr.tithe,
            faith_promise: acc.faith_promise + curr.faith_promise,
            love_gift: acc.love_gift + curr.love_gift + curr.pledge,
            total: acc.total + curr.total
        }), { tithe: 0, faith_promise: 0, love_gift: 0, total: 0 });
    }, [aggregatedData]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
    };

    const openEditModal = (row: AggregatedTransaction) => {
        setEditingRow(row);
        setEditForm({
            tithe_amount: row.tithe || '',
            faith_promise_amount: row.faith_promise || '',
            love_gift_amount: row.love_gift || '',
            pledge_amount: row.pledge || '',
            pledge_purpose: row.pledge_purpose || ''
        });
    };

    const closeEditModal = () => {
        setEditingRow(null);
        setEditForm(EMPTY_EDIT_FORM);
    };

    const handleUpdateTransaction = async () => {
        if (!editingRow) return;

        const tithe = Number(editForm.tithe_amount) || 0;
        const faithPromise = Number(editForm.faith_promise_amount) || 0;
        const loveGift = Number(editForm.love_gift_amount) || 0;
        const pledge = Number(editForm.pledge_amount) || 0;

        if (tithe <= 0 && faithPromise <= 0 && loveGift <= 0 && pledge <= 0) {
            showToast('Please enter at least one amount greater than 0.', 'error');
            return;
        }

        const recordsToInsert: any[] = [];

        if (tithe > 0) {
            recordsToInsert.push({
                member_id: editingRow.member_id,
                transaction_date: editingRow.date,
                transaction_type: 'tithe',
                amount: tithe
            });
        }

        if (faithPromise > 0) {
            recordsToInsert.push({
                member_id: editingRow.member_id,
                transaction_date: editingRow.date,
                transaction_type: 'faith_promise',
                amount: faithPromise
            });
        }

        if (loveGift > 0) {
            recordsToInsert.push({
                member_id: editingRow.member_id,
                transaction_date: editingRow.date,
                transaction_type: 'love_gift',
                amount: loveGift
            });
        }

        if (pledge > 0) {
            recordsToInsert.push({
                member_id: editingRow.member_id,
                transaction_date: editingRow.date,
                transaction_type: 'pledge',
                amount: pledge,
                pledge_purpose: editForm.pledge_purpose || 'Unspecified'
            });
        }

        setUpdating(true);
        try {
            const { error: deleteError } = await supabase
                .from('financial_records')
                .delete()
                .eq('member_id', editingRow.member_id)
                .eq('transaction_date', editingRow.date);

            if (deleteError) throw deleteError;

            const { error: insertError } = await supabase
                .from('financial_records')
                .insert(recordsToInsert as any);

            if (insertError) throw insertError;

            showToast('Transaction history updated.', 'success');
            closeEditModal();
            fetchRecords();
        } catch (err: any) {
            showToast('Failed to update transaction: ' + err.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)]">
                        Treasury Dashboard
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Manage and audit financial entries.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        to="/finance/reports"
                        className="bg-white border border-[var(--color-border)] hover:bg-gray-50 text-[var(--color-text-main)] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Printer size={18} />
                        <span>Reports</span>
                    </Link>
                    <Link
                        to="/finance/new"
                        className="bg-[var(--color-primary)] hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20"
                    >
                        <Plus size={18} />
                        <span>New Entry</span>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-panel p-6 relative overflow-hidden group border-l-4 border-l-blue-500 bg-white">
                    <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign size={64} className="text-blue-500" />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Total Tithes</p>
                    <h3 className="text-2xl font-bold text-[var(--color-text-main)] mt-1">{formatCurrency(totals.tithe)}</h3>
                </div>

                <div className="card-panel p-6 relative overflow-hidden group border-l-4 border-l-green-500 bg-white">
                    <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CreditCard size={64} className="text-green-500" />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Faith Promise</p>
                    <h3 className="text-2xl font-bold text-[var(--color-text-main)] mt-1">{formatCurrency(totals.faith_promise)}</h3>
                </div>

                <div className="card-panel p-6 relative overflow-hidden group border-l-4 border-l-pink-500 bg-white">
                    <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <PieChart size={64} className="text-pink-500" />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Offerings & Pledges</p>
                    <h3 className="text-2xl font-bold text-[var(--color-text-main)] mt-1">{formatCurrency(totals.love_gift)}</h3>
                </div>
            </div>

            <div className="card-panel p-4 flex flex-wrap items-center justify-between gap-4 bg-white">
                <h3 className="font-bold text-lg text-[var(--color-text-main)]">Transaction History</h3>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-[var(--color-bg)] rounded-lg p-1 border border-[var(--color-border)]">
                        <span className="text-xs font-medium text-[var(--color-text-muted)] px-2">Year</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                            className="bg-transparent border-none text-sm text-[var(--color-text-main)] focus:ring-0 cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center bg-[var(--color-bg)] rounded-lg p-1 border border-[var(--color-border)]">
                        <span className="text-xs font-medium text-[var(--color-text-muted)] px-2">Month</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-sm text-[var(--color-text-main)] focus:ring-0 cursor-pointer"
                        >
                            <option value="all">All Months</option>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i.toString()}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-[var(--color-bg)] rounded-lg p-1 border border-[var(--color-border)]">
                        <Calendar size={14} className="text-[var(--color-text-muted)] ml-2" />
                        <input
                            type="date"
                            value={selectedSunday}
                            onChange={(e) => {
                                const value = e.target.value;
                                setSelectedSunday(value);
                                if (value) {
                                    setSelectedYear(parseInt(value.substring(0, 4), 10));
                                }
                            }}
                            className="bg-transparent border-none text-sm text-[var(--color-text-main)] focus:ring-0"
                        />
                        {selectedSunday && (
                            <button
                                type="button"
                                onClick={() => setSelectedSunday('')}
                                className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="flex items-center bg-[var(--color-bg)] rounded-lg p-1 border border-[var(--color-border)]">
                        <span className="text-xs font-medium text-[var(--color-text-muted)] px-2">Sort</span>
                        <select
                            value={sortDirection}
                            onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                            className="bg-transparent border-none text-sm text-[var(--color-text-main)] focus:ring-0 cursor-pointer"
                        >
                            <option value="desc">Latest First</option>
                            <option value="asc">Oldest First</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="card-panel overflow-hidden bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] bg-gray-50 text-xs font-bold uppercase text-[var(--color-text-muted)] tracking-wider">
                                <th className="p-4">Date</th>
                                <th className="p-4">Member</th>
                                <th className="p-4 text-right text-blue-600">Tithe</th>
                                <th className="p-4 text-right text-green-600">Faith Promise</th>
                                <th className="p-4 text-right text-pink-600">Love Gift</th>
                                <th className="p-4 text-right text-yellow-600">Pledge</th>
                                <th className="p-4 text-right text-[var(--color-text-main)]">Total</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loading ? (
                                <tr><td colSpan={8} className="p-8 text-center">Loading records...</td></tr>
                            ) : aggregatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-[var(--color-text-muted)]">
                                        No records found for the selected period.
                                    </td>
                                </tr>
                            ) : (
                                aggregatedData.map((row) => (
                                    <tr key={row.key} className="hover:bg-gray-50 transition-colors text-sm group">
                                        <td className="p-4 font-mono text-[var(--color-text-muted)]">{row.date}</td>
                                        <td className="p-4 font-medium text-[var(--color-text-main)]">{row.member_name}</td>
                                        <td className="p-4 text-right font-mono text-[var(--color-text-main)]">{row.tithe > 0 ? formatCurrency(row.tithe) : '-'}</td>
                                        <td className="p-4 text-right font-mono text-[var(--color-text-main)]">{row.faith_promise > 0 ? formatCurrency(row.faith_promise) : '-'}</td>
                                        <td className="p-4 text-right font-mono text-[var(--color-text-main)]">{row.love_gift > 0 ? formatCurrency(row.love_gift) : '-'}</td>
                                        <td className="p-4 text-right font-mono text-[var(--color-text-main)]">{row.pledge > 0 ? formatCurrency(row.pledge) : '-'}</td>
                                        <td className="p-4 text-right font-bold text-[var(--color-text-main)]">{formatCurrency(row.total)}</td>
                                        <td className="p-4 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditModal(row)}
                                                className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded"
                                                title="Edit"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setConfirmRevert({
                                                        isOpen: true,
                                                        member_id: row.member_id,
                                                        date: row.date,
                                                        name: row.member_name
                                                    });
                                                }}
                                                className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                                                title="Revert"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmRevert.isOpen}
                title="Revert Transaction"
                message={`Are you sure you want to revert (delete) all transactions for ${confirmRevert.name} on ${confirmRevert.date}? This cannot be undone.`}
                confirmText="Revert Now"
                isDanger={true}
                onConfirm={async () => {
                    const { error } = await supabase
                        .from('financial_records')
                        .delete()
                        .eq('member_id', confirmRevert.member_id)
                        .eq('transaction_date', confirmRevert.date);

                    if (error) showToast(error.message, 'error');
                    else showToast('Transaction history reverted.', 'success');

                    setConfirmRevert({ ...confirmRevert, isOpen: false });
                    fetchRecords();
                }}
                onCancel={() => setConfirmRevert({ ...confirmRevert, isOpen: false })}
            />

            {editingRow && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Edit Transaction History</h3>
                                <p className="text-xs text-gray-500 mt-1">{editingRow.member_name} | {editingRow.date}</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-blue-600 uppercase tracking-wide">Tithe</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editForm.tithe_amount}
                                    onChange={(e) => setEditForm({ ...editForm, tithe_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-green-600 uppercase tracking-wide">Faith Promise</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editForm.faith_promise_amount}
                                    onChange={(e) => setEditForm({ ...editForm, faith_promise_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-pink-600 uppercase tracking-wide">Love Gift</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editForm.love_gift_amount}
                                    onChange={(e) => setEditForm({ ...editForm, love_gift_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Pledge</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editForm.pledge_amount}
                                    onChange={(e) => setEditForm({ ...editForm, pledge_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Pledge Purpose</label>
                                <input
                                    type="text"
                                    value={editForm.pledge_purpose}
                                    onChange={(e) => setEditForm({ ...editForm, pledge_purpose: e.target.value })}
                                    placeholder="Purpose (if pledge is used)"
                                    className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdateTransaction}
                                disabled={updating}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save size={14} />
                                {updating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TreasuryDashboard;
