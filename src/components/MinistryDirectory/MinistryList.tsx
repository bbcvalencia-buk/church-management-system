import React from 'react';
import { MoreHorizontal, User, Calendar, Eye, Users } from 'lucide-react';
import { getCategoryStyle } from './utils';

interface MinistryListProps {
  groups: any[];
  openManageGroup: (group: any) => void;
  handleViewMember: (m: any) => void;
  attendanceRates: Record<string, { count: number; rate: string; total: number }>;
  participationRates: Record<string, number>;
  musicAttendanceRates: Record<string, Record<string, { count: number; rate: string; total: number }>>;
  setAllMembersOpen: (val: boolean) => void;
  membersLength: number;
}

const MinistryList: React.FC<MinistryListProps> = ({
  groups,
  openManageGroup,
  handleViewMember,
  attendanceRates,
  participationRates,
  musicAttendanceRates,
  setAllMembersOpen,
  membersLength
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {groups.map((group: any) => {
        const style = getCategoryStyle(group.category);
        const previewMembers = group.members.slice(0, 3);

        return (
          <div key={group.name} onClick={() => openManageGroup(group)} className="bg-white rounded-[24px] border border-gray-200 overflow-hidden shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] flex flex-col transition-all hover:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.06)] group cursor-pointer relative">
            {/* Top Card Section */}
            <div className={`${style.bg} px-6 pt-5 pb-8 relative`}>
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${style.text}`}>
                  {group.categoryLabel}
                </span>
                <button onClick={(e) => { e.stopPropagation(); openManageGroup(group); }} className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={18} /></button>
              </div>
              <h3 className="text-[22px] font-serif font-extrabold text-[#111827] mt-3 pr-4 leading-tight">
                {group.name}
              </h3>
            </div>

            {/* Bottom Card Section */}
            <div className="px-6 pb-6 pt-6 flex-1 flex flex-col bg-white rounded-t-[20px] -mt-4 relative">
              <div className="space-y-3 mb-6">
                {previewMembers.map((preview: any, idx: number) => (
                  <div key={`${preview.id}-${idx}`} className="flex items-center gap-3">
                    {preview.profile_picture_url ? (
                      <img src={preview.profile_picture_url} alt={`${preview.first_name} ${preview.surname}`} className="w-9 h-9 rounded-none object-cover shadow-sm bg-gray-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-none bg-gray-100 border border-gray-200 flex items-center justify-center shadow-sm">
                        <User size={16} className="text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">
                        {preview.full_pos?.is_ministry_head ? `Head - ${preview.specific_role || 'Member'}` : (preview.specific_role || 'Member')}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewMember(preview); }} className="text-sm font-bold text-gray-900 hover:text-[var(--color-text-main)] transition-colors truncate text-left">
                          {preview.first_name} {preview.surname}
                        </button>

                        {/* Attendance Badge */}
                        {group.category === 'music_ministry' ? (() => {
                          const memberMusicRates = musicAttendanceRates[preview.id];
                          let bestRateObj = null;
                          if (memberMusicRates) {
                            const types = Object.keys(memberMusicRates);
                            const groupNameLower = group.name.toLowerCase();
                            let bestMatch = types.find(t => groupNameLower.includes(t.toLowerCase()) || t.toLowerCase().includes(groupNameLower));

                            if (bestMatch) {
                              bestRateObj = memberMusicRates[bestMatch];
                            } else if (types.length > 0) {
                              bestRateObj = memberMusicRates[types.reduce((a, b) => memberMusicRates[a].count > memberMusicRates[b].count ? a : b)];
                            }
                          }

                          return bestRateObj && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap ${Number(bestRateObj.rate.replace('%', '')) >= 75
                              ? 'bg-green-50 text-green-800 border-green-200'
                              : Number(bestRateObj.rate.replace('%', '')) >= 50
                                ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                              }`} title={`Attended ${bestRateObj.count} of ${bestRateObj.total} music practices`}>
                              {bestRateObj.rate} Attendance
                            </span>
                          );
                        })() : (
                          attendanceRates[preview.id] && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap ${Number(attendanceRates[preview.id].rate.replace('%', '')) >= 80
                              ? 'bg-green-50 text-green-800 border-green-200'
                              : Number(attendanceRates[preview.id].rate.replace('%', '')) >= 50
                                ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                              }`} title={`Attended ${attendanceRates[preview.id].count} out of ${attendanceRates[preview.id].total} services`}>
                              {attendanceRates[preview.id].rate} Attendance
                            </span>
                          )
                        )}

                        {participationRates[preview.id] && (
                          <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100/50 shadow-sm whitespace-nowrap" title="Service Participation Count">
                            {participationRates[preview.id]}x Serviced
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {group.members.length > 3 && (
                  <p className="text-[11px] font-semibold text-gray-500 pl-12">+{group.members.length - 3} more position{group.members.length - 3 !== 1 ? 's' : ''}</p>
                )}
                {group.members.length === 0 && (
                  <p className="text-sm font-semibold text-gray-500">No members assigned yet.</p>
                )}
              </div>

              <div className="mt-auto">
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Calendar size={14} />
                    <span className="text-[12px] font-semibold text-gray-600">{group.schedule || 'Schedule Not Set'}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); openManageGroup(group); }} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded text-[var(--color-text-main)] hover:bg-blue-100 transition-colors">
                    <Eye size={12} />
                    <span className="text-[11px] font-bold">View All</span>
                  </button>
                  <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded text-gray-500">
                    <Users size={12} />
                    <span className="text-[11px] font-bold text-gray-600">{group.members.length} Member{group.members.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* View All Members Placeholder Card */}
      <div onClick={() => setAllMembersOpen(true)} className="border border-blue-100 rounded-[28px] overflow-hidden flex flex-col items-center justify-center p-8 bg-gray-50/40 cursor-pointer hover:border-blue-300 hover:bg-gray-50 transition-all min-h-[300px] group shadow-sm">
        <div className="w-14 h-14 bg-white rounded-none flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
          <Users size={24} className="text-[var(--color-text-main)]" />
        </div>
        <h3 className="text-lg font-serif font-extrabold text-[#111827] mb-2 text-center">View All Members</h3>
        <p className="text-xs text-gray-500 text-center leading-relaxed px-4">
          Open a quick roster of every member and jump to any profile.
        </p>
        <div className="mt-4 text-[12px] font-bold text-blue-700 bg-white rounded-none px-3 py-1 border border-blue-100">
          {membersLength} Total Member{membersLength !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

export default MinistryList;
