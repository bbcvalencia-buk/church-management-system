import React from 'react';
import { X, User, Star, Shield, Plus } from 'lucide-react';
import { sortGroupMembers } from './utils';

interface ManageGroupModalProps {
  manageGroup: any;
  setManageGroup: (val: any) => void;
  groupDraftName: string;
  setGroupDraftName: (val: string) => void;
  groupDraftSchedule: string;
  setGroupDraftSchedule: (val: string) => void;
  handleUpdateGroupMeta: () => void;
  savingGroupMeta: boolean;
  savingHeadAssignmentId: string | null;
  handleSetGroupHead: (assignment: any) => void;
  handleOpenModal: (groupName?: string | null, posToEdit?: any) => void;
  setConfirmRemove: (val: { isOpen: boolean; assignment: any }) => void;
  handleViewMember: (m: any) => void;
  musicAttendanceRates: Record<string, Record<string, { count: number; rate: string; total: number }>>;
  attendanceRates: Record<string, { count: number; rate: string; total: number }>;
}

const ManageGroupModal: React.FC<ManageGroupModalProps> = ({
  manageGroup,
  setManageGroup,
  groupDraftName,
  setGroupDraftName,
  groupDraftSchedule,
  setGroupDraftSchedule,
  handleUpdateGroupMeta,
  savingGroupMeta,
  savingHeadAssignmentId,
  handleSetGroupHead,
  handleOpenModal,
  setConfirmRemove,
  handleViewMember,
  musicAttendanceRates,
  attendanceRates
}) => {
  if (!manageGroup) return null;

  return (
    <div className="fixed inset-0 z-50 lg:left-64 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={() => setManageGroup(null)}>
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg p-4 sm:p-6 relative animate-in zoom-in-95 duration-200 border border-gray-100 mx-2 sm:mx-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setManageGroup(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10" title="Close (Esc)">
          <X size={24} strokeWidth={2.5} />
        </button>
        <h2 className="text-[20px] font-bold text-gray-900 mb-2">{manageGroup.name} Members</h2>
        <p className="text-sm text-gray-500 mb-6 font-medium">Manage roles and members within this ministry.</p>

        <div className="space-y-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Ministry Name</label>
            <input
              type="text"
              value={groupDraftName}
              onChange={(e) => setGroupDraftName(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Schedule / Notes</label>
            <input
              type="text"
              value={groupDraftSchedule}
              onChange={(e) => setGroupDraftSchedule(e.target.value)}
              placeholder="e.g. Sunday 8:30"
              className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
            />
          </div>
          <button
            onClick={handleUpdateGroupMeta}
            disabled={savingGroupMeta || !groupDraftName.trim()}
            className="w-full py-3 bg-[#2563eb] text-white rounded-xl shadow-md text-sm font-bold hover:bg-[#1d4ed8] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingGroupMeta ? 'Saving Ministry Details...' : 'Save Ministry Name & Schedule'}
          </button>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {sortGroupMembers(manageGroup.members).map((m: any) => (
            <div key={m.full_pos.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                {m.profile_picture_url ? (
                  <img src={m.profile_picture_url} className="w-10 h-10 rounded-full object-cover shadow-sm bg-white" alt="Profile" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200"><User size={18} className="text-gray-500" /></div>
                )}
                <div>
                  <button onClick={(e) => { e.preventDefault(); setManageGroup(null); handleViewMember(m); }} className="text-[13px] font-bold text-gray-900 hover:text-blue-600 transition-colors text-left">{m.first_name} {m.surname}</button>
                  {m.member_number && (
                    <p className="text-[9px] font-bold text-indigo-600 tracking-tight">{m.member_number}</p>
                  )}
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-0.5">
                    {m.specific_role}
                    {m.full_pos?.is_ministry_head && <span className="ml-2 text-amber-600">HEAD</span>}
                  </p>
                  {manageGroup.category === 'music_ministry' ? (() => {
                    const memberMusicRates = musicAttendanceRates[m.id];
                    let bestRateObj = null;
                    if (memberMusicRates) {
                      const types = Object.keys(memberMusicRates);
                      const groupNameLower = manageGroup.name.toLowerCase();
                      let bestMatch = types.find(t => groupNameLower.includes(t.toLowerCase()) || t.toLowerCase().includes(groupNameLower));

                      if (bestMatch) {
                        bestRateObj = memberMusicRates[bestMatch];
                      } else if (types.length > 0) {
                        bestRateObj = memberMusicRates[types.reduce((a, b) => memberMusicRates[a].count > memberMusicRates[b].count ? a : b)];
                      }
                    }

                    return bestRateObj && (
                      <div className="mt-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap ${Number(bestRateObj.rate.replace('%', '')) >= 75
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : Number(bestRateObj.rate.replace('%', '')) >= 50
                            ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                          }`} title={`Attended ${bestRateObj.count} of ${bestRateObj.total} music practices`}>
                          {bestRateObj.rate} Attendance
                        </span>
                      </div>
                    );
                  })() : (
                    attendanceRates[m.id] && (
                      <div className="mt-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap ${Number(attendanceRates[m.id].rate.replace('%', '')) >= 80
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : Number(attendanceRates[m.id].rate.replace('%', '')) >= 50
                            ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                          }`} title={`Attended ${attendanceRates[m.id].count} out of ${attendanceRates[m.id].total} services`}>
                          {attendanceRates[m.id].rate} Attendance
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSetGroupHead(m)}
                  disabled={savingHeadAssignmentId === m.full_pos.id}
                  className={`p-2 rounded-xl transition-colors ${m.full_pos?.is_ministry_head ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'} disabled:opacity-60 disabled:cursor-not-allowed`}
                  title={m.full_pos?.is_ministry_head ? 'Remove as Ministry Head' : 'Set as Ministry Head'}
                >
                  <Star size={16} className={m.full_pos?.is_ministry_head ? 'fill-current' : ''} />
                </button>
                <button onClick={() => { setManageGroup(null); handleOpenModal(null, m.full_pos); }} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
                  <Shield size={16} />
                </button>
                <button onClick={() => { setManageGroup(null); setConfirmRemove({ isOpen: true, assignment: m.full_pos }); }} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
          {manageGroup.members.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm font-semibold border-2 border-dashed border-gray-100 rounded-xl">No members in this group yet.</div>
          )}
        </div>

        <button onClick={() => { setManageGroup(null); handleOpenModal(manageGroup.name); }} className="w-full mt-6 py-3.5 border-2 border-dashed border-gray-200 rounded-xl text-blue-600 font-bold hover:bg-blue-50/50 hover:border-blue-300 transition-all flex items-center justify-center gap-2">
          <Plus size={16} strokeWidth={2.5} /> Add Member to Group
        </button>
      </div>
    </div>
  );
};

export default ManageGroupModal;
