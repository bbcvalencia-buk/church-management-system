
import React from 'react';
import type { Member } from '@/types';

interface SpiritualFormProps {
    data: any;
    onChange: (field: string, value: any) => void;
}

const SpiritualForm: React.FC<SpiritualFormProps> = ({ data, onChange }) => {
    // Helper to update fields
    const update = (field: string, value: any) => {
        onChange(field, value);
    };

    const handleBaptismChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        if (date) {
            onChange('baptism_date', date);
            onChange('membership_date', date);
            onChange('is_regular_member', true);
            
        } else {
            onChange('baptism_date', date);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-[var(--color-text-main)] mb-4">Spiritual Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Salvation Date</label>
                    <input
                        type="date"
                        value={data.salvation_date || ''}
                        onChange={(e) => update('salvation_date', e.target.value)}
                    />
                    <p className="text-xs text-[var(--color-text-muted)]">When they accepted Christ</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Baptism Date</label>
                    <input
                        type="date"
                        value={data.baptism_date || ''}
                        onChange={handleBaptismChange}
                    />
                    <p className="text-xs text-[var(--color-text-muted)]">Automatically sets Membership Date</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Membership Date</label>
                    <input
                        type="date"
                        value={data.membership_date || ''}
                        onChange={(e) => update('membership_date', e.target.value)}
                        disabled={!!data.baptism_date} // Disabled if baptism date is set (auto-synced)
                        className="opacity-75 cursor-not-allowed"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Previous Church</label>
                    <input
                        type="text"
                        value={data.previous_church || ''}
                        onChange={(e) => update('previous_church', e.target.value)}
                        placeholder="e.g. Hope Baptist Church"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Previous Religion</label>
                    <input
                        type="text"
                        value={data.previous_religion || ''}
                        onChange={(e) => update('previous_religion', e.target.value)}
                        placeholder="e.g. Catholic"
                    />
                </div>

                {/* Status Badges Preview */}
                <div className="md:col-span-2 glass-panel p-4 bg-white/5 rounded-none border border-white/10 mt-4">
                    <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase mb-3">Membership Status</h4>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={data.is_regular_member || false}
                                onChange={(e) => update('is_regular_member', e.target.checked)}
                            />
                            <span>Regular Member</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                
                                
                            />
                            <span>Visitor</span>
                        </label>
                        <div className="h-6 w-[1px] bg-white/20 mx-2"></div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={data.is_pastor || false}
                                onChange={(e) => update('is_pastor', e.target.checked)}
                            />
                            <span>Pastor (ID #1)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={data.is_pastors_wife || false}
                                onChange={(e) => update('is_pastors_wife', e.target.checked)}
                            />
                            <span>Pastor's Wife (ID #2)</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpiritualForm;
