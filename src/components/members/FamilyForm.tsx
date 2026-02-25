
import React from 'react';
import type { FamilyRelationship } from '@/types';
import { Plus, X, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // Assuming alias works, or need relative path

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

    const addRelation = () => {
        if (!newRelationName.trim()) return;

        const relation: Partial<FamilyRelationship> = {
            non_member_name: newRelationName,
            relationship_type: relationType,
        };

        onChange('relationships', [...relationships, relation]);
        onChange('newRelationName', '');
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
                <div className="flex-1 space-y-2 w-full">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Relative Name</label>
                    <input
                        type="text"
                        value={newRelationName}
                        onChange={(e) => onChange('newRelationName', e.target.value)}
                        placeholder="e.g. Maria Santos"
                    />
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
