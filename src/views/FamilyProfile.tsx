import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    Users, Heart, Shield, ArrowLeft, Mail, Printer, Edit3, CheckCircle2, Phone, Home, BookOpen, Clock, Activity, FileText, TrendingUp, Calendar, User, Star, MapPin
} from "lucide-react";

import * as memberService from "@/services/memberService";
import Skeleton from "@/components/Skeleton";
import { useToast } from "@/contexts/ToastContext";

interface FamilyMember {
    id: string;
    first_name: string;
    surname: string;
    membership_status: string;
    profile_picture_url: string;
    date_of_birth: string;
    created_at: string;
    home_address?: string;
    phone_number?: string;
    email?: string;
}

const FamilyProfile: React.FC = () => {
    const { surname } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');

    useEffect(() => {
        if (surname) {
            fetchFamilyMembers(surname);
        }
    }, [surname]);

    const fetchFamilyMembers = async (familySurname: string) => {
        setLoading(true);
        try {
            const data = await memberService.getMembersBySurname(familySurname);
            setMembers(data as any[]);
        } catch (err: any) {
            console.error("Failed to load family members:", err);
            showToast("Failed to load family members", "error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-pulse">
            <Skeleton className="w-full h-48 rounded-none" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-96 rounded-none" /><Skeleton className="h-96 rounded-none" /><Skeleton className="h-96 rounded-none" /></div>
        </div>
    );

    const mainHousehold = members[0] || {}; // Typically the oldest or head
    const familyCount = members.length;

    return (
        <div className="max-w-[1200px] mx-auto space-y-6 pb-20 fade-in font-sans">
            {/* Header Card */}
            <div className="bg-white rounded-[20px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-8 pb-0 overflow-hidden relative">
                <div className="flex flex-col md:flex-row gap-8 items-start mb-6">
                    {/* Representative Avatar / Family Icon */}
                    <div className="relative shrink-0 w-36 h-36">
                        <div className="w-full h-full rounded-[24px] overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 border-4 border-white shadow-lg flex items-center justify-center text-[var(--color-primary)]">
                            {members.length > 1 ? <Users size={56} /> : <User size={56} />}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-[var(--color-primary)] text-[var(--color-text-main)] p-2 rounded-none shadow-lg border-2 border-white" title="Household">
                            <Home size={18} />
                        </div>
                    </div>

                    {/* Info Block */}
                    <div className="flex-1 space-y-3 w-full">
                        <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4">
                            <div>
                                <h1 className="text-4xl font-serif font-bold text-gray-900 tracking-tight">
                                    The {surname} Family
                                </h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-gray-500">
                                    <span className="px-3 py-1 rounded-none font-bold text-xs uppercase tracking-wider bg-green-100 text-green-700">
                                        Household
                                    </span>
                                    {mainHousehold.home_address && (
                                        <span className="flex items-center gap-1.5"><MapPin size={16} /> {mainHousehold.home_address?.split(',')[0]}</span>
                                    )}
                                    {mainHousehold.created_at && (
                                        <span className="flex items-center gap-1.5"><Calendar size={16} /> Since {new Date(mainHousehold.created_at).getFullYear()}</span>
                                    )}
                                    <span className="text-[var(--color-primary)] font-bold">
                                        Members: {familyCount}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={() => window.location.href = `mailto:${(mainHousehold as any).email || ''}`} className="px-5 py-2.5 bg-white border border-gray-200 rounded-none shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <Mail size={18} className="text-gray-400" /> Email Family
                                </button>
                                <button onClick={() => showToast('Label Printing module coming soon', 'info')} className="px-5 py-2.5 bg-white border border-gray-200 rounded-none shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <Printer size={18} className="text-gray-400" /> Print Labels
                                </button>
                                <button onClick={() => mainHousehold.id ? navigate(`/members/${mainHousehold.id}`) : showToast('No members found', 'error')} className="px-5 py-2.5 bg-[#4c1d95] text-[var(--color-text-main)] rounded-none shadow-md text-sm font-bold hover:bg-[#3b1773] flex items-center gap-2 transition-transform hover:-translate-y-0.5">
                                    <Edit3 size={18} /> Edit Household
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-gray-100/80 pt-5 mt-5">
                            <div className="flex gap-4">
                                <div className="text-gray-300 font-serif text-3xl">"</div>
                                <p className="text-gray-600 italic font-serif leading-relaxed mt-1 text-sm md:text-base">
                                    A wonderful household serving faithfully together. Often seen participating in Sunday worship as a family.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-8 overflow-x-auto px-2 mt-4 hide-scrollbar">
                    {['Overview', 'Sacraments', 'Giving', 'Notes', 'Attendance'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 border-b-[3px] transition-colors whitespace-nowrap ${activeTab === tab ? 'border-[#4c1d95] text-[#4c1d95]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                        >
                            {tab === 'Overview' && <Activity size={18} />}
                            {tab === 'Sacraments' && <Heart size={18} />}
                            {tab === 'Giving' && <TrendingUp size={18} />}
                            {tab === 'Notes' && <FileText size={18} />}
                            {tab === 'Attendance' && <Clock size={18} />}
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3 Columns Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Household/Family */}
                <div className="bg-white rounded-[20px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-6 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-serif text-xl font-bold text-gray-900">Household Members</h3>
                        <button onClick={() => showToast('Manage Household coming soon', 'info')} className="text-xs font-bold text-[#4c1d95] uppercase tracking-wider hover:underline">Manage</button>
                    </div>

                    <div className="space-y-4 flex-1">
                        {members.map((member, i) => (
                            <Link key={member.id} to={`/members/${member.id}`} className="flex items-center justify-between p-3 -mx-3 rounded-none hover:bg-gray-50 transition-colors group cursor-pointer border border-transparent hover:border-gray-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-none overflow-hidden bg-gray-200 shrink-0">
                                        {member.profile_picture_url ? (
                                            <img src={member.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 bg-emerald-100">
                                                {member.first_name[0]}{member.surname[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 group-hover:text-[#4c1d95] transition-colors">
                                            {member.first_name} {member.surname}
                                        </h4>
                                        <p className="text-xs text-gray-500">
                                            {i === 0 ? "Head of Household" : "Family Member"}
                                            {member.date_of_birth && ` • ${new Date().getFullYear() - new Date(member.date_of_birth).getFullYear()} yrs`}
                                        </p>
                                    </div>
                                </div>
                                <ArrowLeft size={16} className="text-gray-300 group-hover:text-[#4c1d95] rotate-180" />
                            </Link>
                        ))}
                    </div>

                    <Link to="/members/new" className="w-full mt-6 py-3 bg-white border border-dashed border-gray-300 rounded-none text-sm font-bold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors flex justify-center items-center gap-2">
                        + Add Family Member
                    </Link>
                </div>

                {/* Middle: Contact Info */}
                <div className="bg-white rounded-[20px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden flex flex-col h-full">
                    {/* Fake Map */}
                    <div className="h-40 bg-gray-200 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[#e5e3df] bg-[url('https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i13!2i2098!3i3129!4i256!2m3!1e0!2sm!3i665985011!3m17!2sen!3sUS!5e18!12m4!1e68!2m2!1sset!2sRoadmap!12m3!1e37!2m1!1ssmartmaps!4e0!5m1!5f2')] bg-cover bg-center mix-blend-multiply opacity-50"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/10 to-transparent"></div>
                        <button className="absolute bottom-3 right-3 bg-white px-3 py-1.5 rounded-none shadow-md text-xs font-bold text-gray-800">Google Maps</button>
                    </div>

                    <div className="p-6 flex-1 flex flex-col">
                        <h3 className="font-serif text-xl font-bold text-gray-900 mb-5">Household Contact</h3>

                        <div className="space-y-4 flex-1">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 w-8 h-8 rounded-none bg-gray-50 flex items-center justify-center shrink-0">
                                    <Home size={16} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{mainHousehold.home_address || 'Address not listed'}</p>
                                    <p className="text-xs text-gray-500">Home Address</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 w-8 h-8 rounded-none bg-gray-50 flex items-center justify-center shrink-0">
                                    <Phone size={16} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{(mainHousehold as any).phone_number || 'Phone not listed'}</p>
                                    <p className="text-xs text-gray-500">Household Phone</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 w-8 h-8 rounded-none bg-gray-50 flex items-center justify-center shrink-0">
                                    <Mail size={16} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{(mainHousehold as any).email || `${surname?.toLowerCase()}@example.com`}</p>
                                    <p className="text-xs text-gray-500">Primary Contact Email</p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 mt-6 pt-6 flex justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Family Last Attended</p>
                                <p className="font-bold text-gray-900">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Attendance Rate</p>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-gray-900">92%</p>
                                    <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded font-bold">+5%</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Right: Spiritual Milestones */}
                <div className="flex flex-col gap-6 h-full">
                    <div className="bg-white rounded-[20px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-6 flex-1">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-serif text-xl font-bold text-gray-900">Family Milestones</h3>
                            <button onClick={() => showToast('Milestone tracker coming soon', 'info')} className="text-xs font-bold text-[#4c1d95] uppercase tracking-wider hover:underline">Add Entry</button>
                        </div>

                        <div className="relative pl-4 border-l-2 border-gray-100 space-y-8">
                            {/* Membership Item */}
                            {mainHousehold.created_at && (
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-none bg-amber-500 ring-4 ring-white"></div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                                        {new Date(mainHousehold.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <h4 className="font-bold text-gray-900 mb-1">Household Created</h4>
                                    <p className="text-sm text-gray-500 leading-relaxed">
                                        First member of the family was added to the directories.
                                    </p>
                                </div>
                            )}

                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-none bg-gray-300 ring-4 ring-white"></div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                                    {new Date(Date.now() - 10000000000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <h4 className="font-bold text-gray-900 mb-1">First Visit</h4>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    The family attended the morning service. Guest card filled out.
                                </p>
                            </div>
                        </div>

                        <button className="w-full mt-8 text-center text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">
                            View Full History
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FamilyProfile;
