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
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-4 hover:border-[var(--color-primary)] transition-all group relative cursor-pointer"
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete({ isOpen: true, id: activity.id });
                }}
                className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                title="Delete"
            >
                <Trash2 size={16} />
            </button>

            <div className="flex items-center gap-3">
                <div className="text-[var(--color-primary)]">
                    {activity.activity_type === 'visitation' ? <UserCheck size={20} /> :
                        activity.activity_type === 'bible_study' ? <BookOpen size={20} /> :
                            activity.activity_type === 'outreach' ? <Megaphone size={20} /> :
                                <Activity size={20} />}
                </div>
                <div>
                    <h3 className="font-bold text-[var(--color-text-main)] text-base">{getTypeLabel(activity.activity_type)}</h3>
                    <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] mt-0.5">
                        <Calendar size={12} />
                        {new Date(activity.activity_date).toLocaleDateString()}
                    </div>
                </div>
            </div>

            <div className="space-y-1.5 text-xs">
                {activity.area && (
                    <p className="text-[var(--color-text-muted)]">AREA: <span className="text-[var(--color-text-main)] font-semibold">{activity.area}</span></p>
                )}
                {activity.activity_type === 'visitation' && activity.activity_data?.visited_name && (
                    <p className="text-[var(--color-text-muted)]">VISITED: <span className="text-[var(--color-text-main)] font-semibold">{activity.activity_data.visited_name}</span></p>
                )}
                {activity.activity_type === 'bible_study' && (activity.activity_data?.student_name || activity.activity_data?.book) && (
                    <p className="text-[var(--color-text-muted)]">
                        STUDY: <span className="text-[var(--color-text-main)] font-semibold">
                            {activity.activity_data?.student_name || 'Unknown'} - {activity.activity_data?.book || 'No Book'}
                            {activity.activity_data?.session_number ? ` (${activity.activity_data.session_number})` : ''}
                        </span>
                    </p>
                )}
                {activity.activity_type === 'outreach' && activity.activity_data?.event_name && (
                    <p className="text-[var(--color-text-muted)]">EVENT: <span className="text-[var(--color-text-main)] font-semibold">{activity.activity_data.event_name}</span></p>
                )}
                {activity.activity_type === 'bible_study' && activity.bible_study_type === 'family' && activity.family_name && (
                    <p className="text-[var(--color-text-muted)]">FAMILY: <span className="text-[var(--color-text-main)] font-semibold">{activity.family_name}</span></p>
                )}
                {activity.activity_type === 'bible_study' && activity.activity_data?.format && activity.activity_data.format.length > 0 && (
                    <p className="text-[var(--color-text-muted)]">FORMAT: <span className="text-[var(--color-text-main)] font-semibold">{activity.activity_data.format.join(', ')}</span></p>
                )}
                {activity.activity_type === 'outreach' && activity.mission_church_name && (
                    <p className="text-[var(--color-text-muted)]">MISSION: <span className="text-[var(--color-text-main)] font-semibold">{activity.mission_church_name}</span></p>
                )}
                {(activity.activity_type === 'soul_winning' || activity.activity_type === 'outreach') && activity.tracts_distributed > 0 && (
                    <p className="text-[var(--color-text-muted)]">TRACTS: <span className="text-[var(--color-text-main)] font-semibold">{activity.tracts_distributed}</span></p>
                )}
            </div>

            {/* Flat Stat Line — No nested bg-gray-50 boxes! */}
            <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-light text-[var(--color-text-main)] leading-none" style={{ fontFamily: "var(--font-display, inherit)" }}>
                        {activity.total_attendance}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1">
                        <Users size={12} /> ATTENDANCE
                    </span>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-light text-red-600 leading-none" style={{ fontFamily: "var(--font-display, inherit)" }}>
                        {activity.souls_saved}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1">
                        <Heart size={12} className="text-red-500" /> SAVED
                    </span>
                </div>
            </div>
            
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-primary)] text-right group-hover:underline transition-all pt-1">
                View Details →
            </p>
        </div>
    );
};
