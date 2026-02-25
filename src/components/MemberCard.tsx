
import React from 'react';
import type { Member } from '@/types';
import { Link } from 'react-router-dom';
import { User, Phone, MapPin, Edit, Shield } from 'lucide-react';

interface MemberCardProps {
    member: Member;
}

export const MemberCard = ({ member }: MemberCardProps) => {
    const isMale = member.gender === 'Male';
    const fallbackInitial = member.first_name[0] + member.surname[0];

    return (
        <Link
            to={`/members/${member.id}`}
            className="card-panel p-5 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)] transition-all duration-300 group relative overflow-hidden bg-white border-[var(--color-border)]"
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    {member.profile_picture_url ? (
                        <img
                            src={member.profile_picture_url}
                            alt={`${member.first_name} ${member.surname}`}
                            className="w-14 h-14 rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
                        />
                    ) : (
                        <div className={`
              w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm ring-1 ring-black/5
              ${isMale ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}
            `}>
                            {fallbackInitial}
                        </div>
                    )}

                    <div>
                        <h3 className="font-bold text-lg leading-tight text-[var(--color-text-main)] tracking-tight group-hover:text-[var(--color-primary)] transition-colors">
                            {member.first_name} {member.surname}
                            {member.name_ext && <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">{member.name_ext}</span>}
                        </h3>
                        <div className="flex flex-col gap-0.5 mt-1">
                            {member.member_number && (
                                <p className="text-sm font-bold text-indigo-600 tracking-tight">
                                    {member.member_number}
                                </p>
                            )}
                            <p className="text-xs text-[var(--color-text-muted)] font-medium flex items-center gap-2">
                                <span className="opacity-70">ID: {member.id_number}</span>
                                {member.nickname && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                        <span>"{member.nickname}"</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className={`
          px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border
          ${member.membership_status === 'active' ? 'bg-green-50 text-green-700 border-green-100' :
                        member.membership_status === 'inactive' ? 'bg-gray-50 text-gray-600 border-gray-100' : 'bg-red-50 text-red-600 border-red-100'}
        `}>
                    {member.membership_status}
                </div>
            </div>

            <div className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
                {member.phone_number && (
                    <div className="flex items-center gap-2">
                        <Phone size={14} className="opacity-50" />
                        <span>{member.phone_number}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 truncate">
                    <MapPin size={14} className="opacity-50 flex-shrink-0" />
                    <span className="truncate">{member.home_address}</span>
                </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-dashed border-[var(--color-border)]">
                {member.is_pastor && (
                    <span className="bg-purple-50 text-purple-700 text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-purple-100">
                        <Shield size={10} /> Pastor
                    </span>
                )}
                {member.is_pastors_wife && (
                    <span className="bg-pink-50 text-pink-700 text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-pink-100">
                        <User size={10} /> Pastor's Wife
                    </span>
                )}
                {member.is_regular_member && (
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-1 rounded-md border border-blue-100">Regular Member</span>
                )}
            </div>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit size={16} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" />
            </div>
        </Link>
    );
};
