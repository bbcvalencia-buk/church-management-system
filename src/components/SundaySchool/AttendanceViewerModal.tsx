import React from "react";
import type { SundaySchoolSession } from "@/types";
import { Users, X, Search, CheckCircle2, Clock, Star, Hash } from "lucide-react";

const DEPARTMENTS = [
    { id: 'adult', label: 'Adult Department', color: '#8884d8' },
    { id: 'beginners', label: 'Beginners Class', color: '#ffc658' },
    { id: 'nursery', label: 'Nursery/Toddler', color: '#ff8042' },
    { id: 'kinder', label: 'Kindergarten', color: '#ffc658' },
    { id: 'primary', label: 'Primary', color: '#8dd1e1' },
    { id: 'junior', label: 'Junior Department', color: '#0088FE' },
];

interface Props {
    session: SundaySchoolSession;
    members: any[];
    loading: boolean;
    search: string;
    onSearchChange: (v: string) => void;
    scores: Record<string, number | null>;
    scoreStats: Record<string, { totalScore: number; submissionCount: number }>;
    tardyIds: Set<string>;
    dayCounts: Record<string, number>;
    onClose: () => void;
}

const AttendanceViewerModal: React.FC<Props> = ({
    session,
    members,
    loading,
    search,
    onSearchChange,
    scores,
    scoreStats,
    tardyIds,
    dayCounts,
    onClose,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-none shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Users size={20} className="text-emerald-600" />
                            Attendance Details
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {DEPARTMENTS.find(d => d.id === session.department)?.label} — {new Date(session.session_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-none hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Summary bar */}
                <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-4 text-sm">
                    <span className="font-bold text-emerald-700">{members.length} present</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">Total: <strong>{session.total_attendance}</strong></span>
                    {(session.visitors_present || 0) > 0 && (
                        <>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-600">Visitors: <strong>{session.visitors_present}</strong></span>
                        </>
                    )}
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-gray-100">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search students..."
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-none bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Member List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading attendance data...</div>
                    ) : members.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <Users size={32} className="mx-auto mb-2 opacity-40" />
                            <p className="font-medium">No attendance records found</p>
                            <p className="text-xs mt-1">No members were marked present for this session.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            <div className="px-4 py-2.5 bg-gray-50/80 grid gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky top-0" style={{ gridTemplateColumns: '24px 1fr 60px 56px 56px' }}>
                                <div>#</div>
                                <div>Student Name</div>
                                <div className="text-center">Status</div>
                                <div className="text-center">Score</div>
                                <div className="text-center">Days</div>
                            </div>
                            {members
                                .filter((m) => {
                                    if (!search) return true;
                                    const term = search.toLowerCase();
                                    return `${m.first_name || ''} ${m.surname || ''}`.toLowerCase().includes(term);
                                })
                                .map((member, idx) => {
                                    const sessionScore = scores[member.id];
                                    const stats = scoreStats[member.id];
                                    return (
                                        <div
                                            key={member.id}
                                            className="px-4 py-2.5 items-center hover:bg-gray-50/50 transition-colors text-sm grid"
                                            style={{ gridTemplateColumns: '24px 1fr 60px 56px 56px', gap: '8px' }}
                                        >
                                            <div className="text-gray-400 font-medium text-xs">{idx + 1}</div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm truncate">
                                                    {member.first_name} {member.surname}
                                                </p>
                                                {stats && stats.submissionCount > 0 && (
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        Avg: {Math.round(stats.totalScore / stats.submissionCount)} ({stats.submissionCount}x)
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-center">
                                                {tardyIds.has(member.id) ? (
                                                    <span className="inline-flex items-center gap-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-none text-[10px] font-bold">
                                                        <Clock size={9} /> Tardy
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-none text-[10px] font-bold">
                                                        <CheckCircle2 size={9} /> Present
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-center">
                                                {sessionScore != null && sessionScore > 0 ? (
                                                    <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-none text-[10px] font-bold">
                                                        <Star size={9} /> {sessionScore}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </div>
                                            <div className="text-center">
                                                <span className="inline-flex items-center gap-0.5 bg-gray-50 text-blue-700 px-2 py-0.5 rounded-none text-[10px] font-bold">
                                                    <Hash size={9} />
                                                    {dayCounts[member.id] || 0}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-none border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-semibold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AttendanceViewerModal;
