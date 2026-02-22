import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Search } from "lucide-react";

export interface AttendanceMember {
    id: string;
    first_name: string;
    surname: string;
    profile_picture_url?: string;
    is_visitor?: boolean;
}

interface MemberAttendancePickerProps {
    label: string;
    members: AttendanceMember[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    onEditMember?: (member: AttendanceMember) => void;
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    maxHeightClass?: string;
    showVisitorToggle?: boolean;
}

const AVATAR_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-green-100 text-green-700",
    "bg-yellow-100 text-yellow-700",
    "bg-pink-100 text-pink-700",
];

const hashText = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const MemberAttendancePicker: React.FC<MemberAttendancePickerProps> = ({
    label,
    members,
    selectedIds,
    onChange,
    onEditMember,
    searchTerm,
    onSearchTermChange,
    maxHeightClass = "max-h-[180px]",
    showVisitorToggle = false,
}) => {
    const [includeVisitors, setIncludeVisitors] = useState(false);

    const visibleMembers = useMemo(() => {
        if (!showVisitorToggle) return members;
        if (includeVisitors) return members;
        return members.filter((m) => !m.is_visitor);
    }, [members, showVisitorToggle, includeVisitors]);

    useEffect(() => {
        if (!showVisitorToggle || includeVisitors) return;
        const nonVisitorIds = new Set(visibleMembers.map((m) => m.id));
        const nextSelected = selectedIds.filter((id) => nonVisitorIds.has(id));
        if (nextSelected.length !== selectedIds.length) {
            onChange(nextSelected);
        }
    }, [showVisitorToggle, includeVisitors, visibleMembers, selectedIds, onChange]);

    const filteredMembers = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return visibleMembers;
        return visibleMembers.filter((m) =>
            `${m.first_name} ${m.surname}`.toLowerCase().includes(q)
        );
    }, [visibleMembers, searchTerm]);

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const allSelected = visibleMembers.length > 0 && visibleMembers.every((m) => selectedSet.has(m.id));

    const toggleSelectAll = () => {
        if (allSelected) {
            onChange([]);
            return;
        }
        onChange(visibleMembers.map((m) => m.id));
    };

    const toggleMember = (id: string, isChecked: boolean) => {
        if (isChecked) {
            if (selectedSet.has(id)) return;
            onChange([...selectedIds, id]);
            return;
        }
        onChange(selectedIds.filter((x) => x !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {label} ({selectedIds.length})
                </label>
                <button
                    type="button"
                    className="text-[10px] text-blue-600 font-bold uppercase hover:text-blue-800 hover:underline transition-colors"
                    onClick={toggleSelectAll}
                >
                    {allSelected ? "Deselect All" : "Select All"}
                </button>
            </div>

            {showVisitorToggle && (
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 font-semibold">
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        checked={includeVisitors}
                        onChange={(e) => setIncludeVisitors(e.target.checked)}
                    />
                    Include visitors in search
                </label>
            )}

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search member..."
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-10 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
            </div>

            <div className={`${maxHeightClass} overflow-y-auto space-y-1 custom-scrollbar px-1 py-2 border border-gray-100 rounded-xl bg-white`}>
                {filteredMembers.length === 0 && (
                    <div className="p-6 text-center text-sm text-gray-500">
                        {members.length === 0
                            ? "No members in the registry yet. Add members first in Members Directory."
                            : (showVisitorToggle && !includeVisitors && visibleMembers.length === 0 && members.some((m) => m.is_visitor)
                                ? "Only visitor records are available. Enable \"Include visitors in search\"."
                                : `No members match "${searchTerm.trim()}".`)}
                    </div>
                )}

                {filteredMembers.map((member) => {
                    const isChecked = selectedSet.has(member.id);
                    const initials = `${member.first_name?.[0] || ""}${member.surname?.[0] || ""}`.toUpperCase();
                    const colorClass = AVATAR_COLORS[hashText(member.id) % AVATAR_COLORS.length];

                    return (
                        <label
                            key={member.id}
                            className="flex items-center gap-4 p-2.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors group"
                        >
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-blue-600 bg-white border-gray-300 focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all"
                                checked={isChecked}
                                onChange={(e) => toggleMember(member.id, e.target.checked)}
                            />
                            {member.profile_picture_url ? (
                                <img src={member.profile_picture_url} alt={`${member.first_name} ${member.surname}`} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colorClass}`}>
                                    {initials}
                                </div>
                            )}
                            <div className="flex flex-col truncate flex-1">
                                <span className="text-sm text-gray-900 leading-tight truncate">
                                    <span className="font-bold">{member.surname}</span>, <span className="text-gray-600 font-medium">{member.first_name}</span>
                                </span>
                                {member.is_visitor && (
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Visitor</span>
                                )}
                            </div>
                            {onEditMember && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onEditMember(member);
                                    }}
                                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors text-[10px] font-bold uppercase tracking-wide"
                                    title="Edit profile"
                                >
                                    <Edit2 size={12} />
                                    Edit
                                </button>
                            )}
                        </label>
                    );
                })}
            </div>
        </div>
    );
};

export default MemberAttendancePicker;
