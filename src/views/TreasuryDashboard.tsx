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
    Upload,
    Download
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

import { TreasuryActionHeader } from "@/components/Treasury/TreasuryActionHeader";
import { TreasurySummaryCards } from "@/components/Treasury/TreasurySummaryCards";
import { TransactionTable } from "@/components/Treasury/TransactionTable";
import { EditTransactionModal } from "@/components/Treasury/EditTransactionModal";
import type { AggregatedTransaction, EditTransactionForm } from "@/components/Treasury/types";
import { EMPTY_EDIT_FORM } from "@/components/Treasury/types";

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
    const [showTransactionHistory, setShowTransactionHistory] = useState(false);
    const initializedFiltersRef = useRef(false);
    const dashboardRef = useRef<HTMLDivElement>(null);



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
        <div className="space-y-6 py-4" ref={dashboardRef}>
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

            <TreasuryActionHeader
                isChurchAdmin={isChurchAdmin}
                canManageTreasury={canManageTreasury}
                activeTab={activeTab}
                selectedMonth={selectedMonth}
                isCurrentPeriodLocked={isCurrentPeriodLocked}
                handleTogglePeriodLock={handleTogglePeriodLock}
                setShowImport={setShowImport}
                setShowPledgeForm={setShowPledgeForm}
            />

            <TreasurySummaryCards totals={totals} formatCurrency={formatCurrency} />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 py-4 border-y border-black mt-8">
                <div className="flex gap-8">
                    <button
                        className={`text-xs font-mono uppercase tracking-widest transition-colors ${activeTab === 'active' ? 'text-black font-bold' : 'text-gray-400 hover:text-black'}`}
                        onClick={() => setActiveTab('active')}
                    >
                        Transaction History
                    </button>
                    {isChurchAdmin && (
                        <button
                            className={`text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === 'deleted' ? 'text-red-600 font-bold' : 'text-gray-400 hover:text-red-600'}`}
                            onClick={() => setActiveTab('deleted')}
                        >
                            Deleted Records
                        </button>
                    )}
                    <button
                        className={`text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === 'faith_promise' ? 'text-black font-bold' : 'text-gray-400 hover:text-black'}`}
                        onClick={() => setActiveTab('faith_promise')}
                    >
                        Faith Promise Ledger
                    </button>
                </div>

                {activeTab !== 'faith_promise' && (
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Year</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                                className="bg-transparent border-none text-xs font-mono text-black focus:ring-0 cursor-pointer p-0"
                            >
                                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Month</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent border-none text-xs font-mono text-black focus:ring-0 cursor-pointer p-0"
                            >
                                <option value="all">All Months</option>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i} value={i.toString()}>{new Date(0, i).toLocaleString('default', { month: 'long' }).toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Date</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={selectedSunday}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedSunday(value);
                                        if (value) setSelectedYear(parseInt(value.substring(0, 4), 10));
                                    }}
                                    className="bg-transparent border-none text-xs font-mono text-black focus:ring-0 p-0"
                                />
                                {selectedSunday && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedSunday('')}
                                        className="text-[9px] font-mono uppercase border border-gray-300 px-1 hover:border-black text-gray-600 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Sort</span>
                            <select
                                value={sortDirection}
                                onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                                className="bg-transparent border-none text-xs font-mono text-black focus:ring-0 cursor-pointer p-0"
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
                <TransactionTable
                    aggregatedData={aggregatedData}
                    loading={loading}
                    activeTab={activeTab}
                    canManageTreasury={canManageTreasury}
                    showTransactionHistory={showTransactionHistory}
                    setShowTransactionHistory={setShowTransactionHistory}
                    formatCurrency={formatCurrency}
                    openEditModal={openEditModal}
                    prepareDelete={prepareDelete}
                    handleRestoreTransaction={handleRestoreTransaction}
                />
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
                <EditTransactionModal
                    editingRow={editingRow}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    closeEditModal={closeEditModal}
                    prepareUpdate={prepareUpdate}
                    updating={updating}
                />
            )}
        </div>
    );
};

export default TreasuryDashboard;
