
import React, { useState, useEffect } from "react";
import * as eventService from "@/services/eventService";
import * as memberService from "@/services/memberService";
import { uploadFile, deleteFile } from "@/lib/storage";
import {
    Calendar,
    Users,
    Plus,
    Trash2,
    Upload,
    MapPin,
    FileText,
    ImageIcon,
    Edit2,
    Search,
    Filter,
    X,
    CheckCircle2,
    Award,
    Tent,
    PartyPopper,
    Star,
    ChevronRight,
    Loader2,
    Heart
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import SuccessModal from "@/components/SuccessModal";
import MemberAttendancePicker from "@/components/MemberAttendancePicker";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionDraft, useSessionValue } from "@/hooks/useSessionDraft";
import { UserRole } from "../types";
import type { ChurchEvent } from "../types";


const EVENT_TYPES = [
    { value: 'fellowship', label: 'Fellowship', icon: Users, color: 'bg-blue-500/10 text-blue-500' },
    { value: 'bible_quiz', label: 'Bible Quiz', icon: Award, color: 'bg-amber-500/10 text-amber-500' },
    { value: 'camp', label: 'Camp', icon: Tent, color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'anniversary', label: 'Anniversary', icon: PartyPopper, color: 'bg-rose-500/10 text-rose-500' },
    { value: 'special_program', label: 'Special Program', icon: Star, color: 'bg-purple-500/10 text-purple-500' },
    { value: 'thanksgiving', label: 'Thanksgiving', icon: Heart, color: 'bg-orange-500/10 text-orange-500' },
    { value: 'other', label: 'Other', icon: Calendar, color: 'bg-gray-500/10 text-gray-500' },
];

const ChurchEvents: React.FC = () => {
    const { roles, member } = useAuth();
    const canEdit = roles.some(r => [UserRole.CHURCH_ADMINISTRATOR, UserRole.CHURCH_CLERK, UserRole.ACTIVITY_COORDINATOR].includes(r as UserRole));

    const [events, setEvents] = useState<ChurchEvent[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<ChurchEvent | null>(null);
    const [selectedMemberIds, setSelectedMemberIds, clearMembersDraft] = useSessionValue<string[]>('church-events-members', []);
    const [tardyMemberIds, setTardyMemberIds, clearTardyDraft] = useSessionValue<string[]>('church-events-tardy', []);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [form, setForm, clearFormDraft] = useSessionDraft<Partial<ChurchEvent>>('church-events-form', {
        event_name: '',
        event_theme: '',
        event_type: 'fellowship',
        event_date: new Date().toISOString().split('T')[0],
        location: '',
        total_attendance: 0,
        visitors_count: 0,
        notes: '',
        attachment_urls: []
    });

    // Modals
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });

    useEffect(() => {
        fetchEvents();
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const data = await memberService.getAllMembers();
            setMembers(data);
        } catch (err) {
            console.error("Error fetching members:", err);
        }
    };
    const fetchEvents = async () => {
        setLoading(true);
        try {
            const data = await eventService.getChurchEvents();
            setEvents(data);
        } catch (err) {
            console.error("Error fetching events:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEventAttendance = async (eventId: string) => {
        try {
            const { memberIds, tardyIds } = await eventService.getChurchEventAttendanceLogs(eventId);
            setSelectedMemberIds(memberIds);
            setTardyMemberIds(tardyIds);
        } catch (err) {
            console.error("Error fetching event attendance:", err);
        }
    };
    const handleOpenModal = (event?: ChurchEvent) => {
        if (event) {
            setForm(event);
            fetchEventAttendance(event.id);
            setSelectedEvent(event);
        } else {
            clearFormDraft();
            clearMembersDraft();
            setForm({
                event_name: '',
                event_theme: '',
                event_type: 'fellowship',
                event_date: new Date().toISOString().split('T')[0],
                location: '',
                total_attendance: 0,
                visitors_count: 0,
                notes: '',
                attachment_urls: [],
                created_by: member?.id
            });
            setSelectedMemberIds([]);
            setTardyMemberIds([]);
            setSelectedEvent(null);
        }
        setIsModalOpen(true);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        try {
            const file = e.target.files[0];
            const url = await uploadFile(file, 'activities');
            setForm(prev => ({
                ...prev,
                attachment_urls: [...(prev.attachment_urls || []), url]
            }));
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = async (url: string) => {
        try {
            await deleteFile(url);
            setForm(prev => ({
                ...prev,
                attachment_urls: (prev.attachment_urls || []).filter(u => u !== url)
            }));
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    const handleSave = async () => {
        if (!form.event_name || !form.event_date) return alert("Please fill in required fields");
        setSaving(true);
        try {
            const isNew = !form.id;
            const eventPayload = {
                ...form,
                total_attendance: (selectedMemberIds.length + tardyMemberIds.length) > (form.total_attendance || 0) ? (selectedMemberIds.length + tardyMemberIds.length) : (form.total_attendance || 0)
            };

            const savedEvent = await eventService.upsertChurchEvent(eventPayload);

            // Update attendance_log
            await eventService.updateChurchEventAttendanceLogs(savedEvent.id, savedEvent.event_date, [...selectedMemberIds, ...tardyMemberIds], tardyMemberIds);

            fetchEvents();
            setIsModalOpen(false);
            clearFormDraft();
            clearMembersDraft();
            clearTardyDraft();
            setShowSuccessModal(true);
        } catch (err: any) {
            alert("Error saving event: " + err.message);
        } finally {
            setSaving(false);
        }
    };
    const handleDelete = async () => {
        if (!confirmDelete.id) return;
        setSaving(true);
        try {
            const id = confirmDelete.id;
            const evt = events.find(e => e.id === id);

            // Delete attachments
            if (evt?.attachment_urls) {
                for (const url of evt.attachment_urls) {
                    try { await deleteFile(url); } catch (e) { console.warn("Failed to delete attachment:", e); }
                }
            }

            // Delete event and logs
            await eventService.deleteChurchEvent(id);

            setConfirmDelete({ isOpen: false, id: null });
            setIsModalOpen(false);
            fetchEvents();
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        } finally {
            setSaving(false);
        }
    };
    const filteredEvents = filterType === 'all'
        ? events
        : events.filter(e => e.event_type === filterType);

    const getTypeIcon = (type: string) => {
        const found = EVENT_TYPES.find(t => t.value === type);
        return found ? found.icon : Calendar;
    };

    const getTypeColor = (type: string) => {
        const found = EVENT_TYPES.find(t => t.value === type);
        return found ? found.color : 'bg-gray-500/10 text-gray-500';
    };

    const ViewIcon = getTypeIcon(form.event_type || 'other');

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Calendar size={32} className="text-blue-600" />
                        Church Events
                    </h1>
                    <p className="text-gray-500 mt-1">Manage fellowships, camps, and special programs.</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus size={20} /> New Event
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide no-scrollbar">
                <button
                    onClick={() => setFilterType('all')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap shadow-sm border ${filterType === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'
                        }`}
                >
                    All Events
                </button>
                {EVENT_TYPES.map(t => (
                    <button
                        key={t.value}
                        onClick={() => setFilterType(t.value)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap shadow-sm border flex items-center gap-2 ${filterType === t.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'
                            }`}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Event List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                    <p className="text-gray-400 font-medium">Fetching events...</p>
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center">
                    <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar size={40} className="text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Events Found</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">There are no events recorded for this category yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(event => {
                        const Icon = getTypeIcon(event.event_type);
                        return (
                            <div
                                key={event.id}
                                onClick={() => handleOpenModal(event)}
                                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all group cursor-pointer animate-in zoom-in-95"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getTypeColor(event.event_type)} shadow-sm`}>
                                        <Icon size={24} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">{event.id}</p>
                                        <p className="text-xs font-bold text-gray-600">{new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                    </div>
                                </div>

                                <h3 className="text-xl font-black text-gray-900 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors uppercase italic">{event.event_name}</h3>
                                {event.event_theme && (
                                    <p className="text-sm text-gray-400 italic mb-4">"{event.event_theme}"</p>
                                )}

                                <div className="space-y-2 mb-6 text-sm font-medium">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <MapPin size={14} className="text-gray-400" />
                                        <span>{event.location || 'No location set'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Users size={14} className="text-gray-400" />
                                        <span>{event.total_attendance || 0} Attended</span>
                                    </div>
                                    {event.visitors_count !== undefined && event.visitors_count > 0 && (
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <Heart size={14} className="text-pink-400" />
                                            <span>{event.visitors_count} Visitors</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getTypeColor(event.event_type)}`}>
                                        {event.event_type.replace('_', ' ')}
                                    </span>
                                    <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-all group-hover:translate-x-1" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Event Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#f8f9fa] rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative border border-white/20">
                        {/* Header */}
                        <div className="bg-white px-10 py-8 border-b border-gray-100 flex justify-between items-center gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic flex items-center gap-3">
                                    <ViewIcon size={28} className="text-blue-600" />
                                    {form.id ? 'Edit Event' : 'Schedule New Event'}
                                </h2>
                                {form.event_theme && <p className="text-blue-600 font-bold italic mt-1 text-lg">"{form.event_theme}"</p>}
                                <p className="text-gray-500 font-medium">Capture attendance and programs for specific activities.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all active:scale-90">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                {/* Left Side: Details */}
                                <div className="space-y-8">
                                    <section className="space-y-6">
                                        <h3 className="text-xs font-black tracking-[0.2em] text-gray-400 uppercase border-b border-gray-100 pb-2">Basic Info</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Event Name</label>
                                                <input
                                                    type="text"
                                                    value={form.event_name}
                                                    onChange={(e) => setForm({ ...form, event_name: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-base font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                    placeholder="e.g., Youth Summer Fellowship"
                                                />
                                            </div>

                                            {['thanksgiving', 'fellowship', 'camp', 'anniversary', 'special_program'].includes(form.event_type || '') && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Event Theme / Title (Optional)</label>
                                                    <input
                                                        type="text"
                                                        value={form.event_theme || ''}
                                                        onChange={(e) => setForm({ ...form, event_theme: e.target.value })}
                                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-base font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                        placeholder='e.g., "Faithful in All Seasons"'
                                                    />
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Type</label>
                                                    <select
                                                        value={form.event_type}
                                                        onChange={(e) => setForm({ ...form, event_type: e.target.value as any })}
                                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none"
                                                    >
                                                        {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Date</label>
                                                    <input
                                                        type="date"
                                                        value={form.event_date}
                                                        onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Location</label>
                                                <input
                                                    type="text"
                                                    value={form.location}
                                                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                    placeholder="e.g., Church Main Hall"
                                                />
                                            </div>

                                            {['thanksgiving', 'fellowship', 'anniversary'].includes(form.event_type || '') && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-2">
                                                        <Heart size={12} /> Visitors Present (Optional)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={form.visitors_count || 0}
                                                        onChange={(e) => setForm({ ...form, visitors_count: parseInt(e.target.value) || 0 })}
                                                        className="w-full bg-pink-50/30 border border-pink-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 outline-none transition-all shadow-sm"
                                                        placeholder="Number of non-member visitors"
                                                    />
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Notes / Program Details</label>
                                                <textarea
                                                    rows={4}
                                                    value={form.notes}
                                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm resize-none"
                                                    placeholder="Outline of the program, speakers, etc."
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-6">
                                        <h3 className="text-xs font-black tracking-[0.2em] text-gray-400 uppercase border-b border-gray-100 pb-2">Attachments</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {(form.attachment_urls || []).map((url) => (
                                                <div key={url} className="group relative aspect-video rounded-3xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center shadow-sm">
                                                    {url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                                                        <img src={url} alt="evt" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileText size={32} className="text-gray-200" />
                                                    )}
                                                    <button
                                                        onClick={() => removeAttachment(url)}
                                                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            <label className="aspect-video rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-all group overflow-hidden relative">
                                                {uploading ? (
                                                    <Loader2 className="animate-spin text-blue-600" size={32} />
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <Upload size={24} />
                                                        </div>
                                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Add File</p>
                                                    </>
                                                )}
                                                <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                                            </label>
                                        </div>
                                    </section>
                                </div>

                                {/* Right Side: Attendance */}
                                <div className="space-y-8 flex flex-col h-full">
                                    <section className="space-y-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                            <h3 className="text-xs font-black tracking-[0.2em] text-gray-400 uppercase">Member Attendance</h3>
                                            <p className="text-xs font-black text-blue-600 uppercase tracking-widest px-3 py-1 bg-blue-50 rounded-full">
                                                {selectedMemberIds.length} Checked In
                                            </p>
                                        </div>

                                        <div className="bg-white rounded-3xl border border-gray-200 p-6 flex-1 shadow-sm overflow-hidden flex flex-col">
                                            <div className="mb-4">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Manual Total Override (Optional)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={form.total_attendance}
                                                    onChange={(e) => setForm({ ...form, total_attendance: parseInt(e.target.value) || 0 })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                    placeholder="Enter if higher than member count"
                                                />
                                            </div>

                                            <div className="flex-1 overflow-hidden min-h-[400px]">
                                                <MemberAttendancePicker
                                                    label="Members Present"
                                                    members={members}
                                                    selectedIds={selectedMemberIds}
                                                    onChange={setSelectedMemberIds}
                                                    tardyIds={tardyMemberIds}
                                                    onTardyChange={setTardyMemberIds}
                                                    searchTerm={memberSearchTerm}
                                                    onSearchTermChange={setMemberSearchTerm}
                                                />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-white px-10 py-8 border-t border-gray-100 flex items-center justify-between">
                            <div>
                                {form.id && (
                                    <button
                                        onClick={() => setConfirmDelete({ isOpen: true, id: form.id! })}
                                        className="text-red-500 font-bold text-sm flex items-center gap-2 hover:bg-red-50 px-5 py-3 rounded-2xl transition-all"
                                    >
                                        <Trash2 size={18} /> Delete Event
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all border border-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-3 active:scale-95"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                    {form.id ? 'Update Report' : 'Save Event'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div >
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Event?"
                message="This will permanently remove this event and its attendance records. This action cannot be undone."
            />

            <SuccessModal
                isOpen={showSuccessModal}
                onDone={() => setShowSuccessModal(false)}
                title="Event Saved!"
                message="Your church event report has been successfully recorded and archived."
            />
        </div >
    );
};

export default ChurchEvents;
