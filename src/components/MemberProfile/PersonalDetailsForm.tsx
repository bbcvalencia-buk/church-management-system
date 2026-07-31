import React from "react";
import { User, Heart, MapPin, Home, Phone, Mail, Star, Users, FileText, Eye } from "lucide-react";
import { Link } from "react-router-dom";

interface PersonalDetailsFormProps {
    member: any;
    positions: any[];
    handleViewMinistryMates: (department: string) => void;
    formatMinistryCategory: (category?: string | null) => string;
    formatMinistryDepartment: (department?: string | null) => string;
}

const PersonalDetailsForm: React.FC<PersonalDetailsFormProps> = ({
    member,
    positions,
    handleViewMinistryMates,
    formatMinistryCategory,
    formatMinistryDepartment,
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
                {/* Biographical */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-main)] flex items-center gap-2 mb-6">
                        <User size={16} className="text-[var(--color-primary)]" /> Biographical
                    </h3>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Nickname</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.nickname || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Civil Status</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.civil_status || 'Single'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Date of Birth</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">
                                {member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Gender</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.gender || '—'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Nationality</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.nationality || 'Filipino'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Place of Birth</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.place_of_birth || '—'}</p>
                        </div>
                    </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-main)] flex items-center gap-2 mb-6">
                        <Heart size={16} className="text-red-500" /> Emergency Contact
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Name</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.emergency_contact_name || 'Not Listed'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Relationship</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.emergency_contact_relationship || 'Not Listed'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Phone</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.emergency_contact_phone || 'Not Listed'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Column */}
            <div className="space-y-6">
                {/* Contact Details */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-main)] flex items-center gap-2 mb-6">
                        <MapPin size={16} className="text-[var(--color-primary)]" /> Contact Details
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <Home size={14} className="text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5">Home Address</p>
                                <p className="text-sm font-medium text-[var(--color-text-main)] leading-snug">{member.home_address || 'Not specified'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Phone size={14} className="text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5">Phone Number</p>
                                <p className="text-sm font-medium text-[var(--color-text-main)]">{member.phone_number || 'Not specified'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Mail size={14} className="text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5">Email Address</p>
                                <p className="text-sm font-medium text-[var(--color-text-main)] break-all">{member.email || 'Not specified'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Spiritual Journey */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-main)] flex items-center gap-2 mb-6">
                        <Star size={16} className="text-[var(--color-primary)]" /> Spiritual Journey
                    </h3>

                    <div className="relative pl-4 border-l-2 border-[var(--color-border)] space-y-6 mb-6">
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]"></div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5">Salvation Date</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">
                                {member.salvation_date ? new Date(member.salvation_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                            </p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-border)]"></div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5">Baptism Date</p>
                            <p className="text-sm font-medium text-[var(--color-text-muted)]">
                                {member.baptism_date ? new Date(member.baptism_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                            </p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-border)]"></div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5">Membership Date</p>
                            <p className="text-sm font-medium text-[var(--color-text-muted)]">
                                {member.membership_date ? new Date(member.membership_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Previous Religion</p>
                            <p className="text-sm font-medium text-[var(--color-text-main)]">{member.previous_religion || 'Catholic'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Membership Status</p>
                            <span className="inline-block bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded font-bold">
                                {member.is_regular_member ? 'Regular Member' : 'New Member'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
                {/* Ministries */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-main)] flex items-center gap-2 mb-6">
                        <Users size={16} className="text-[var(--color-primary)]" /> Ministries
                    </h3>

                    {positions.length > 0 ? (
                        <div className="space-y-3 mb-6">
                            {positions.map((pos, i) => (
                                <div key={i} onClick={() => handleViewMinistryMates(pos.department)} className="group border-b border-[var(--color-border)] pb-3 cursor-pointer hover:border-[var(--color-primary)] transition-all">
                                    <h4 className="font-bold text-[var(--color-text-main)] text-sm group-hover:text-[var(--color-primary)] transition-colors">
                                        {pos.position_name || pos.position_title || 'Ministry Member'}
                                    </h4>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                        {formatMinistryCategory(pos.position_category)} — Ministry: {formatMinistryDepartment(pos.department) || pos.department}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs font-mono text-[var(--color-text-muted)] italic mb-6">No ministry involvements recorded yet.</p>
                    )}

                    <Link to="/members" className="w-full py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-primary)] text-xs font-mono uppercase tracking-widest hover:bg-[var(--color-surface-hover)] transition-colors flex items-center justify-center gap-2">
                        <Eye size={14} /> View All Members
                    </Link>
                </div>

                {/* Record Info */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-main)] flex items-center gap-2 mb-4">
                        <FileText size={16} className="text-[var(--color-text-muted)]" /> Record Info
                    </h3>
                    <div className="space-y-2">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Record Created</p>
                        <p className="text-sm font-mono text-[var(--color-text-main)]">
                            {member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Feb 19, 2026'}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Information added to system directory.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonalDetailsForm;
