import React from 'react';
import { Plus, Trash2, User, Edit3, CalendarDays, Clock3 } from 'lucide-react';
import type { Gender, MaritalStatus } from '@/types';
import { getLatestSundayISODate } from '@/lib/date';
import MultiImageUpload from './MultiImageUpload';

const MARITAL_STATUS_OPTIONS: MaritalStatus[] = ['Married', 'Single', 'Widow', 'Widower', 'Separated'];
const GENDER_OPTIONS: Gender[] = ['Male', 'Female'];
const VISIT_TIME_OPTIONS: Array<'AM' | 'PM'> = ['AM', 'PM'];

const todayIso = () => getLatestSundayISODate();

const asNumberOrUndefined = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
};

export interface DraftVisitor {
    id: string; // Temp ID
    name: string;
    address?: string;
    office_address?: string;
    contact?: string; // Contact No.
    age?: number;
    date_of_birth?: string;
    gender: Gender;
    marital_status: MaritalStatus;
    church_name?: string; // Church affiliation
    invited_by?: string;
    visit_time: 'AM' | 'PM';
    visit_date?: string;
    images: string[];
}

interface QuickVisitorRegistrationProps {
    visitors: DraftVisitor[];
    onChange: (visitors: DraftVisitor[]) => void;
    folderPath?: string;
    defaultVisitDate?: string;
    contextLabel?: string;
}

const QuickVisitorRegistration: React.FC<QuickVisitorRegistrationProps> = ({
    visitors,
    onChange,
    folderPath = 'visitors/cards',
    defaultVisitDate,
    contextLabel
}) => {
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const resolvedDefaultVisitDate = defaultVisitDate || todayIso();

    React.useEffect(() => {
        if (!resolvedDefaultVisitDate) return;
        if (!visitors.some(v => !v.visit_date)) return;

        onChange(visitors.map(v => ({
            ...v,
            visit_date: v.visit_date || resolvedDefaultVisitDate
        })));
    }, [resolvedDefaultVisitDate, visitors, onChange]);

    const addVisitor = () => {
        const newId = Date.now().toString();
        onChange([
            ...visitors,
            {
                id: newId,
                name: '',
                gender: 'Male',
                marital_status: 'Single',
                visit_time: new Date().getHours() < 12 ? 'AM' : 'PM',
                visit_date: resolvedDefaultVisitDate,
                images: []
            }
        ]);
        setEditingId(newId);
    };

    const updateVisitor = <K extends keyof DraftVisitor>(id: string, field: K, value: DraftVisitor[K]) => {
        onChange(visitors.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const removeVisitor = (id: string) => {
        onChange(visitors.filter(v => v.id !== id));
        if (editingId === id) setEditingId(null);
    };

    return (
        <div className="bg-white rounded-[16px] border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden font-sans">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <User size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg text-gray-900 font-bold leading-tight">Visitor Card Registration</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">{contextLabel || 'Manage Entries'}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={addVisitor}
                    className="bg-[#2563eb] text-white hover:bg-blue-700 px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors font-bold text-sm shadow-sm"
                >
                    <Plus size={16} /> Add Visitor Card
                </button>
            </div>

            <div className="p-6 space-y-4">
                {visitors.map((visitor) => {
                    const isEditing = editingId === visitor.id;
                    const isComplete = Boolean(
                        visitor.name.trim() &&
                        (visitor.date_of_birth || '').trim()
                    );

                    if (isEditing) {
                        return (
                            <div key={visitor.id} className="bg-gray-50 p-5 rounded-xl border border-blue-100 space-y-4 relative">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-gray-900">Visitor Card Details</h4>
                                    <button
                                        type="button"
                                        onClick={() => setEditingId(null)}
                                        className="text-sm font-bold text-blue-600 hover:text-blue-800"
                                    >
                                        Done
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Name *</label>
                                            <input
                                                type="text"
                                                placeholder="Full Name"
                                                value={visitor.name}
                                                onChange={(e) => updateVisitor(visitor.id, 'name', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Address</label>
                                            <input
                                                type="text"
                                                placeholder="Complete Home Address"
                                                value={visitor.address || ''}
                                                onChange={(e) => updateVisitor(visitor.id, 'address', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Office Address (if any)</label>
                                            <input
                                                type="text"
                                                placeholder="Office Address"
                                                value={visitor.office_address || ''}
                                                onChange={(e) => updateVisitor(visitor.id, 'office_address', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Marital Status</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {MARITAL_STATUS_OPTIONS.map(status => (
                                                    <button
                                                        key={status}
                                                        type="button"
                                                        onClick={() => updateVisitor(visitor.id, 'marital_status', status)}
                                                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${visitor.marital_status === status
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        {status}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Gender</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {GENDER_OPTIONS.map(gender => (
                                                    <button
                                                        key={gender}
                                                        type="button"
                                                        onClick={() => updateVisitor(visitor.id, 'gender', gender)}
                                                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${visitor.gender === gender
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        {gender}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-gray-500 font-bold">Current Church</label>
                                        <input
                                            type="text"
                                            placeholder="Church Name"
                                            value={visitor.church_name || ''}
                                            onChange={(e) => updateVisitor(visitor.id, 'church_name', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Age</label>
                                            <input
                                                type="number"
                                                value={visitor.age ?? ''}
                                                onChange={(e) => updateVisitor(visitor.id, 'age', asNumberOrUndefined(e.target.value))}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                placeholder="0"
                                                min={0}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Date of Birth *</label>
                                            <input
                                                type="date"
                                                value={visitor.date_of_birth || ''}
                                                onChange={(e) => updateVisitor(visitor.id, 'date_of_birth', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-gray-500 font-bold">Contact No.</label>
                                        <input
                                            type="text"
                                            value={visitor.contact || ''}
                                            onChange={(e) => updateVisitor(visitor.id, 'contact', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            placeholder="+1 (555) 000-0000"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Invited By</label>
                                            <input
                                                type="text"
                                                value={visitor.invited_by || ''}
                                                onChange={(e) => updateVisitor(visitor.id, 'invited_by', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                placeholder="Member / Teacher Name"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-gray-500 font-bold">Visit Time</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {VISIT_TIME_OPTIONS.map(slot => (
                                                    <button
                                                        key={slot}
                                                        type="button"
                                                        onClick={() => updateVisitor(visitor.id, 'visit_time', slot)}
                                                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${visitor.visit_time === slot
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        {slot}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-gray-500 font-bold">Visit Date</label>
                                        <input
                                            type="date"
                                            value={visitor.visit_date || resolvedDefaultVisitDate}
                                            onChange={(e) => updateVisitor(visitor.id, 'visit_date', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="pt-2 border-t border-gray-200">
                                        <MultiImageUpload
                                            values={visitor.images || []}
                                            onChange={(urls: string[]) => updateVisitor(visitor.id, 'images', urls)}
                                            folder={folderPath}
                                            label="Visitor Card Photos"
                                            description="Upload Front & Back of Card (and Sketch)"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={visitor.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 relative">
                                    <User size={24} />
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-bold text-gray-900 text-base">{visitor.name || 'Unnamed Visitor'}</h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {isComplete ? 'READY' : 'DRAFT'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-500 font-medium flex-wrap">
                                        <span className="flex items-center gap-1.5">
                                            <CalendarDays size={14} className="text-gray-400" />
                                            {visitor.visit_date || resolvedDefaultVisitDate}
                                        </span>
                                        <span className="text-gray-300">|</span>
                                        <span className="flex items-center gap-1.5">
                                            <Clock3 size={14} className="text-gray-400" />
                                            {visitor.visit_time}
                                        </span>
                                        <span className="text-gray-300">|</span>
                                        <span>{visitor.contact || 'No contact'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                        <span>{visitor.gender}</span>
                                        <span>|</span>
                                        <span>{visitor.marital_status}</span>
                                        {visitor.church_name && (
                                            <>
                                                <span>|</span>
                                                <span>{visitor.church_name}</span>
                                            </>
                                        )}
                                        {visitor.invited_by && (
                                            <>
                                                <span>|</span>
                                                <span>Invited by {visitor.invited_by}</span>
                                            </>
                                        )}
                                    </div>
                                    {contextLabel && (
                                        <p className="text-[11px] font-semibold text-blue-700">{contextLabel}</p>
                                    )}
                                    {!isComplete && (
                                        <p className="text-[11px] font-semibold text-amber-700">
                                            Required: Name and Date of Birth.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 border-t border-gray-100 md:border-0 pt-3 md:pt-0">
                                <button type="button" onClick={() => setEditingId(visitor.id)} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800">
                                    <Edit3 size={16} /> Edit
                                </button>
                                <button type="button" onClick={() => removeVisitor(visitor.id)} className="flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-700">
                                    <Trash2 size={16} /> Remove
                                </button>
                            </div>
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={addVisitor}
                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-3 text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 transition-colors group font-bold text-sm"
                >
                    <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center group-hover:bg-gray-500 transition-colors">
                        <Plus size={14} />
                    </div>
                    Add another visitor card
                </button>
            </div>

            <div className="bg-gray-50 border-t border-gray-100 p-3 text-center">
                <p className="text-xs font-medium text-gray-500 flex items-center justify-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-[10px]">i</span>
                    Fill card fields and upload front/back (plus sketch image if available)
                </p>
            </div>
        </div>
    );
};

export default QuickVisitorRegistration;
