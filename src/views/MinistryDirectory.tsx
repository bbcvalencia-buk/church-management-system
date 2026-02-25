import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { ChurchPosition } from "@/types";
import {
  Shield,
  Music,
  BookOpen,
  Users,
  Activity,
  Search,
  User,
  Plus,
  X,
  Save,
  Calendar,
  Eye,
  Star,
  MoreHorizontal,
  Download,
  MapPin,
  Clock,
  Trash2,
  Edit2
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { Link } from "react-router-dom";
import { exportToCSV } from "@/lib/csv";

interface PartialMember {
  id: string;
  first_name: string;
  surname: string;
  profile_picture_url?: string;
  member_number?: string;
}

interface PositionWithMember extends ChurchPosition {
  members: PartialMember | null;
}

const CATEGORIES = [
  { id: 'all', label: 'All Ministries', icon: Users },
  { id: 'leadership', label: 'Pastoral & Admin', icon: Shield },
  { id: 'music_ministry', label: 'Music & Creatives', icon: Music },
  { id: 'sunday_school_adult', label: 'Sunday School & Ed.', icon: BookOpen },
  { id: 'other_ministries', label: 'Operations & Support', icon: Activity },
];

const CATEGORY_LABELS: Record<string, string> = {
  leadership: 'Pastoral & Admin',
  music_ministry: 'Music & Creatives',
  sunday_school_adult: 'Sunday School & Ed.',
  sunday_school_children: 'Sunday School & Ed.',
  beginners_class: 'Sunday School & Ed.',
  other_ministries: 'Operations & Support',
};

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  sunday_school_children: 'sunday_school_adult',
  beginners_class: 'sunday_school_adult',
};

const normalizeCategory = (category?: string | null) => {
  if (!category) return 'other_ministries';
  return LEGACY_CATEGORY_MAP[category] || category;
};

const getCategoryLabel = (category?: string | null) => {
  if (!category) return 'General';
  return CATEGORY_LABELS[category] || category.replace(/_/g, ' ');
};

const sortGroupMembers = (groupMembers: any[]) => {
  return [...groupMembers].sort((a, b) => {
    const aHead = a.full_pos?.is_ministry_head ? 1 : 0;
    const bHead = b.full_pos?.is_ministry_head ? 1 : 0;
    if (aHead !== bHead) return bHead - aHead;
    const aName = `${a.first_name || ''} ${a.surname || ''}`.trim();
    const bName = `${b.first_name || ''} ${b.surname || ''}`.trim();
    return aName.localeCompare(bName);
  });
};

const INITIAL_STATE = {
  member_id: '',
  position_name: '',
  department: '',
  position_category: 'leadership',
  assignment_reason: '',
  start_date: new Date().toISOString().split('T')[0],
  is_active: true
};

const getCategoryStyle = (catId: string) => {
  switch (catId) {
    case 'leadership':
      return {
        bg: 'bg-emerald-50/50',
        border: 'border-emerald-50',
        text: 'text-emerald-600',
      };
    case 'music_ministry':
      return {
        bg: 'bg-orange-50/50',
        border: 'border-orange-50',
        text: 'text-orange-600',
      };
    case 'sunday_school_adult':
    case 'sunday_school_children':
      return {
        bg: 'bg-rose-50/50',
        border: 'border-rose-50',
        text: 'text-rose-600',
      };
    case 'other_ministries':
    default:
      return {
        bg: 'bg-[#f4f7ff]',
        border: 'border-[#eef2fc]',
        text: 'text-indigo-600',
      };
  }
};

const MinistryDirectory: React.FC = () => {
  const [positions, setPositions] = useState<PositionWithMember[]>([]);
  const [members, setMembers] = useState<PartialMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [allMembersOpen, setAllMembersOpen] = useState(false);
  const [allMembersSearch, setAllMembersSearch] = useState('');

  // Assign Role Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>(INITIAL_STATE);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<{ isOpen: boolean; assignment: any }>({
    isOpen: false,
    assignment: null
  });

  const [manageGroup, setManageGroup] = useState<any>(null);
  const [groupDraftName, setGroupDraftName] = useState('');
  const [groupDraftSchedule, setGroupDraftSchedule] = useState('');
  const [savingGroupMeta, setSavingGroupMeta] = useState(false);
  const [savingHeadAssignmentId, setSavingHeadAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions();
    fetchMembers();
  }, []);

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('church_positions')
        .select('*, members(id, first_name, surname, profile_picture_url)')
        .eq('is_active', true)
        .order('position_name', { ascending: true });

      if (error) throw error;
      setPositions(data as unknown as PositionWithMember[]);
    } catch (err) {
      console.error("Error fetching ministries:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from('members').select('id, first_name, surname, profile_picture_url, member_number').order('surname');
    if (data) setMembers(data);
  };

  const handleOpenModal = (groupName?: string | null, posToEdit?: any) => {
    if (posToEdit) {
      setForm({
        ...posToEdit,
        position_category: normalizeCategory(posToEdit.position_category)
      });
      if (posToEdit.members) {
        setSelectedMembers([{ ...posToEdit.members, custom_role: posToEdit.position_name }]);
      } else {
        setSelectedMembers([]);
      }
    } else if (groupName) {
      const pos = positions.find(p => (p.department || p.position_name) === groupName);
      setForm(pos ? { ...INITIAL_STATE, department: pos.department || pos.position_name, position_category: normalizeCategory(pos.position_category), position_name: 'group-assign', assignment_reason: pos.assignment_reason || '' } : { ...INITIAL_STATE, position_name: 'group-assign' });
      setSelectedMembers([]);
    } else {
      setForm({ ...INITIAL_STATE, position_name: 'group-assign' });
      setSelectedMembers([]);
    }
    setMemberSearchTerm('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (selectedMembers.length === 0) return alert("Please select at least one member.");
    if (selectedMembers.some(m => !m.custom_role)) return alert("Please enter a specific role for each selected member.");
    setSubmitting(true);
    try {
      const { members: _, position_name: __, ...saveData } = form;
      const normalizedSaveData = {
        ...saveData,
        position_category: normalizeCategory(saveData.position_category)
      };

      const insertData = selectedMembers.map(m => {
        const payload = { ...normalizedSaveData, member_id: m.id, position_name: m.custom_role };
        // If adding multiple new members, ensure we aren't overwriting an existing ID
        if (!form.id || selectedMembers.length > 1) {
          delete payload.id;
        }
        return payload;
      });

      const { error } = await supabase.from('church_positions').upsert(insertData);
      if (error) throw error;

      setIsModalOpen(false);
      fetchPositions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmRemove.assignment) return;
    const id = confirmRemove.assignment.id;
    try {
      const { error } = await supabase
        .from('church_positions')
        .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);

      if (error) throw error;
      setConfirmRemove({ isOpen: false, assignment: null });
      fetchPositions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openManageGroup = (group: any) => {
    setManageGroup(group);
    setGroupDraftName(group?.name || '');
    setGroupDraftSchedule(group?.schedule || '');
  };

  const handleUpdateGroupMeta = async () => {
    if (!manageGroup) return;
    const nextName = groupDraftName.trim();
    const nextSchedule = groupDraftSchedule.trim();
    if (!nextName) return alert('Ministry name is required.');

    const positionIds = manageGroup.members
      .map((m: any) => m?.full_pos?.id)
      .filter(Boolean);

    if (positionIds.length === 0) return alert('No ministry assignments found to update.');

    setSavingGroupMeta(true);
    try {
      const { error } = await supabase
        .from('church_positions')
        .update({
          department: nextName,
          assignment_reason: nextSchedule || null
        })
        .in('id', positionIds);

      if (error) throw error;
      setManageGroup(null);
      await fetchPositions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingGroupMeta(false);
    }
  };

  const handleSetGroupHead = async (assignment: any) => {
    if (!manageGroup) return;
    const targetId = assignment?.full_pos?.id;
    if (!targetId) return;
    const isCurrentlyHead = !!assignment?.full_pos?.is_ministry_head;

    const positionIds = manageGroup.members
      .map((m: any) => m?.full_pos?.id)
      .filter(Boolean);

    if (positionIds.length === 0) return;

    setSavingHeadAssignmentId(targetId);
    try {
      const { error: clearError } = await supabase
        .from('church_positions')
        .update({ is_ministry_head: false })
        .in('id', positionIds);
      if (clearError) throw clearError;

      const nextHeadId = isCurrentlyHead ? null : targetId;

      if (nextHeadId) {
        const { error: setError } = await supabase
          .from('church_positions')
          .update({ is_ministry_head: true })
          .eq('id', nextHeadId);
        if (setError) throw setError;
      }

      setManageGroup((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: sortGroupMembers(prev.members.map((m: any) => ({
            ...m,
            full_pos: {
              ...m.full_pos,
              is_ministry_head: nextHeadId ? m.full_pos.id === nextHeadId : false
            }
          })))
        };
      });

      fetchPositions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingHeadAssignmentId(null);
    }
  };

  const filteredMembers = members.filter(m =>
    `${m.first_name} ${m.surname}`.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  const filteredAllMembers = members.filter(m =>
    `${m.first_name} ${m.surname}`.toLowerCase().includes(allMembersSearch.toLowerCase())
  );

  // Grouping by Department/Ministry Name
  const groupsMap = positions.reduce((acc, pos) => {
    const groupKey = pos.department || pos.position_name || 'Unassigned';
    const normalizedCategory = normalizeCategory(pos.position_category);
    if (!acc[groupKey]) {
      acc[groupKey] = {
        name: groupKey,
        category: normalizedCategory,
        categoryLabel: getCategoryLabel(pos.position_category),
        schedule: pos.assignment_reason || '',
        members: [] as any[],
        leader: null as any
      };
    }
    if (pos.assignment_reason && pos.assignment_reason.length > acc[groupKey].schedule.length) {
      acc[groupKey].schedule = pos.assignment_reason;
    }
    if (pos.members) {
      acc[groupKey].members.push({
        ...pos.members,
        specific_role: pos.position_name,
        full_pos: pos
      });
      // Try to intelligently pick a leader
      const roleLower = pos.position_name?.toLowerCase() || '';
      if (!acc[groupKey].leader && (roleLower.includes('lead') || roleLower.includes('conductor') || roleLower.includes('pastor') || roleLower.includes('director') || roleLower === 'teacher')) {
        acc[groupKey].leader = { ...pos.members, specific_role: pos.position_name };
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const groups = Object.values(groupsMap).filter((g: any) => {
    const matchesCategory = selectedCategory === 'all' || g.category === selectedCategory;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      g.name.toLowerCase().includes(searchLower) ||
      g.categoryLabel.toLowerCase().includes(searchLower) ||
      g.members.some((m: any) => m.first_name.toLowerCase().includes(searchLower) || m.surname.toLowerCase().includes(searchLower) || m.specific_role?.toLowerCase().includes(searchLower));

    g.members = sortGroupMembers(g.members);
    const headMember = g.members.find((m: any) => m.full_pos?.is_ministry_head);

    // Prefer explicit head; otherwise fallback to inferred leader; otherwise first member.
    if (headMember) {
      g.leader = headMember;
    } else if (!g.leader && g.members.length > 0) {
      g.leader = g.members[0];
    }

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-sans pb-20 fade-in">
      {/* Header section matching exact design */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-[24px] sm:text-[32px] font-serif font-extrabold text-[#111827] mb-0.5 tracking-tight">Ministry Directory</h1>
          <p className="text-[#6b7280] text-[15px]">Manage your church leadership and ministry assignments.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const exportData = groups.flatMap((g: any) => g.members.map((m: any) => ({
                ministry: g.name,
                category: g.categoryLabel,
                member_number: m.member_number || '',
                name: `${m.first_name} ${m.surname}`,
                role: m.specific_role,
                is_head: m.full_pos?.is_ministry_head ? 'Yes' : 'No'
              })));
              exportToCSV('Church_Ministries_Roster.csv', exportData, [
                { key: 'ministry', label: 'Ministry' },
                { key: 'category', label: 'Category' },
                { key: 'member_number', label: 'Member #' },
                { key: 'name', label: 'Member Name' },
                { key: 'role', label: 'Role' },
                { key: 'is_head', label: 'Head' }
              ]);
            }}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} /> Establish New Group
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Container */}
      <div className="bg-white border border-gray-100 rounded-[14px] shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col items-center justify-between p-2 overflow-hidden gap-2 sm:gap-4">
        <div className="flex overflow-x-auto hide-scrollbar w-full px-1 gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${selectedCategory === cat.id
                ? 'bg-[#2563eb] text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex-1 w-full sm:max-w-xs relative border-t sm:border-t-0 sm:border-l border-gray-100 pt-2 sm:pt-0 pl-0 sm:pl-2">
          <Search className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 text-gray-400" size={16} strokeWidth={2.5} />
          <input
            type="text"
            placeholder="Search positions or members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 sm:pl-12 pr-4 py-2 border-none bg-transparent placeholder-gray-400 text-sm font-medium focus:outline-none focus:ring-0 text-gray-800"
          />
        </div>
      </div>

      {/* Groups Grid */}
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
                        <img src={preview.profile_picture_url} alt={`${preview.first_name} ${preview.surname}`} className="w-9 h-9 rounded-full object-cover shadow-sm bg-gray-100" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shadow-sm">
                          <User size={16} className="text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">
                          {preview.full_pos?.is_ministry_head ? `Head - ${preview.specific_role || 'Member'}` : (preview.specific_role || 'Member')}
                        </p>
                        <Link to={`/members/${preview.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors truncate block">
                          {preview.first_name} {preview.surname}
                        </Link>
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
                    <button onClick={(e) => { e.stopPropagation(); openManageGroup(group); }} className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-600 hover:bg-blue-100 transition-colors">
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
        <div onClick={() => setAllMembersOpen(true)} className="border border-blue-100 rounded-[28px] overflow-hidden flex flex-col items-center justify-center p-8 bg-blue-50/40 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all min-h-[300px] group shadow-sm">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
            <Users size={24} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-serif font-extrabold text-[#111827] mb-2 text-center">View All Members</h3>
          <p className="text-xs text-gray-500 text-center leading-relaxed px-4">
            Open a quick roster of every member and jump to any profile.
          </p>
          <div className="mt-4 text-[12px] font-bold text-blue-700 bg-white rounded-full px-3 py-1 border border-blue-100">
            {members.length} Total Member{members.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* All Members Modal */}
      {allMembersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg p-4 sm:p-6 relative animate-in zoom-in-95 duration-200 border border-gray-100 mx-2 sm:mx-0">
            <button onClick={() => setAllMembersOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 p-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10">
              <X size={18} />
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
                <Link key={m.id} to={`/members/${m.id}`} onClick={() => setAllMembersOpen(false)} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
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
                </Link>
              ))}
              {filteredAllMembers.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm font-semibold border-2 border-dashed border-gray-100 rounded-xl">
                  No members match your search.
                </div>
              )}
            </div>

            <Link to="/members" onClick={() => setAllMembersOpen(false)} className="w-full mt-5 py-3.5 border border-blue-200 rounded-xl text-blue-700 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
              <Users size={16} /> Open Full Members Directory
            </Link>
          </div>
        </div>
      )}

      {/* Manage Group Modal */}
      {manageGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg p-4 sm:p-6 relative animate-in zoom-in-95 duration-200 border border-gray-100 mx-2 sm:mx-0">
            <button onClick={() => setManageGroup(null)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 p-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10">
              <X size={18} />
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
                      <img src={m.profile_picture_url} className="w-10 h-10 rounded-full object-cover shadow-sm bg-white" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200"><User size={18} className="text-gray-500" /></div>
                    )}
                    <div>
                      <Link to={`/members/${m.id}`} className="text-[13px] font-bold text-gray-900 hover:text-blue-600 transition-colors inline-block">{m.first_name} {m.surname}</Link>
                      {m.member_number && (
                        <p className="text-[9px] font-bold text-indigo-600 tracking-tight">{m.member_number}</p>
                      )}
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-0.5">
                        {m.specific_role}
                        {m.full_pos?.is_ministry_head && <span className="ml-2 text-amber-600">HEAD</span>}
                      </p>
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
                    <button onClick={() => { setManageGroup(null); handleOpenModal(null, m.full_pos) }} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
                      <Shield size={16} />
                    </button>
                    <button onClick={() => { setManageGroup(null); setConfirmRemove({ isOpen: true, assignment: m.full_pos }) }} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {manageGroup.members.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm font-semibold border-2 border-dashed border-gray-100 rounded-xl">No members in this group yet.</div>
              )}
            </div>

            <button onClick={() => { setManageGroup(null); handleOpenModal(manageGroup.name) }} className="w-full mt-6 py-3.5 border-2 border-dashed border-gray-200 rounded-xl text-blue-600 font-bold hover:bg-blue-50/50 hover:border-blue-300 transition-all flex items-center justify-center gap-2">
              <Plus size={16} strokeWidth={2.5} /> Add Member to Group
            </button>
          </div>
        </div>
      )}

      {/* Editing / Assigning Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg p-5 sm:p-8 relative animate-in zoom-in-95 duration-200 border border-gray-100 mx-2 sm:mx-0">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 p-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <h2 className="text-[20px] font-bold text-gray-900 flex items-center gap-2 mb-6">
              <Shield className="text-blue-600" size={24} />
              {form.id ? 'Edit Role Assignment' : 'Assign Church Role'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-6">
              <div className="space-y-1.5 relative col-span-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Members & Specific Roles</label>

                {selectedMembers.length > 0 && (
                  <div className="flex flex-col gap-3 pb-3">
                    {selectedMembers.map(m => (
                      <div key={m.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-2 relative group hover:border-blue-200 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-900 text-[13px] font-bold">
                            {m.first_name} {m.surname} {m.member_number && <span className="text-indigo-600 ml-2 font-mono text-[11px]">{m.member_number}</span>}
                          </span>
                          <X size={16} className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors" onClick={() => setSelectedMembers(sm => sm.filter(x => x.id !== m.id))} />
                        </div>
                        <input
                          type="text"
                          placeholder="Specific Role (e.g. Flutist, Teacher, Soprano)"
                          value={m.custom_role || ''}
                          onChange={(e) => setSelectedMembers(sm => sm.map(x => x.id === m.id ? { ...x, custom_role: e.target.value } : x))}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
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
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                />

                {memberSearchTerm && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden max-h-48 overflow-y-auto">
                    {filteredMembers.map(m => {
                      const isSelected = selectedMembers.some(sm => sm.id === m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (!isSelected) {
                              if (form.id) setSelectedMembers([{ ...m, custom_role: '' }]); // If editing single existing role, replace entirely.
                              else setSelectedMembers([...selectedMembers, { ...m, custom_role: '' }]); // If new, append multiple.
                            }
                            setMemberSearchTerm('');
                          }}
                          className={`w-full text-left p-3 text-sm font-semibold border-b border-gray-50 last:border-0 transition-colors ${isSelected ? 'bg-gray-100 text-gray-400 cursor-default' : 'hover:bg-gray-50'}`}
                        >
                          {m.first_name} {m.surname} {m.member_number && <span className="text-indigo-600 italic text-[11px] ml-1">({m.member_number})</span>} {isSelected && <span className="float-right text-blue-500">Added</span>}
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
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
                <select
                  value={form.position_category}
                  onChange={(e) => setForm({ ...form, position_category: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
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
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                />
              </div>
            </div>

            <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting || selectedMembers.length === 0 || selectedMembers.some(m => !m.custom_role)}
                className="px-6 py-2.5 bg-[#2563eb] text-white rounded-xl shadow-md text-sm font-bold hover:bg-[#1d4ed8] flex items-center gap-2 transition-transform disabled:opacity-50 hover:-translate-y-0.5"
              >
                <Save size={16} /> {submitting ? 'Saving...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Modal */}
      <ConfirmModal
        isOpen={confirmRemove.isOpen}
        title="Remove Role Assignment"
        message="Are you sure you want to remove this member from the ministry? You can re-assign them later."
        confirmText="Remove Now"
        isDanger={true}
        onConfirm={handleDelete}
        onCancel={() => setConfirmRemove({ isOpen: false, assignment: null })}
      />
    </div>
  );
};

export default MinistryDirectory;
