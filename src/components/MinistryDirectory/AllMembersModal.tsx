import React from 'react';
import { Search, X, User, Eye, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PartialMember } from './types';

interface AllMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: any[];
  allMembersSearch: string;
  setAllMembersSearch: (val: string) => void;
  filteredAllMembers: any[];
  handleViewMember: (m: any) => void;
}

const AllMembersModal: React.FC<AllMembersModalProps> = ({
  isOpen,
  onClose,
  members,
  allMembersSearch,
  setAllMembersSearch,
  filteredAllMembers,
  handleViewMember
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:left-64 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg p-4 sm:p-6 relative animate-in zoom-in-95 duration-200 border border-gray-100 mx-2 sm:mx-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10" title="Close (Esc)">
          <X size={24} strokeWidth={2.5} />
        </button>
        <h2 className="text-[20px] font-bold text-gray-900 mb-1">All Members</h2>
        <p className="text-sm text-gray-500 mb-5 font-medium">{members.length} member{members.length !== 1 ? 's' : ''} in the church registry.</p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} strokeWidth={2.5} />
          <input
            type="text"
            value={allMembersSearch}
            onChange={(e) => setAllMembersSearch(e.target.value)}
            placeholder="Search member name..."
            className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
          {filteredAllMembers.map((m) => (
            <button key={m.id} onClick={(e) => { e.preventDefault(); onClose(); handleViewMember({ ...m, specific_role: m.member_number ? 'Member' : 'Member' }); }} className="w-full flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center gap-3">
                {m.profile_picture_url ? (
                  <img src={m.profile_picture_url} alt={`${m.first_name} ${m.surname}`} className="w-9 h-9 rounded-full object-cover shadow-sm bg-white" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <User size={16} className="text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900">{m.first_name} {m.surname}</p>
                  {m.member_number && (
                    <p className="text-[10px] font-bold text-indigo-600 tracking-tight">{m.member_number}</p>
                  )}
                </div>
              </div>
              <Eye size={15} className="text-blue-600" />
            </button>
          ))}
          {filteredAllMembers.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm font-semibold border-2 border-dashed border-gray-100 rounded-xl">
              No members match your search.
            </div>
          )}
        </div>

        <Link to="/members" onClick={onClose} className="w-full mt-5 py-3.5 border border-blue-200 rounded-xl text-blue-700 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
          <Users size={16} /> Open Full Members Directory
        </Link>
      </div>
    </div>
  );
};

export default AllMembersModal;
