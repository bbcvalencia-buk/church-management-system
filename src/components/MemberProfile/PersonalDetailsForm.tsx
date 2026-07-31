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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Left Column */}
            <div className="space-y-6">
                {/* Biographical */}
                <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                            <User size={18} className="text-[#4f46e5]" /> Biographical
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nickname</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.nickname || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Civil Status</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.civil_status || 'Single'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date of Birth</p>
                            <p className="font-semibold text-gray-900 text-sm">
                                {member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Not specified'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Gender</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.gender || 'Not specified'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nationality</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.nationality || 'Filipino'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Place of Birth</p>
                            <p className="font-semibold text-gray-900 text-sm italic">{member.place_of_birth || 'Not specified'}</p>
                        </div>
                    </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                            <Heart size={18} className="text-red-500" /> Emergency Contact
                        </h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Name</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.emergency_contact_name || 'Not Listed'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Relationship</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.emergency_contact_relationship || 'Not Listed'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Phone</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.emergency_contact_phone || 'Not Listed'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Column */}
            <div className="space-y-6">
                {/* Contact Details */}
                <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                            <MapPin size={18} className="text-[var(--color-primary)]" /> Contact Details
                        </h3>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-none bg-gray-50 flex items-center justify-center shrink-0">
                                <Home size={14} className="text-[var(--color-primary)]" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Home Address</p>
                                <p className="font-semibold text-gray-900 text-sm leading-snug">{member.home_address || 'Not specified'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-none bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                                <Phone size={14} className="text-[var(--color-primary)]" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                                <p className="font-semibold text-gray-900 text-sm">{member.phone_number || 'Not specified'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-none bg-green-50 flex items-center justify-center shrink-0">
                                <Mail size={14} className="text-green-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
                                <p className="font-semibold text-gray-900 text-sm break-all">{member.email || 'Not specified'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Spiritual Journey */}
                <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                            <Star size={18} className="text-amber-500" /> Spiritual Journey
                        </h3>
                    </div>

                    <div className="relative pl-3 border-l-2 border-gray-100 space-y-6 mb-8">
                        <div className="relative">
                            <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-none bg-[#4f46e5] ring-4 ring-white"></div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Salvation Date</p>
                            <p className="font-semibold text-gray-900 text-sm">
                                {member.salvation_date ? new Date(member.salvation_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                            </p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-none bg-gray-300 ring-4 ring-white"></div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Baptism Date</p>
                            <p className="font-semibold text-gray-500 text-sm italic">
                                {member.baptism_date ? new Date(member.baptism_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                            </p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-none bg-gray-300 ring-4 ring-white"></div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Membership Date</p>
                            <p className="font-semibold text-gray-500 text-sm italic">
                                {member.membership_date ? new Date(member.membership_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Pending'}
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-50 space-y-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Previous Religion</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.previous_religion || 'Catholic'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-none p-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Membership Status</p>
                            <span className="bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[11px] px-3 py-1.5 rounded-none font-bold">
                                {member.is_regular_member ? 'Regular Member' : 'New Member'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
                {/* Ministries */}
                <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                            <Users size={18} className="text-[#4f46e5]" /> Ministries
                        </h3>
                    </div>

                    {positions.length > 0 ? (
                        <div className="space-y-4 mb-6">
                            {positions.map((pos, i) => (
                                <div key={i} onClick={() => handleViewMinistryMates(pos.department)} className="group border border-gray-100 rounded-none p-5 flex flex-col gap-1 shadow-sm cursor-pointer hover:border-[var(--color-primary)] hover:shadow-md transition-all">
                                    <h4 className="font-bold text-[#111827] text-[15px] group-hover:text-[var(--color-text-main)] transition-colors">
                                        {pos.position_name || pos.position_title || 'Ministry Member'}
                                    </h4>
                                    <p className="text-[14px] text-gray-500">
                                        {formatMinistryCategory(pos.position_category)} - Since {new Date(pos.start_date || pos.created_at || new Date()).toISOString().split('T')[0]}
                                    </p>
                                    <p className="text-[14px] text-gray-500">
                                        Ministry: {formatMinistryDepartment(pos.department) || pos.department}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[12px] font-semibold text-gray-400 italic mb-6">No ministry involvements recorded yet.</p>
                    )}

                    <Link to="/members" className="w-full py-2.5 border border-[var(--color-primary-light)] rounded-none text-[var(--color-primary)] text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                        <Eye size={15} /> View All Members
                    </Link>
                </div>

                {/* Record Info */}
                <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={18} className="text-gray-500" /> Record Info
                        </h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Record Created</p>
                            <p className="font-semibold text-gray-900 text-sm">
                                {member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Feb 19, 2026'}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">Information added to the system directory.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonalDetailsForm;
