import React, { useState, useEffect } from "react";
import * as activityService from "@/services/activityService";
import * as memberService from "@/services/memberService";
import * as visitorService from "@/services/visitorService";
import { getLatestSundayISODate } from "@/lib/date";
import { uploadFile, deleteFile } from "@/lib/storage";
import {
    Activity,
    Plus
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import SuccessModal from "@/components/SuccessModal";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";
import { useSessionDraft, useSessionValue } from "@/hooks/useSessionDraft";

import type { ActivityRecord } from "@/components/Activities/types";
import { ActivityCard } from "@/components/Activities/ActivityCard";
import { ActivityViewModal } from "@/components/Activities/ActivityViewModal";
import { ActivityFormModal } from "@/components/Activities/ActivityFormModal";

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
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            setViewActivity={setViewActivity}
                            setConfirmDelete={setConfirmDelete}
                        />
                    ))
                }
            </div>

            {/* Detailed View Modal */}
            {viewActivity && (
                <ActivityViewModal
                    viewActivity={viewActivity}
                    setViewActivity={setViewActivity}
                    setConfirmDelete={setConfirmDelete}
                    handleOpenModal={handleOpenModal}
                />
            )}

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <ActivityFormModal
                    isModalOpen={isModalOpen}
                    setIsModalOpen={setIsModalOpen}
                    form={form}
                    setForm={setForm}
                    members={members}
                    visitors={visitors}
                    selectedMemberIds={selectedMemberIds}
                    setSelectedMemberIds={setSelectedMemberIds}
                    tardyMemberIds={tardyMemberIds}
                    setTardyMemberIds={setTardyMemberIds}
                    memberSearchTerm={memberSearchTerm}
                    setMemberSearchTerm={setMemberSearchTerm}
                    attachmentFile={attachmentFile}
                    setAttachmentFile={setAttachmentFile}
                    saving={saving}
                    handleSave={handleSave}
                    setConfirmDelete={setConfirmDelete}
                />
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
