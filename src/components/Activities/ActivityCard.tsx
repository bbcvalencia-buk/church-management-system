import React from 'react';
import type { ActivityRecord } from './types';
import { getTypeLabel } from './utils';
import { Trash2, UserCheck, BookOpen, Megaphone, Activity, Calendar, Users, Heart } from 'lucide-react';

interface ActivityCardProps {
    activity: ActivityRecord;
    setViewActivity: (activity: ActivityRecord) => void;
    setConfirmDelete: (state: { isOpen: boolean; id: string | null }) => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ activity, setViewActivity, setConfirmDelete }) => {
    return (
        <div
            onClick={() => setViewActivity(activity)}
            className="bg-white border border-gray-200 rounded-none shadow-sm p-6 space-y-4 hover:border-[var(--color-primary)]/50 hover:shadow-md transition-all group relative cursor-pointer"
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete({ isOpen: true, id: activity.id });
                }}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
            >
                <Trash2 size={16} />
            </button>

            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-none flex items-center justify-center 
                    ${activity.activity_type === 'soul_winning' ? 'bg-red-50 text-red-500' :
                        activity.activity_type === 'bible_study' ? 'bg-gray-50 text-[var(--color-primary)]' :
                            activity.activity_type === 'visitation' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' :
                                'bg-[var(--color-primary-light)] text-[var(--color-primary)]'}`}
                >
                    {activity.activity_type === 'visitation' ? <UserCheck size={20} /> :
                        activity.activity_type === 'bible_study' ? <BookOpen size={20} /> :
                            activity.activity_type === 'outreach' ? <Megaphone size={20} /> :
                                <Activity size={20} />}
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">{getTypeLabel(activity.activity_type)}</h3>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <Calendar size={12} />
                        {new Date(activity.activity_date).toLocaleDateString()}
                    </div>
                </div>
            </div>

            <div className="space-y-2 text-sm">
                {activity.area && (
                    <p className="text-[var(--color-text-muted)]">Area: <span className="text-gray-900 font-medium">{activity.area}</span></p>
                )}
                {activity.activity_type === 'visitation' && activity.activity_data?.visited_name && (
                    <p className="text-[var(--color-text-muted)]">Visited: <span className="text-gray-900 font-medium">{activity.activity_data.visited_name}</span></p>
                )}
                {activity.activity_type === 'bible_study' && (activity.activity_data?.student_name || activity.activity_data?.book) && (
                    <p className="text-[var(--color-text-muted)]">
                        Study: <span className="text-gray-900 font-medium">
                            {activity.activity_data?.student_name || 'Unknown'} - {activity.activity_data?.book || 'No Book'}
                            {activity.activity_data?.session_number ? ` (${activity.activity_data.session_number})` : ''}
                        </span>
                    </p>
                )}
                {activity.activity_type === 'outreach' && activity.activity_data?.event_name && (
                    <p className="text-[var(--color-text-muted)]">Event: <span className="text-gray-900 font-medium">{activity.activity_data.event_name}</span></p>
                )}
                {activity.activity_type === 'bible_study' && activity.bible_study_type === 'family' && activity.family_name && (
                    <p className="text-[var(--color-text-muted)]">Family: <span className="text-gray-900 font-medium">{activity.family_name}</span></p>
                )}
                {activity.activity_type === 'bible_study' && activity.activity_data?.format && activity.activity_data.format.length > 0 && (
                    <p className="text-[var(--color-text-muted)]">Format: <span className="text-gray-900 font-medium">{activity.activity_data.format.join(', ')}</span></p>
                )}
                {activity.activity_type === 'outreach' && activity.mission_church_name && (
                    <p className="text-[var(--color-text-muted)]">Mission: <span className="text-gray-900 font-medium">{activity.mission_church_name}</span></p>
                )}
                {(activity.activity_type === 'soul_winning' || activity.activity_type === 'outreach') && activity.tracts_distributed > 0 && (
                    <p className="text-[var(--color-text-muted)]">Tracts: <span className="text-gray-900 font-medium">{activity.tracts_distributed}</span></p>
                )}
            </div>

            <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div className="text-center p-2 rounded bg-gray-50">
                    <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold mb-1">Attendance</p>
                    <p className="text-lg font-bold flex items-center justify-center gap-2">
                        <Users size={16} className="text-[var(--color-primary)]" />
                        {activity.total_attendance}
                    </p>
                </div>
                <div className="text-center p-2 rounded bg-gray-50">
                    <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold mb-1">Souls Saved</p>
                    <p className="text-lg font-bold flex items-center justify-center gap-2">
                        <Heart size={16} className="text-red-500" />
                        {activity.souls_saved}
                    </p>
                </div>
            </div>
            <p className="text-[10px] text-[var(--color-primary)]/70 mt-1 uppercase font-bold text-right group-hover:text-[var(--color-text-main)] transition-colors">Click to view details</p>
        </div>
    );
};
