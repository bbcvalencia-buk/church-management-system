import React, { useState, useEffect } from "react";
import * as memberService from "@/services/memberService";
import * as ministryService from "@/services/ministryService";
import * as musicService from "@/services/musicService";
import { Search, Plus, Download } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { Link } from "react-router-dom";
import { exportToCSV } from "@/lib/csv";

import type { PartialMember, PositionWithMember } from "../components/MinistryDirectory/types";
import { CATEGORIES, normalizeCategory, getCategoryLabel, sortGroupMembers, INITIAL_STATE } from "../components/MinistryDirectory/utils";
import MinistryList from "../components/MinistryDirectory/MinistryList";
import AllMembersModal from "../components/MinistryDirectory/AllMembersModal";
import ManageGroupModal from "../components/MinistryDirectory/ManageGroupModal";
import AssignRoleModal from "../components/MinistryDirectory/AssignRoleModal";
import MemberViewModal from "../components/MinistryDirectory/MemberViewModal";

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
  const [participationRates, setParticipationRates] = useState<Record<string, number>>({});
  const [attendanceRates, setAttendanceRates] = useState<Record<string, { count: number, rate: string, total: number }>>({});
  const [musicAttendanceRates, setMusicAttendanceRates] = useState<Record<string, Record<string, { count: number, rate: string, total: number }>>>({});

  const [viewingMember, setViewingMember] = useState<any>(null);
  const [memberServiceHistory, setMemberServiceHistory] = useState<any[]>([]);
  const [memberMusicHistory, setMemberMusicHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchPositions();
    fetchMembers();
    fetchParticipation();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAllMembersOpen(false);
        setManageGroup(null);
        setIsModalOpen(false);
        setViewingMember(null);
        setConfirmRemove({ isOpen: false, assignment: null });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchParticipation = async () => {
    try {
      const counts = await memberService.getServiceAssignmentCounts();
      setParticipationRates(counts);
      const rates = await memberService.getMemberAttendanceRates();
      setAttendanceRates(rates);
      const musicRates = await musicService.getMusicPracticeAttendanceRates();
      setMusicAttendanceRates(musicRates || {});
    } catch (err) {
      console.error("Error fetching participation/attendance:", err);
    }
  };

  const handleViewMember = async (member: any) => {
    setViewingMember(member);
    setMemberServiceHistory([]);
    setMemberMusicHistory([]);
    try {
      const history = await memberService.getMemberServiceHistory(member.id, 5);
      setMemberServiceHistory(history);

      const musicHistory = await musicService.getMemberMusicPracticeHistory(member.id, 5);
      setMemberMusicHistory(musicHistory);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const fetchPositions = async () => {
    try {
      const data = await ministryService.getMinistryAssignments();
      setPositions(data as unknown as PositionWithMember[]);
    } catch (err) {
      console.warn("Normalized ministries unavailable, falling back to church_positions:", err);
      try {
        const data = await memberService.getChurchPositions();
        setPositions(data as unknown as PositionWithMember[]);
      } catch (fallbackErr) {
        console.error("Error fetching ministries:", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const data = await memberService.getAllMembers();
      setMembers(data as any[]);
    } catch (err) {
      console.error("Error fetching members:", err);
    }
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
        if (!form.id || selectedMembers.length > 1) {
          delete payload.id;
        }
        return payload;
      });

      await ministryService.upsertMinistryAssignmentsFromPositions(insertData);

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
      if (confirmRemove.assignment.ministry_id) {
        await ministryService.deactivateMinistryAssignment(id);
      } else {
        await memberService.updateChurchPositions([id], {
          is_active: false,
          end_date: new Date().toISOString().split('T')[0]
        });
      }

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
      if (manageGroup.ministry_id) {
        await ministryService.updateMinistry(manageGroup.ministry_id, {
          name: nextName,
          schedule: nextSchedule || null
        });
      } else {
        await memberService.updateChurchPositions(positionIds, {
          department: nextName,
          assignment_reason: nextSchedule || null
        });
      }

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
      if (manageGroup.ministry_id) {
        await ministryService.updateMinistryAssignments(positionIds, { is_leader: false });
      } else {
        await memberService.updateChurchPositions(positionIds, { is_ministry_head: false });
      }

      const nextHeadId = isCurrentlyHead ? null : targetId;

      if (nextHeadId) {
        if (manageGroup.ministry_id) {
          await ministryService.updateMinistryAssignments([nextHeadId], { is_leader: true });
        } else {
          await memberService.updateChurchPositions([nextHeadId], { is_ministry_head: true });
        }
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

  const groupsMap = positions.reduce((acc, pos) => {
    const groupKey = pos.department || pos.position_name || 'Unassigned';
    const normalizedCategory = normalizeCategory(pos.position_category);
    if (!acc[groupKey]) {
      acc[groupKey] = {
        name: groupKey,
        ministry_id: pos.ministry_id,
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

    if (headMember) {
      g.leader = headMember;
    } else if (!g.leader && g.members.length > 0) {
      g.leader = g.members[0];
    }

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-sans pb-20 fade-in">
      <div className="-mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)] font-medium">
        <Link to="/" className="hover:text-[var(--color-primary)] transition-colors">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <span className="text-[var(--color-text-main)] font-semibold">Ministry Directory</span>
      </div>

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

      <MinistryList 
        groups={groups}
        openManageGroup={openManageGroup}
        handleViewMember={handleViewMember}
        attendanceRates={attendanceRates}
        participationRates={participationRates}
        musicAttendanceRates={musicAttendanceRates}
        setAllMembersOpen={setAllMembersOpen}
        membersLength={members.length}
      />

      <AllMembersModal
        isOpen={allMembersOpen}
        onClose={() => setAllMembersOpen(false)}
        members={members}
        allMembersSearch={allMembersSearch}
        setAllMembersSearch={setAllMembersSearch}
        filteredAllMembers={filteredAllMembers}
        handleViewMember={handleViewMember}
      />

      <ManageGroupModal
        manageGroup={manageGroup}
        setManageGroup={setManageGroup}
        groupDraftName={groupDraftName}
        setGroupDraftName={setGroupDraftName}
        groupDraftSchedule={groupDraftSchedule}
        setGroupDraftSchedule={setGroupDraftSchedule}
        handleUpdateGroupMeta={handleUpdateGroupMeta}
        savingGroupMeta={savingGroupMeta}
        savingHeadAssignmentId={savingHeadAssignmentId}
        handleSetGroupHead={handleSetGroupHead}
        handleOpenModal={handleOpenModal}
        setConfirmRemove={setConfirmRemove}
        handleViewMember={handleViewMember}
        musicAttendanceRates={musicAttendanceRates}
        attendanceRates={attendanceRates}
      />

      <AssignRoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        form={form}
        setForm={setForm}
        selectedMembers={selectedMembers}
        setSelectedMembers={setSelectedMembers}
        memberSearchTerm={memberSearchTerm}
        setMemberSearchTerm={setMemberSearchTerm}
        filteredMembers={filteredMembers}
        members={members}
        submitting={submitting}
        handleSave={handleSave}
      />

      <MemberViewModal
        viewingMember={viewingMember}
        setViewingMember={setViewingMember}
        memberServiceHistory={memberServiceHistory}
        memberMusicHistory={memberMusicHistory}
        attendanceRates={attendanceRates}
      />

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
