import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as financeService from "@/services/financeService";
import type { FinancialRecord, Member } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { PinConfirmModal } from "@/components/PinConfirmModal";
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
    X,
    Lock,
    Unlock,
    Trash2,
    RefreshCcw,
    AlertTriangle,
    Heart,
    Upload
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/contexts/ToastContext";
import FaithPromiseLedgerTab from "@/components/finance/FaithPromiseLedgerTab";
import FaithPromiseQuickAdd from "@/components/finance/FaithPromiseQuickAdd";
import FaithPromisePledgeForm from "@/components/finance/FaithPromisePledgeForm";
import { FaithPromiseImport } from "@/components/finance/FaithPromiseImport";

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
    is_deleted?: boolean;
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

const normalizeIsoDate = (value: string | null | undefined): string => {
    if (!value) return '';
    return value.length >= 10 ? value.slice(0, 10) : value;
};

const TreasuryDashboard: React.FC = () => {
    const { user, roles } = useAuth();
    const { showToast } = useToast();
    const isChurchAdmin = roles.includes('church_administrator');
    const canManageTreasury = roles.includes('church_administrator') || roles.includes('treasurer');

    const [rawRecords, setRawRecords] = useState<FinancialRecordWithMember[]>([]);
    const [periodLocks, setPeriodLocks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const [activeTab, setActiveTab] = useState<'active' | 'deleted' | 'faith_promise'>(() => {
        try {
            const saved = sessionStorage.getItem('treasury-dashboard-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.activeTab) return parsed.activeTab;
            }
        } catch (e) { console.error(e); }
        return 'active';
    });
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        try {
            const saved = sessionStorage.getItem('treasury-dashboard-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.selectedYear) return Number(parsed.selectedYear);
            }
        } catch (e) { console.error(e); }
        return new Date().getFullYear();
    });
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        try {
            const saved = sessionStorage.getItem('treasury-dashboard-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.selectedMonth) return parsed.selectedMonth;
            }
        } catch (e) { console.error(e); }
        return 'all';
    });
    const [selectedSunday, setSelectedSunday] = useState<string>(() => {
        try {
            const saved = sessionStorage.getItem('treasury-dashboard-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.selectedSunday) return parsed.selectedSunday;
            }
        } catch (e) { console.error(e); }
        return '';
    });
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>(() => {
        try {
            const saved = sessionStorage.getItem('treasury-dashboard-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.sortDirection) return parsed.sortDirection;
            }
        } catch (e) { console.error(e); }
        return 'desc';
    });

    const [confirmRevert, setConfirmRevert] = useState<{ isOpen: boolean; member_id: string | null; date: string | null; name: string }>({
        isOpen: false, member_id: null, date: null, name: ''
    });

    const [editingRow, setEditingRow] = useState<AggregatedTransaction | null>(null);
    const [editForm, setEditForm] = useState<EditTransactionForm>(EMPTY_EDIT_FORM);

    // PIN confirm modals
    const [pinModalAction, setPinModalAction] = useState<{ isOpen: boolean, action: 'edit' | 'delete' | 'restore' | 'lock' | null, payload?: any }>({
        isOpen: false, action: null
    });

    const [quickAddMember, setQuickAddMember] = useState<{ id: string, name: string } | null>(null);
    const [showPledgeForm, setShowPledgeForm] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const initializedFiltersRef = useRef(false);

    // Add debug mount/unmount logging
    useEffect(() => {
        console.log('[TreasuryDashboard] Mounted! State restored:', { activeTab, selectedYear, selectedMonth, selectedSunday, sortDirection });
        return () => {
            console.log('[TreasuryDashboard] Unmounted!');
        };
    }, []);

    // Persist changes in sessionStorage
    useEffect(() => {
        console.log('[TreasuryDashboard] State Changed:', { activeTab, selectedYear, selectedMonth, selectedSunday, sortDirection });
        try {
            sessionStorage.setItem('treasury-dashboard-state', JSON.stringify({
                activeTab,
                selectedYear,
                selectedMonth,
                selectedSunday,
                sortDirection
            }));
        } catch (e) { console.error(e); }
    }, [activeTab, selectedYear, selectedMonth, selectedSunday, sortDirection]);

    useEffect(() => {
        if (initializedFiltersRef.current) return;

        const initializeFiltersFromLatestRecord = async () => {
            try {
                // If we already have stored state, skip fetching latest date to avoid overwriting selected settings
                const saved = sessionStorage.getItem('treasury-dashboard-state');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.selectedYear) {
                        initializedFiltersRef.current = true;
                        return;
                    }
                }

                const latestDate = await financeService.getLatestFinancialTransactionDate('active');
                if (!latestDate) return;

                const parsed = new Date(`${latestDate}T00:00:00`);
                if (!Number.isNaN(parsed.getTime())) {
                    setSelectedYear(parsed.getFullYear());
                }
            } catch (err) {
                console.error("Error initializing financial filters:", err);
            } finally {
                initializedFiltersRef.current = true;
            }
        };

        initializeFiltersFromLatestRecord();
    }, []);

    useEffect(() => {
        fetchRecords();
        fetchPeriodLocks();
    }, [selectedYear, activeTab, selectedMonth]); // Added selectedMonth to dependencies for fetchRecords

    const fetchPeriodLocks = async () => {
        const data = await financeService.getFinancialPeriodLocks();
        if (data) setPeriodLocks(data);
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const formatDate = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            let start: string;
            let end: string;

            if (selectedMonth === 'all') {
                start = `${selectedYear}-01-01`;
                end = `${selectedYear}-12-31`;
            } else {
                const monthIndex = parseInt(selectedMonth, 10);
                const monthStart = new Date(selectedYear, monthIndex, 1);
                const monthEnd = new Date(selectedYear, monthIndex + 1, 0);
                start = formatDate(monthStart);
                end = formatDate(monthEnd);
            }

            const data = await financeService.getFinancialRecords(start, end, activeTab);
            setRawRecords(data || []);
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
            const recordDate = normalizeIsoDate(record.transaction_date);
            if (!recordDate) return;

            if (selectedMonth !== 'all' && recordDate.slice(5, 7) !== String(Number(selectedMonth) + 1).padStart(2, '0')) {
                return;
            }

            if (selectedSunday && recordDate !== selectedSunday) {
                return;
            }

            const key = `${record.member_id}_${recordDate}`;

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    member_id: record.member_id,
                    date: recordDate,
                    member_name: record.members ? `${record.members.first_name} ${record.members.surname}` : 'Unknown',
                    tithe: 0,
                    faith_promise: 0,
                    love_gift: 0,
                    pledge: 0,
                    total: 0,
                    pledge_purpose: '',
                    is_deleted: !!(record as any).deleted_at
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
            const dateDiff = a.date.localeCompare(b.date);
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

    const isCurrentPeriodLocked = useMemo(() => {
        if (selectedMonth === 'all') return false;
        const monthNum = parseInt(selectedMonth) + 1;
        return periodLocks.some(p => p.year === selectedYear && p.month === monthNum && p.unlocked_at === null);
    }, [selectedYear, selectedMonth, periodLocks]);

    const handleTogglePeriodLock = async () => {
        if (selectedMonth === 'all') {
            showToast("Please select a specific month to lock/unlock.", 'error');
            return;
        }
        setPinModalAction({ isOpen: true, action: 'lock' });
    };

    const executeLockUnlock = async () => {
        setLoading(true);
        try {
            if (isCurrentPeriodLocked) {
                // Unlock
                await financeService.unlockFinancialPeriod(selectedYear, parseInt(selectedMonth) + 1, user?.id || '');
                showToast(`Period ${selectedYear}-${parseInt(selectedMonth) + 1} unlocked successfully.`, 'success');
            } else {
                // Lock
                await financeService.lockFinancialPeriod(selectedYear, parseInt(selectedMonth) + 1, user?.id || '');
                showToast(`Period ${selectedYear}-${parseInt(selectedMonth) + 1} locked successfully.`, 'success');
            }
            fetchPeriodLocks();
        } catch (err: any) {
            showToast("Failed to toggle period lock: " + err.message, 'error');
        } finally {
            setLoading(false);
            setPinModalAction({ isOpen: false, action: null });
        }
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

    const prepareUpdate = async () => {
        if (!editingRow) return;
        setPinModalAction({ isOpen: true, action: 'edit' });
    };

    const executeUpdateTransaction = async () => {
        if (!editingRow) return;

        const tithe = Number(editForm.tithe_amount) || 0;
        const faithPromise = Number(editForm.faith_promise_amount) || 0;
        const loveGift = Number(editForm.love_gift_amount) || 0;
        const pledge = Number(editForm.pledge_amount) || 0;

        if (tithe <= 0 && faithPromise <= 0 && loveGift <= 0 && pledge <= 0) {
            showToast('Please enter at least one amount greater than 0.', 'error');
            setPinModalAction({ isOpen: false, action: null });
            return;
        }

        const recordsToInsert: any[] = [];
        const base = { member_id: editingRow.member_id, transaction_date: editingRow.date };

        if (tithe > 0) recordsToInsert.push({ ...base, transaction_type: 'tithe', amount: tithe });
        if (faithPromise > 0) recordsToInsert.push({ ...base, transaction_type: 'faith_promise', amount: faithPromise });
        if (loveGift > 0) recordsToInsert.push({ ...base, transaction_type: 'love_gift', amount: loveGift });
        if (pledge > 0) recordsToInsert.push({ ...base, transaction_type: 'pledge', amount: pledge, pledge_purpose: editForm.pledge_purpose || 'Unspecified' });

        setUpdating(true);
        setPinModalAction({ isOpen: false, action: null });

        try {
            // Revert existing (soft delete wrapper handles Netlify call)
            await financeService.submitFinancialMutation('DELETE', { member_id: editingRow.member_id, transaction_date: editingRow.date });
            // Insert new 
            await financeService.submitFinancialMutation('INSERT', { records: recordsToInsert });

            showToast('Transaction history updated.', 'success');
            closeEditModal();
            fetchRecords();
        } catch (err: any) {
            showToast('Failed to update transaction: ' + err.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    const prepareDelete = (row: AggregatedTransaction) => {
        setConfirmRevert({
            isOpen: true,
            member_id: row.member_id,
            date: row.date,
            name: row.member_name
        });
    };

    const promptDeletePin = () => {
        setConfirmRevert(prev => ({ ...prev, isOpen: false }));
        setPinModalAction({ isOpen: true, action: 'delete' });
    };

    const executeDeleteTransaction = async () => {
        setPinModalAction({ isOpen: false, action: null });
        setUpdating(true); // Using updating state for delete
        try {
            await financeService.submitFinancialMutation('DELETE', { member_id: confirmRevert.member_id, transaction_date: confirmRevert.date });
            showToast('Transaction history reverted.', 'success');
            fetchRecords();
            setConfirmRevert({ isOpen: false, member_id: null, date: null, name: '' }); // Reset confirmRevert
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleRestoreTransaction = async (row: AggregatedTransaction) => {
        setPinModalAction({ isOpen: true, action: 'restore', payload: row });
    };

    const executeRestore = async () => {
        const row = pinModalAction.payload;
        setPinModalAction({ isOpen: false, action: null });
        setUpdating(true); // Using updating state for restore
        try {
            await financeService.restoreFinancialTransaction(row.member_id, row.date);
            showToast("Transaction restored successfully.", 'success');
            fetchRecords();
        } catch (err: any) {
            showToast("Restore failed: " + err.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handlePinSuccess = () => {
        if (pinModalAction.action === 'edit') executeUpdateTransaction();
        if (pinModalAction.action === 'delete') executeDeleteTransaction();
        if (pinModalAction.action === 'restore') executeRestore();
        if (pinModalAction.action === 'lock') executeLockUnlock();
    };

    return (
        <div className="space-y-6">
            {isCurrentPeriodLocked && selectedMonth !== 'all' && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Lock className="text-yellow-600" size={24} />
                        <div>
                            <h3 className="text-yellow-800 font-bold">PERIOD LOCKED</h3>
                            <p className="text-yellow-700 text-sm">Financial records for this month are locked and cannot be edited or deleted.</p>
                        </div>
                    </div>
                </div>
            )}

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
                    {isChurchAdmin && selectedMonth !== 'all' && (
                        <button
                            onClick={handleTogglePeriodLock}
                            className={`border px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-bold ${isCurrentPeriodLocked
                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                                }`}
                        >
                            {isCurrentPeriodLocked ? <Unlock size={18} /> : <Lock size={18} />}
                            <span>{isCurrentPeriodLocked ? 'Unlock Period' : 'Lock Period'}</span>
                        </button>
                    )}
                    <Link
                        to="/finance/reports"
                        className="bg-white border border-[var(--color-border)] hover:bg-gray-50 text-[var(--color-text-main)] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Printer size={18} />
                        <span>Reports</span>
                    </Link>
                    {activeTab === 'faith_promise' ? (
                        <>
                            {canManageTreasury && (
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-bold"
                                >
                                    <Upload size={18} />
                                    <span>Import</span>
                                </button>
                            )}
                            {canManageTreasury && (
                                <button
                                    onClick={() => setShowPledgeForm(true)}
                                    className="bg-[var(--color-primary)] hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20 font-bold"
                                >
                                    <Plus size={18} />
                                    <span>New Pledge</span>
                                </button>
                            )}
                        </>
                    ) : canManageTreasury ? (
                        <Link
                            to="/finance/new"
                            className="bg-[var(--color-primary)] hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20"
                        >
                            <Plus size={18} />
                            <span>New Entry</span>
                        </Link>
                    ) : null
                    }
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

            <div className="card-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white">
                <div className="flex gap-4">
                    <button
                        className={`font-bold text-lg pb-1 transition-colors ${activeTab === 'active' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'}`}
                        onClick={() => setActiveTab('active')}
                    >
                        Transaction History
                    </button>
                    {isChurchAdmin && (
                        <button
                            className={`font-bold text-lg pb-1 transition-colors flex items-center gap-2 ${activeTab === 'deleted' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => setActiveTab('deleted')}
                        >
                            <Trash2 size={18} /> Deleted Records
                        </button>
                    )}
                    <button
                        className={`font-bold text-lg pb-1 transition-colors flex items-center gap-2 ${activeTab === 'faith_promise' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        onClick={() => setActiveTab('faith_promise')}
                    >
                        <Heart size={18} /> Faith Promise Ledger
                    </button>
                </div>

                {activeTab !== 'faith_promise' && (
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
                                    if (value) setSelectedYear(parseInt(value.substring(0, 4), 10));
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
                )}
            </div>

            {activeTab === 'faith_promise' ? (
                <FaithPromiseLedgerTab
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    onQuickAdd={(memberId, memberName) => setQuickAddMember({ id: memberId, name: memberName })}
                />
            ) : (
                <div className={`card-panel overflow-hidden bg-white ${activeTab === 'deleted' ? 'border border-red-200 shadow-red-500/10' : ''}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className={`border-b border-[var(--color-border)] text-xs font-bold uppercase tracking-wider ${activeTab === 'deleted' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-[var(--color-text-muted)]'}`}>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Member</th>
                                    <th className="p-4 text-right">Tithe</th>
                                    <th className="p-4 text-right">Faith Promise</th>
                                    <th className="p-4 text-right">Love Gift</th>
                                    <th className="p-4 text-right">Pledge</th>
                                    <th className="p-4 text-right">Total</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse bg-white">
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-12 mx-auto"></div></td>
                                        </tr>
                                    ))
                                ) : aggregatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className={`p-8 text-center font-medium ${activeTab === 'deleted' ? 'text-red-400' : 'text-gray-400'}`}>
                                            No {activeTab} records found for the selected period.
                                        </td>
                                    </tr>
                                ) : (
                                    aggregatedData.map((row) => (
                                        <tr key={row.key} className={`text-sm group transition-colors ${activeTab === 'deleted' ? 'hover:bg-red-50/50' : 'hover:bg-gray-50'}`}>
                                            <td className="p-4 font-mono text-gray-500">{row.date}</td>
                                            <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                                                {row.member_name}
                                                {activeTab === 'deleted' && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">Deleted</span>}
                                            </td>
                                            <td className="p-4 text-right font-mono text-gray-700">{row.tithe > 0 ? formatCurrency(row.tithe) : '-'}</td>
                                            <td className="p-4 text-right font-mono text-gray-700">{row.faith_promise > 0 ? formatCurrency(row.faith_promise) : '-'}</td>
                                            <td className="p-4 text-right font-mono text-gray-700">{row.love_gift > 0 ? formatCurrency(row.love_gift) : '-'}</td>
                                            <td className="p-4 text-right font-mono text-gray-700">{row.pledge > 0 ? formatCurrency(row.pledge) : '-'}</td>
                                            <td className="p-4 text-right font-bold text-black">{formatCurrency(row.total)}</td>
                                            <td className="p-4 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {activeTab === 'active' ? (
                                                    canManageTreasury ? (
                                                        <>
                                                            <button
                                                                onClick={() => openEditModal(row)}
                                                                className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded"
                                                                title="Edit"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => prepareDelete(row)}
                                                                className="p-1.5 text-red-500 hover:bg-red-500/20 rounded"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    ) : null
                                                ) : canManageTreasury ? (
                                                    <button
                                                        onClick={() => handleRestoreTransaction(row)}
                                                        className="p-1.5 text-green-600 hover:bg-green-500/20 rounded font-bold uppercase text-[10px] tracking-wider flex items-center gap-1"
                                                        title="Restore"
                                                    >
                                                        <RefreshCcw size={12} /> Restore
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {quickAddMember && (
                <FaithPromiseQuickAdd
                    memberId={quickAddMember.id}
                    memberName={quickAddMember.name}
                    year={selectedYear}
                    onClose={() => setQuickAddMember(null)}
                    onSuccess={() => {
                        showToast('Payment added successfully', 'success');
                        setQuickAddMember(null);
                        // Force refresh of ledger tab by remounting or triggering context fetch,
                        // for now we trigger fetchRecords which happens to run but not the child directly.
                        // Actually, updating selectedYear forces child re-render, we can just reload window
                        // or better yet wait until next version. A simple location.reload() to save time or fetchRecords
                    }}
                />
            )}

            {showPledgeForm && (
                <FaithPromisePledgeForm
                    onClose={() => setShowPledgeForm(false)}
                    onSuccess={() => {
                        showToast('Pledge saved successfully', 'success');
                        setShowPledgeForm(false);
                        // Refresh will happen automatically if we decouple it or just manually trigger
                        fetchRecords();
                    }}
                />
            )}

            {showImport && (
                <FaithPromiseImport
                    isOpen={showImport}
                    onClose={() => setShowImport(false)}
                    onSuccess={() => {
                        setShowImport(false);
                        fetchRecords();
                    }}
                />
            )}

            <ConfirmModal
                isOpen={confirmRevert.isOpen}
                title="Revert Transaction"
                message={`Are you sure you want to revert(delete) all transactions for ${confirmRevert.name} on ${confirmRevert.date}?`}
                confirmText="Proceed to Delete"
                isDanger={true}
                onConfirm={promptDeletePin}
                onCancel={() => setConfirmRevert({ ...confirmRevert, isOpen: false })}
            />

            <PinConfirmModal
                isOpen={pinModalAction.isOpen}
                onClose={() => setPinModalAction({ isOpen: false, action: null })}
                onSuccess={handlePinSuccess}
                actionLabel={pinModalAction.action === 'delete' ? 'Delete' : pinModalAction.action === 'restore' ? 'Restore' : pinModalAction.action === 'lock' ? 'Confirm Lock Action' : 'Save Changes'}
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
                                onClick={prepareUpdate}
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
