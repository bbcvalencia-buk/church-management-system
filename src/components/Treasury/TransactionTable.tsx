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
            <div className="flex items-end justify-between border-b border-[var(--color-border)] pb-4 mt-16 mb-4">
                <h2 className="text-xl font-normal tracking-tight text-[var(--color-text-main)]" style={{ fontFamily: "var(--font-display, inherit)" }}>
                    Ledger
                </h2>
                <button
                    onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                    className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                >
                    {showTransactionHistory ? "Hide Records" : `View ${aggregatedData.length} Records`}
                </button>
            </div>
            
            {showTransactionHistory && (
                <div className={`mt-4 space-y-0.5 ${activeTab === 'deleted' ? 'opacity-80' : ''}`}>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-50 h-16 w-full mb-0.5"></div>
                        ))
                    ) : aggregatedData.length === 0 ? (
                        <div className={`py-12 text-center text-xs font-mono uppercase tracking-widest ${activeTab === 'deleted' ? 'text-red-400' : 'text-gray-400'}`}>
                            No {activeTab} records found for the selected period.
                        </div>
                    ) : (
                        aggregatedData.map((row) => (
                            <div 
                                key={row.key} 
                                className="group flex flex-col md:flex-row md:items-center justify-between p-4 md:py-3 transition-colors border-l-2 border-transparent hover:border-[var(--color-primary)] hover:bg-gray-50/50 bg-white"
                            >
                                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-8 flex-1">
                                    <div className="w-24 shrink-0">
                                        <span className="text-[10px] font-mono tracking-widest text-gray-400">{row.date}</span>
                                    </div>
                                    <div className="w-48 shrink-0 flex items-center gap-2">
                                        <span className="text-sm font-medium text-black truncate">{row.member_name}</span>
                                        {activeTab === 'deleted' && <span className="text-red-500 text-[9px] font-mono uppercase tracking-widest border border-red-200 px-1 rounded-sm">Deleted</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] font-mono tracking-widest text-gray-400">
                                        {row.tithe > 0 && <span>TITHE {formatCurrency(row.tithe)}</span>}
                                        {row.faith_promise > 0 && <span>FAITH {formatCurrency(row.faith_promise)}</span>}
                                        {row.love_gift > 0 && <span>LOVE {formatCurrency(row.love_gift)}</span>}
                                        {row.pledge > 0 && <span>PLEDGE {formatCurrency(row.pledge)}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between md:justify-end gap-6 mt-4 md:mt-0 shrink-0">
                                    <div className="text-2xl text-black tracking-tighter" style={{ fontFamily: "var(--font-display, inherit)" }}>
                                        {formatCurrency(row.total)}
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity w-16 justify-end">
                                        {activeTab === 'active' ? (
                                            canManageTreasury ? (
                                                <>
                                                    <button
                                                        onClick={() => openEditModal(row)}
                                                        className="text-gray-400 hover:text-black transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => prepareDelete(row)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            ) : null
                                        ) : canManageTreasury ? (
                                            <button
                                                onClick={() => handleRestoreTransaction(row)}
                                                className="text-green-600 hover:text-green-700 transition-colors font-mono uppercase text-[9px] tracking-widest flex items-center gap-1"
                                                title="Restore"
                                            >
                                                <RefreshCcw size={12} /> Restore
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
