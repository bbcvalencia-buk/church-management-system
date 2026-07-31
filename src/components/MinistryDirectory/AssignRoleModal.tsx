import React from 'react';
import { X, Shield, Save } from 'lucide-react';
import { CATEGORIES } from './utils';

interface AssignRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: any;
  setForm: (val: any) => void;
  selectedMembers: any[];
  setSelectedMembers: (val: any[] | ((prev: any[]) => any[])) => void;
  memberSearchTerm: string;
  setMemberSearchTerm: (val: string) => void;
  filteredMembers: any[];
  members: any[];
  submitting: boolean;
  handleSave: () => void;
}

const AssignRoleModal: React.FC<AssignRoleModalProps> = ({
  isOpen,
  onClose,
  form,
  setForm,
  selectedMembers,
  setSelectedMembers,
  memberSearchTerm,
  setMemberSearchTerm,
  filteredMembers,
  members,
  submitting,
  handleSave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:left-64 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg p-5 sm:p-8 relative animate-in zoom-in-95 duration-200 border border-gray-100 mx-2 sm:mx-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 p-2 bg-gray-100 hover:bg-gray-200 rounded-none transition-colors"
          title="Close (Esc)"
        >
          <X size={24} strokeWidth={2.5} />
        </button>

        <h2 className="text-[20px] font-bold text-gray-900 flex items-center gap-2 mb-6">
          <Shield className="text-[var(--color-text-main)]" size={24} />
          {form.id ? 'Edit Role Assignment' : 'Assign Church Role'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-6">
          <div className="space-y-1.5 relative col-span-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Members & Specific Roles</label>

            {selectedMembers.length > 0 && (
              <div className="flex flex-col gap-3 pb-3">
                {selectedMembers.map(m => (
                  <div key={m.id} className="bg-gray-50 border border-gray-100 rounded-none p-3 flex flex-col gap-2 relative group hover:border-[var(--color-primary-light)] transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 text-[13px] font-bold">
                        {m.first_name} {m.surname} {m.member_number && <span className="text-indigo-600 ml-2 font-mono text-[11px]">{m.member_number}</span>}
                      </span>
                      <X size={16} className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors" onClick={() => setSelectedMembers((sm: any[]) => sm.filter((x: any) => x.id !== m.id))} />
                    </div>
                    <input
                      type="text"
                      placeholder="Specific Role (e.g. Flutist, Teacher, Soprano)"
                      value={m.custom_role || ''}
                      onChange={(e) => setSelectedMembers((sm: any[]) => sm.map((x: any) => x.id === m.id ? { ...x, custom_role: e.target.value } : x))}
                      className="w-full bg-white border border-gray-200 rounded-none p-2.5 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-gray-400"
                    />
                  </div>
                ))}
              </div>
            )}

            <input
              type="text"
              placeholder="Search to add members..."
              value={memberSearchTerm}
              onChange={(e) => setMemberSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-none p-3 text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] shadow-sm transition-all outline-none font-semibold text-sm"
            />

            {memberSearchTerm && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-none shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden max-h-48 overflow-y-auto">
                {filteredMembers.map(m => {
                  const isSelected = selectedMembers.some(sm => sm.id === m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (!isSelected) {
                          if (form.id) setSelectedMembers([{ ...m, custom_role: '' }]);
                          else setSelectedMembers([...selectedMembers, { ...m, custom_role: '' }]);
                        }
                        setMemberSearchTerm('');
                      }}
                      className={`w-full text-left p-3 text-sm font-semibold border-b border-gray-50 last:border-0 transition-colors ${isSelected ? 'bg-gray-100 text-gray-400 cursor-default' : 'hover:bg-gray-50'}`}
                    >
                      {m.first_name} {m.surname} {m.member_number && <span className="text-indigo-600 italic text-[11px] ml-1">({m.member_number})</span>} {isSelected && <span className="float-right text-[var(--color-primary)]">Added</span>}
                    </button>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <div className="p-3 text-sm text-gray-500 border-b border-gray-100 font-medium">
                    {members.length === 0
                      ? "No members in the registry yet."
                      : "No members found."}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5 col-span-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Ministry Group / Department</label>
            <input
              type="text"
              placeholder="e.g. Sunday School Children, Mini Ensemble"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full bg-white border border-gray-200 rounded-none p-3 text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] shadow-sm transition-all outline-none font-semibold text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
            <select
              value={form.position_category}
              onChange={(e) => setForm({ ...form, position_category: e.target.value })}
              className="w-full bg-white border border-gray-200 rounded-none p-3 text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] shadow-sm transition-all outline-none font-semibold text-sm"
            >
              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 col-span-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Schedule / Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Sundays at 9:00 AM, Meets in Sanctuary, Weekly Server"
              value={form.assignment_reason}
              onChange={(e) => setForm({ ...form, assignment_reason: e.target.value })}
              className="w-full bg-white border border-gray-200 rounded-none p-3 text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] shadow-sm transition-all outline-none font-semibold text-sm"
            />
          </div>
        </div>

        <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 rounded-none shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || selectedMembers.length === 0 || selectedMembers.some(m => !m.custom_role)}
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-none shadow-md text-sm font-bold hover:bg-[var(--color-primary-dark)] flex items-center gap-2 transition-transform disabled:opacity-50 hover:-translate-y-0.5"
          >
            <Save size={16} /> {submitting ? 'Saving...' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignRoleModal;
