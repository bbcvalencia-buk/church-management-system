
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Shield,
    User,
    Search,
    Check,
    X,
    AlertCircle,
    ArrowRight,
    Bell,
    Clock3
} from 'lucide-react';
import { UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

import ConfirmModal from '@/components/ConfirmModal';

// Define roles with descriptions
const ROLE_DESCRIPTIONS = {
    [UserRole.CHURCH_ADMINISTRATOR]: "Full system access. Can manage settings, users, and all data.",
    [UserRole.PASTOR]: "Read-only access to all records and data.",
    [UserRole.CHURCH_CLERK]: "Manages members, visitors, services, and attendance records.",
    [UserRole.TREASURER]: "Manages financial records, reports, faith promise, and audits.",
    [UserRole.RECORDING_SECRETARY]: "Records attendance and updates services and activities.",
    [UserRole.MUSIC_MINISTER]: "Manages music ministry members, attendance, and songs.",
    [UserRole.SUNDAY_SCHOOL_ADMIN]: "Manages Sunday School departments, teachers, and records.",
    [UserRole.GOODNEWS_TEACHER]: "Manages Good News class records.",
    [UserRole.ACTIVITY_COORDINATOR]: "Manages church activities, soul winning, and outreach records.",
    [UserRole.MEMBER]: "View-only personal access. Can open own profile and My Financials.",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
    [UserRole.CHURCH_ADMINISTRATOR]: 'bg-slate-800 text-white border-slate-700',
    [UserRole.PASTOR]: 'bg-purple-100 text-purple-700 border-purple-200',
    [UserRole.CHURCH_CLERK]: 'bg-blue-100 text-blue-700 border-blue-200',
    [UserRole.TREASURER]: 'bg-green-100 text-green-700 border-green-200',
    [UserRole.RECORDING_SECRETARY]: 'bg-teal-100 text-teal-700 border-teal-200',
    [UserRole.MUSIC_MINISTER]: 'bg-orange-100 text-orange-700 border-orange-200',
    [UserRole.SUNDAY_SCHOOL_ADMIN]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [UserRole.GOODNEWS_TEACHER]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [UserRole.ACTIVITY_COORDINATOR]: 'bg-amber-100 text-amber-700 border-amber-200',
    [UserRole.MEMBER]: 'bg-gray-100 text-gray-700 border-gray-200',
};

interface MemberRole {
    member_id: string;
    role: string;
    member?: {
        first_name: string;
        surname: string;
        profile_picture_url?: string;
    };
}

interface ProfileEditRequest {
    id: string;
    target_member_id: string;
    requested_by_member_id?: string | null;
    request_message: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

const RoleManagement: React.FC = () => {
    const { roles } = useAuth();
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [members, setMembers] = useState<any[]>([]);
    const [assignedRoles, setAssignedRoles] = useState<MemberRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editRequests, setEditRequests] = useState<ProfileEditRequest[]>([]);
    const [confirmAdminObj, setConfirmAdminObj] = useState<{ memberId: string, role: string } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all members for search
            const { data: mData, error: mError } = await supabase
                .from('members')
                .select('id, first_name, surname, profile_picture_url')
                .order('surname');

            if (mError) throw mError;
            setMembers(mData || []);

            // 2. Fetch current role assignments
            const { data: rData, error: rError } = await supabase
                .from('user_roles')
                .select('member_id, role, members(first_name, surname, profile_picture_url)');

            if (rError) {
                // If table doesn't exist yet, handle gracefully
                if (rError.code === '42P01') {
                    console.warn("user_roles table missing");
                    setError("System Error: user_roles table is missing. Please run the migration.");
                } else {
                    throw rError;
                }
            } else {
                // Flatten structure
                const roles = (rData || []).map((r: any) => ({
                    member_id: r.member_id,
                    role: r.role,
                    member: r.members
                }));
                setAssignedRoles(roles);
            }

            // 3. Fetch pending profile edit requests (admin notification feed)
            const { data: reqData, error: reqError } = await supabase
                .from('member_profile_edit_requests')
                .select('id, target_member_id, requested_by_member_id, request_message, status, created_at')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(20);

            if (reqError) {
                if (reqError.code === '42P01') {
                    console.warn("member_profile_edit_requests table missing");
                    setEditRequests([]);
                } else {
                    throw reqError;
                }
            } else {
                setEditRequests((reqData || []) as ProfileEditRequest[]);
            }
        } catch (err: any) {
            console.error(err);
            setError("Failed to load data: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleRole = async (memberId: string, role: string, create: boolean) => {
        if (create && role === UserRole.CHURCH_ADMINISTRATOR && !confirmAdminObj) {
            setConfirmAdminObj({ memberId, role });
            return;
        }

        setSaving(true);
        try {
            if (create) {
                const { error } = await supabase
                    .from('user_roles')
                    .insert({ member_id: memberId, role });
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('user_roles')
                    .delete()
                    .eq('member_id', memberId)
                    .eq('role', role);
                if (error) throw error;
            }
            // Refresh local state
            fetchData();
        } catch (err: any) {
            showToast("Action failed: " + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const [selectedMember, setSelectedMember] = useState<any | null>(null);

    const resolveProfileEditRequest = async (requestId: string, status: 'approved' | 'rejected') => {
        setResolvingRequestId(requestId);
        try {
            const { data: userResult } = await supabase.auth.getUser();
            const adminUserId = userResult.user?.id || null;

            const { error } = await supabase
                .from('member_profile_edit_requests')
                .update({
                    status,
                    resolved_at: new Date().toISOString(),
                    resolved_by: adminUserId
                })
                .eq('id', requestId);

            if (error) throw error;
            showToast(`Request ${status}.`, 'success');
            fetchData();
        } catch (err: any) {
            showToast("Failed to update request: " + err.message, 'error');
        } finally {
            setResolvingRequestId(null);
        }
    };

    // Filter members
    const filteredMembers = members.filter(m =>
        `${m.first_name} ${m.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRolesForMember = (memberId: string) => {
        return assignedRoles.filter(r => r.member_id === memberId).map(r => r.role);
    };

    const getMemberDisplayName = (memberId: string) => {
        const found = members.find((m) => m.id === memberId);
        if (!found) return "Unknown Member";
        return `${found.first_name} ${found.surname}`;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--color-text-main)]">
                        <Shield className="text-[var(--color-primary)]" /> Role Management
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">
                        Securely assign administrative privileges to church members.
                    </p>
                </div>

                {/* User's own role badge */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Your Access:</span>
                    {roles.length > 0 ? (
                        roles.map(r => (
                            <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${ROLE_BADGE_COLORS[r] || 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                {r.replace(/_/g, ' ')}
                            </span>
                        ))
                    ) : (
                        <span className="text-xs text-gray-400 italic">Standard Access</span>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center gap-2 animate-pulse">
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            {editRequests.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-amber-900">
                        <Bell size={18} />
                        <h3 className="font-bold text-sm uppercase tracking-wider">
                            Pending Profile Edit Requests ({editRequests.length})
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {editRequests.slice(0, 5).map((req) => (
                            <div key={req.id} className="bg-white border border-amber-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{getMemberDisplayName(req.target_member_id)}</p>
                                    <p className="text-xs text-gray-600 mt-1">{req.request_message}</p>
                                    <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
                                        <Clock3 size={12} />
                                        {new Date(req.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => resolveProfileEditRequest(req.id, 'approved')}
                                        disabled={resolvingRequestId === req.id}
                                        className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => resolveProfileEditRequest(req.id, 'rejected')}
                                        disabled={resolvingRequestId === req.id}
                                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Member List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search members..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] shadow-sm transition-all"
                        />
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-[600px] flex flex-col">
                        <div className="p-3 bg-gray-50 border-b border-gray-100 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                            Select a Member
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Loading directory...</span>
                                </div>
                            ) : filteredMembers.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    {members.length === 0 ? "No members in the registry yet." : "No matches found."}
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {filteredMembers.map(member => {
                                        const memberRoles = getRolesForMember(member.id);
                                        const isSelected = selectedMember?.id === member.id;
                                        const hasAccess = memberRoles.length > 0;

                                        return (
                                            <button
                                                key={member.id}
                                                onClick={() => setSelectedMember(member)}
                                                className={`w-full text-left p-4 transition-all duration-200 hover:bg-gray-50 flex items-center gap-3
                                                    ${isSelected ? 'bg-blue-50/60 border-l-4 border-[var(--color-primary)]' : 'border-l-4 border-transparent'}
                                                `}
                                            >
                                                <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${isSelected ? 'border-blue-200 shadow-sm' : 'border-gray-100'}`}>
                                                    {member.profile_picture_url ? (
                                                        <img src={member.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                            {member.first_name[0]}{member.surname[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>
                                                        {member.surname}, {member.first_name}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {hasAccess ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                                                                <Shield size={10} /> {memberRoles.length} Roles
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400">No access</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ArrowRight size={16} className={`text-gray-300 ${isSelected ? 'text-[var(--color-primary)] opacity-100' : 'opacity-0'}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Role Assignment Panel */}
                <div className="lg:col-span-2">
                    {selectedMember ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden fade-in-up">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex items-center gap-5 bg-gradient-to-r from-gray-50 to-white">
                                <div className="w-20 h-20 rounded-2xl shadow-md overflow-hidden bg-white p-1 border border-gray-100">
                                    <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50">
                                        {selectedMember.profile_picture_url ? (
                                            <img src={selectedMember.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300 bg-gray-100">
                                                {selectedMember.first_name[0]}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">
                                        {selectedMember.first_name} {selectedMember.surname}
                                    </h2>
                                    <p className="text-[var(--color-text-muted)] flex items-center gap-2 text-sm mt-1">
                                        <User size={14} /> ID: {selectedMember.id}
                                    </p>
                                </div>
                            </div>

                            {/* Roles Grid */}
                            <div className="p-6">
                                <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Shield size={16} /> Assign Privileges
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => {
                                        const memberRoles = getRolesForMember(selectedMember.id);
                                        const hasRole = memberRoles.includes(role);
                                        const isActive = hasRole;

                                        return (
                                            <button
                                                key={role}
                                                onClick={() => toggleRole(selectedMember.id, role, !isActive)}
                                                disabled={saving}
                                                className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-start gap-4 hover:-translate-y-0.5
                                                    ${isActive
                                                        ? 'bg-blue-50/50 border-[var(--color-primary)] shadow-md shadow-blue-500/10'
                                                        : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                                    }
                                                `}
                                            >
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors mt-0.5
                                                    ${isActive ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-300 group-hover:bg-gray-200'}
                                                `}>
                                                    {isActive && <Check size={14} strokeWidth={3} />}
                                                </div>

                                                <div className="flex-1">
                                                    <h4 className={`font-bold text-sm ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>
                                                        {role.replace(/_/g, ' ')}
                                                    </h4>
                                                    <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                                                        {desc}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-400">
                                Changes are saved automatically.
                            </div>
                        </div>
                    ) : (
                        <div className="h-[600px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                <User className="text-gray-300" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-500">No Member Selected</h3>
                            <p className="text-gray-400 max-w-xs mt-2">
                                Select a member from the directory on the left to view and manage their access roles.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {confirmAdminObj && (
                <ConfirmModal
                    isOpen={true}
                    title="Grant Church Administrator Access?"
                    message="Are you sure you want to grant full system access to this user? They will have complete control over settings, users, and all data."
                    confirmText="Grant Access"
                    onConfirm={() => {
                        const targetId = confirmAdminObj.memberId;
                        const targetRole = confirmAdminObj.role;
                        setConfirmAdminObj(null);
                        toggleRole(targetId, targetRole, true);
                    }}
                    onCancel={() => setConfirmAdminObj(null)}
                />
            )}
        </div>
    );
};

export default RoleManagement;
