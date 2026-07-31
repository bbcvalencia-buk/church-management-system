import React from 'react';
import { ArrowLeft, MapPin, Calendar, User, Edit2, Plus, Users, Heart, Activity, Trash2 } from 'lucide-react';
import type { GoodnewsSeries, GoodnewsSession, GoodnewsSessionRole } from '@/types';
import { ROLE_LABELS } from '@/views/GoodnewsClass';

interface SeriesDetailsProps {
    series: GoodnewsSeries;
    sessions: GoodnewsSession[];
    canManageSessions: boolean;
    isTeacher: boolean;
    onBack: () => void;
    onEditSeries: () => void;
    onAddSession: () => void;
    onEditSession: (session: GoodnewsSession) => void;
    onDeleteSession: (sessionId: string) => void;
}

const SeriesDetails: React.FC<SeriesDetailsProps> = ({
    series,
    sessions,
    canManageSessions,
    isTeacher,
    onBack,
    onEditSeries,
    onAddSession,
    onEditSession,
    onDeleteSession
}) => {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-10 h-10 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-[var(--color-text-main)] transition-colors shadow-sm"
                >
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${series.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                            series.status === 'completed' ? 'bg-gray-200 text-gray-800' :
                                'bg-amber-100 text-amber-800'
                            }`}>{series.status}</span>
                    </div>
                    <h2 className="text-3xl font-black text-[var(--color-text-main)] leading-tight">{series.area}</h2>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-sm">
                    <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)] flex-wrap">
                        {series.location && <span className="flex items-center gap-1.5 font-bold"><MapPin size={16} className="text-red-400" /> {series.location}</span>}
                        <span className="flex items-center gap-1.5"><Calendar size={16} className="text-[var(--color-primary)]" /> Started: {new Date(series.start_date).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1.5 bg-[var(--color-surface-hover)] px-3 py-1 border border-[var(--color-border)]">
                            <User size={14} className="text-[var(--color-text-muted)]" />
                            Lead: <span className="font-bold text-[var(--color-text-main)]">{series.lead_member ? `${series.lead_member.first_name} ${series.lead_member.surname}` : 'None'}</span>
                        </span>
                    </div>
                    {series.notes && (
                        <p className="mt-4 text-[var(--color-text-muted)] text-sm max-w-3xl leading-relaxed bg-[var(--color-surface-hover)] p-4 border border-[var(--color-border)] font-medium">{series.notes}</p>
                    )}
                </div>

                <div className="w-full md:w-64 flex flex-col gap-3 shrink-0">
                    {(canManageSessions || isTeacher) && (
                        <>
                            <button
                                onClick={onEditSeries}
                                className="w-full py-2.5 bg-[var(--color-surface-hover)] text-[var(--color-text-main)] border border-[var(--color-border)] font-bold hover:bg-[var(--color-border)] transition-colors flex items-center gap-2 text-sm justify-center shadow-sm"
                            >
                                <Edit2 size={16} /> Edit Series
                            </button>
                            <button
                                onClick={onAddSession}
                                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm shadow-sm font-bold"
                            >
                                <Plus size={16} /> Add Session
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[var(--color-surface-hover)] p-6 border border-[var(--color-border)]">
                <div className="flex items-center gap-4 bg-[var(--color-surface)] p-4 shadow-sm border border-[var(--color-border)]">
                    <div className="p-3 bg-[var(--color-primary-light)]/50"><Calendar className="text-[var(--color-primary)]" size={24} /></div>
                    <div>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Total Sessions</p>
                        <p className="text-2xl font-black text-[var(--color-text-main)]">{sessions.length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-[var(--color-surface)] p-4 shadow-sm border border-[var(--color-border)]">
                    <div className="p-3 bg-sky-50"><Users className="text-sky-500" size={24} /></div>
                    <div>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Children Reached</p>
                        <p className="text-2xl font-black text-[var(--color-text-main)]">{sessions.reduce((sum, s) => sum + (s.children_count || 0), 0)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-[var(--color-surface)] p-4 shadow-sm border border-[var(--color-border)]">
                    <div className="p-3 bg-rose-50"><Heart className="text-rose-500" size={24} /></div>
                    <div>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Souls Saved</p>
                        <p className="text-2xl font-black text-[var(--color-text-main)]">{sessions.reduce((sum, s) => sum + (s.souls_saved_count || 0), 0)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-sm">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-[var(--color-border)]">
                    <h3 className="text-lg font-black flex items-center gap-2 text-[var(--color-text-main)]">
                        <Activity size={20} className="text-[var(--color-primary)]" /> Session History
                    </h3>
                </div>

                {sessions.length === 0 ? (
                    <div className="text-center py-16 bg-[var(--color-surface-hover)] border border-dashed border-[var(--color-border)]">
                        <div className="w-12 h-12 bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
                            <Calendar className="text-[var(--color-text-muted)]" size={24} />
                        </div>
                        <p className="text-[var(--color-text-main)] font-bold">No Sessions Recorded</p>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1 font-medium">Add a session to track attendance and souls saved.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sessions.map((session) => (
                            <div key={session.id} className="flex flex-col md:flex-row gap-6 p-6 border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] transition-all">
                                <div className="md:w-32 shrink-0 flex flex-col items-start md:border-r border-[var(--color-border)] pr-4">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Session #{session.session_number}</span>
                                    <span className="font-bold text-[var(--color-text-main)] text-sm">
                                        {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>

                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-bold text-[var(--color-text-main)] text-lg">
                                            {session.lesson_topic || 'Standard Session'}
                                        </h4>
                                        <div className="flex gap-2">
                                            {(canManageSessions || isTeacher) && (
                                                <>
                                                    <button
                                                        onClick={() => onEditSession(session)}
                                                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors p-1"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteSession(session.id!)}
                                                        className="text-[var(--color-text-muted)] hover:text-red-600 transition-colors p-1"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-6 mb-4 bg-[var(--color-surface-hover)] p-3 border border-[var(--color-border)] w-max">
                                        <div className="flex items-center gap-3">
                                            <Users size={16} className="text-sky-600" />
                                            <div>
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] mr-2">Children</span>
                                                <span className="font-black text-[var(--color-text-main)]">{session.children_count}</span>
                                            </div>
                                        </div>
                                        <div className="w-px bg-[var(--color-border)]"></div>
                                        <div className="flex items-center gap-3">
                                            <Heart size={16} className="text-rose-600" />
                                            <div>
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] mr-2">Saved</span>
                                                <span className="font-black text-[var(--color-text-main)]">{session.souls_saved_count}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {session.notes && (
                                        <p className="mb-4 text-sm text-[var(--color-text-muted)] italic border-l-2 border-[var(--color-border)] pl-3 font-medium">"{session.notes}"</p>
                                    )}

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Members Participated ({session.members?.length || 0})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {session.members && session.members.length > 0 ? (
                                                session.members.map((m: any, idx: number) => (
                                                    <div key={idx} className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] px-3 py-1.5 flex items-center gap-2">
                                                        <div>
                                                            <p className="text-xs font-bold text-[var(--color-text-main)] leading-tight">{m.member?.first_name} {m.member?.surname}</p>
                                                            <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider leading-tight">{ROLE_LABELS[m.role as GoodnewsSessionRole]}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-xs text-[var(--color-text-muted)] italic font-bold bg-[var(--color-surface-hover)] px-3 py-1 border border-[var(--color-border)]">No members marked.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeriesDetails;
