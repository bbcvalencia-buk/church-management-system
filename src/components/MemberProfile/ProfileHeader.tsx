import React from "react";
import { Mail, Printer, Edit3, MessageSquare, Star, User } from "lucide-react";
import FamilyLinks from "./FamilyLinks";

interface ProfileHeaderProps {
    member: any;
    previewUrl: string | null;
    family: any[];
    canManageProfiles: boolean;
    id?: string;
    setIsViewing: (viewing: boolean) => void;
    setShowEditRequestModal: (show: boolean) => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    member,
    previewUrl,
    family,
    canManageProfiles,
    id,
    setIsViewing,
    setShowEditRequestModal,
    activeTab,
    setActiveTab,
}) => {
    return (
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8 pb-0 overflow-hidden relative">
            <div className="flex flex-col md:flex-row gap-8 items-start mb-6">
                {/* Avatar */}
                <div className="relative shrink-0 w-[120px] h-[120px]">
                    <div className="w-full h-full rounded-[16px] overflow-hidden bg-gray-50 flex items-center justify-center">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={48} className="text-gray-400" />
                        )}
                    </div>
                    {member.is_regular_member && (
                        <div className="absolute -bottom-2 -right-2 bg-amber-400 text-[var(--color-text-main)] p-1.5 rounded-none ring-4 ring-white" title="Regular Member">
                            <Star size={14} className="fill-white text-[var(--color-text-main)]" />
                        </div>
                    )}
                </div>

                {/* Info Block */}
                <div className="flex-1 w-full space-y-4">
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4">
                        <div>
                            <h1 className="text-[28px] font-extrabold text-[#111827] tracking-tight leading-none mb-3">
                                {member.first_name} {member.surname}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 mb-4">
                                <span className={`px-2.5 py-1 rounded-none font-bold text-[10px] uppercase tracking-wider ${member.membership_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {member.membership_status} {member.is_regular_member ? 'Member' : 'Visitor'}
                                </span>
                                {member.member_number && (
                                    <span className="bg-indigo-600 text-[var(--color-text-main)] px-3 py-1 rounded-none font-bold text-[12px] tracking-wider shadow-sm">
                                        {member.member_number}
                                    </span>
                                )}
                                {member.is_regular_member && (
                                    <span className="text-gray-500 text-sm flex items-center gap-1">
                                        <span className="opacity-60">ID:</span> <span className="font-bold">#{member.id_number}</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-500 italic leading-relaxed text-sm max-w-2xl">
                                "A faithful individual actively participating in our fellowship. Encouraged by their faithfulness in small group."
                            </p>

                            <FamilyLinks family={family} />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={() => window.location.href = `mailto:${member.email || ''}`} className="px-4 py-2 bg-white border border-gray-200 rounded-none text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-sm">
                                <Mail size={16} className="text-gray-500" /> Email
                            </button>
                            {canManageProfiles && id && (
                                <button onClick={() => window.open(`/members/${id}/print-id`, '_blank')} className="px-4 py-2 bg-white border border-gray-200 rounded-none text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-sm">
                                    <Printer size={16} className="text-gray-500" /> Label
                                </button>
                            )}
                            {canManageProfiles ? (
                                <button onClick={() => setIsViewing(false)} className="px-5 py-2 bg-[#4f46e5] text-[var(--color-text-main)] rounded-none text-sm font-bold hover:bg-[#4338ca] flex items-center gap-2 transition-colors shadow-sm">
                                    <Edit3 size={16} /> Edit Profile
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="px-5 py-2 bg-gray-100 text-gray-500 rounded-none text-sm font-bold border border-gray-200">
                                        Read Only
                                    </span>
                                    <button
                                        onClick={() => setShowEditRequestModal(true)}
                                        className="px-5 py-2 bg-amber-100 text-amber-800 rounded-none text-sm font-bold border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-2"
                                    >
                                        <MessageSquare size={16} />
                                        Request Edit
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-8 mt-4 border-t border-gray-100 px-8">
                {['Overview', 'Attendance'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-4 px-1 text-sm font-bold border-b-2 transition-all ${activeTab === tab
                            ? 'border-[var(--color-border)] text-[var(--color-text-main)]'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ProfileHeader;
