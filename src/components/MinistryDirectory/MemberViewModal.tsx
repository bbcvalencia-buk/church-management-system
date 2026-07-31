import React from 'react';
import { X, User, Star, Activity, Phone, Shield, Music, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MemberViewModalProps {
  viewingMember: any;
  setViewingMember: (val: any) => void;
  memberServiceHistory: any[];
  memberMusicHistory: any[];
  attendanceRates: Record<string, { count: number; rate: string; total: number }>;
}

const MemberViewModal: React.FC<MemberViewModalProps> = ({
  viewingMember,
  setViewingMember,
  memberServiceHistory,
  memberMusicHistory,
  attendanceRates
}) => {
  if (!viewingMember) return null;

  return (
    <div className="fixed inset-0 z-50 lg:left-64 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={() => setViewingMember(null)}>
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden relative animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setViewingMember(null)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 p-2 bg-gray-100/50 backdrop-blur-sm hover:bg-gray-200 rounded-full transition-all z-20"
          title="Close (Esc)"
        >
          <X size={24} strokeWidth={2.5} />
        </button>

        {/* Header / Hero */}
        <div className="pt-8 pb-6 px-6 bg-gradient-to-b from-blue-50/50 to-white flex flex-col items-center border-b border-gray-100">
          <div className="relative mb-4">
            {viewingMember.profile_picture_url ? (
              <img
                src={viewingMember.profile_picture_url}
                alt={`${viewingMember.first_name}`}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shadow-lg border-4 border-white"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-lg">
                <User size={40} className="text-blue-500" />
              </div>
            )}
            {viewingMember.full_pos?.is_ministry_head && (
              <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-1.5 rounded-full border-4 border-white shadow-sm" title="Ministry Head">
                <Star size={16} className="fill-current" />
              </div>
            )}
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-1 leading-tight text-center">
            {viewingMember.first_name} {viewingMember.surname}
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {viewingMember.member_number && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100/50 px-2.5 py-1 rounded-md text-[11px] font-black tracking-widest font-mono shadow-sm">
                {viewingMember.member_number}
              </span>
            )}
            {viewingMember.specific_role && (
              <span className="bg-blue-50 text-blue-700 border border-blue-100/50 px-2.5 py-1 rounded-md text-[11px] font-black tracking-widest uppercase shadow-sm">
                {viewingMember.full_pos?.is_ministry_head ? `HEAD - ${viewingMember.specific_role}` : viewingMember.specific_role}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-6 py-6 custom-scrollbar flex-1 bg-[#F9FAFB]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Left Column: Quick Stats */}
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Activity size={12} /> Attendance Rate
                </h4>
                {attendanceRates[viewingMember.id] ? (
                  <div>
                    <div className="text-3xl font-black text-gray-900 leading-none mb-1">
                      {attendanceRates[viewingMember.id].rate}
                    </div>
                    <p className="text-[11px] font-bold text-gray-500">
                      {attendanceRates[viewingMember.id].count} of {attendanceRates[viewingMember.id].total} Services
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-gray-400 italic">No attendance data yet</p>
                )}
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Phone size={12} /> Contact Info
                </h4>
                {viewingMember.phone_number ? (
                  <a href={`tel:${viewingMember.phone_number}`} className="text-sm font-bold text-gray-900 hover:text-blue-600 truncate block">
                    {viewingMember.phone_number}
                  </a>
                ) : (
                  <p className="text-xs font-bold text-gray-400 italic">No phone on record</p>
                )}
              </div>
            </div>

            {/* Right Column: Service History & Music Practice History */}
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Shield size={12} /> Recent Service Roles
                </h4>
                <div className="flex-1 space-y-3">
                  {memberServiceHistory.length > 0 ? (
                    memberServiceHistory.map(history => (
                      <div key={history.id} className="relative pl-3 border-l-2 border-blue-100">
                        <p className="text-xs font-bold text-gray-900 capitalize leading-tight">
                          {history.role.replace('_', ' ')}
                          {history.notes && <span className="text-gray-400 font-normal"> - {history.notes}</span>}
                        </p>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase mt-0.5">
                          {new Date(history.services?.service_date).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-gray-400 italic py-2">No recent service assignments</p>
                  )}
                </div>
              </div>

              {viewingMember?.full_pos?.position_category === 'music_ministry' && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Music size={12} /> Practice Attendance
                  </h4>
                  <div className="flex-1 space-y-3">
                    {memberMusicHistory.length > 0 ? (
                      memberMusicHistory.map(practice => (
                        <div key={practice.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="font-semibold text-gray-900 text-xs">{new Date(practice.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">{practice.name.replace('_', ' ')}</p>
                          </div>
                          <div>
                            {practice.present ? (
                              <span className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shadow-sm">Present</span>
                            ) : (
                              <span className="bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shadow-sm">Absent</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs font-bold text-gray-400 italic py-2">No practice history</p>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-100">
          <Link
            to={`/members/${viewingMember.id}`}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors shadow-sm active:scale-[0.98]"
          >
            <Eye size={16} /> View Full Profile
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MemberViewModal;
