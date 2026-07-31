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
            <div className="card-panel p-6 space-y-6 bg-white">
                <h3 className="text-[1.16rem] leading-6 font-semibold tracking-tight flex items-center gap-2 text-[var(--color-text-main)]">
                    <Users className="text-[var(--color-primary)]" size={20} />
                    Attendance Stats
                </h3>

                <div className="space-y-4">
                    <div className="p-4 bg-[var(--color-primary)]/10 rounded-lg border border-[var(--color-primary)]/20 text-center">
                        <p className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-semibold mb-1">Total Attendance</p>
                        <p className="text-4xl font-bold text-[var(--color-primary-dark)] tracking-tight tabular-nums">{service.total_attendance}</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center gap-3 px-1">
                            <label className="text-[0.7rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.1em] min-w-[7.6rem] leading-tight">Members Present</label>
                            <span className="text-lg font-semibold text-[var(--color-primary-dark)] whitespace-nowrap tabular-nums">{Number(service.members_present) || 0} Checked In</span>
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                            <button
                                type="button"
                                onClick={onMarkAllPresent}
                                className="w-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 px-3"
                            >
                                <UserCheck size={18} className="shrink-0" /> <span>Mark All Present</span>
                            </button>
                            <button
                                type="button"
                                onClick={onOpenAttendance}
                                className="w-full bg-gray-50 text-[var(--color-primary)] border border-[var(--color-primary-light)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)] py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 px-3"
                            >
                                <Users size={18} className="shrink-0" /> <span>Manage Attendance Report</span>
                            </button>
                        </div>
                        <div className="space-y-1 pt-2 border-t border-[var(--color-border)]">
                            <label className="text-[0.7rem] text-[var(--color-text-muted)] uppercase font-semibold px-1 tracking-[0.1em]">Visitors / Non-Members Present</label>
                            <input
                                type="number"
                                value={isPrimaryService ? service.visitors_present : 0}
                                onChange={(e) => onUpdate('visitors_present', parseInt(e.target.value) || 0)}
                                className="form-control text-center text-2xl font-semibold tabular-nums text-[var(--color-primary-dark)] px-3 disabled:opacity-60 disabled:bg-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min="0"
                                disabled={!isPrimaryService}
                            />
                            <p className="text-[11px] text-[var(--color-text-muted)] font-semibold px-1 mt-1">
                                {isPrimaryService
                                    ? `Visitor cards encoded: ${newVisitors.length}`
                                    : "Visitors can only be recorded for Sunday Morning, Sunday Afternoon, and Wednesday Prayer Meeting."}
                            </p>
                        </div>
                        {isPrimaryService && (
                            <div className="space-y-1 pt-2">
                                <label className="text-[0.7rem] text-[var(--color-text-muted)] uppercase font-semibold px-1 tracking-[0.1em]">Visitor Card URL (Image)</label>
                                <ImageUpload
                                    value={(service as any).visitor_card_url || ''}
                                    onChange={(url) => onUpdate('visitor_card_url', url)}
                                    folder={`services/${service.service_type || 'general'}`}
                                    label=""
                                    description="Upload visitor card or service photo"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="card-panel p-6 space-y-6 bg-white">
                <h3 className="text-[1.16rem] leading-6 font-semibold tracking-tight flex items-center gap-2 text-[var(--color-text-main)]">
                    <Heart className="text-red-400" size={20} />
                    Spiritual Results
                </h3>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="form-label">Souls Saved</label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                value={isPrimaryService ? service.souls_saved : 0}
                                onChange={(e) => onUpdate('souls_saved', parseInt(e.target.value) || 0)}
                                className="form-control text-right font-semibold tabular-nums disabled:opacity-60 disabled:bg-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                disabled={!isPrimaryService}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="form-label">Members who Prayed</label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                value={service.members_who_prayed}
                                onChange={(e) => onUpdate('members_who_prayed', parseInt(e.target.value) || 0)}
                                className="form-control text-right font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="form-label">Baptism Prospects</label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                value={service.prospects_for_baptism}
                                onChange={(e) => onUpdate('prospects_for_baptism', parseInt(e.target.value) || 0)}
                                className="form-control text-right font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="form-label">Visitors Saved</label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                value={isPrimaryService ? service.visitors_saved : 0}
                                onChange={(e) => onUpdate('visitors_saved', parseInt(e.target.value) || 0)}
                                className="form-control text-right font-semibold tabular-nums disabled:opacity-60 disabled:bg-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                disabled={!isPrimaryService}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceStatsPanel;
