import React from 'react';
import { UserCheck, Shield, BookOpen, Music, Mic, Plus, Users, X as IconX } from 'lucide-react';
import type { ServiceRole, ServiceAssignment } from '@/types';
import { ROLES, ROLE_LABELS, MULTI_MEMBER_ROLES } from './constants';

interface Props {
    assignments: Partial<ServiceAssignment>[];
    onAssign: (role: ServiceRole) => void;
    onRemove: (memberId: string, role: ServiceRole) => void;
    onUpdateNotes: (memberId: string, role: ServiceRole, notes: string) => void;
}

const ServiceRolesPanel: React.FC<Props> = ({ assignments, onAssign, onRemove, onUpdateNotes }) => {
    return (
        <div className="card-panel p-6 space-y-4 bg-white">
            <h3 className="text-[1.22rem] leading-6 font-semibold tracking-tight flex items-center gap-2 mb-4 text-[var(--color-text-main)]">
                <UserCheck className="text-[var(--color-primary)]" size={20} />
                Service Roles / Roster
            </h3>

            <div className="space-y-6">
                {ROLES.map(role => {
                    const roleAssignments = assignments.filter(a => a.role === role);
                    const isMulti = MULTI_MEMBER_ROLES.includes(role);

                    return (
                        <div key={role} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                    {role === 'pastor' && <Shield size={14} className="text-blue-500" />}
                                    {role === 'preacher' && <BookOpen size={14} className="text-purple-500" />}
                                    {role === 'choir' && <Music size={14} className="text-indigo-500" />}
                                    {role === 'songleader' && <Mic size={14} className="text-pink-500" />}
                                    {ROLE_LABELS[role]}
                                </label>
                                {(isMulti || roleAssignments.length === 0) && (
                                    <button
                                        onClick={() => onAssign(role)}
                                        className="text-[11px] font-bold text-[var(--color-text-main)] hover:text-blue-700 flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg transition-colors"
                                    >
                                        <Plus size={12} /> Assign {isMulti ? 'More' : ''}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {roleAssignments.map((a, idx) => (
                                    <div key={`${a.member_id}-${idx}`} className="flex flex-col gap-2 p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-200 border border-[var(--color-border)] shadow-sm">
                                                    {a.member?.profile_picture_url ? (
                                                        <img src={a.member.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                            <Users size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold text-gray-900">
                                                    {a.member?.first_name} {a.member?.surname}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => onRemove(a.member_id!, role)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <IconX size={14} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Notes/Assignments (e.g. Lead, Alto, etc.)"
                                            value={a.notes || ''}
                                            onChange={(e) => onUpdateNotes(a.member_id!, role, e.target.value)}
                                            className="text-xs bg-white border border-[var(--color-border)] rounded-lg px-2 py-1.5 focus:border-[var(--color-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
                                        />
                                    </div>
                                ))}
                                {roleAssignments.length === 0 && (
                                    <div className="text-[11px] italic text-gray-400 pl-1">No one assigned</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ServiceRolesPanel;
