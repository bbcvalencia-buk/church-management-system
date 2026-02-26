import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { FaithPromiseLedger } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Search, Filter, Download, Plus, CheckCircle, AlertCircle, Clock, XCircle, Printer } from 'lucide-react';

interface Props {
    selectedYear: number;
    setSelectedYear: (year: number) => void;
    onQuickAdd: (memberId: string, memberName: string) => void;
}

const FaithPromiseLedgerTab: React.FC<Props> = ({ selectedYear, setSelectedYear, onQuickAdd }) => {
    const { roles } = useAuth();
    const { showToast } = useToast();
    const [ledgers, setLedgers] = useState<FaithPromiseLedger[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const isChurchAdmin = roles.includes('church_administrator');

    useEffect(() => {
        fetchLedger();
    }, [selectedYear]);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('faith_promise_ledger')
                .select('*')
                .eq('year', selectedYear);

            if (error) throw error;
            setLedgers(data as FaithPromiseLedger[]);
        } catch (err: any) {
            console.error("Error fetching FP Ledger:", err);
            showToast('Failed to load Faith Promise ledger.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRollover = async () => {
        if (!isChurchAdmin || new Date().getMonth() !== 0) {
            showToast("Year Rollover is only available to administrators in January.", "error");
            return;
        }

        if (!confirm(`Are you sure you want to finalize ${selectedYear} and rollover to ${selectedYear + 1}?`)) return;

        showToast("Rollover feature logic to be implemented...", "info");
    };

    // Filter and aggregate
    const filteredLedgers = useMemo(() => {
        return ledgers.filter(l => {
            const matchesSearch =
                l.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                l.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (l.member_number && l.member_number.includes(searchTerm));
            const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
            return matchesSearch && matchesStatus;
        }).sort((a, b) => a.surname.localeCompare(b.surname));
    }, [ledgers, searchTerm, statusFilter]);

    const stats = useMemo(() => {
        let totalPledged = 0;
        let totalReceived = 0;
        let totalRemaining = 0;
        let fulfilledCount = 0;
        let behindCount = 0;

        ledgers.forEach(l => {
            totalPledged += l.committed_amount;
            totalReceived += l.total_paid;
            totalRemaining += l.remaining_balance > 0 ? l.remaining_balance : 0;
            if (l.status === 'FULFILLED') fulfilledCount++;
            if (l.status === 'BEHIND') behindCount++;
        });

        const pct = totalPledged > 0 ? (totalReceived / totalPledged) * 100 : 0;

        return { totalPledged, totalReceived, totalRemaining, pct, pledgedCount: ledgers.length, fulfilledCount, behindCount };
    }, [ledgers]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

    const getStatusBadgeOptions = (status: string) => {
        switch (status) {
            case 'FULFILLED': return { color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle size={14} /> };
            case 'ON TRACK': return { color: 'bg-teal-100 text-teal-800 border-teal-200', icon: <Clock size={14} /> };
            case 'BEHIND': return { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <AlertCircle size={14} /> };
            case 'INCOMPLETE': return { color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle size={14} /> };
            default: return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: null };
        }
    };

    const downloadCsv = () => {
        const headers = ["Member No", "First Name", "Last Name", "Pledged", "Total Paid", "Remaining", "Weekly Target", "Variance", "Fulfillment %", "Status"];
        const rows = filteredLedgers.map(l => [
            l.member_number || '',
            l.first_name,
            l.surname,
            l.committed_amount,
            l.total_paid,
            l.remaining_balance,
            l.weekly_target.toFixed(2),
            l.variance.toFixed(2),
            l.fulfillment_pct.toFixed(2) + '%',
            l.status
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Faith_Promise_Ledger_${selectedYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="card-panel p-4 bg-white border-l-4 border-blue-500">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Pledged</p>
                    <p className="text-lg font-black mt-1">{formatCurrency(stats.totalPledged)}</p>
                </div>
                <div className="card-panel p-4 bg-white border-l-4 border-green-500">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Received</p>
                    <p className="text-lg font-black mt-1 text-green-700">{formatCurrency(stats.totalReceived)}</p>
                </div>
                <div className="card-panel p-4 bg-white border-l-4 border-amber-500">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Remaining</p>
                    <p className="text-lg font-black mt-1 text-amber-700">{formatCurrency(stats.totalRemaining)}</p>
                </div>
                <div className="card-panel p-4 bg-white border-l-4 border-purple-500">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Fulfillment %</p>
                    <p className="text-lg font-black mt-1 text-purple-700">{stats.pct.toFixed(1)}%</p>
                </div>
                <div className="card-panel p-4 bg-white border-l-4 border-slate-500">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Members Pledged</p>
                    <p className="text-lg font-black mt-1">{stats.pledgedCount}</p>
                </div>
                <div className="card-panel p-4 bg-white border-l-4 border-emerald-500">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Fulfilled</p>
                    <p className="text-lg font-black mt-1 text-emerald-700">{stats.fulfilledCount}</p>
                </div>
                <div className="card-panel p-4 bg-white border-l-4 border-rose-500">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Behind</p>
                    <p className="text-lg font-black mt-1 text-rose-700">{stats.behindCount}</p>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row justify-between gap-4 card-panel p-4 bg-white">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search name or ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>

                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                        <Filter size={16} className="text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="FULFILLED">Fulfilled</option>
                            <option value="ON TRACK">On Track</option>
                            <option value="BEHIND">Behind</option>
                            <option value="INCOMPLETE">Incomplete</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                        <span className="text-xs font-bold text-gray-500 uppercase">Year</span>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value))}
                            className="bg-transparent text-sm border-none focus:ring-0 font-bold cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Batch Print, CSV, Rollover etc. */}
                    <button onClick={downloadCsv} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors">
                        <Download size={16} /> CSV
                    </button>
                    <button
                        onClick={() => window.open(`/finance/faith-promise-print?year=${selectedYear}`, '_blank')}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                        <Printer size={16} /> Print All
                    </button>
                    {isChurchAdmin && new Date().getMonth() === 0 && (
                        <button onClick={handleRollover} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-colors">
                            Year Rollover
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="card-panel overflow-hidden bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                                <th className="p-4">Member</th>
                                <th className="p-4 text-right">Pledged</th>
                                <th className="p-4 text-right">Total Paid</th>
                                <th className="p-4 text-right">Remaining</th>
                                <th className="p-4 text-right">Target vs Paid</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-500">Loading ledger...</td></tr>
                            ) : filteredLedgers.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-500">No faith promise pledges found.</td></tr>
                            ) : (
                                filteredLedgers.map(row => {
                                    const badge = getStatusBadgeOptions(row.status);

                                    return (
                                        <tr key={row.id} className="text-sm hover:bg-gray-50 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900">{row.first_name} {row.surname}</div>
                                                <div className="text-xs text-gray-500 tracking-wider">{row.member_number || 'NO-ID'}</div>
                                            </td>
                                            <td className="p-4 text-right font-mono font-medium">{formatCurrency(row.committed_amount)}</td>
                                            <td className="p-4 text-right font-mono font-medium text-blue-700">{formatCurrency(row.total_paid)}</td>
                                            <td className="p-4 text-right font-mono font-medium text-slate-500">{formatCurrency(row.remaining_balance)}</td>
                                            <td className="p-4 text-right">
                                                <div className="font-mono text-xs">{formatCurrency(row.expected_paid_by_now)} / {formatCurrency(row.total_paid)}</div>
                                                <div className={`text-[10px] font-bold ${row.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {row.variance >= 0 ? '+' : ''}{formatCurrency(row.variance)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-center">
                                                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${badge.color}`}>
                                                        {badge.icon} {row.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => onQuickAdd(row.member_id, `${row.first_name} ${row.surname}`)}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                                                        title="Quick Add Payment"
                                                    >
                                                        <Plus size={14} /> Add Payment
                                                    </button>
                                                    <button
                                                        onClick={() => window.open(`/finance/faith-promise-print?year=${selectedYear}&member_id=${row.member_id}`, '_blank')}
                                                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                                        title="Print Statement"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FaithPromiseLedgerTab;
