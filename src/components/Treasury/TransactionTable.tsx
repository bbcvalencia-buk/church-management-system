import React from "react";
import { Edit, Trash2, RefreshCcw } from "lucide-react";
import type { AggregatedTransaction } from "./types";

interface TransactionTableProps {
    aggregatedData: AggregatedTransaction[];
    loading: boolean;
    activeTab: 'active' | 'deleted' | 'faith_promise';
    canManageTreasury: boolean;
    showTransactionHistory: boolean;
    setShowTransactionHistory: (show: boolean) => void;
    formatCurrency: (amount: number) => string;
    openEditModal: (row: AggregatedTransaction) => void;
    prepareDelete: (row: AggregatedTransaction) => void;
    handleRestoreTransaction: (row: AggregatedTransaction) => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
    aggregatedData,
    loading,
    activeTab,
    canManageTreasury,
    showTransactionHistory,
    setShowTransactionHistory,
    formatCurrency,
    openEditModal,
    prepareDelete,
    handleRestoreTransaction
}) => {
    return (
        <div className="space-y-4">
            <button
                onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                className="w-full flex items-center justify-between p-4 bg-white border border-[var(--color-border)] rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
            >
                <span className="font-bold text-[var(--color-text-main)]">
                    {showTransactionHistory ? "Hide Transaction History" : "View Full Transaction History"}
                </span>
                <span className="text-[var(--color-text-muted)] text-sm">
                    {aggregatedData.length} records found
                </span>
            </button>
            
            {showTransactionHistory && (
                <div className={`card-panel overflow-hidden bg-white rounded-2xl shadow-sm border border-[var(--color-border)] ${activeTab === 'deleted' ? 'border-red-200 shadow-red-500/10' : ''}`}>
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
        </div>
    );
};
