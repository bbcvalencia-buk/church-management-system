import React, { useState, useEffect } from 'react';
import * as goodnewsService from '@/services/goodnewsService';
import * as memberService from '@/services/memberService';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, type GoodnewsSeries, type GoodnewsSession, type GoodnewsSessionRole } from '@/types';
import {
    Plus,
    Search,
    ChevronRight,
    Calendar,
    MapPin,
    Users,
    Heart,
    BookOpen,
    ArrowLeft,
    CheckCircle2,
    X,
    User,
    Edit2,
    Trash2,
    Activity,
    ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';

export const ROLES: GoodnewsSessionRole[] = ['teacher', 'helper', 'musician', 'accompanist', 'driver', 'other'];
export const ROLE_LABELS: Record<GoodnewsSessionRole, string> = {
    teacher: 'Teacher',
    helper: 'Helper',
    musician: 'Musician',
    accompanist: 'Accompanist',
    driver: 'Driver',
    other: 'Other'
};

const GoodnewsClass = () => {
    const { roles, member } = useAuth();
    const { showToast } = useToast();
    const canManageSessions = roles.includes(UserRole.CHURCH_ADMINISTRATOR) || roles.includes(UserRole.CHURCH_CLERK);
    const isTeacher = roles.includes(UserRole.GOODNEWS_TEACHER);

    const [activeTab, setActiveTab] = useState<'ongoing' | 'completed' | 'paused'>('ongoing');
    const [seriesList, setSeriesList] = useState<GoodnewsSeries[]>([]);
    const [loading, setLoading] = useState(true);

    // View state
    const [viewingSeries, setViewingSeries] = useState<GoodnewsSeries | null>(null);
    const [seriesSessions, setSeriesSessions] = useState<any[]>([]);

    // Modals
    const [showSeriesForm, setShowSeriesForm] = useState(false);
    const [showSessionForm, setShowSessionForm] = useState(false);

    // Series Form Data
    const [seriesForm, setSeriesForm] = useState<Partial<GoodnewsSeries>>({
        status: 'ongoing',
        start_date: new Date().toISOString().split('T')[0]
    });

    // Session Form Data
    const [sessionForm, setSessionForm] = useState<Partial<GoodnewsSession>>({
        date: new Date().toISOString().split('T')[0],
        children_count: 0,
        souls_saved_count: 0
    });

    const [members, setMembers] = useState<any[]>([]);
    const [sessionMembers, setSessionMembers] = useState<any[]>([]);

    const [submitting, setSubmitting] = useState(false);
    const [actionNotice, setActionNotice] = useState<string | null>(null);

    // Deletion Modal
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, type: 'series' | 'session', id: string | null }>({ isOpen: false, type: 'series', id: null });

    useEffect(() => {
        fetchSeries();
        fetchMembers();
    }, [isTeacher, canManageSessions, member?.id]);

    const fetchSeries = async () => {
        setLoading(true);
        try {
            if (isTeacher && !canManageSessions) {
                if (!member?.id) {
                    setSeriesList([]);
                    return;
                }
                const assignments = await goodnewsService.getGoodnewsAssignmentsByMember(member.id);
                const seen = new Map<string, GoodnewsSeries>();
                for (const row of (assignments || []) as any[]) {
                    const series = row?.session?.series;
                    if (series?.id && !seen.has(series.id)) {
                        seen.set(series.id, series);
                    }
                }
                setSeriesList(Array.from(seen.values()));
                return;
            }

            const data = await goodnewsService.getGoodnewsSeries();
            setSeriesList((data || []) as any[]);
        } catch (e) {
            console.error("Goodnews series not found", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const data = await memberService.getActiveMembers();
            setMembers(data || []);
        } catch (e) {
            console.error("Error fetching members:", e);
        }
    };

    const loadSeriesDetails = async (series: GoodnewsSeries) => {
        setViewingSeries(series);
        try {
            const data = await goodnewsService.getGoodnewsSessionsBySeries(series.id);
            setSeriesSessions(data || []);
        } catch (e) { /* ignore */ }
    };

    const handleSaveSeries = async () => {
        setSubmitting(true);
        try {
            const isEditing = !!seriesForm.id;
            const payload = {
                id: seriesForm.id,
                title: seriesForm.area, // Title is now automatically the area
                area: seriesForm.area,
                location: seriesForm.location,
                start_date: seriesForm.start_date,
                end_date: seriesForm.status === 'completed' && !seriesForm.end_date ? new Date().toISOString().split('T')[0] : seriesForm.end_date,
                lead_member_id: seriesForm.lead_member_id,
                status: seriesForm.status,
                notes: seriesForm.notes
            };

            await goodnewsService.upsertGoodnewsSeries(payload);

            fetchSeries();
            setShowSeriesForm(false);
            const areaName = payload.area || 'Goodnews Area';
            const notice = isEditing
                ? `Goodnews Area updated: ${areaName}`
                : `Goodnews Area created: ${areaName}`;
            setActionNotice(notice);
            showToast(notice, 'success');
            if (viewingSeries && seriesForm.id === viewingSeries.id) {
                setViewingSeries({ ...viewingSeries, ...payload } as any);
            }
        } catch (e) {
            alert('Error saving series');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveSession = async () => {
        setSubmitting(true);
        try {
            const isEditing = !!sessionForm.id;
            const sessionPayload = {
                id: sessionForm.id,
                series_id: viewingSeries?.id,
                session_number: sessionForm.session_number,
                date: sessionForm.date,
                lesson_topic: sessionForm.lesson_topic,
                children_count: sessionForm.children_count || 0,
                souls_saved_count: sessionForm.souls_saved_count || 0,
                notes: sessionForm.notes
            };

            const savedSession = await goodnewsService.upsertGoodnewsSession(sessionPayload);

            if (savedSession?.id || sessionForm.id) {
                const sessionId = savedSession?.id || sessionForm.id!;
                await goodnewsService.updateGoodnewsSessionMembers(sessionId, sessionPayload.date!, sessionMembers);
            }

            if (viewingSeries) loadSeriesDetails(viewingSeries);
            setShowSessionForm(false);
            const notice = isEditing ? 'Session updated successfully.' : 'Session created successfully.';
            setActionNotice(notice);
            showToast(notice, 'success');
        } catch (e: any) {
            alert('Error saving session: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete.id) return;
        setSubmitting(true);
        try {
            if (confirmDelete.type === 'series') {
                const deletedSeriesName = viewingSeries?.area || 'Goodnews Area';
                await goodnewsService.deleteGoodnewsSeries(confirmDelete.id);
                fetchSeries();
                setViewingSeries(null);
                const notice = `Goodnews Area deleted: ${deletedSeriesName}`;
                setActionNotice(notice);
                showToast(notice, 'success');
            } else if (confirmDelete.type === 'session') {
                await goodnewsService.deleteGoodnewsSession(confirmDelete.id);
                if (viewingSeries) loadSeriesDetails(viewingSeries);
                const notice = 'Session deleted successfully.';
                setActionNotice(notice);
                showToast(notice, 'success');
            }
            setConfirmDelete({ isOpen: false, type: 'series', id: null });
        } catch (e) {
            alert('Delete failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto space-y-6 pb-20 font-sans">
            {actionNotice && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center justify-between">
                    <div className="text-sm font-semibold">{actionNotice}</div>
                    <button
                        onClick={() => setActionNotice(null)}
                        className="text-xs font-bold px-2 py-1 rounded border border-green-300 hover:bg-green-100"
                    >
                        Dismiss
                    </button>
                </div>
            )}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <BookOpen className="text-blue-600" size={32} />
                        Goodnews Classes
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">Manage Goodnews series, locations, children attendance, and members involved.</p>
                </div>
                {canManageSessions && !viewingSeries && (
                    <button
                        onClick={() => { setSeriesForm({ status: 'ongoing', start_date: new Date().toISOString().split('T')[0] }); setShowSeriesForm(true); }}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={18} /> Goodnews Area
                    </button>
                )}
            </div>

            {!viewingSeries ? (
                // SERIES LIST VIEW
                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
                    <div className="flex border-b border-gray-100 mb-6">
                        {['ongoing', 'completed', 'paused'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-6 py-3 font-bold text-sm tracking-wide capitalize transition-colors ${activeTab === tab
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? <p className="text-gray-500 col-span-full">Loading...</p> :
                            seriesList.filter(s => s.status === activeTab).length === 0 ?
                                <p className="text-gray-500 col-span-full py-8 text-center italic border border-dashed border-gray-200 rounded-xl bg-gray-50">No {activeTab} Goodnews areas found.</p> :
                                seriesList.filter(s => s.status === activeTab).map(series => (
                                    <div
                                        key={series.id}
                                        onClick={() => loadSeriesDetails(series)}
                                        className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white shadow-sm flex flex-col"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-black text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{series.area}</h3>
                                            <span className={`text-[10px] shrink-0 font-bold uppercase px-2 py-1 rounded-full ${series.status === 'ongoing' ? 'bg-green-100 text-green-700' :
                                                series.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>{series.status}</span>
                                        </div>

                                        <div className="space-y-2 flex-1 mt-2 text-sm">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-gray-600 font-medium">
                                                    <MapPin size={16} className="text-red-400" />
                                                    <span>{series.area}</span>
                                                </div>
                                                {series.location && (
                                                    <div className="pl-6 text-xs text-gray-500 italic">
                                                        {series.location}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-gray-50">
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <User size={14} className="text-blue-400" />
                                                    <span className="font-medium text-xs">Lead: {series.lead_member ? `${series.lead_member.first_name} ${series.lead_member.surname}` : 'Unassigned'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 mt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                                            <div className="bg-gray-50 rounded-lg p-2 flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400" />
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400 leading-tight">Started</p>
                                                    <p className="text-xs font-black text-gray-700 leading-tight">{new Date(series.start_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end text-blue-600 font-bold text-sm">
                                                View <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                        }
                    </div>
                </div>
            ) : (
                // SERIES DETAILS VIEW
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    <button
                        onClick={() => setViewingSeries(null)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors bg-white px-4 py-2 border border-gray-200 rounded-full shadow-sm w-max"
                    >
                        <ArrowLeft size={16} /> Back to Goodnews Areas
                    </button>

                    <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${viewingSeries.status === 'ongoing' ? 'bg-green-100 text-green-700' :
                                        viewingSeries.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>{viewingSeries.status}</span>
                                </div>
                                <h2 className="text-3xl font-black text-gray-900">{viewingSeries.area}</h2>
                                <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                                    {viewingSeries.location && <span className="flex items-center gap-1.5 font-bold"><MapPin size={16} className="text-red-400" /> {viewingSeries.location}</span>}
                                    <span className="flex items-center gap-1.5"><Calendar size={16} className="text-blue-400" /> Started: {new Date(viewingSeries.start_date).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                                        <User size={14} className="text-gray-400" />
                                        Lead: <span className="font-bold">{viewingSeries.lead_member ? `${viewingSeries.lead_member.first_name} ${viewingSeries.lead_member.surname}` : 'None'}</span>
                                    </span>
                                </div>
                                {viewingSeries.notes && (
                                    <p className="mt-4 text-gray-500 text-sm max-w-3xl leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{viewingSeries.notes}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                {canManageSessions && (
                                    <button
                                        onClick={() => {
                                            setSeriesForm(viewingSeries);
                                            setShowSeriesForm(true);
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm justify-center"
                                    >
                                        <Edit2 size={16} /> Edit Series
                                    </button>
                                )}
                                {(canManageSessions || isTeacher) && (
                                    <button
                                        onClick={() => {
                                            setSessionForm({
                                                series_id: viewingSeries.id,
                                                session_number: seriesSessions.length > 0 ? seriesSessions[0].session_number + 1 : 1,
                                                date: new Date().toISOString().split('T')[0],
                                                children_count: 0,
                                                souls_saved_count: 0
                                            });
                                            setSessionMembers([]);
                                            setShowSessionForm(true);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/20 text-sm justify-center"
                                    >
                                        <Plus size={16} /> Add Session
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div className="p-3 bg-blue-50 rounded-xl"><Calendar className="text-blue-500" size={24} /></div>
                                <div>
                                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Total Sessions</p>
                                    <p className="text-2xl font-black text-gray-900">{seriesSessions.length}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div className="p-3 bg-sky-50 rounded-xl"><Users className="text-sky-500" size={24} /></div>
                                <div>
                                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Children Reached</p>
                                    <p className="text-2xl font-black text-gray-900">{seriesSessions.reduce((sum, s) => sum + (s.children_count || 0), 0)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div className="p-3 bg-rose-50 rounded-xl"><Heart className="text-rose-500" size={24} /></div>
                                <div>
                                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Souls Saved</p>
                                    <p className="text-2xl font-black text-gray-900">{seriesSessions.reduce((sum, s) => sum + (s.souls_saved_count || 0), 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                                <Activity size={20} className="text-amber-500" /> Session History
                            </h3>
                        </div>

                        {seriesSessions.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                    <Calendar className="text-gray-300" size={28} />
                                </div>
                                <p className="text-gray-900 font-bold">No Sessions Recorded</p>
                                <p className="text-sm text-gray-500 mt-1">Add a session to track attendance and souls saved.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                                {seriesSessions.map((session) => (
                                    <div key={session.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-black text-sm absolute left-0 md:left-1/2">
                                            #{session.session_number}
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all ml-12 md:ml-0">
                                            <div className="flex justify-between items-start mb-4 gap-4">
                                                <div>
                                                    <h4 className="font-bold text-gray-900 flex flex-col gap-1">
                                                        <span className="text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-max">
                                                            {new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </span>
                                                        {session.lesson_topic || 'Standard Session'}
                                                    </h4>
                                                </div>
                                                <div className="flex gap-2">
                                                    {(canManageSessions || isTeacher) && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setSessionForm(session);
                                                                    setSessionMembers(session.members || []);
                                                                    setShowSessionForm(true);
                                                                }}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete({ isOpen: true, type: 'session', id: session.id })}
                                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-6 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                                                        <Users size={14} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 leading-tight">Children</p>
                                                        <p className="font-black text-gray-900 leading-tight">{session.children_count}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                                        <Heart size={14} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 leading-tight">Souls Saved</p>
                                                        <p className="font-black text-gray-900 leading-tight">{session.souls_saved_count}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {session.notes && (
                                                <div className="mb-4 text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3">"{session.notes}"</div>
                                            )}

                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Members Participated ({session.members?.length || 0})</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {session.members && session.members.length > 0 ? (
                                                        session.members.map((m: any, idx: number) => (
                                                            <div key={idx} className="bg-white border border-gray-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
                                                                <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[9px] font-bold">
                                                                    {m.member?.first_name?.[0]}{m.member?.surname?.[0]}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-gray-900 leading-tight">{m.member?.first_name} {m.member?.surname}</p>
                                                                    <p className="text-[9px] text-gray-500 uppercase tracking-wider leading-tight">{ROLE_LABELS[m.role as GoodnewsSessionRole]}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic bg-gray-50 px-3 py-1 rounded-md border border-gray-100">No members marked.</span>
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
            )
            }

            {/* Series Form Modal */}
            {
                showSeriesForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                                    <BookOpen size={20} className="text-blue-600" />
                                    {seriesForm.id ? 'Edit Goodnews Area' : 'Create Goodnews Area'}
                                </h2>
                                <button onClick={() => setShowSeriesForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-white rounded-md border border-gray-200">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Area/Barangay *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Bagontaas"
                                            value={seriesForm.area || ''}
                                            onChange={(e) => setSeriesForm({ ...seriesForm, area: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Specific Location</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Purok 5 Covered Court"
                                            value={seriesForm.location || ''}
                                            onChange={(e) => setSeriesForm({ ...seriesForm, location: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Lead Teacher</label>
                                        <select
                                            value={seriesForm.lead_member_id || ''}
                                            onChange={(e) => setSeriesForm({ ...seriesForm, lead_member_id: e.target.value || undefined })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        >
                                            <option value="">-- Unassigned --</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>{m.first_name} {m.surname}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Status</label>
                                        <select
                                            value={seriesForm.status || 'ongoing'}
                                            onChange={(e) => setSeriesForm({ ...seriesForm, status: e.target.value as any })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all font-bold"
                                        >
                                            <option value="ongoing">Ongoing</option>
                                            <option value="paused">Paused</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Start Date *</label>
                                        <input
                                            type="date"
                                            required
                                            value={seriesForm.start_date || ''}
                                            onChange={(e) => setSeriesForm({ ...seriesForm, start_date: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">End Date</label>
                                        <input
                                            type="date"
                                            disabled={seriesForm.status !== 'completed'}
                                            value={seriesForm.end_date || ''}
                                            onChange={(e) => setSeriesForm({ ...seriesForm, end_date: e.target.value })}
                                            className="w-full disabled:bg-gray-100 disabled:text-gray-400 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Notes / Description</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Any additional information..."
                                        value={seriesForm.notes || ''}
                                        onChange={(e) => setSeriesForm({ ...seriesForm, notes: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="p-4 px-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                                {seriesForm.id ? (
                                    <button
                                        onClick={() => setConfirmDelete({ isOpen: true, type: 'series', id: seriesForm.id! })}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest"
                                    >
                                        Delete
                                    </button>
                                ) : <div></div>}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowSeriesForm(false)}
                                        className="px-4 py-2 font-bold text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveSeries}
                                        disabled={submitting || !seriesForm.area || !seriesForm.start_date}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {submitting ? 'Saving...' : 'Save Area'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Session Form Modal */}
            {
                showSessionForm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                                    <ClipboardList size={20} className="text-green-600" />
                                    {sessionForm.id ? 'Edit Session' : 'Add New Session'}
                                </h2>
                                <button onClick={() => setShowSessionForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-white rounded-md border border-gray-200">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Session Number</label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={sessionForm.session_number || ''}
                                            onChange={(e) => setSessionForm({ ...sessionForm, session_number: parseInt(e.target.value) || 1 })}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={sessionForm.date || ''}
                                            onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-lg text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Lesson Topic (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Creation"
                                        value={sessionForm.lesson_topic || ''}
                                        onChange={(e) => setSessionForm({ ...sessionForm, lesson_topic: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                                    <div>
                                        <label className="block text-[10px] items-center gap-1 font-bold text-sky-600 uppercase tracking-widest mb-1.5 flex"><Users size={12} /> Children Attendance</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={sessionForm.children_count === 0 && !sessionForm.id ? '' : sessionForm.children_count}
                                            onChange={(e) => setSessionForm({ ...sessionForm, children_count: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white border border-sky-200 rounded-xl p-3 text-center text-2xl font-black text-sky-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] items-center gap-1 font-bold text-rose-600 uppercase tracking-widest mb-1.5 flex"><Heart size={12} /> Souls Saved</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={sessionForm.souls_saved_count === 0 && !sessionForm.id ? '' : sessionForm.souls_saved_count}
                                            onChange={(e) => setSessionForm({ ...sessionForm, souls_saved_count: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white border border-rose-200 rounded-xl p-3 text-center text-2xl font-black text-rose-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Notes</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Additional session details..."
                                        value={sessionForm.notes || ''}
                                        onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                    />
                                </div>

                                {/* Member Selection for Session */}
                                <div className="border-t border-gray-100 pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users size={16} className="text-blue-500" /> Church Members Participating</h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSessionMembers([...sessionMembers, { member_id: '', role: 'teacher', notes: '' }]);
                                            }}
                                            className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                                        >
                                            + Add Member
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {sessionMembers.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic text-center p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">No members added to this session yet.</p>
                                        ) : (
                                            sessionMembers.map((sm, index) => (
                                                <div key={index} className="flex gap-2 items-start bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 group">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex gap-2">
                                                            <select
                                                                value={sm.member_id}
                                                                onChange={(e) => {
                                                                    const newMembers = [...sessionMembers];
                                                                    newMembers[index].member_id = e.target.value;
                                                                    setSessionMembers(newMembers);
                                                                }}
                                                                className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold text-gray-900"
                                                            >
                                                                <option value="" disabled>Select Member...</option>
                                                                {members.map(m => (
                                                                    <option key={m.id} value={m.id}>{m.surname}, {m.first_name}</option>
                                                                ))}
                                                            </select>

                                                            <select
                                                                value={sm.role}
                                                                onChange={(e) => {
                                                                    const newMembers = [...sessionMembers];
                                                                    newMembers[index].role = e.target.value as any;
                                                                    setSessionMembers(newMembers);
                                                                }}
                                                                className="w-[120px] bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold text-gray-700 uppercase tracking-wide"
                                                            >
                                                                {ROLES.map(r => (
                                                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Role notes (optional)"
                                                            value={sm.notes || ''}
                                                            onChange={(e) => {
                                                                const newMembers = [...sessionMembers];
                                                                newMembers[index].notes = e.target.value;
                                                                setSessionMembers(newMembers);
                                                            }}
                                                            className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-600"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newMembers = [...sessionMembers];
                                                            newMembers.splice(index, 1);
                                                            setSessionMembers(newMembers);
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                                                        title="Remove"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 px-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                                <button
                                    onClick={() => setShowSessionForm(false)}
                                    className="px-4 py-2 font-bold text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveSession}
                                    disabled={submitting || !sessionForm.date || sessionMembers.some(sm => !sm.member_id)}
                                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold shadow-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : 'Save Session'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title={`Delete ${confirmDelete.type === 'series' ? 'Goodnews Area' : 'Session'}`}
                message={`Are you sure you want to delete this ${confirmDelete.type === 'series' ? 'Goodnews Area' : 'session'}? This action cannot be undone.`}
                confirmText={`Delete ${confirmDelete.type === 'series' ? 'Area' : 'Session'}`}
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete({ isOpen: false, type: 'series', id: null })}
            />
        </div >
    );
};

export default GoodnewsClass;
