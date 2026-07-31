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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Hero Stat Block */}
            <div className="md:col-span-2 bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Users size={120} />
                </div>
                <div>
                    <p className="text-sm font-bold tracking-widest text-gray-400 uppercase flex items-center gap-2 mb-3">
                        <Users size={16} className="text-blue-500" /> Latest Sunday Attendance
                    </p>
                    <p className="text-7xl md:text-8xl font-black text-gray-900 tracking-tighter" style={{ fontFamily: 'var(--font-display, "Outfit", sans-serif)' }}>
                        {totalAttendanceToday}
                    </p>
                </div>
                
                <div className="mt-12 pt-8 border-t border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <BookOpen size={20} className="text-[var(--color-text-main)]" /> Sunday School Overview
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Logged in as <span className="text-[var(--color-text-main)] font-semibold">{currentMember?.first_name} {currentMember?.surname}</span>
                        {!isSundaySchoolAdmin ? (
                            <span> — {getSundaySchoolScopeLabel(teacherDepartments)} Teacher</span>
                        ) : (
                            <span> — Admin</span>
                        )}
                    </p>
                    {latestDate && (
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">
                            Latest Report: {new Date(latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    )}
                </div>
            </div>

            {/* Smaller Stats Stack */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-200 flex flex-col justify-center">
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2 mb-2">
                        <Calendar size={14} className="text-emerald-500" /> This Month
                    </p>
                    <p className="text-5xl font-black text-gray-900 tracking-tight" style={{ fontFamily: 'var(--font-display, "Outfit", sans-serif)' }}>
                        {thisMonthAttendance}
                    </p>
                </div>
                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-200 flex flex-col justify-center">
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2 mb-2">
                        <UserPlus size={14} className="text-purple-500" /> Visitors
                    </p>
                    <p className="text-5xl font-black text-gray-900 tracking-tight" style={{ fontFamily: 'var(--font-display, "Outfit", sans-serif)' }}>
                        {thisMonthVisitors}
                    </p>
                </div>
                <div className="bg-gray-900 rounded-[2rem] p-8 shadow-sm flex flex-col justify-center relative overflow-hidden">
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2 mb-2 z-10 relative">
                        <Heart size={14} className="text-pink-500" /> Souls Saved
                    </p>
                    <p className="text-5xl font-black text-[var(--color-text-main)] tracking-tight z-10 relative" style={{ fontFamily: 'var(--font-display, "Outfit", sans-serif)' }}>
                        {thisMonthSaved}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SundaySchoolDashboard;
