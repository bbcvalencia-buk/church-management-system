import React from "react";
import { Link } from "react-router-dom";
import { Lock, Unlock, Printer, Upload, Plus } from "lucide-react";

interface TreasuryActionHeaderProps {
    isChurchAdmin: boolean;
    canManageTreasury: boolean;
    activeTab: 'active' | 'deleted' | 'faith_promise';
    selectedMonth: string;
    isCurrentPeriodLocked: boolean;
    handleTogglePeriodLock: () => void;
    setShowImport: (show: boolean) => void;
    setShowPledgeForm: (show: boolean) => void;
}

export const TreasuryActionHeader: React.FC<TreasuryActionHeaderProps> = ({
    isChurchAdmin,
    canManageTreasury,
    activeTab,
    selectedMonth,
    isCurrentPeriodLocked,
    handleTogglePeriodLock,
    setShowImport,
    setShowPledgeForm
}) => {
    return (
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
                        className={`border px-4 py-2 rounded-none flex items-center gap-2 transition-colors shadow-sm font-bold ${isCurrentPeriodLocked
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
                    className="bg-white border border-[var(--color-border)] hover:bg-gray-50 text-[var(--color-text-main)] px-4 py-2 rounded-none flex items-center gap-2 transition-colors shadow-sm">
                    <Printer size={18} />
                    <span>Reports</span>
                </Link>
                {activeTab === 'faith_promise' ? (
                    <>
                        {canManageTreasury && (
                            <button
                                onClick={() => setShowImport(true)}
                                className="bg-green-600 hover:bg-green-700 text-[var(--color-text-main)] px-4 py-2 rounded-none flex items-center gap-2 transition-colors shadow-sm font-bold"
                            >
                                <Upload size={18} />
                                <span>Import</span>
                            </button>
                        )}
                        {canManageTreasury && (
                            <button
                                onClick={() => setShowPledgeForm(true)}
                                className="bg-[var(--color-primary)] hover:bg-violet-600 text-[var(--color-text-main)] px-4 py-2 rounded-none flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20 font-bold"
                            >
                                <Plus size={18} />
                                <span>New Pledge</span>
                            </button>
                        )}
                    </>
                ) : canManageTreasury ? (
                    <Link
                        to="/finance/new"
                        className="bg-[var(--color-primary)] hover:bg-violet-600 text-[var(--color-text-main)] px-4 py-2 rounded-none flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20"
                    >
                        <Plus size={18} />
                        <span>New Entry</span>
                    </Link>
                ) : null
                }
            </div>
        </div>
    );
};
