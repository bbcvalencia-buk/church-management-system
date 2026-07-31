import React, { useEffect, useState } from "react";
import { X, Check, ClipboardCheck } from "lucide-react";
import MemberAttendancePicker, { type AttendanceMember } from "@/components/MemberAttendancePicker";

interface AttendanceReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle: string;
    members: AttendanceMember[];
    selectedMemberIds: string[];
    tardyIds?: string[];
    onSave: (selectedIds: string[], tardyIds?: string[]) => void;
    visitorsCount: number;
}

const AttendanceReportModal: React.FC<AttendanceReportModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    members,
    selectedMemberIds,
    tardyIds = [],
    onSave,
    visitorsCount
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedMemberIds);
    const [localTardyIds, setLocalTardyIds] = useState<string[]>(tardyIds);

    // Tardy members are counted as present for total attendance purposes usually
    const selectedVisitorCount = localSelectedIds.filter((id) =>
        members.some((m) => m.id === id && m.is_regular_member === false)
    ).length;
    const tardyVisitorCount = localTardyIds.filter((id) =>
        members.some((m) => m.id === id && m.is_regular_member === false)
    ).length;

    const totalSelectedVisitors = selectedVisitorCount + tardyVisitorCount;
    const selectedRegularCount = localSelectedIds.length - selectedVisitorCount;
    const tardyRegularCount = localTardyIds.length - tardyVisitorCount;

    const effectiveVisitorsCount = Math.max(visitorsCount, totalSelectedVisitors);
    const effectiveTotal = selectedRegularCount + tardyRegularCount + effectiveVisitorsCount;

    useEffect(() => {
        if (!isOpen) return;
        setLocalSelectedIds(selectedMemberIds);
        setLocalTardyIds(tardyIds);
        setSearchTerm("");
    }, [isOpen, selectedMemberIds, tardyIds]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-none shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                        <h2 className="text-xl font-bold flex items-center gap-3 text-gray-900">
                            <ClipboardCheck size={24} className="text-[var(--color-text-main)]" />
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.16em] mb-1">{subtitle}</p>
                                <span>{title}</span>
                            </div>
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-none bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <MemberAttendancePicker
                        label="Members Present"
                        members={members}
                        selectedIds={localSelectedIds}
                        onChange={setLocalSelectedIds}
                        tardyIds={localTardyIds}
                        onTardyChange={setLocalTardyIds}
                        searchTerm={searchTerm}
                        onSearchTermChange={setSearchTerm}
                        maxHeightClass="max-h-[280px]"
                        showVisitorToggle
                    />

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Visitors / Non-Members</label>
                            <div className="w-full border border-gray-200 rounded-none p-3 text-center text-xl font-bold bg-white text-gray-900 shadow-sm h-[54px]">
                                {effectiveVisitorsCount}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 text-center">Total</label>
                            <div className="w-full bg-gray-50 text-gray-900 font-bold text-xl rounded-none p-3 flex items-center justify-center border border-[var(--color-primary-light)] shadow-sm h-[54px]">
                                {effectiveTotal}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#1e2333] p-4 px-6 flex items-center justify-end shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] relative z-10 transition-colors">
                    <div className="flex gap-4 items-center">
                        <button
                            onClick={onClose}
                            className="text-sm font-medium text-gray-300 hover:text-[var(--color-text-main)] transition-colors py-2 px-4"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onSave(localSelectedIds, localTardyIds);
                                onClose();
                            }}
                            className="bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] shadow-[0_4px_12px_rgba(37,99,235,0.2)] rounded-none px-8 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
                        >
                            <span className="inline-flex items-center gap-2">
                                <Check size={16} />
                                Finish Report
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceReportModal;
