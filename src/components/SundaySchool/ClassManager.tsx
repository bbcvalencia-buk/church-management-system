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
                    <div id="dept-children" className="py-2 text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 mb-4">
                        Children
                    </div>
                    <div className="space-y-8">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
                                <div>
                                    <h3 className="text-3xl font-black tracking-tight flex items-center gap-3 text-gray-900" style={{ fontFamily: 'var(--font-display, "Outfit", sans-serif)' }}>
                                        <span className="w-4 h-4 rounded-none shadow-sm" style={{ backgroundColor: '#0088FE' }} />
                                        Children
                                    </h3>
                                    <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Read-Only Mode</p>
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
                                        className="px-6 py-3 rounded-none flex items-center gap-2 text-sm font-bold transition-all bg-gray-900 text-[var(--color-text-main)] hover:bg-gray-800 hover:-translate-y-0.5"
                                    >
                                        <Plus size={16} /> File Children Report
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto bg-white rounded-[2rem] border border-gray-100 shadow-sm">
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
                                                                <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-none text-xs font-bold inline-block min-w-[28px]">
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
                                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-none text-xs font-bold transition-colors flex items-center gap-1.5 border border-emerald-200"
                                                                    title="View Attendance"
                                                                >
                                                                    <Eye size={14} /> Attendance
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenModal(session)}
                                                                    className="px-3 py-1.5 bg-gray-50 text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] rounded-none text-xs font-bold transition-colors flex items-center gap-1.5 border border-[var(--color-primary-light)]"
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
                        <div className="py-2 text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 mb-4">
                            {group.label}
                        </div>
                        <div className="space-y-12">
                            {group.departments.map((deptId) => {
                                const dept = DEPARTMENTS.find((item) => item.id === deptId);
                                if (!dept) return null;
                                const isManaged = managedDepartmentIds.includes(dept.id);
                                const deptSessions = sessions.filter((s) => s.department === dept.id);
                                return (
                                    <div key={dept.id} id={`dept-${dept.id}`} className={`flex flex-col gap-6 pt-4 ${!isManaged ? 'opacity-80' : ''}`}>
                                        {/* Department Header */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="z-10 relative">
                                                <h3 className="text-3xl font-black tracking-tight flex items-center gap-3 text-gray-900" style={{ fontFamily: 'var(--font-display, "Outfit", sans-serif)' }}>
                                                    {/* Dot indicator */}
                                                    <span className="w-4 h-4 rounded-none shadow-sm" style={{ backgroundColor: dept.color }}></span>
                                                    {dept.label}
                                                </h3>
                                                {!isManaged && <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Read-Only Mode</p>}
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
                                                        className="px-6 py-3 rounded-none flex items-center gap-2 text-sm font-bold transition-all text-[var(--color-text-main)] hover:opacity-90 hover:-translate-y-0.5 shadow-sm"
                                                        style={{ backgroundColor: dept.color }}
                                                    >
                                                        <Plus size={16} /> File {dept.label} Report
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Department Table */}
                                        <div className="overflow-x-auto bg-white rounded-[2rem] border border-gray-100 shadow-sm">
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
                                                                        <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-none text-xs font-bold inline-block min-w-[28px]">
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
                                                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-none text-xs font-bold transition-colors flex items-center gap-1.5 border border-emerald-200"
                                                                            title="View Attendance"
                                                                        >
                                                                            <Eye size={14} /> Attendance
                                                                        </button>
                                                                        {isManaged ? (
                                                                            <button
                                                                                onClick={() => handleOpenModal(session)}
                                                                                className="px-3 py-1.5 bg-gray-50 text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] rounded-none text-xs font-bold transition-colors flex items-center gap-1.5 border border-[var(--color-primary-light)]"
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
                                                                                className="px-3 py-1.5 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-none text-xs font-bold transition-colors flex items-center gap-1.5 border border-gray-200"
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
