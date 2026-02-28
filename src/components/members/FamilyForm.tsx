
import React, { useState, useEffect } from 'react';
import type { FamilyRelationship } from '@/types';
import { Plus, X, UserPlus, Users, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // Assuming alias works, or need relative path
import { getActiveMembers } from '@/services/memberService';

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
        getActiveMembers().then(setMembers).catch(console.error);
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
            <h3 className="text-lg font-medium text-white mb-4">Family Relationships</h3>

            <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2 w-full relative">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Relative Name (Search Member)</label>
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
                            className="bg-white/5 border border-white/10 text-white rounded-lg p-2.5 pl-9 w-full focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                        />
                    </div>
                    {/* Autocomplete Dropdown */}
                    {showDropdown && filteredMembers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                            {filteredMembers.map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleSelectMember(m)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                                >
                                    <p className="text-sm font-bold text-white leading-none">{m.first_name} {m.surname}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 space-y-2 w-full">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Relationship</label>
                    <select
                        value={relationType}
                        onChange={(e) => onChange('relationType', e.target.value)}
                    >
                        {Object.entries(RELATION_TYPES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={addRelation}
                    className="bg-[var(--color-primary)] hover:bg-violet-600 text-white p-2.5 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-purple-500/20"
                >
                    <UserPlus size={20} />
                </button>
            </div>

            {/* List Relations */}
            <div className="space-y-3">
                {relationships.length === 0 && (
                    <p className="text-center text-[var(--color-text-muted)] py-4">No family members linked yet.</p>
                )}

                {relationships.map((rel: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                                <Users size={16} />
                            </div>
                            <div>
                                <h4 className="font-medium text-white">
                                    {rel.non_member_name || 'Linked Member'}
                                </h4>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {RELATION_TYPES[rel.relationship_type as keyof typeof RELATION_TYPES]}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => removeRelation(idx)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FamilyForm;
