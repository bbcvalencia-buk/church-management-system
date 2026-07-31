import React from 'react';
import { Users, UserCheck, Heart } from 'lucide-react';
import type { Service } from '@/types';
import type { DraftVisitor } from '@/components/QuickVisitorRegistration';
import ImageUpload from '@/components/ImageUpload';

interface Props {
    service: Partial<Service>;
    isPrimaryService: boolean;
    newVisitors: DraftVisitor[];
    onUpdate: (field: keyof Service, value: any) => void;
    onMarkAllPresent: () => void;
    onOpenAttendance: () => void;
}

const ServiceStatsPanel: React.FC<Props> = ({ service, isPrimaryService, newVisitors, onUpdate, onMarkAllPresent, onOpenAttendance }) => {
    return (
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-6">
                <h3 className="text-base font-bold uppercase tracking-wider flex items-center gap-2 text-[var(--color-text-main)]">
                    <Users className="text-[var(--color-primary)]" size={18} />
                    Attendance Stats
                </h3>

                <div className="space-y-4">
                    {/* Stat Display - Flat & Large */}
                    <div className="py-4 border-b border-[var(--color-border)] text-center">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Total Attendance</p>
                        <p className="text-5xl font-light text-[var(--color-text-main)] tracking-tight tabular-nums" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                            {service.total_attendance || 0}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center gap-3">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Members Present</span>
                            <span className="text-sm font-mono text-[var(--color-text-main)] tabular-nums">{Number(service.members_present) || 0} Checked In</span>
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                            <button
                                type="button"
                                onClick={onMarkAllPresent}
                                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-2.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2 px-3"
                            >
                                <UserCheck size={16} className="shrink-0" /> <span>Mark All Present</span>
                            </button>
                            <button
                                type="button"
                                onClick={onOpenAttendance}
                                className="w-full border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] py-2.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2 px-3"
                            >
                                <Users size={16} className="shrink-0" /> <span>Manage Attendance Report</span>
                            </button>
                        </div>
                        <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                            <label className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest block">Visitors / Non-Members Present</label>
                            <input
                                type="number"
                                value={isPrimaryService ? service.visitors_present : 0}
                                onChange={(e) => onUpdate('visitors_present', parseInt(e.target.value) || 0)}
                                className="w-full bg-transparent border border-[var(--color-border)] text-center text-2xl font-mono tabular-nums text-[var(--color-text-main)] p-2 rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                                min="0"
                                disabled={!isPrimaryService}
                            />
                            <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                                {isPrimaryService
                                    ? `Visitor cards encoded: ${newVisitors.length}`
                                    : "Visitors can only be recorded for primary services."}
                            </p>
                        </div>
                        {isPrimaryService && (
                            <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                                <label className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest block">Visitor Card URL (Image)</label>
                                <ImageUpload
                                    value={(service as any).visitor_card_url || ''}
                                    onChange={(url) => onUpdate('visitor_card_url', url)}
                                    folder={`services/${service.service_type || 'general'}`}
                                    label=""
                                    description="Upload visitor card photo"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-6">
                <h3 className="text-base font-bold uppercase tracking-wider flex items-center gap-2 text-[var(--color-text-main)]">
                    <Heart className="text-red-500" size={18} />
                    Spiritual Results
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Souls Saved</label>
                        <input
                            type="number"
                            min="0"
                            value={isPrimaryService ? service.souls_saved : 0}
                            onChange={(e) => onUpdate('souls_saved', parseInt(e.target.value) || 0)}
                            className="w-24 bg-transparent border border-[var(--color-border)] text-right font-mono text-base p-1.5 rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                            disabled={!isPrimaryService}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Members who Prayed</label>
                        <input
                            type="number"
                            min="0"
                            value={service.members_who_prayed}
                            onChange={(e) => onUpdate('members_who_prayed', parseInt(e.target.value) || 0)}
                            className="w-24 bg-transparent border border-[var(--color-border)] text-right font-mono text-base p-1.5 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Baptism Prospects</label>
                        <input
                            type="number"
                            min="0"
                            value={service.prospects_for_baptism}
                            onChange={(e) => onUpdate('prospects_for_baptism', parseInt(e.target.value) || 0)}
                            className="w-24 bg-transparent border border-[var(--color-border)] text-right font-mono text-base p-1.5 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Visitors Saved</label>
                        <input
                            type="number"
                            min="0"
                            value={isPrimaryService ? service.visitors_saved : 0}
                            onChange={(e) => onUpdate('visitors_saved', parseInt(e.target.value) || 0)}
                            className="w-24 bg-transparent border border-[var(--color-border)] text-right font-mono text-base p-1.5 rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                            disabled={!isPrimaryService}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceStatsPanel;
