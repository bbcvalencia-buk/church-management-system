import React from "react";
import { Music } from "lucide-react";
import MemberAttendancePicker from "@/components/MemberAttendancePicker";
import type { PracticeSession, Member } from "@/views/MusicMinistry";

const DEFAULT_PRACTICE_START_TIME = "18:30";
const DEFAULT_PRACTICE_END_TIME = "20:30";

const normalizeTimeInputValue = (value?: string | null, fallback = "") => {
    if (!value) return fallback;
    return value.slice(0, 5);
};

interface Props {
    form: Partial<PracticeSession>;
    setForm: (form: Partial<PracticeSession>) => void;
    formMembers: Member[];
    selectedMemberIds: string[];
    setSelectedMemberIds: (ids: string[]) => void;
    tardyMemberIds: string[];
    setTardyMemberIds: (ids: string[]) => void;
    memberSearchTerm: string;
    setMemberSearchTerm: (term: string) => void;
    hasGroupedRosters: boolean;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
    onDeleteRequest: (id: string) => void;
}

const PracticeFormModal: React.FC<Props> = ({
    form,
    setForm,
    formMembers,
    selectedMemberIds,
    setSelectedMemberIds,
    tardyMemberIds,
    setTardyMemberIds,
    memberSearchTerm,
    setMemberSearchTerm,
    hasGroupedRosters,
    saving,
    onSave,
    onClose,
    onDeleteRequest,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-[500px] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Body */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-4 text-gray-900 border-b border-gray-100 pb-6">
                        <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center text-blue-600">
                            <Music size={20} />
                        </div>
                        {form.id ? 'Edit Practice Record' : 'Log New Practice'}
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Type</label>
                            <div className="relative">
                                <select
                                    value={form.practice_type}
                                    onChange={(e) => setForm({ ...form, practice_type: e.target.value })}
                                    className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                                >
                                    <option value="choir">Choir Practice</option>
                                    <option value="mini_ensemble">Mini Ensemble Practice</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Date</label>
                            <input
                                type="date"
                                value={form.practice_date}
                                onChange={(e) => setForm({ ...form, practice_date: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Start Time</label>
                            <input
                                type="time"
                                value={normalizeTimeInputValue(form.practice_start_time, DEFAULT_PRACTICE_START_TIME)}
                                onChange={(e) => setForm({ ...form, practice_start_time: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">End Time</label>
                            <input
                                type="time"
                                value={normalizeTimeInputValue(form.practice_end_time, DEFAULT_PRACTICE_END_TIME)}
                                onChange={(e) => setForm({ ...form, practice_end_time: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Non-Members</label>
                            <input
                                type="number"
                                min="0"
                                value={form.non_member_attendance || ''}
                                onChange={(e) => setForm({ ...form, non_member_attendance: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white border border-gray-200 rounded-[8px] p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <MemberAttendancePicker
                            label="Mark Attendance"
                            members={formMembers}
                            selectedIds={selectedMemberIds}
                            onChange={setSelectedMemberIds}
                            tardyIds={tardyMemberIds}
                            onTardyChange={setTardyMemberIds}
                            searchTerm={memberSearchTerm}
                            onSearchTermChange={setMemberSearchTerm}
                            maxHeightClass="max-h-[300px]"
                        />
                        {formMembers.length === 0 && hasGroupedRosters && (
                            <p className="text-xs font-semibold text-amber-700 mt-3">
                                No members are assigned to this group yet. Add members in Ministry Directory first.
                            </p>
                        )}
                    </div>
                </div>

                {/* Sticky Footer */}
                <div className="bg-[#1e2333] p-4 px-6 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] relative z-10 transition-colors">
                    <div className="flex gap-2">
                        {form.id && (
                            <button
                                onClick={() => onDeleteRequest(form.id as string)}
                                className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors text-xs font-bold uppercase tracking-widest"
                                title="Delete Record"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4 items-center w-full justify-end">
                        <button
                            onClick={onClose}
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2 px-4"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)] rounded-lg px-8 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : (form.id ? 'Save Changes' : 'Submit Practice')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PracticeFormModal;
