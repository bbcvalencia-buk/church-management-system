import React from "react";
import { Mic, Users, BookOpen, Activity, Star, Lock } from "lucide-react";

interface ActivityHistoryProps {
    serviceAssignments: any[];
    goodnewsAssignments: any[];
    attendanceInsights: any;
    canManageProfiles: boolean;
    hasSystemAccess: boolean;
    member: any;
    sendingInvite: boolean;
    handleSendInvite: () => void;
}

const ActivityHistory: React.FC<ActivityHistoryProps> = ({
    serviceAssignments,
    goodnewsAssignments,
    attendanceInsights,
    canManageProfiles,
    hasSystemAccess,
    member,
    sendingInvite,
    handleSendInvite
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Left/Main Column - Participation History */}
            <div className="lg:col-span-8 space-y-6">
                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8 overflow-hidden">
                    <h3 className="text-[18px] font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Mic size={22} className="text-indigo-500" /> Detailed Service Participation
                    </h3>

                    {serviceAssignments.length > 0 ? (
                        <div className="space-y-6">
                            {/* Detailed Summary */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {Object.entries(serviceAssignments.reduce((acc: any, curr: any) => {
                                    acc[curr.role] = (acc[curr.role] || 0) + 1;
                                    return acc;
                                }, {})).map(([role, count]: [string, any]) => (
                                    <div key={role} className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl transition-all hover:bg-indigo-50">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{role.replace(/_/g, ' ')}</p>
                                        <p className="text-2xl font-black text-indigo-700">{count}<span className="text-xs ml-1 opacity-60">times</span></p>
                                    </div>
                                ))}
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-gray-100">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Date & Service Type</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Assigned Role</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest text-right">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {serviceAssignments.map((a, i) => (
                                            <tr key={i} className="hover:bg-gray-50/30 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <p className="font-bold text-gray-900">{a.service?.service_date ? new Date(a.service.service_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : 'N/A'}</p>
                                                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-tighter mt-0.5">{a.service?.service_type?.replace(/_/g, ' ')}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-black uppercase text-[10px] tracking-tight">{a.role.replace(/_/g, ' ')}</span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <p className="text-sm text-gray-500 italic font-medium">{a.notes ? `"${a.notes}"` : '—'}</p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                <Users className="text-gray-300" size={28} />
                            </div>
                            <p className="text-gray-900 font-bold">No Service Roles Recorded</p>
                            <p className="text-sm text-gray-500 mt-1">This member hasn't been assigned to any service roles yet.</p>
                        </div>
                    )}
                </div>

                {/* Goodnews Class Participation */}
                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8 overflow-hidden">
                    <h3 className="text-[18px] font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <BookOpen size={22} className="text-green-500" /> Goodnews Class Participation
                    </h3>

                    {goodnewsAssignments.length > 0 ? (
                        <div className="space-y-6">
                            {/* Detailed Summary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50/50 border border-green-100/50 p-4 rounded-2xl transition-all hover:bg-green-50">
                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Total Sessions Participated</p>
                                    <p className="text-2xl font-black text-green-700">{goodnewsAssignments.length}<span className="text-xs ml-1 opacity-60">sessions</span></p>
                                </div>
                                <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-2xl transition-all hover:bg-blue-50">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Unique Series Reached</p>
                                    <p className="text-2xl font-black text-blue-700">{new Set(goodnewsAssignments.map(a => a.session?.series_id)).size}<span className="text-xs ml-1 opacity-60">series</span></p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-gray-100">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Date & Series</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Assigned Role</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase text-gray-400 tracking-widest text-right">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {goodnewsAssignments.map((a, i) => (
                                            <tr key={i} className="hover:bg-gray-50/30 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <p className="font-bold text-gray-900">{a.session?.date ? new Date(a.session.date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : 'N/A'}</p>
                                                    <p className="text-[11px] font-bold text-green-600 uppercase tracking-tighter mt-0.5">{a.session?.series?.title || 'Unknown Series'} - Vol {a.session?.session_number || '?'}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 font-black uppercase text-[10px] tracking-tight">{a.role.replace(/_/g, ' ')}</span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <p className="text-sm text-gray-500 italic font-medium">{a.notes ? `"${a.notes}"` : '—'}</p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                <BookOpen className="text-gray-300" size={28} />
                            </div>
                            <p className="text-gray-900 font-bold">No Goodnews Class Records</p>
                            <p className="text-sm text-gray-500 mt-1">This member hasn't participated in any Goodnews Classes yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column - Attendance Insights */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity size={16} className="text-green-500" /> Basic Attendance
                    </h3>
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-green-50/50 border border-green-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Sunday Morning</p>
                                <p className="text-xs text-green-700/60 font-bold">Net Attendance</p>
                            </div>
                            <p className="text-3xl font-black text-green-700">{attendanceInsights.sundayMorningNet}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Sunday Afternoon</p>
                                <p className="text-xs text-blue-700/60 font-bold">Total Services</p>
                            </div>
                            <p className="text-3xl font-black text-blue-700">{attendanceInsights.sundayAfternoon}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Wednesday Prayer</p>
                                <p className="text-xs text-purple-700/60 font-bold">Midweek Service</p>
                            </div>
                            <p className="text-3xl font-black text-purple-700">{attendanceInsights.wednesdayPrayer}</p>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between px-2">
                                <p className="text-xs font-bold text-gray-400">Grand Total Services</p>
                                <p className="text-lg font-black text-gray-900">{attendanceInsights.totalPrimaryServices}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-600 rounded-[20px] p-6 text-white shadow-lg shadow-indigo-500/20">
                    <h4 className="font-bold flex items-center gap-2 mb-2">
                        <Star size={18} className="text-indigo-200" /> Engagement Level
                    </h4>
                    <p className="text-xs text-indigo-100 leading-relaxed mb-4">
                        Member has participated in {serviceAssignments.length} service roles across multiple departments.
                    </p>
                    <div className="h-2 bg-indigo-900/30 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-200 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, (serviceAssignments.length / 20) * 100)}%` }}
                        ></div>
                    </div>
                </div>

                {canManageProfiles && !hasSystemAccess && member.email && (
                    <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
                        <h4 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Lock size={16} /> System Access
                        </h4>
                        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                            This member has an email address but does not have system access yet. You can invite them to create a password and access the app.
                        </p>
                        <button
                            onClick={handleSendInvite}
                            disabled={sendingInvite}
                            className="w-full flex justify-center items-center py-2.5 px-4 border border-blue-200 rounded-xl text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            {sendingInvite ? 'Sending...' : 'Send App Invite'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityHistory;
