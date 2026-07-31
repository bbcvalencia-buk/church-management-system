import React from 'react';
import { MapPin, User, Calendar, ChevronRight } from 'lucide-react';
import type { GoodnewsSeries } from '@/types';

interface SeriesListProps {
    seriesList: GoodnewsSeries[];
    activeTab: 'ongoing' | 'completed' | 'paused';
    loading: boolean;
    onSelectSeries: (series: GoodnewsSeries) => void;
}

const SeriesList: React.FC<SeriesListProps> = ({ seriesList, activeTab, loading, onSelectSeries }) => {
    const filtered = seriesList.filter(s => s.status === activeTab);

    if (loading) return <div className="p-8 text-[var(--color-text-muted)]">Loading...</div>;

    if (filtered.length === 0) {
        return (
            <div className="p-12 text-center text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                <p className="italic font-bold">No {activeTab} Goodnews areas found.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
            {filtered.map(series => (
                <div
                    key={series.id}
                    onClick={() => onSelectSeries(series)}
                    className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)] transition-all cursor-pointer group flex flex-col shadow-sm"
                >
                    <div className="flex justify-between items-start mb-3 gap-2">
                        <h3 className="font-black text-lg text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">{series.area}</h3>
                        <span className={`text-[10px] shrink-0 font-bold uppercase tracking-widest px-2 py-1 ${
                            series.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                            series.status === 'completed' ? 'bg-gray-200 text-gray-800' :
                            'bg-amber-100 text-amber-800'
                        }`}>{series.status}</span>
                    </div>

                    <div className="space-y-3 flex-1 text-sm">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[var(--color-text-muted)] font-medium">
                                <MapPin size={16} className="text-red-400" />
                                <span>{series.area}</span>
                            </div>
                            {series.location && (
                                <div className="pl-6 text-[11px] text-[var(--color-text-muted)] italic font-bold">
                                    {series.location}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-1 pt-3 border-t border-[var(--color-border)]">
                            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                <User size={14} className="text-[var(--color-primary)]" />
                                <span className="font-bold text-xs">Lead: {series.lead_member ? `${series.lead_member.first_name} ${series.lead_member.surname}` : 'Unassigned'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <Calendar size={14} />
                            <span className="text-[10px] uppercase font-bold tracking-widest">{new Date(series.start_date).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[var(--color-primary)] font-bold text-sm flex items-center group-hover:underline">
                            View <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform ml-1" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SeriesList;
