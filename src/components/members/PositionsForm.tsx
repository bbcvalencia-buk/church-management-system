import React from 'react';
import type { ChurchPosition } from '@/types';
import { Plus, X, Star } from 'lucide-react';

interface PositionsFormProps {
    data: any;
    onChange: (field: string, value: any) => void;
}

const CATEGORY_OPTIONS = [
    { id: 'leadership', label: 'Pastoral & Admin' },
    { id: 'music_ministry', label: 'Music & Creatives' },
    { id: 'sunday_school_adult', label: 'Sunday School & Ed.' },
    { id: 'other_ministries', label: 'Operations & Support' }
];

const CATEGORY_LABELS: Record<string, string> = {
    leadership: 'Pastoral & Admin',
    music_ministry: 'Music & Creatives',
    sunday_school_adult: 'Sunday School & Ed.',
    sunday_school_children: 'Sunday School & Ed.',
    beginners_class: 'Sunday School & Ed.',
    other_ministries: 'Operations & Support'
};

const createInitialPosition = (): Partial<ChurchPosition> => ({
    position_name: '',
    department: '',
    position_category: 'sunday_school_adult',
    assignment_reason: '',
    is_ministry_head: false,
    start_date: new Date().toISOString().split('T')[0],
    is_active: true
});

const getCategoryLabel = (category?: string) => {
    if (!category) return 'General';
    return CATEGORY_LABELS[category] || category.replace(/_/g, ' ');
};

const PositionsForm: React.FC<PositionsFormProps> = ({ data, onChange }) => {
    const { positions = [], newPosition = createInitialPosition() } = data;

    const updateDraft = (field: keyof ChurchPosition, value: any) => {
        onChange('newPosition', { ...newPosition, [field]: value });
    };

    const addPosition = () => {
        const roleName = newPosition.position_name?.trim();
        const ministryName = newPosition.department?.trim();

        if (!roleName) return;
        if (!ministryName) return;

        const newEntry: Partial<ChurchPosition> = {
            ...newPosition,
            position_name: roleName,
            department: ministryName,
            assignment_reason: newPosition.assignment_reason?.trim() || '',
            start_date: newPosition.start_date || new Date().toISOString().split('T')[0],
            is_active: true
        };

        const updated = [...positions, newEntry];

        // Keep only one head per ministry in the local editor list.
        if (newEntry.is_ministry_head) {
            const normalizedDepartment = ministryName.toLowerCase();
            const lastIndex = updated.length - 1;
            for (let i = 0; i < updated.length; i++) {
                const dep = updated[i].department?.toLowerCase();
                if (dep === normalizedDepartment) {
                    updated[i] = {
                        ...updated[i],
                        is_ministry_head: i === lastIndex
                    };
                }
            }
        }

        onChange('positions', updated);
        onChange('newPosition', createInitialPosition());
    };

    const removePosition = (index: number) => {
        const next = [...positions];
        next.splice(index, 1);
        onChange('positions', next);
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4 sm:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Position Name</label>
                        <input
                            type="text"
                            value={newPosition.position_name || ''}
                            onChange={(e) => updateDraft('position_name', e.target.value)}
                            placeholder="e.g. Choir Member, Sunday School Teacher"
                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
                        <select
                            value={newPosition.position_category || 'sunday_school_adult'}
                            onChange={(e) => updateDraft('position_category', e.target.value as ChurchPosition['position_category'])}
                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                        >
                            {CATEGORY_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Ministry Group / Department</label>
                        <input
                            type="text"
                            value={newPosition.department || ''}
                            onChange={(e) => updateDraft('department', e.target.value)}
                            placeholder="e.g. Main Choir, Sunday School Adult"
                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Schedule / Notes</label>
                        <input
                            type="text"
                            value={newPosition.assignment_reason || ''}
                            onChange={(e) => updateDraft('assignment_reason', e.target.value)}
                            placeholder="e.g. Sunday 8:30"
                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Start Date</label>
                        <input
                            type="date"
                            value={newPosition.start_date || new Date().toISOString().split('T')[0]}
                            onChange={(e) => updateDraft('start_date', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={!!newPosition.is_ministry_head}
                                onChange={(e) => updateDraft('is_ministry_head', e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                            />
                            Mark as ministry head
                        </label>
                    </div>
                </div>

                <div className="flex justify-end mt-4">
                    <button
                        onClick={addPosition}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        <Plus size={16} /> Add Position
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {positions.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No positions assigned yet.</p>
                )}

                {positions.map((pos: any, idx: number) => (
                    <div key={idx} className="rounded-xl border border-gray-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-[15px] font-bold text-gray-900 truncate">{pos.position_name || 'Untitled Position'}</h4>
                                    {pos.is_ministry_head && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-1">
                                            <Star size={12} className="fill-current" /> Head
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {getCategoryLabel(pos.position_category)} - Since {pos.start_date || 'N/A'}
                                </p>
                                {pos.department && (
                                    <p className="text-xs text-gray-500 mt-1">Ministry: {pos.department}</p>
                                )}
                                {pos.assignment_reason && (
                                    <p className="text-xs text-gray-500 mt-1">Schedule: {pos.assignment_reason}</p>
                                )}
                            </div>
                            <button
                                onClick={() => removePosition(idx)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove position"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PositionsForm;
