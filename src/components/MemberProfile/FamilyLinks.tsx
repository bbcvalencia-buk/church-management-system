import React from "react";

interface FamilyLinksProps {
    family: any[];
}

const FamilyLinks: React.FC<FamilyLinksProps> = ({ family }) => {
    if (!family || family.length === 0) return null;

    return (
        <div className="mt-4 pt-4 border-t border-gray-100/60 max-w-2xl">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-2">Family & Relatives</p>
            <div className="flex flex-wrap gap-2">
                {family.map((rel: any, idx: number) => {
                    const relMember = rel.members;
                    const name = relMember ? `${relMember.first_name} ${relMember.surname}` : (rel.non_member_name || 'Relative');
                    const initials = name.substring(0, 2).toUpperCase();
                    const typeStr = (rel.relationship_type || '').replace(/_/g, ' ');

                    const content = (
                        <div className="flex items-center gap-2 pr-3 pl-1 py-1 rounded-full border border-gray-200/80 bg-white hover:bg-gray-50 hover:border-blue-200 transition-colors shadow-sm cursor-pointer group">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0 border border-blue-50/50">
                                {relMember && relMember.profile_picture_url ? (
                                    <img src={relMember.profile_picture_url} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <span className="text-[10px] font-bold text-blue-700">{initials}</span>
                                )}
                            </div>
                            <div className="flex flex-col leading-none justify-center">
                                <span className="text-xs font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-0.5">{name}</span>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{typeStr}</span>
                            </div>
                        </div>
                    );

                    if (relMember) {
                        return <a href={`/members/${relMember.id}`} target="_blank" rel="noopener noreferrer" key={idx}>{content}</a>
                    }
                    return <span key={idx} title="Not a registered member">{content}</span>
                })}
            </div>
        </div>
    );
};

export default FamilyLinks;
