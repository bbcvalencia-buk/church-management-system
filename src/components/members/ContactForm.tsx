
import React from 'react';
import type { Member } from '@/types';

interface ContactFormProps {
    data: any;
    onChange: (field: string, value: any) => void;
}

const ContactForm: React.FC<ContactFormProps> = ({ data, onChange }) => {
    const update = (field: string, value: any) => {
        onChange(field, value);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-[var(--color-text-main)] mb-4">Contact & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Home Address <span className="text-red-400">*</span></label>
                    <textarea
                        value={data.home_address || ''}
                        onChange={(e) => update('home_address', e.target.value)}
                        placeholder="e.g. Purok 17 Hindangon, Poblacion, Valencia City, Bukidnon"
                        required
                        className="min-h-[100px]"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Phone Number <span className="text-red-400">*</span></label>
                    <input
                        type="tel"
                        value={data.phone_number || ''}
                        onChange={(e) => update('phone_number', e.target.value)}
                        placeholder="e.g. 0917-123-4567"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Email Address</label>
                    <input
                        type="email"
                        value={data.email || ''}
                        onChange={(e) => update('email', e.target.value)}
                        placeholder="e.g. member@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Emergency Contact Name</label>
                    <input
                        type="text"
                        value={data.emergency_contact_name || ''}
                        onChange={(e) => update('emergency_contact_name', e.target.value)}
                        placeholder="e.g. Spouse Name"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Emergency Contact Phone</label>
                    <input
                        type="tel"
                        value={data.emergency_contact_phone || ''}
                        onChange={(e) => update('emergency_contact_phone', e.target.value)}
                        placeholder="e.g. 0917-123-4567"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--color-text-muted)]">Relationship to Member</label>
                    <input
                        type="text"
                        value={data.emergency_contact_relationship || ''}
                        onChange={(e) => update('emergency_contact_relationship', e.target.value)}
                        placeholder="e.g. Spouse, Father"
                    />
                </div>
            </div>
        </div>
    );
};

export default ContactForm;
