import React from "react";
import { Mail, Printer, Edit3, MessageSquare, User } from "lucide-react";
import FamilyLinks from "./FamilyLinks";

interface ProfileHeaderProps {
    member: any;
    previewUrl: string | null;
    family: any[];
    canManageProfiles: boolean;
    id?: string;
    setIsViewing: (viewing: boolean) => void;
    setShowEditRequestModal: (show: boolean) => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    member,
    previewUrl,
    family,
    canManageProfiles,
    id,
    setIsViewing,
    setShowEditRequestModal,
}) => {
    return (
        <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Avatar */}
                <div className="relative shrink-0 w-24 h-24 md:w-28 md:h-28">
                    <div className="w-full h-full rounded-lg overflow-hidden bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={40} className="text-[var(--color-text-muted)]" />
                        )}
                    </div>
                </div>

                {/* Info Block */}
                <div className="flex-1 w-full space-y-4">
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4">
                        <div>
                            <h1 className="text-3xl font-light text-[var(--color-text-main)] tracking-tight leading-none mb-3" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                                {member.first_name} {member.surname}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest ${member.membership_status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-[var(--color-text-muted)]'}`}>
                                    {member.membership_status} {member.is_regular_member ? 'Member' : 'Visitor'}
                                </span>
                                {member.member_number && (
                                    <span className="bg-[var(--color-primary-light)] text-[var(--color-primary)] px-2.5 py-1 rounded font-mono font-bold text-[10px] tracking-widest border border-[var(--color-primary-light)]">
                                        {member.member_number}
                                    </span>
                                )}
                                {member.is_regular_member && member.id_number && (
                                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
                                        ID: <span className="font-bold text-[var(--color-text-main)]">#{member.id_number}</span>
                                    </span>
                                )}
                            </div>
                            {member.notes && (
                                <p className="text-[var(--color-text-muted)] italic leading-relaxed text-xs max-w-2xl">
                                    "{member.notes}"
                                </p>
                            )}

                            <FamilyLinks family={family} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {member.email && (
                                <button 
                                    onClick={() => window.location.href = `mailto:${member.email}`} 
                                    className="px-3.5 py-2 border border-[var(--color-border)] rounded-lg text-xs font-mono uppercase tracking-widest text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] flex items-center gap-1.5 transition-colors"
                                >
                                    <Mail size={14} /> Email
                                </button>
                            )}
                            {canManageProfiles && id && (
                                <button 
                                    onClick={() => window.open(`/members/${id}/print-id`, '_blank')} 
                                    className="px-3.5 py-2 border border-[var(--color-border)] rounded-lg text-xs font-mono uppercase tracking-widest text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] flex items-center gap-1.5 transition-colors"
                                >
                                    <Printer size={14} /> Print ID
                                </button>
                            )}
                            {canManageProfiles ? (
                                <button 
                                    onClick={() => setIsViewing(false)} 
                                    className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg text-xs font-mono uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                >
                                    <Edit3 size={14} /> Edit Profile
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg text-xs font-mono uppercase tracking-widest">
                                        Read Only
                                    </span>
                                    <button
                                        onClick={() => setShowEditRequestModal(true)}
                                        className="px-3.5 py-2 bg-amber-50 text-amber-800 rounded-lg text-xs font-mono uppercase tracking-widest border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                                    >
                                        <MessageSquare size={14} />
                                        Request Edit
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileHeader;
