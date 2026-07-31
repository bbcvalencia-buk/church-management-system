import React from 'react';
import { Eye, Edit2, Plus } from 'lucide-react';
import { getLatestSundayISODate } from '@/lib/date';
import type { SundaySchoolSession } from '@/types';

interface DepartmentMeta {
    id: string;
    label: string;
    color: string;
}

interface ClassManagerProps {
    isChildTeacherOnly: boolean;
    CHILDREN_DEPARTMENTS: string[];
    DEPARTMENTS: DepartmentMeta[];
    DEPARTMENT_GROUPS: { id: string; label: string; departments: string[] }[];
    managedDepartmentIds: string[];
    sessions: SundaySchoolSession[];
    childrenSessions: SundaySchoolSession[];
    handleOpenModal: (session?: SundaySchoolSession) => void;
    handleOpenAttendanceViewer: (session: SundaySchoolSession) => void;
    setNewSession: React.Dispatch<React.SetStateAction<Partial<SundaySchoolSession>>>;
    setSelectedMemberIds: React.Dispatch<React.SetStateAction<string[]>>;
    setNewVisitors: React.Dispatch<React.SetStateAction<any[]>>;
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ClassManager: React.FC<ClassManagerProps> = ({
    isChildTeacherOnly,
    CHILDREN_DEPARTMENTS,
    DEPARTMENTS,
    DEPARTMENT_GROUPS,
    managedDepartmentIds,
    sessions,
    childrenSessions,
    handleOpenModal,
    handleOpenAttendanceViewer,
    setNewSession,
    setSelectedMemberIds,
    setNewVisitors,
    setIsModalOpen
}) => {
    return (
        <div className="space-y-10">
            {isChildTeacherOnly ? (
                <div key="children">
                    <div id="dept-children" className="px-3 py-2 text-sm font-bold uppercase tracking-widest text-gray-500">
                        Children
                    </div>
                    <div className="space-y-8">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-300 overflow-hidden">
                            <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style={{ backgroundColor: '#0088FE15', borderColor: '#0088FE30' }}>
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-3 text-[#0088FE]">
                                        <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: '#0088FE' }} />
                                        Children
                                    </h3>
                                    <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-widest">Read-Only Mode</p>
                                </div>
                                <div>
                                    <button
                                        onClick={() => {
                                            setNewSession({
                                                session_date: getLatestSundayISODate(),
                                                department: CHILDREN_DEPARTMENTS[0] as any,
                                                members_present: 0,
                                                visitors_present: 0,
                                                total_attendance: 0,
                                                souls_saved: 0
                                            });
                                            setSelectedMemberIds([]);
                                            setNewVisitors([]);
                                            setIsModalOpen(true);
                                        }}
                                        className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm bg-white hover:bg-gray-50"
                                        style={{ color: '#0088FE', border: '1px solid rgba(0, 136, 254, 0.25)' }}
                                    >
                                        <Plus size={16} /> File Children Report
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead className="bg-gray-50/50">
                                        <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                            <th className="p-4 pl-6">Date</th>
                                            <th className="p-4">Department</th>
                                            <th className="p-4 text-center">Members</th>
                                            <th className="p-4 text-center">Visitors</th>
                                            <th className="p-4 text-center">Total</th>
                                            <th className="p-4 text-center">Saved</th>
                                            <th className="p-4 pr-6 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {childrenSessions.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-gray-400 font-medium">No reports filed for Children yet.</td>
                                            </tr>
                                        ) : (
                                            childrenSessions.map((session) => {
                                                const dept = DEPARTMENTS.find((item) => item.id === session.department);
                                                return (
                                                    <tr key={session.id} className="hover:bg-gray-50/50 transition-colors text-sm group">
                                                        <td className="p-4 pl-6 font-semibold text-gray-900">
                                                            {new Date(session.session_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}
                                                        </td>
                                                        <td className="p-4 text-gray-500">{dept?.label || session.department}</td>
                                                        <td className="p-4 text-center text-gray-500 font-medium">{session.members_present}</td>
                                                        <td className="p-4 text-center text-gray-500 font-medium">{session.visitors_present}</td>
                                                        <td className="p-4 text-center font-bold text-gray-900 bg-gray-50">{session.total_attendance}</td>
                                                        <td className="p-4 text-center">
                                                            {(session.souls_saved || 0) > 0 ? (
                                                                <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold inline-block min-w-[28px]">
                                                                    {session.souls_saved}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 pr-6 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleOpenAttendanceViewer(session)}
                                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-emerald-200"
                                                                    title="View Attendance"
                                                                >
                                                                    <Eye size={14} /> Attendance
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenModal(session)}
                                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-blue-200"
                                                                    title="Edit Report"
                                                                >
                                                                    <Edit2 size={14} /> Edit
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                DEPARTMENT_GROUPS.filter((group) => group.departments.some((deptId) => managedDepartmentIds.includes(deptId))).map((group) => (
                    <div key={group.id}>
                        <div className="px-3 py-2 text-sm font-bold uppercase tracking-widest text-gray-500">
                            {group.label}
                        </div>
                        <div className="space-y-8">
                            {group.departments.map((deptId) => {
                                const dept = DEPARTMENTS.find((item) => item.id === deptId);
                                if (!dept) return null;
                                const isManaged = managedDepartmentIds.includes(dept.id);
                                const deptSessions = sessions.filter((s) => s.department === dept.id);
                                return (
                                    <div key={dept.id} id={`dept-${dept.id}`} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isManaged ? 'border-gray-300 shadow-md' : 'border-gray-100 opacity-90'}`}>
                                        {/* Department Header */}
                                        <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative" style={{ backgroundColor: `${dept.color}15`, borderColor: `${dept.color}30` }}>
                                            <div className="z-10 relative">
                                                <h3 className="text-xl font-bold flex items-center gap-3" style={{ color: isManaged ? dept.color : '#4b5563' }}>
                                                    {/* Dot indicator */}
                                                    <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: dept.color }}></span>
                                                    {dept.label}
                                                </h3>
                                                {!isManaged && <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-widest">Read-Only Mode</p>}
                                            </div>
                                            <div className="z-10 relative">
                                                {isManaged && (
                                                    <button
                                                        onClick={() => {
                                                            setNewSession({
                                                                session_date: getLatestSundayISODate(),
                                                                department: dept.id as any,
                                                                members_present: 0,
                                                                visitors_present: 0,
                                                                total_attendance: 0,
                                                                souls_saved: 0
                                                            });
                                                            setSelectedMemberIds([]);
                                                            setNewVisitors([]);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm bg-white hover:bg-gray-50"
                                                        style={{ color: dept.color, border: `1px solid ${dept.color}40` }}
                                                    >
                                                        <Plus size={16} /> File {dept.label} Report
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Department Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-[700px]">
                                                <thead className="bg-gray-50/50">
                                                    <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                        <th className="p-4 pl-6">Date</th>
                                                        <th className="p-4 text-center">Members</th>
                                                        <th className="p-4 text-center">Visitors</th>
                                                        <th className="p-4 text-center">Total</th>
                                                        <th className="p-4 text-center">Saved</th>
                                                        <th className="p-4 pr-6 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {deptSessions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="p-8 text-center text-gray-400 font-medium">No reports filed for {dept.label} yet.</td>
                                                        </tr>
                                                    ) : (
                                                        deptSessions.slice(0, 5).map((session) => (
                                                            <tr key={session.id} className="hover:bg-gray-50/50 transition-colors text-sm group">
                                                                <td className="p-4 pl-6 font-semibold text-gray-900">
                                                                    {new Date(session.session_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}
                                                                </td>
                                                                <td className="p-4 text-center text-gray-500 font-medium">{session.members_present}</td>
                                                                <td className="p-4 text-center text-gray-500 font-medium">{session.visitors_present}</td>
                                                                <td className="p-4 text-center font-bold text-gray-900 bg-gray-50">{session.total_attendance}</td>
                                                                <td className="p-4 text-center">
                                                                    {(session.souls_saved || 0) > 0 ? (
                                                                        <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold inline-block min-w-[28px]">
                                                                            {session.souls_saved}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 pr-6 text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            onClick={() => handleOpenAttendanceViewer(session)}
                                                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-emerald-200"
                                                                            title="View Attendance"
                                                                        >
                                                                            <Eye size={14} /> Attendance
                                                                        </button>
                                                                        {isManaged ? (
                                                                            <button
                                                                                onClick={() => handleOpenModal(session)}
                                                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-blue-200"
                                                                                title="Edit Report"
                                                                            >
                                                                                <Edit2 size={14} /> Edit
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setNewSession(session);
                                                                                    setIsModalOpen(true);
                                                                                }}
                                                                                className="px-3 py-1.5 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-gray-200"
                                                                                title="View Report"
                                                                            >
                                                                                <Eye size={14} /> View
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default ClassManager;
