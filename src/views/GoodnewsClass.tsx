import React, { useState, useEffect } from 'react';
import * as goodnewsService from '@/services/goodnewsService';
import * as memberService from '@/services/memberService';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, type GoodnewsSeries, type GoodnewsSession, type GoodnewsSessionRole } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';

import GoodnewsSidebar from '@/components/GoodnewsClass/GoodnewsSidebar';
import SeriesList from '@/components/GoodnewsClass/SeriesList';
import SeriesDetails from '@/components/GoodnewsClass/SeriesDetails';
import SeriesFormModal from '@/components/GoodnewsClass/SeriesFormModal';
import SessionFormModal from '@/components/GoodnewsClass/SessionFormModal';

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

    // Forms
    const [seriesForm, setSeriesForm] = useState<Partial<GoodnewsSeries>>({
        status: 'ongoing',
        start_date: new Date().toISOString().split('T')[0]
    });
    const [sessionForm, setSessionForm] = useState<Partial<GoodnewsSession>>({
        date: new Date().toISOString().split('T')[0],
        children_count: 0,
        souls_saved_count: 0
    });

    const [members, setMembers] = useState<any[]>([]);
    const [sessionMembers, setSessionMembers] = useState<any[]>([]);

    const [submitting, setSubmitting] = useState(false);
    const [actionNotice, setActionNotice] = useState<string | null>(null);

    // Deletion
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, type: 'series' | 'session', id: string | null }>({ isOpen: false, type: 'series', id: null });

    useEffect(() => {
        fetchSeries();
        fetchMembers();
    }, [isTeacher, canManageSessions, member?.id]);

    const fetchSeries = async () => {
        setLoading(true);
        try {
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
                title: seriesForm.area,
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
            const notice = isEditing ? `Goodnews Area updated: ${areaName}` : `Goodnews Area created: ${areaName}`;
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
                setShowSeriesForm(false);
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
        <div className="flex h-full font-sans bg-[var(--color-bg)]">
            <GoodnewsSidebar 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                seriesList={seriesList}
                canManageSessions={canManageSessions}
                isTeacher={isTeacher}
                onAddSeries={() => { 
                    setSeriesForm({ status: 'ongoing', start_date: new Date().toISOString().split('T')[0] }); 
                    setShowSeriesForm(true); 
                }}
                viewingSeries={viewingSeries}
            />

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {actionNotice && (
                    <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 flex items-center justify-between shadow-sm">
                        <div className="text-sm font-bold">{actionNotice}</div>
                        <button
                            onClick={() => setActionNotice(null)}
                            className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-green-300 hover:bg-green-100 transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                <div className="max-w-[1200px]">
                    {!viewingSeries ? (
                        <SeriesList 
                            seriesList={seriesList} 
                            activeTab={activeTab} 
                            loading={loading}
                            onSelectSeries={loadSeriesDetails}
                        />
                    ) : (
                        <SeriesDetails 
                            series={viewingSeries}
                            sessions={seriesSessions}
                            canManageSessions={canManageSessions}
                            isTeacher={isTeacher}
                            onBack={() => setViewingSeries(null)}
                            onEditSeries={() => {
                                setSeriesForm(viewingSeries);
                                setShowSeriesForm(true);
                            }}
                            onAddSession={() => {
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
                            onEditSession={(session) => {
                                setSessionForm(session);
                                setSessionMembers(session.members || []);
                                setShowSessionForm(true);
                            }}
                            onDeleteSession={(id) => setConfirmDelete({ isOpen: true, type: 'session', id })}
                        />
                    )}
                </div>
            </div>

            {showSeriesForm && (
                <SeriesFormModal 
                    seriesForm={seriesForm}
                    setSeriesForm={setSeriesForm}
                    members={members}
                    submitting={submitting}
                    onClose={() => setShowSeriesForm(false)}
                    onSave={handleSaveSeries}
                    onDelete={seriesForm.id ? () => setConfirmDelete({ isOpen: true, type: 'series', id: seriesForm.id! }) : undefined}
                />
            )}

            {showSessionForm && (
                <SessionFormModal 
                    sessionForm={sessionForm}
                    setSessionForm={setSessionForm}
                    sessionMembers={sessionMembers}
                    setSessionMembers={setSessionMembers}
                    members={members}
                    submitting={submitting}
                    onClose={() => setShowSessionForm(false)}
                    onSave={handleSaveSession}
                />
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title={`Delete ${confirmDelete.type === 'series' ? 'Goodnews Area' : 'Session'}`}
                message={`Are you sure you want to delete this ${confirmDelete.type === 'series' ? 'Goodnews Area' : 'session'}? This action cannot be undone.`}
                confirmText={`Delete ${confirmDelete.type === 'series' ? 'Area' : 'Session'}`}
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete({ isOpen: false, type: 'series', id: null })}
            />
        </div>
    );
};

export default GoodnewsClass;
