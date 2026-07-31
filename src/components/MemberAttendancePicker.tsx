import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Search } from "lucide-react";

export interface AttendanceMember {
    id: string;
    first_name: string;
    surname: string;
    profile_picture_url?: string;
    is_regular_member?: boolean;
}

interface MemberAttendancePickerProps {
    label: string;
    members: AttendanceMember[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    tardyIds?: string[];
    onTardyChange?: (ids: string[]) => void;
    onEditMember?: (member: AttendanceMember) => void;
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    maxHeightClass?: string;
    showVisitorToggle?: boolean;
    emptyMessage?: string;
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
    tardyIds = [],
    onTardyChange,
    onEditMember,
    searchTerm,
    onSearchTermChange,
    maxHeightClass = "max-h-[180px]",
    showVisitorToggle = false,
    emptyMessage,
}) => {
    const [includeVisitors, setIncludeVisitors] = useState(false);

    const visibleMembers = useMemo(() => {
        if (!showVisitorToggle) return members;
        if (includeVisitors) return members;
        return members.filter((m) => m.is_regular_member !== false);
    }, [members, showVisitorToggle, includeVisitors]);

    useEffect(() => {
        if (!showVisitorToggle || includeVisitors) return;
        const nonVisitorIds = new Set(visibleMembers.map((m) => m.id));
        const nextSelected = selectedIds.filter((id) => nonVisitorIds.has(id));
        if (nextSelected.length !== selectedIds.length) {
            onChange(nextSelected);
        }
        if (onTardyChange) {
            const nextTardy = tardyIds.filter((id) => nonVisitorIds.has(id));
            if (nextTardy.length !== tardyIds.length) {
                onTardyChange(nextTardy);
            }
        }
    }, [showVisitorToggle, includeVisitors, visibleMembers, selectedIds, onChange, tardyIds, onTardyChange]);

    const filteredMembers = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return visibleMembers;
        return visibleMembers.filter((m) =>
            `${m.first_name} ${m.surname}`.toLowerCase().includes(q)
        );
    }, [visibleMembers, searchTerm]);

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const tardySet = useMemo(() => new Set(tardyIds), [tardyIds]);
    const allSelected = visibleMembers.length > 0 && visibleMembers.every((m) => selectedSet.has(m.id));

    const toggleSelectAll = () => {
        if (allSelected) {
            onChange([]);
            if (onTardyChange) onTardyChange([]);
            return;
        }
        onChange(visibleMembers.map((m) => m.id));
        if (onTardyChange) onTardyChange([]);
    };

    const toggleMember = (id: string, isChecked: boolean) => {
        if (isChecked) {
            // Remove from tardy if it was there
            if (onTardyChange && tardySet.has(id)) {
                onTardyChange(tardyIds.filter(x => x !== id));
            }
            if (selectedSet.has(id)) return;
            onChange([...selectedIds, id]);
            return;
        }
        onChange(selectedIds.filter((x) => x !== id));
    };

    const toggleTardy = (id: string, isChecked: boolean) => {
        if (!onTardyChange) return;
        if (isChecked) {
            // Remove from strictly present if it was there
            if (selectedSet.has(id)) {
                onChange(selectedIds.filter(x => x !== id));
            }
            if (tardySet.has(id)) return;
            onTardyChange([...tardyIds, id]);
            return;
        }
        onTardyChange(tardyIds.filter(x => x !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {label} ({selectedIds.length})
                </label>
                <button
                    type="button"
                    className={`text-xs font-bold px-3 py-1.5 rounded-none transition-colors ${
                        allSelected 
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                            : "bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] shadow-sm"
                    }`}
                    onClick={toggleSelectAll}
                >
                    {allSelected ? "Deselect All" : "Select All"}
                </button>
            </div>

            {showVisitorToggle && (
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 font-semibold">
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-[var(--color-text-main)] focus:ring-blue-500 focus:ring-2"
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
                    className="w-full bg-white border border-gray-200 rounded-none pl-10 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
            </div>

            <div className={`${maxHeightClass} overflow-y-auto space-y-1 custom-scrollbar px-1 py-2 border border-gray-100 rounded-none bg-white`}>
                {filteredMembers.length === 0 && (
                    <div className="p-6 text-center text-sm text-gray-500">
                        {members.length === 0
                            ? (emptyMessage || "No members in the registry yet. Add members first in Members Directory.")
                            : (showVisitorToggle && !includeVisitors && visibleMembers.length === 0
                                ? "Only visitor records are available. Enable \"Include visitors in search\"."
                                : `No members match "${searchTerm.trim()}".`)}
                    </div>
                )}

                {filteredMembers.map((member) => {
                    const isPresent = selectedSet.has(member.id);
                    const isTardy = tardySet.has(member.id);
                    const initials = `${member.first_name?.[0] || ""}${member.surname?.[0] || ""}`.toUpperCase();
                    const colorClass = AVATAR_COLORS[hashText(member.id) % AVATAR_COLORS.length];

                    return (
                        <div
                            key={member.id}
                            className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-2.5 rounded-none transition-colors group ${isPresent ? 'bg-gray-50/50' : isTardy ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                                {member.profile_picture_url ? (
                                    <img src={member.profile_picture_url} alt={`${member.first_name} ${member.surname}`} className="w-8 h-8 rounded-none object-cover shrink-0" />
                                ) : (
                                    <div className={`w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-bold shrink-0 ${colorClass}`}>
                                        {initials}
                                    </div>
                                )}
                                <div className="flex flex-col truncate flex-1">
                                    <span className="text-sm text-gray-900 leading-tight truncate">
                                        <span className="font-bold">{member.surname}</span>, <span className="text-gray-600 font-medium">{member.first_name}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Attendance Controls */}
                            <div className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 p-1 rounded-none border border-gray-100 flex-shrink-0">
                                <label className={`flex gap-1.5 items-center px-3 py-1.5 rounded-none cursor-pointer text-[10px] font-bold uppercase tracking-wider transition-all ${!isPresent && !isTardy ? 'bg-white shadow-sm text-gray-700 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <input
                                        type="radio"
                                        name={`attendance_${member.id}`}
                                        className="sr-only"
                                        checked={!isPresent && !isTardy}
                                        onChange={() => {
                                            if (isPresent) toggleMember(member.id, false);
                                            if (isTardy) toggleTardy(member.id, false);
                                        }}
                                    />
                                    <span className={!isPresent && !isTardy ? "text-red-500 font-black" : ""}>Absent</span>
                                </label>

                                {onTardyChange && (
                                    <label className={`flex gap-1.5 items-center px-3 py-1.5 rounded-none cursor-pointer text-[10px] font-bold uppercase tracking-wider transition-all ${isTardy ? 'bg-amber-100 shadow-sm text-amber-800 ring-1 ring-amber-200' : 'text-gray-500 hover:text-amber-600'}`}>
                                        <input
                                            type="radio"
                                            name={`attendance_${member.id}`}
                                            className="sr-only"
                                            checked={isTardy}
                                            onChange={() => toggleTardy(member.id, true)}
                                        />
                                        <span className={isTardy ? "text-amber-700 font-black" : ""}>Tardy</span>
                                    </label>
                                )}

                                <label className={`flex gap-1.5 items-center px-3 py-1.5 rounded-none cursor-pointer text-[10px] font-bold uppercase tracking-wider transition-all ${isPresent ? 'bg-blue-100 shadow-sm text-blue-800 ring-1 ring-blue-200' : 'text-gray-500 hover:text-[var(--color-text-main)]'}`}>
                                    <input
                                        type="radio"
                                        name={`attendance_${member.id}`}
                                        className="sr-only"
                                        checked={isPresent}
                                        onChange={() => toggleMember(member.id, true)}
                                    />
                                    <span className={isPresent ? "text-blue-700 font-black" : ""}>Present</span>
                                </label>
                            </div>

                            {onEditMember && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onEditMember(member);
                                    }}
                                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-none border border-blue-200 text-[var(--color-text-main)] hover:bg-gray-50 transition-colors text-[10px] font-bold uppercase tracking-wide ml-auto sm:ml-0"
                                    title="Edit profile"
                                >
                                    <Edit2 size={12} />
                                    Edit
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MemberAttendancePicker;
