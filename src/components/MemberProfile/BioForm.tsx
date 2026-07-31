
import React from 'react';
import type { Member } from '@/types';

interface BioFormProps {
    data: any;
    onChange: (field: string, value: any) => void;
}

const BioForm: React.FC<BioFormProps> = ({ data, onChange }) => {
    // Helper to update fields
    const update = (field: string, value: any) => {
        onChange(field, value);
    };

    // Calculate age if DOB changes
    const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        // Age will be calculated by backend or utility, but we can store DOB
        update('date_of_birth', date);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-[var(--color-text-main)] mb-4">Biographical Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">First Name <span className="text-red-400">*</span></label>
                    <input
                        type="text"
                        value={data.first_name || ''}
                        onChange={(e) => update('first_name', e.target.value)}
                        placeholder="e.g. Juan"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--color-text-muted)]">Middle Name</label>
                        <input
                            type="text"
                            value={data.middle_name || ''}
                            onChange={(e) => update('middle_name', e.target.value)}
                            placeholder="e.g. Santos"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--color-text-muted)]">Nickname</label>
                        <input
                            type="text"
                            value={data.nickname || ''}
                            onChange={(e) => update('nickname', e.target.value)}
                            placeholder="e.g. Jun"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Surname <span className="text-red-400">*</span></label>
                    <input
                        type="text"
                        value={data.surname || ''}
                        onChange={(e) => update('surname', e.target.value)}
                        placeholder="e.g. Dela Cruz"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Name Extension</label>
                    <select
                        value={data.name_ext || ''}
                        onChange={(e) => update('name_ext', e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-none px-3 py-2.5"
                    >
                        <option value="">None</option>
                        <option value="Jr.">Jr.</option>
                        <option value="Sr.">Sr.</option>
                        <option value="II">II</option>
                        <option value="III">III</option>
                        <option value="IV">IV</option>
                        <option value="V">V</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Date of Birth <span className="text-red-400">*</span></label>
                    <input
                        type="date"
                        value={data.date_of_birth || ''}
                        onChange={handleDobChange}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Gender <span className="text-red-400">*</span></label>
                    <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="gender"
                                value="Male"
                                checked={data.gender === 'Male'}
                                onChange={() => update('gender', 'Male')}
                                className="w-4 h-4 text-[var(--color-primary)] bg-[var(--color-surface)] border-[var(--color-border)] focus:ring-[var(--color-primary)]"
                            />
                            <span>Male</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="gender"
                                value="Female"
                                checked={data.gender === 'Female'}
                                onChange={() => update('gender', 'Female')}
                                className="w-4 h-4 text-[var(--color-primary)] bg-[var(--color-surface)] border-[var(--color-border)] focus:ring-[var(--color-primary)]"
                            />
                            <span>Female</span>
                        </label>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Civil Status <span className="text-red-400">*</span></label>
                    <select
                        value={data.civil_status || 'Single'}
                        onChange={(e) => update('civil_status', e.target.value as any)}
                        required
                    >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widow">Widow</option>
                        <option value="Widower">Widower</option>
                        <option value="Separated">Separated</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Nationality</label>
                    <input
                        type="text"
                        value={data.nationality || 'Filipino'}
                        onChange={(e) => update('nationality', e.target.value)}
                    />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Place of Birth</label>
                    <input
                        type="text"
                        value={data.place_of_birth || ''}
                        onChange={(e) => update('place_of_birth', e.target.value)}
                        placeholder="e.g. Valencia City, Bukidnon"
                    />
                </div>
            </div>
        </div>
    );
};

export default BioForm;
