import React from 'react';
import { BookOpen, Calendar, Heart, UserPlus, Users } from 'lucide-react';
import { getSundaySchoolScopeLabel } from '@/lib/sundaySchoolAccess';

interface SundaySchoolDashboardProps {
    currentMember: any;
    isSundaySchoolAdmin: boolean;
    teacherDepartments: any[];
    latestDate: string | null;
    totalAttendanceToday: number;
    thisMonthAttendance: number;
    thisMonthVisitors: number;
    thisMonthSaved: number;
}

const SundaySchoolDashboard: React.FC<SundaySchoolDashboardProps> = ({
    currentMember,
    isSundaySchoolAdmin,
    teacherDepartments,
    latestDate,
    totalAttendanceToday,
    thisMonthAttendance,
    thisMonthVisitors,
    thisMonthSaved,
}) => {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Header bar */}
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <BookOpen size={20} className="text-blue-600" /> Sunday School Overview
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Logged in as <span className="text-blue-600 font-semibold">{currentMember?.first_name} {currentMember?.surname}</span>
                        {!isSundaySchoolAdmin ? (
                            <span> — {getSundaySchoolScopeLabel(teacherDepartments)} Teacher</span>
                        ) : (
                            <span> — Admin</span>
                        )}
                    </p>
                </div>
                {latestDate && (
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Latest: {new Date(latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                <div className="px-5 py-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><Users size={12} /> Latest Sunday</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{totalAttendanceToday}</p>
                </div>
                <div className="px-5 py-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><Calendar size={12} /> This Month</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{thisMonthAttendance}</p>
                </div>
                <div className="px-5 py-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><UserPlus size={12} /> Visitors</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{thisMonthVisitors}</p>
                </div>
                <div className="px-5 py-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center gap-1.5"><Heart size={12} /> Souls Saved</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{thisMonthSaved}</p>
                </div>
            </div>
        </div>
    );
};

export default SundaySchoolDashboard;
