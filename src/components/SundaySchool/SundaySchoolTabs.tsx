import React from 'react';

interface DepartmentMeta {
    id: string;
    label: string;
    color: string;
}

interface SundaySchoolTabsProps {
    isChildTeacherOnly: boolean;
    DEPARTMENTS: DepartmentMeta[];
    managedDepartmentIds: string[];
    latestChildrenAttendance: number;
    latestDeptStats: Record<string, { attendance: number; trend: string }>;
}

const SundaySchoolTabs: React.FC<SundaySchoolTabsProps> = ({
    isChildTeacherOnly,
    DEPARTMENTS,
    managedDepartmentIds,
    latestChildrenAttendance,
    latestDeptStats,
}) => {
    return (
        <div className="px-6 py-3 flex flex-wrap gap-2">
            {(isChildTeacherOnly ? [{ id: 'children' as const, label: 'Children', color: '#0088FE' }] : DEPARTMENTS.filter((dept) => managedDepartmentIds.includes(dept.id))).map((dept) => {
                const stats = dept.id === 'children'
                    ? { attendance: latestChildrenAttendance }
                    : latestDeptStats[dept.id];
                return (
                    <button
                        key={dept.id}
                        onClick={() => document.getElementById(dept.id === 'children' ? 'dept-children' : `dept-${dept.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-none text-xs font-bold transition-all border hover:shadow-sm"
                        style={{
                            backgroundColor: `${dept.color}10`,
                            borderColor: `${dept.color}30`,
                            color: dept.color
                        }}
                    >
                        <span className="w-2 h-2 rounded-none" style={{ backgroundColor: dept.color }} />
                        {dept.label}
                        <span className="bg-white/80 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-black">
                            {stats?.attendance || 0}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default SundaySchoolTabs;
