
import React, { useState, useEffect } from 'react';
import type { FamilyRelationship } from '@/types';
import { Plus, X, UserPlus, Users, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // Assuming alias works, or need relative path
import { getActiveMembersWithPositions } from '@/services/memberService';

interface FamilyFormProps {
    data: any;
    onChange: (field: string, value: any) => void;
}

const RELATION_TYPES = {
    spouse: 'Spouse',
    father: 'Father',
    mother: 'Mother',
    son: 'Son',
    daughter: 'Daughter',
    brother: 'Brother',
    sister: 'Sister',
    grandfather: 'Grandfather',
    grandmother: 'Grandmother',
    uncle: 'Uncle',
    aunt: 'Aunt',
    nephew: 'Nephew',
    niece: 'Niece',
    cousin: 'Cousin',
    in_law: 'In-Law',
};

const FamilyForm: React.FC<FamilyFormProps> = ({ data, onChange }) => {
    const { relationships = [], newRelationName = '', relationType = 'spouse' } = data;
    const [members, setMembers] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any | null>(null);

    useEffect(() => {
        getActiveMembersWithPositions().then(setMembers).catch(console.error);
    }, []);

    const filteredMembers = React.useMemo(() => {
        if (!newRelationName || newRelationName.length < 2) return [];
        const lowerSearch = newRelationName.toLowerCase();
        return members.filter(m => `${m.first_name} ${m.surname}`.toLowerCase().includes(lowerSearch));
    }, [newRelationName, members]);

    const handleSelectMember = (member: any) => {
        setSelectedMember(member);
        onChange('newRelationName', `${member.first_name} ${member.surname}`);
        setShowDropdown(false);
    };

    const addRelation = () => {
        if (!newRelationName.trim()) return;

        const relation: Partial<FamilyRelationship> = {
            non_member_name: newRelationName,
            relationship_type: relationType,
        };

        if (selectedMember && `${selectedMember.first_name} ${selectedMember.surname}` === newRelationName) {
            relation.related_member_id = selectedMember.id;
            (relation as any).members = selectedMember;
        }

        onChange('relationships', [...relationships, relation]);
        onChange('newRelationName', '');
        setSelectedMember(null);
    };

    const removeRelation = (index: number) => {
        const newRelations = [...relationships];
        newRelations.splice(index, 1);
        onChange('relationships', newRelations);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-[16px] font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={18} className="text-[#4f46e5]" /> Family Relationships
            </h3>

            <div className="bg-gray-50 border border-gray-100 rounded-[16px] p-4 flex flex-col md:flex-row gap-4 items-end shadow-sm">
                <div className="flex-1 space-y-1.5 w-full relative">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Relative Name (Search Member)</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={newRelationName}
                            onChange={(e) => {
                                onChange('newRelationName', e.target.value);
                                setShowDropdown(true);
                                if (selectedMember && `${selectedMember.first_name} ${selectedMember.surname}` !== e.target.value) {
                                    setSelectedMember(null);
                                }
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            placeholder="Type to search members..."
                            className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-semibold"
                        />
                    </div>
                    {/* Autocomplete Dropdown */}
                    {showDropdown && filteredMembers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                            {filteredMembers.map(m => {
                                const pos = m.church_positions?.find((p: any) => p.is_active)?.position_name;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => handleSelectMember(m)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-center gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                                            {m.profile_picture_url ? (
                                                <img src={m.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Users size={14} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 leading-none mb-1">{m.first_name} {m.surname}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                {m.member_number && <span>{m.member_number}</span>}
                                                {m.member_number && pos && <span>•</span>}
                                                {pos && <span className="truncate text-gray-500">{pos}</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="flex-1 space-y-1.5 w-full">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Relationship</label>
                    <select
                        value={relationType}
                        onChange={(e) => onChange('relationType', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-semibold"
                    >
                        {Object.entries(RELATION_TYPES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={addRelation}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-2.5 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                    title="Add Relative"
                >
                    <UserPlus size={20} />
                </button>
            </div>

            {/* List Relations */}
            <div className="space-y-3">
                {relationships.length === 0 && (
                    <p className="text-center text-gray-500 text-sm font-semibold py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">No family members linked yet.</p>
                )}

                {relationships.map((rel: any, idx: number) => {
                    const relMember = rel.members;
                    const name = relMember ? `${relMember.first_name} ${relMember.surname}` : (rel.non_member_name || 'Linked Member');
                    const isLinked = !!relMember;

                    return (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-[16px] border border-gray-200 group hover:border-[#93c5fd] hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.15)] transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                                    {isLinked && relMember.profile_picture_url ? (
                                        <img src={relMember.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <Users size={20} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    {isLinked ? (
                                        <a href={`/members/${relMember.id}`} target="_blank" rel="noopener noreferrer" className="font-bold text-gray-900 text-base hover:text-blue-600 transition-colors hover:underline">
                                            {name}
                                        </a>
                                    ) : (
                                        <h4 className="font-bold text-gray-900 text-base">{name}</h4>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        <span className="text-[10px] font-black tracking-widest uppercase bg-indigo-50 text-indigo-700 border border-indigo-100/50 px-2.5 py-1 rounded-md shadow-sm">
                                            {RELATION_TYPES[rel.relationship_type as keyof typeof RELATION_TYPES]}
                                        </span>
                                        {isLinked && relMember.member_number && (
                                            <span className="text-xs text-gray-500 font-bold">{relMember.member_number}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => removeRelation(idx)}
                                className="p-2.5 text-red-500 bg-red-50/0 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all border border-transparent hover:border-red-100"
                                title="Remove related member"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FamilyForm;
