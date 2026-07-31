import React from 'react';
import type { ActivityRecord } from './types';
import { Activity, User, BookOpen, UserCheck, Repeat, Megaphone, Heart, ExternalLink, Upload } from 'lucide-react';
import MemberAttendancePicker from "@/components/MemberAttendancePicker";

interface ActivityFormModalProps {
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
    form: Partial<ActivityRecord>;
    setForm: (form: Partial<ActivityRecord>) => void;
    members: any[];
    visitors: any[];
    selectedMemberIds: string[];
    setSelectedMemberIds: (ids: string[]) => void;
    tardyMemberIds: string[];
    setTardyMemberIds: (ids: string[]) => void;
    memberSearchTerm: string;
    setMemberSearchTerm: (term: string) => void;
    attachmentFile: File | null;
    setAttachmentFile: (file: File | null) => void;
    saving: boolean;
    handleSave: () => void;
    setConfirmDelete: (state: { isOpen: boolean; id: string | null }) => void;
}

export const ActivityFormModal: React.FC<ActivityFormModalProps> = ({
    isModalOpen,
    setIsModalOpen,
    form,
    setForm,
    members,
    visitors,
    selectedMemberIds,
    setSelectedMemberIds,
    tardyMemberIds,
    setTardyMemberIds,
    memberSearchTerm,
    setMemberSearchTerm,
    attachmentFile,
    setAttachmentFile,
    saving,
    handleSave,
    setConfirmDelete
}) => {
    if (!isModalOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-none shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Body */}
                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    <h2 className="text-xl font-bold flex items-center gap-3 text-gray-900 border-b border-gray-100 pb-4">
                        <Activity size={24} className="text-[var(--color-text-main)]" />
                        {form.id ? 'Edit Activity Record' : 'File New Report'}
                    </h2>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Type</label>
                            <select
                                value={form.activity_type}
                                onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                            >
                                <option value="soul_winning">Soul Winning</option>
                                <option value="bible_study">Bible Study</option>
                                <option value="outreach">Outreach</option>
                                <option value="visitation">Visitation</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date</label>
                            <input
                                type="date"
                                value={form.activity_date}
                                onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {form.activity_type === 'bible_study' && (
                        <div className="space-y-6 bg-gray-50/30 p-4 rounded-none border border-[var(--color-primary-light)]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        <User size={14} className="text-[var(--color-primary)]" /> Student / Contact
                                    </label>
                                    <div className="space-y-2">
                                        <select
                                            value={form.activity_data?.student_member_id || ''}
                                            onChange={(e) => {
                                                const member = members.find(m => m.id === e.target.value);
                                                setForm({
                                                    ...form,
                                                    activity_data: {
                                                        ...(form.activity_data || {}),
                                                        student_member_id: e.target.value,
                                                        student_name: member ? `${member.first_name} ${member.surname}` : (form.activity_data?.student_name || '')
                                                    }
                                                });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        >
                                            <option value="">-- Select Member --</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>{m.surname}, {m.first_name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="OR Free text name"
                                            value={form.activity_data?.student_name || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: {
                                                    ...(form.activity_data || {}),
                                                    student_name: e.target.value,
                                                    student_member_id: '' // Clear if typing manually
                                                }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        <BookOpen size={14} className="text-[var(--color-primary)]" /> Study Details
                                    </label>
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Book / Course being studied"
                                            value={form.activity_data?.book || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), book: e.target.value }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Session e.g. Session 3 of 12"
                                            value={form.activity_data?.session_number || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), session_number: e.target.value }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        />

                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        Format (Multi-select)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Individual', 'Family', 'Online', 'Face-to-Face'].map(fmt => (
                                            <button
                                                key={fmt}
                                                onClick={() => {
                                                    const current = form.activity_data?.format || [];
                                                    const next = current.includes(fmt)
                                                        ? current.filter((f: string) => f !== fmt)
                                                        : [...current, fmt];
                                                    setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), format: next }
                                                    });
                                                }}
                                                className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all ${form.activity_data?.format?.includes(fmt)
                                                    ? 'bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] text-[var(--color-text-main)] shadow-md'
                                                    : 'bg-white text-gray-500 border border-gray-200 hover:border-[var(--color-primary)]'
                                                    }`}
                                            >
                                                {fmt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {form.activity_data?.format?.includes('Family') && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Family Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Santos Family"
                                            value={form.activity_data?.family_name || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), family_name: e.target.value }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {form.activity_type === 'visitation' && (
                        <div className="space-y-6 bg-[var(--color-primary-light)]/30 p-4 rounded-none border border-[var(--color-primary-light)]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        <UserCheck size={14} className="text-[var(--color-primary)]" /> Who was visited?
                                    </label>
                                    <div className="space-y-2">
                                        <select
                                            value={form.activity_data?.visited_member_id || ''}
                                            onChange={(e) => {
                                                const member = members.find(m => m.id === e.target.value);
                                                setForm({
                                                    ...form,
                                                    activity_data: {
                                                        ...(form.activity_data || {}),
                                                        visited_member_id: e.target.value,
                                                        visited_visitor_id: '',
                                                        visited_name: member ? `${member.first_name} ${member.surname}` : (form.activity_data?.visited_name || '')
                                                    }
                                                });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        >
                                            <option value="">-- Member --</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>{m.surname}, {m.first_name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={form.activity_data?.visited_visitor_id || ''}
                                            onChange={(e) => {
                                                const visitor = visitors.find(v => v.id === e.target.value);
                                                setForm({
                                                    ...form,
                                                    activity_data: {
                                                        ...(form.activity_data || {}),
                                                        visited_visitor_id: e.target.value,
                                                        visited_member_id: '',
                                                        visited_name: visitor ? visitor.name : (form.activity_data?.visited_name || '')
                                                    }
                                                });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        >
                                            <option value="">-- Or Visitor --</option>
                                            {visitors.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="OR Enter Name Manually"
                                            value={form.activity_data?.visited_name || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: {
                                                    ...(form.activity_data || {}),
                                                    visited_name: e.target.value,
                                                    visited_member_id: '',
                                                    visited_visitor_id: ''
                                                }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        <Repeat size={14} className="text-[var(--color-primary)]" /> Visitation Reason
                                    </label>
                                    <div className="space-y-4">
                                        <select
                                            value={form.activity_data?.reason || 'follow-up'}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), reason: e.target.value }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                        >
                                            <option value="follow-up">Follow-up</option>
                                            <option value="hospital-visit">Hospital Visit</option>
                                            <option value="home-visit">Home Visit</option>
                                            <option value="first-time-contact">First-time Contact</option>
                                        </select>
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-none border border-gray-200">
                                            <input
                                                type="checkbox"
                                                id="first_visit"
                                                checked={!!form.activity_data?.first_visit}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    activity_data: { ...(form.activity_data || {}), first_visit: e.target.checked }
                                                })}
                                                className="w-4 h-4 text-[var(--color-primary)] bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                                            />
                                            <label htmlFor="first_visit" className="text-sm font-medium text-gray-700 select-none">First time visiting church?</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {form.activity_type === 'outreach' && (
                        <div className="space-y-6 bg-green-50/30 p-4 rounded-none border border-green-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <Megaphone size={14} className="text-green-600" /> Event Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Community Health Fair"
                                            value={form.activity_data?.event_name || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), event_name: e.target.value }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Partner Organizations</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Red Cross, Local LGU"
                                            value={form.activity_data?.partners || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), partners: e.target.value }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Total People Reached</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={form.activity_data?.people_reached || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), people_reached: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Follow-up Actions Planned</label>
                                        <textarea
                                            rows={2}
                                            placeholder="e.g. Distribute relief goods next week"
                                            value={form.activity_data?.followup_actions || ''}
                                            onChange={(e) => setForm({
                                                ...form,
                                                activity_data: { ...(form.activity_data || {}), followup_actions: e.target.value }
                                            })}
                                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 font-sans">Mission Church Name (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Laguitas Mission"
                                    value={form.mission_church_name || ''}
                                    onChange={(e) => setForm({ ...form, mission_church_name: e.target.value })}
                                    className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Location / Area</label>
                        <input
                            type="text"
                            placeholder="e.g. Purok 5, Bagontaas"
                            value={form.area || ''}
                            onChange={(e) => setForm({ ...form, area: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-none p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                        />
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
                        {(form.activity_type === 'soul_winning' || form.activity_type === 'outreach') ? (
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Total Tracts Distributed</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.tracts_distributed || ''}
                                    onChange={(e) => setForm({ ...form, tracts_distributed: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-white border border-gray-200 rounded-none p-3 text-center text-xl font-bold text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                />
                            </div>
                        ) : (
                            <div className="hidden md:block" />
                        )}

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Souls Saved</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Heart size={16} className="text-red-400" />
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.souls_saved || ''}
                                    onChange={(e) => setForm({ ...form, souls_saved: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-white border border-gray-200 rounded-none pl-10 p-3 text-xl font-bold text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Non-Member Attendees</label>
                            <input
                                type="number"
                                min="0"
                                value={form.non_member_attendance || ''}
                                onChange={(e) => setForm({ ...form, non_member_attendance: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white border border-gray-200 rounded-none p-3 text-center text-xl font-bold text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-gray-100">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Facebook Post Link</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <ExternalLink size={16} className="text-gray-400" />
                            </div>
                            <input
                                type="url"
                                placeholder="https://facebook.com/..."
                                value={form.facebook_post_link || ''}
                                onChange={(e) => setForm({ ...form, facebook_post_link: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-none pl-10 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Attachment Section */}
                    <div className="space-y-4 pt-6 border-t border-gray-100">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Attachment / Sketch</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-none p-8 text-center hover:bg-gray-50 hover:border-[var(--color-primary)] transition-colors cursor-pointer relative overflow-hidden group">
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) setAttachmentFile(e.target.files[0]);
                                }}
                            />
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="p-3 bg-gray-50 text-[var(--color-primary)] rounded-none mb-3 group-hover:scale-110 transition-transform">
                                    <Upload size={24} />
                                </div>
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                    {attachmentFile ? attachmentFile.name : (form.attachment_url ? "Replace file" : "Upload a file")} <span className="text-gray-500 font-normal">or drag and drop</span>
                                </p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">PNG, JPG, PDF up to 10MB</p>
                            </div>

                            {form.attachment_url && !attachmentFile && (
                                <a
                                    href={form.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="absolute top-4 right-4 p-2 bg-[var(--color-primary-light)] rounded-none hover:bg-[var(--color-primary-light)] text-[var(--color-primary)] transition-colors z-30"
                                    title="View Attachment"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExternalLink size={16} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Attendance Section */}
                    <div className="space-y-4 pt-6 border-t border-gray-100">
                        <MemberAttendancePicker
                            label="Mark Attendance"
                            members={members}
                            selectedIds={selectedMemberIds}
                            onChange={setSelectedMemberIds}
                            tardyIds={tardyMemberIds}
                            onTardyChange={setTardyMemberIds}
                            searchTerm={memberSearchTerm}
                            onSearchTermChange={setMemberSearchTerm}
                            maxHeightClass="max-h-[150px]"
                        />
                    </div>
                </div>

                {/* Sticky Footer */}
                <div className="bg-[#1e2333] p-4 px-6 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] relative z-10 transition-colors">
                    <div className="flex gap-2">
                        {form.id && (
                            <button
                                onClick={() => setConfirmDelete({ isOpen: true, id: form.id! })}
                                className="px-4 py-2 rounded-none text-red-400 hover:bg-red-400/10 transition-colors text-xs font-bold uppercase tracking-widest"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4 items-center">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="text-sm font-medium text-gray-300 hover:text-[var(--color-text-main)] transition-colors py-2 px-4"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] shadow-[0_4px_12px_rgba(37,99,235,0.2)] rounded-none px-8 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : (form.id ? 'Save Changes' : 'Submit Report')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
