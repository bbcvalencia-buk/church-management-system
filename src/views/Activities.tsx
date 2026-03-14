
import React, { useState, useEffect } from "react";
import * as activityService from "@/services/activityService";
import * as memberService from "@/services/memberService";
import * as visitorService from "@/services/visitorService";
import { getLatestSundayISODate } from "@/lib/date";
import { uploadFile, deleteFile } from "@/lib/storage";
import {
    Activity,
    Calendar,
    Users,
    Heart,
    Plus,
    Trash2,
    Upload,
    ExternalLink,
    MapPin,
    FileText,
    ImageIcon,
    Edit2,
    BookOpen,
    UserCheck,
    Megaphone,
    Repeat,
    User
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import SuccessModal from "@/components/SuccessModal";
import MemberAttendancePicker from "@/components/MemberAttendancePicker";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";
import { useSessionDraft, useSessionValue } from "@/hooks/useSessionDraft";

interface ActivityRecord {
    id: string;
    activity_type: string;
    activity_date: string; // YYYY-MM-DD
    members_present: number;
    non_member_attendance: number;
    total_attendance: number;
    souls_saved: number;
    kids_attended: number;
    tracts_distributed: number;
    area?: string;
    bible_study_type?: 'individual' | 'family';
    family_name?: string;
    mission_church_name?: string;
    facebook_post_link?: string;
    attachment_url?: string;
    activity_data?: any;
}

const INITIAL_STATE = {
    activity_type: 'soul_winning',
    activity_date: getLatestSundayISODate(),
    members_present: 0,
    non_member_attendance: 0,
    total_attendance: 0,
    souls_saved: 0,
    kids_attended: 0,
    tracts_distributed: 0,
    area: '',
    bible_study_type: 'individual' as const,
    family_name: '',
    mission_church_name: '',
    facebook_post_link: '',
    attachment_url: '',
    activity_data: {}
};

const Activities: React.FC = () => {
    const { roles } = useAuth();
    const canManageActivities =
        roles.includes(UserRole.CHURCH_ADMINISTRATOR) ||
        roles.includes(UserRole.ACTIVITY_COORDINATOR) ||
        roles.includes(UserRole.RECORDING_SECRETARY);
    const [activities, setActivities] = useState<ActivityRecord[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [visitors, setVisitors] = useState<any[]>([]);
    const [selectedMemberIds, setSelectedMemberIds, clearMembersDraft] = useSessionValue<string[]>('activities-members', []);
    const [tardyMemberIds, setTardyMemberIds, clearTardyDraft] = useSessionValue<string[]>('activities-tardy', []);
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm, clearFormDraft] = useSessionDraft<Partial<ActivityRecord>>('activities-form', INITIAL_STATE);
    const [saving, setSaving] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [viewActivity, setViewActivity] = useState<ActivityRecord | null>(null);

    // Deletion Modal State
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });

    useEffect(() => {
        fetchActivities();
        fetchMembers();
        fetchVisitors();
    }, []);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const data = await activityService.getActivities();
            setActivities(data || []);
        } catch (err) {
            console.error("Error fetching activities:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const data = await memberService.getAllMembers();
            setMembers(data || []);
        } catch (err) {
            console.error("Error fetching members:", err);
        }
    };

    const fetchVisitors = async () => {
        try {
            const data = await visitorService.getVisitors();
            setVisitors(data || []);
        } catch (err) {
            console.error("Error fetching visitors:", err);
        }
    };

    const fetchActivityAttendance = async (activityId: string) => {
        try {
            const { memberIds, tardyIds } = await activityService.getActivityAttendanceLogs(activityId);
            const tardySet = new Set(tardyIds);
            const strictMemberIds = memberIds.filter((id) => !tardySet.has(id));
            setSelectedMemberIds(strictMemberIds);
            setTardyMemberIds(tardyIds);
        } catch (err) {
            console.error("Error fetching activity attendance:", err);
        }
    };

    const handleOpenModal = (activity?: ActivityRecord) => {
        if (activity) {
            setForm(activity);
            fetchActivityAttendance(activity.id);
        } else {
            setForm(INITIAL_STATE);
            setSelectedMemberIds([]);
            setTardyMemberIds([]);
        }
        setMemberSearchTerm("");
        setAttachmentFile(null);
        setViewActivity(null);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!canManageActivities) {
            alert("You have read-only access.");
            return;
        }
        setSaving(true);
        try {
            const membersPresent = selectedMemberIds.length + tardyMemberIds.length;
            const nonMemberAttendance = Number(form.non_member_attendance) || 0;
            const total = membersPresent + nonMemberAttendance;

            // 1. Upload Attachment if present
            let attachmentUrl = form.attachment_url;
            if (attachmentFile) {
                if (attachmentUrl) {
                    try { await deleteFile(attachmentUrl); } catch (e) { console.warn("Failed to delete old attachment:", e); }
                }
                attachmentUrl = await uploadFile(attachmentFile, "activities");
            }

            // 2. Save Activity
            const payload = {
                ...form,
                members_present: membersPresent,
                non_member_attendance: nonMemberAttendance,
                total_attendance: total,
                attachment_url: attachmentUrl,
                activity_data: form.activity_data || {}
            };

            const savedActivity = await activityService.upsertActivity(payload as ActivityRecord);

            // 3. Save new attendance
            await activityService.updateActivityAttendanceLogs(savedActivity.id, savedActivity.activity_date, [...selectedMemberIds, ...tardyMemberIds], tardyMemberIds);

            fetchActivities();
            setIsModalOpen(false);
            clearFormDraft();
            clearMembersDraft();
            clearTardyDraft();
            setShowSuccessModal(true);
        } catch (err: any) {
            alert("Error saving activity: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!canManageActivities) {
            alert("You have read-only access.");
            return;
        }
        if (!confirmDelete.id) return;
        setSaving(true);
        try {
            const id = confirmDelete.id;
            const activityToDelete = activities.find(a => a.id === id);

            // Delete attachment if exists
            if (activityToDelete?.attachment_url) {
                try { await deleteFile(activityToDelete.attachment_url); } catch (e) { console.warn("Failed to delete attachment:", e); }
            }

            // Delete the activity and its related attendance logs
            await activityService.deleteActivity(id);

            setConfirmDelete({ isOpen: false, id: null });
            setIsModalOpen(false);
            setViewActivity(null);
            fetchActivities();
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'soul_winning': return 'Soul Winning';
            case 'bible_study': return 'Bible Study';
            case 'outreach': return 'Outreach';
            case 'visitation': return 'Visitation';
            default: return type.replace(/_/g, ' ');
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="text-[var(--color-primary)]" />
                    Activities & Missions
                </h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-[var(--color-primary)] hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-bold shadow-lg shadow-purple-500/20"
                >
                    <Plus size={18} /> Add Activity
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <p className="text-[var(--color-text-muted)]">Loading...</p> : activities.length === 0 ? <p className="text-[var(--color-text-muted)]">No activities recorded yet.</p> :
                    activities.map(activity => (
                        <div
                            key={activity.id}
                            onClick={() => setViewActivity(activity)}
                            className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4 hover:border-[var(--color-primary)]/50 hover:shadow-md transition-all group relative cursor-pointer"
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
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center 
                                    ${activity.activity_type === 'soul_winning' ? 'bg-red-50 text-red-500' :
                                        activity.activity_type === 'bible_study' ? 'bg-blue-50 text-blue-500' :
                                            activity.activity_type === 'visitation' ? 'bg-purple-50 text-purple-500' :
                                                'bg-purple-50 text-purple-500'}`}
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
                                        <Users size={16} className="text-blue-500" />
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
                            <p className="text-[10px] text-blue-400/70 mt-1 uppercase font-bold text-right group-hover:text-blue-600 transition-colors">Click to view details</p>
                        </div>
                    ))
                }
            </div>

            {/* Detailed View Modal */}
            {viewActivity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md font-sans animate-in fade-in duration-200">
                    <div className="bg-[#f8f9fa] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative">
                        {/* Header */}
                        <div className="bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-start gap-4">
                            <div className="space-y-3 flex-1">
                                <div className="flex items-center gap-3 text-xs font-semibold">
                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-wider">{getTypeLabel(viewActivity.activity_type)}</span>
                                    <span className="text-gray-400 flex items-center gap-1.5"><Calendar size={14} /> {new Date(viewActivity.activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <h2 className="text-3xl font-extrabold text-gray-900 leading-tight">
                                    {viewActivity.activity_type === 'outreach' && viewActivity.mission_church_name ? viewActivity.mission_church_name :
                                        viewActivity.activity_type === 'bible_study' && viewActivity.family_name ? `${viewActivity.family_name} Bible Study` :
                                            viewActivity.area ? `${getTypeLabel(viewActivity.activity_type)}: ${viewActivity.area}` :
                                                `${getTypeLabel(viewActivity.activity_type)} Report`}
                                </h2>
                                <p className="text-sm text-gray-500 max-w-2xl leading-relaxed">
                                    {viewActivity.activity_type === 'outreach' ? 'Field mission and outreach activity.' :
                                        viewActivity.activity_type === 'soul_winning' ? 'Soul winning and evangelism activity in the local area.' :
                                            'Regular church activity and ministry engagement.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setConfirmDelete({ isOpen: true, id: viewActivity.id })} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Record">
                                    <Trash2 size={18} />
                                </button>
                                <button onClick={() => handleOpenModal(viewActivity)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Record">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => setViewActivity(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1" title="Close">
                                    <span className="text-xs font-bold uppercase tracking-wider px-2">Close</span>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                            {/* Gallery Section */}
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <h3 className="text-[11px] font-black tracking-widest text-gray-400 uppercase">Mission Gallery / Files</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {viewActivity.attachment_url ? (
                                        <div className="col-span-1 rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white aspect-[4/3] group relative flex items-center justify-center">
                                            {viewActivity.attachment_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                                                <img src={viewActivity.attachment_url} alt="Activity Resource" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="text-center p-6">
                                                    <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                                                    <a href={viewActivity.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">View Document</a>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="col-span-1 md:col-span-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-[4/2] flex flex-col items-center justify-center text-gray-400">
                                            <ImageIcon size={48} className="mb-3 opacity-50" />
                                            <p className="font-medium text-sm">No photos or documents attached</p>
                                        </div>
                                    )}
                                    {/* Placeholder for more photos to match mockup aesthetics */}
                                    {viewActivity.attachment_url && viewActivity.attachment_url.match(/\.(jpeg|jpg|gif|png)$/i) && (
                                        <div className="col-span-1 grid grid-rows-2 gap-4">
                                            <div className="rounded-2xl border border-gray-100 bg-white p-6 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-blue-50/50 group-hover:bg-blue-50 transition-colors" />
                                                <div className="relative z-10 text-center">
                                                    <ImageIcon size={32} className="mx-auto mb-2 opacity-50 text-blue-300" />
                                                    <p className="text-xs font-bold text-blue-600/70">Add More Photos</p>
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-gray-100 bg-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
                                                {viewActivity.facebook_post_link && (
                                                    <a href={viewActivity.facebook_post_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex flex-col items-center justify-center bg-blue-600 text-white hover:bg-blue-700 transition-colors group">
                                                        <ExternalLink size={24} className="mb-2 opacity-70 group-hover:opacity-100 group-hover:-mt-1 transition-all" />
                                                        <span className="font-bold text-sm tracking-wide">View on Facebook</span>
                                                    </a>
                                                )}
                                                {!viewActivity.facebook_post_link && (
                                                    <div className="text-center text-gray-400">
                                                        <ExternalLink size={24} className="mx-auto mb-2 opacity-30" />
                                                        <span className="text-xs font-medium">No external link</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-4 items-center text-sm font-medium border-y border-gray-100 py-4 pb-4">
                                <div className="flex items-center gap-2 text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-50">
                                    <MapPin size={16} className="text-blue-500" /> Location: <span className="text-gray-900">{viewActivity.area || 'Unknown'}</span>
                                </div>
                                <div className="flex text-gray-400 px-4 py-2">
                                    ID: <span className="ml-1 uppercase tracking-wider">{viewActivity.id.slice(0, 8)}</span>
                                </div>
                            </div>

                            {/* Type Specific Details */}
                            {viewActivity.activity_data && Object.keys(viewActivity.activity_data).length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                    {viewActivity.activity_type === 'visitation' && (
                                        <>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Person Visited</p>
                                                <p className="text-lg font-bold text-gray-900">{viewActivity.activity_data.visited_name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Visitation Reason</p>
                                                <p className="text-lg font-bold text-gray-900 capitalize">{viewActivity.activity_data.reason?.replace(/-/g, ' ') || 'N/A'} {viewActivity.activity_data.first_visit ? '(First Time)' : ''}</p>
                                            </div>
                                        </>
                                    )}
                                    {viewActivity.activity_type === 'bible_study' && (
                                        <>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Student / Contact</p>
                                                <p className="text-lg font-bold text-gray-900">{viewActivity.activity_data.student_name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Study Details</p>
                                                <p className="text-lg font-bold text-gray-900">{viewActivity.activity_data.book || 'N/A'} - {viewActivity.activity_data.session_number || 'N/A'}</p>
                                                {viewActivity.activity_data.format && (
                                                    <p className="text-xs text-blue-600 font-medium mt-1">Format: {viewActivity.activity_data.format.join(', ')}</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                    {viewActivity.activity_type === 'outreach' && (
                                        <>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Event Name</p>
                                                <p className="text-lg font-bold text-gray-900">{viewActivity.activity_data.event_name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reach & Follow-up</p>
                                                <p className="text-lg font-bold text-gray-900">{viewActivity.activity_data.people_reached || 0} People Reached</p>
                                                {viewActivity.activity_data.followup_actions && (
                                                    <p className="text-xs text-gray-600 mt-1 italic">Action: {viewActivity.activity_data.followup_actions}</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
                                        <Users size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Non-Members</p>
                                        <p className="text-lg font-black text-gray-900">{viewActivity.non_member_attendance || 0}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                        <Users size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Attendance</p>
                                        <p className="text-lg font-black text-gray-900">{viewActivity.total_attendance}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                                        <Heart size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Souls Saved</p>
                                        <p className="text-lg font-black text-gray-900">{viewActivity.souls_saved}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Body */}
                        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            <h2 className="text-xl font-bold flex items-center gap-3 text-gray-900 border-b border-gray-100 pb-4">
                                <Activity size={24} className="text-blue-600" />
                                {form.id ? 'Edit Activity Record' : 'File New Report'}
                            </h2>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Type</label>
                                    <select
                                        value={form.activity_type}
                                        onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                    >
                                        <option value="soul_winning">Soul Winning</option>
                                        <option value="bible_study">Bible Study</option>
                                        <option value="outreach">Outreach</option>
                                        <option value="visitation">Visitation</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date</label>
                                    <input
                                        type="date"
                                        value={form.activity_date}
                                        onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            {form.activity_type === 'bible_study' && (
                                <div className="space-y-6 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                <User size={14} className="text-blue-500" /> Student / Contact
                                            </label>
                                            <div className="space-y-2">
                                                <select
                                                    value={form.activity_data?.student_member_id || ''}
                                                    onChange={(e) => {
                                                        const member = members.find(m => m.id === e.target.value);
                                                        setForm({
                                                            ...form,
                                                            activity_data: {
                                                                ...(form.activity_data || {}),
                                                                student_member_id: e.target.value,
                                                                student_name: member ? `${member.first_name} ${member.surname}` : (form.activity_data?.student_name || '')
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                >
                                                    <option value="">-- Select Member --</option>
                                                    {members.map(m => (
                                                        <option key={m.id} value={m.id}>{m.surname}, {m.first_name}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="OR Free text name"
                                                    value={form.activity_data?.student_name || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: {
                                                            ...(form.activity_data || {}),
                                                            student_name: e.target.value,
                                                            student_member_id: '' // Clear if typing manually
                                                        }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                <BookOpen size={14} className="text-blue-500" /> Study Details
                                            </label>
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Book / Course being studied"
                                                    value={form.activity_data?.book || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), book: e.target.value }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Session e.g. Session 3 of 12"
                                                    value={form.activity_data?.session_number || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), session_number: e.target.value }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                />

                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                Format (Multi-select)
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {['Individual', 'Family', 'Online', 'Face-to-Face'].map(fmt => (
                                                    <button
                                                        key={fmt}
                                                        onClick={() => {
                                                            const current = form.activity_data?.format || [];
                                                            const next = current.includes(fmt)
                                                                ? current.filter((f: string) => f !== fmt)
                                                                : [...current, fmt];
                                                            setForm({
                                                                ...form,
                                                                activity_data: { ...(form.activity_data || {}), format: next }
                                                            });
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${form.activity_data?.format?.includes(fmt)
                                                            ? 'bg-blue-600 text-white shadow-md'
                                                            : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        {fmt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {form.activity_data?.format?.includes('Family') && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Family Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Santos Family"
                                                    value={form.activity_data?.family_name || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), family_name: e.target.value }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {form.activity_type === 'visitation' && (
                                <div className="space-y-6 bg-purple-50/30 p-4 rounded-xl border border-purple-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                <UserCheck size={14} className="text-purple-500" /> Who was visited?
                                            </label>
                                            <div className="space-y-2">
                                                <select
                                                    value={form.activity_data?.visited_member_id || ''}
                                                    onChange={(e) => {
                                                        const member = members.find(m => m.id === e.target.value);
                                                        setForm({
                                                            ...form,
                                                            activity_data: {
                                                                ...(form.activity_data || {}),
                                                                visited_member_id: e.target.value,
                                                                visited_visitor_id: '',
                                                                visited_name: member ? `${member.first_name} ${member.surname}` : (form.activity_data?.visited_name || '')
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                                                >
                                                    <option value="">-- Member --</option>
                                                    {members.map(m => (
                                                        <option key={m.id} value={m.id}>{m.surname}, {m.first_name}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={form.activity_data?.visited_visitor_id || ''}
                                                    onChange={(e) => {
                                                        const visitor = visitors.find(v => v.id === e.target.value);
                                                        setForm({
                                                            ...form,
                                                            activity_data: {
                                                                ...(form.activity_data || {}),
                                                                visited_visitor_id: e.target.value,
                                                                visited_member_id: '',
                                                                visited_name: visitor ? visitor.name : (form.activity_data?.visited_name || '')
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                                                >
                                                    <option value="">-- Or Visitor --</option>
                                                    {visitors.map(v => (
                                                        <option key={v.id} value={v.id}>{v.name}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="OR Enter Name Manually"
                                                    value={form.activity_data?.visited_name || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: {
                                                            ...(form.activity_data || {}),
                                                            visited_name: e.target.value,
                                                            visited_member_id: '',
                                                            visited_visitor_id: ''
                                                        }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                <Repeat size={14} className="text-purple-500" /> Visitation Reason
                                            </label>
                                            <div className="space-y-4">
                                                <select
                                                    value={form.activity_data?.reason || 'follow-up'}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), reason: e.target.value }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                                                >
                                                    <option value="follow-up">Follow-up</option>
                                                    <option value="hospital-visit">Hospital Visit</option>
                                                    <option value="home-visit">Home Visit</option>
                                                    <option value="first-time-contact">First-time Contact</option>
                                                </select>
                                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        id="first_visit"
                                                        checked={!!form.activity_data?.first_visit}
                                                        onChange={(e) => setForm({
                                                            ...form,
                                                            activity_data: { ...(form.activity_data || {}), first_visit: e.target.checked }
                                                        })}
                                                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                                                    />
                                                    <label htmlFor="first_visit" className="text-sm font-medium text-gray-700 select-none">First time visiting church?</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {form.activity_type === 'outreach' && (
                                <div className="space-y-6 bg-green-50/30 p-4 rounded-xl border border-green-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                    <Megaphone size={14} className="text-green-600" /> Event Name
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Community Health Fair"
                                                    value={form.activity_data?.event_name || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), event_name: e.target.value }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Partner Organizations</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Red Cross, Local LGU"
                                                    value={form.activity_data?.partners || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), partners: e.target.value }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Total People Reached</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={form.activity_data?.people_reached || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), people_reached: parseInt(e.target.value) || 0 }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Follow-up Actions Planned</label>
                                                <textarea
                                                    rows={2}
                                                    placeholder="e.g. Distribute relief goods next week"
                                                    value={form.activity_data?.followup_actions || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        activity_data: { ...(form.activity_data || {}), followup_actions: e.target.value }
                                                    })}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 font-sans">Mission Church Name (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Laguitas Mission"
                                            value={form.mission_church_name || ''}
                                            onChange={(e) => setForm({ ...form, mission_church_name: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Location / Area</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Purok 5, Bagontaas"
                                    value={form.area || ''}
                                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                />
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
                                {(form.activity_type === 'soul_winning' || form.activity_type === 'outreach') ? (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Total Tracts Distributed</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.tracts_distributed || ''}
                                            onChange={(e) => setForm({ ...form, tracts_distributed: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-center text-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                ) : (
                                    <div className="hidden md:block" />
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Souls Saved</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Heart size={16} className="text-red-400" />
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.souls_saved || ''}
                                            onChange={(e) => setForm({ ...form, souls_saved: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white border border-gray-200 rounded-lg pl-10 p-3 text-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Non-Member Attendees</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.non_member_attendance || ''}
                                        onChange={(e) => setForm({ ...form, non_member_attendance: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-white border border-gray-200 rounded-lg p-3 text-center text-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Facebook Post Link</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <ExternalLink size={16} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="url"
                                        placeholder="https://facebook.com/..."
                                        value={form.facebook_post_link || ''}
                                        onChange={(e) => setForm({ ...form, facebook_post_link: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-lg pl-10 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Attachment Section */}
                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Attachment / Sketch</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 hover:border-blue-400 transition-colors cursor-pointer relative overflow-hidden group">
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) setAttachmentFile(e.target.files[0]);
                                        }}
                                    />
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className="p-3 bg-blue-50 text-blue-500 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 mb-1">
                                            {attachmentFile ? attachmentFile.name : (form.attachment_url ? "Replace file" : "Upload a file")} <span className="text-gray-500 font-normal">or drag and drop</span>
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">PNG, JPG, PDF up to 10MB</p>
                                    </div>

                                    {form.attachment_url && !attachmentFile && (
                                        <a
                                            href={form.attachment_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="absolute top-4 right-4 p-2 bg-blue-100 rounded-lg hover:bg-blue-200 text-blue-700 transition-colors z-30"
                                            title="View Attachment"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Attendance Section */}
                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <MemberAttendancePicker
                                    label="Mark Attendance"
                                    members={members}
                                    selectedIds={selectedMemberIds}
                                    onChange={setSelectedMemberIds}
                                    tardyIds={tardyMemberIds}
                                    onTardyChange={setTardyMemberIds}
                                    searchTerm={memberSearchTerm}
                                    onSearchTermChange={setMemberSearchTerm}
                                    maxHeightClass="max-h-[150px]"
                                />
                            </div>
                        </div>

                        {/* Sticky Footer */}
                        <div className="bg-[#1e2333] p-4 px-6 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] relative z-10 transition-colors">
                            <div className="flex gap-2">
                                {form.id && (
                                    <button
                                        onClick={() => setConfirmDelete({ isOpen: true, id: form.id! })}
                                        className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors text-xs font-bold uppercase tracking-widest"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-4 items-center">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2 px-4"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)] rounded-lg px-8 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : (form.id ? 'Save Changes' : 'Submit Report')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SuccessModal
                isOpen={showSuccessModal}
                onDone={() => setShowSuccessModal(false)}
                onView={() => setShowSuccessModal(false)}
            />
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title="Delete Activity"
                message="Are you sure you want to PERMANENTLY delete this activity record? This will also remove all associated attendance logs."
                confirmText="Delete Record"
                isDanger={true}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
            />
        </div>
    );
};

export default Activities;
