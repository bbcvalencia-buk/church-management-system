import React from 'react';
import { Plus, BookOpen, Layers } from 'lucide-react';
import type { GoodnewsSeries } from '@/types';

interface GoodnewsSidebarProps {
    activeTab: 'ongoing' | 'completed' | 'paused';
    setActiveTab: (tab: 'ongoing' | 'completed' | 'paused') => void;
    seriesList: GoodnewsSeries[];
    canManageSessions: boolean;
    isTeacher: boolean;
    onAddSeries: () => void;
    viewingSeries: GoodnewsSeries | null;
}

const GoodnewsSidebar: React.FC<GoodnewsSidebarProps> = ({
    activeTab,
    setActiveTab,
    seriesList,
    canManageSessions,
    isTeacher,
    onAddSeries,
    viewingSeries
}) => {
    // Workbench Toolbox Layout (narrow sidebar)
    return (
        <div className="w-64 shrink-0 flex flex-col gap-6 bg-[var(--color-surface)] p-6 border-r border-[var(--color-border)] min-h-[calc(100vh-64px)]">
            <div>
                <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight flex items-center gap-3">
                    <BookOpen className="text-[var(--color-primary)]" size={24} />
                    Classes
                </h1>
                <p className="text-[var(--color-text-muted)] mt-2 text-xs font-medium leading-relaxed">
                    Manage Goodnews series, locations, children attendance, and members.
                </p>
            </div>

            {(canManageSessions || isTeacher) && !viewingSeries && (
                <button
                    onClick={onAddSeries}
                    className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
                >
                    <Plus size={16} /> New Area
                </button>
            )}

            {!viewingSeries && (
                <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-6">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Layers size={12} /> Status Filter
                    </label>
                    {(['ongoing', 'completed', 'paused'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 font-bold text-sm tracking-wide capitalize transition-colors text-left flex justify-between items-center ${activeTab === tab
                                ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] border-l-2 border-[var(--color-primary)]'
                                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] border-l-2 border-transparent'
                                }`}
                        >
                            {tab}
                            <span className="text-[10px] bg-[var(--color-surface)] px-2 py-0.5 rounded-sm text-[var(--color-text-muted)]">
                                {seriesList.filter(s => s.status === tab).length}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            
            <div className="mt-auto border-t border-[var(--color-border)] pt-6">
                <div className="bg-[var(--color-surface-hover)] p-4 rounded-sm border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] leading-relaxed">
                    <strong>Note:</strong> Active areas receive weekly attendance updates. Use the completed tab to view historical data.
                </div>
            </div>
        </div>
    );
};

export default GoodnewsSidebar;
