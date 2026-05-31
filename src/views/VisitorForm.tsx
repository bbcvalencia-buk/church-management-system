
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as visitorService from '@/services/visitorService';
import * as memberService from '@/services/memberService';
import { splitVisitorName } from '@/lib/visitorDedup';
import { getLatestSundayISODate } from '@/lib/date';
import type { Visitor, Member } from '@/types';
import MultiImageUpload from '@/components/MultiImageUpload';
import { useToast } from '@/contexts/ToastContext';
import { User, Phone, MapPin, Calendar, Heart, ArrowLeft, Save, UserPlus, CheckCircle, Upload, FileText } from 'lucide-react';
import ConvertToMemberModal from '@/components/ConvertToMemberModal';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionDraft } from '@/hooks/useSessionDraft';

const VisitorForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const isEditMode = !!id;

    const [visitor, setVisitor, clearVisitorDraft] = useSessionDraft<Partial<Visitor>>(
        isEditMode ? `visitor-form-edit-${id}` : 'visitor-form-new',
        {
            visit_date: getLatestSundayISODate(),
            visit_time: 'AM',
            gender: 'Male',
            marital_status: 'Single',
            follow_up_status: 'pending',
            is_prospect_for_baptism: false,
            is_saved: false,
            visitor_card_images: []
        }
    );

    const [loading, setLoading] = useState(isEditMode);
    const [activeTab, setActiveTab] = useState('visit');
    const [showConvertModal, setShowConvertModal] = useState(false);
    const { roles } = useAuth();
    const canConvert = roles.includes('church_administrator') || roles.includes('church_clerk');

    const TABS = [
        { id: 'visit', label: 'Visit Details', icon: Calendar },
        { id: 'personal', label: 'Personal Info', icon: User },
        { id: 'contact', label: 'Contact Details', icon: MapPin },
        { id: 'spiritual', label: 'Spiritual Status', icon: Heart },
        { id: 'cards', label: 'Visitor Cards', icon: FileText }
    ];

    useEffect(() => {
        if (isEditMode) {
            fetchVisitor();
        }
    }, [id]);

    const fetchVisitor = async () => {
        setLoading(true);
        try {
            const data = await visitorService.getVisitorById(id!);
            if (data) {
                // Handle legacy single image -> array
                const images = data.visitor_card_images || (data.visitor_card_image_url ? [data.visitor_card_image_url] : []);
                setVisitor({ ...data, visitor_card_images: images });
            }
        } catch (err) {
            console.error("Error fetching visitor:", err);
            showToast("Failed to load visitor data", "error");
        } finally {
            setLoading(false);
        }
    };

    const update = (field: keyof Visitor, value: any) => {
        setVisitor(prev => ({ ...prev, [field]: value }));
    };

    const handleConversionSuccess = (newMemberId: string) => {
        showToast("Successfully converted to regular member!", 'success');
        setShowConvertModal(false);
        navigate(`/members/${newMemberId}`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Visitor card images are handled by MultiImageUpload component immediately
            const visitorData = {
                ...visitor,
                name: visitor.name?.trim() || 'Unknown',
                address: visitor.address?.trim() || 'Unknown',
                contact_number: visitor.contact_number?.trim() || 'N/A',
                visitor_card_images: visitor.visitor_card_images || []
            };

            // 1. Ensure shadow member record exists and is synced
            let memberId = visitor.member_id;
            const parsedName = splitVisitorName(visitorData.name);
            const memberPayload = {
                first_name: parsedName.firstName || 'Visitor',
                surname: parsedName.surname || '',
                is_regular_member: false,
                membership_status: 'active' as const,
                home_address: visitorData.address,
                phone_number: visitorData.contact_number,
                gender: visitorData.gender,
                civil_status: visitorData.marital_status || 'Single',
                date_of_birth: visitorData.date_of_birth || new Date().toISOString().split('T')[0]
            };

            if (memberId) {
                // Update existing shadow member
                await memberService.updateMember(memberId, memberPayload);
            } else {
                // Create a new shadow member
                const newMember = await memberService.createMember(memberPayload);
                memberId = newMember.id;
                visitorData.member_id = memberId;

                // Immediately clear the automatically generated member number for the visitor shadow record
                await memberService.updateMember(memberId, {
                    member_number: null as any,
                    member_number_year: null as any,
                    member_number_seq: null as any
                });
            }

            const savedVisitor = await visitorService.upsertVisitor(visitorData);

            showToast(isEditMode ? "Visitor updated successfully!" : "Visitor added successfully!", 'success');
            clearVisitorDraft();

            if (!isEditMode) {
                navigate(`/visitors/${savedVisitor.id}`);
            }
        } catch (error: any) {
            console.error('Error saving visitor:', error);
            showToast('Failed to save visitor: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditMode) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-20 fade-in">
            {/* Top Navigation / Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm sticky top-4 z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none mb-1">
                            {isEditMode ? 'Edit Visitor' : 'New Visitor Registration'}
                        </h1>
                        <p className="text-sm font-semibold text-gray-500">
                            {isEditMode ? `Managing ${visitor.name}` : 'Register a new visitor for follow-up'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/visitors')}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-[#2563eb] hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 font-bold disabled:opacity-50"
                    >
                        <Save size={18} />
                        {loading ? 'Saving...' : 'Save Visitor'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Fixed Sidebar */}
                <div className="w-full md:w-64 shrink-0">
                    <div className="bg-white rounded-[24px] border border-gray-100 p-3 shadow-sm sticky top-36">
                        <nav className="flex flex-col gap-1">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <tab.icon size={18} />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Main Form Fields */}
                <div className="flex-1 space-y-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* 1. Visit Details */}
                        <div id="visit" className="bg-white rounded-[24px] border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Calendar className="text-blue-600" size={20} />
                                </div>
                                <h3 className="text-[18px] font-bold text-gray-900">Visit Details</h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Visit Date</label>
                                    <input
                                        type="date"
                                        value={visitor.visit_date}
                                        onChange={(e) => update('visit_date', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Service Time</label>
                                    <select
                                        value={visitor.visit_time}
                                        onChange={(e) => update('visit_time', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                    >
                                        <option value="AM">AM Service</option>
                                        <option value="PM">PM Service</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Invited By</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                        value={visitor.invited_by || ''}
                                        onChange={(e) => update('invited_by', e.target.value)}
                                        placeholder="Member / Teacher Name"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Personal Information */}
                        <div id="personal" className="bg-white rounded-[24px] border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <User className="text-blue-600" size={20} />
                                </div>
                                <h3 className="text-[18px] font-bold text-gray-900">Personal Information</h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Full Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                        value={visitor.name || ''}
                                        onChange={(e) => update('name', e.target.value)}
                                        placeholder="e.g. Maria Clara"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Age</label>
                                    <input
                                        type="number"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                        value={visitor.age || ''}
                                        onChange={(e) => {
                                            if (!e.target.value.trim()) {
                                                update('age', undefined);
                                                return;
                                            }
                                            update('age', parseInt(e.target.value, 10));
                                        }}
                                        placeholder="e.g. 25"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Date of Birth</label>
                                    <input
                                        type="date"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm text-gray-500"
                                        value={visitor.date_of_birth || ''}
                                        onChange={(e) => update('date_of_birth', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Gender</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                        value={visitor.gender}
                                        onChange={(e) => update('gender', e.target.value as any)}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Marital Status</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                        value={visitor.marital_status}
                                        onChange={(e) => update('marital_status', e.target.value as any)}
                                    >
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Widow">Widow</option>
                                        <option value="Widower">Widower</option>
                                        <option value="Separated">Separated</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Current Church</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-semibold text-sm"
                                        value={visitor.church_name || ''}
                                        onChange={(e) => update('church_name', e.target.value)}
                                        placeholder="Church affiliation (if any)"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Contact Details */}
                        <div id="contact" className="bg-white rounded-[24px] border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <MapPin className="text-blue-600" size={20} />
                                </div>
                                <h3 className="text-[18px] font-bold text-gray-900">Contact Details</h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Home Address</label>
                                    <textarea
                                        value={visitor.address || ''}
                                        onChange={(e) => update('address', e.target.value)}
                                        placeholder="Complete Address"
                                        required
                                        className="min-h-[100px] w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-medium text-sm resize-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Office Address (Optional)</label>
                                    <textarea
                                        value={visitor.office_address || ''}
                                        onChange={(e) => update('office_address', e.target.value)}
                                        placeholder="Office Address"
                                        className="min-h-[90px] w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all outline-none font-medium text-sm resize-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Contact Number</label>
                                    <div className="flex bg-white border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 shadow-sm transition-all overflow-hidden">
                                        <div className="p-3 text-gray-400 bg-gray-50 border-r border-gray-200"><Phone size={18} /></div>
                                        <input
                                            type="tel"
                                            className="w-full p-3 text-gray-900 outline-none font-semibold text-sm bg-transparent"
                                            value={visitor.contact_number || ''}
                                            onChange={(e) => update('contact_number', e.target.value)}
                                            placeholder="+1 (555) 000-0000"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Spiritual Status */}
                        <div id="spiritual" className="bg-white rounded-[24px] border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Heart className="text-blue-600" size={20} />
                                </div>
                                <h3 className="text-[18px] font-bold text-gray-900">Spiritual Status</h3>
                            </div>
                            <div className="p-8 space-y-4">
                                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-white transition-colors">
                                    <div>
                                        <span className="font-bold text-gray-900 text-sm">Is Saved?</span>
                                        <p className="text-xs font-semibold text-gray-500 mt-0.5">Check if visitor has accepted Christ</p>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full flex items-center transition-colors p-1 border ${visitor.is_saved ? 'bg-blue-600 border-blue-600' : 'bg-gray-200 border-gray-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={visitor.is_saved || false}
                                            onChange={(e) => update('is_saved', e.target.checked)}
                                            className="hidden"
                                        />
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${visitor.is_saved ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-white transition-colors">
                                    <div>
                                        <span className="font-bold text-gray-900 text-sm">Prospect for Baptism?</span>
                                        <p className="text-xs font-semibold text-gray-500 mt-0.5">Check if visitor is a candidate for baptism</p>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full flex items-center transition-colors p-1 border ${visitor.is_prospect_for_baptism ? 'bg-blue-600 border-blue-600' : 'bg-gray-200 border-gray-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={visitor.is_prospect_for_baptism || false}
                                            onChange={(e) => update('is_prospect_for_baptism', e.target.checked)}
                                            className="hidden"
                                        />
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${visitor.is_prospect_for_baptism ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>

                                {isEditMode && canConvert && !visitor.converted_to_member && visitor.status !== 'converted' && (
                                    <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between bg-white rounded-xl p-4 border shadow-sm">
                                        <div>
                                            <span className="font-bold text-gray-900 text-sm">Convert to Member</span>
                                            <p className="text-xs font-semibold text-gray-500 mt-0.5">Convert this visitor fully to the main Member Registry</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowConvertModal(true)}
                                            className="text-green-600 bg-white hover:bg-green-50 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors text-sm font-bold border-2 border-green-200"
                                        >
                                            <CheckCircle size={18} />
                                            Convert to Member
                                        </button>
                                    </div>
                                )}
                                {(visitor.converted_to_member || visitor.status === 'converted') && (
                                    <div className="pt-4 mt-4 border-t border-gray-100">
                                        <div className="flex items-center gap-2 text-green-600 text-sm font-bold px-4 py-3 bg-green-50 rounded-xl border border-green-200 w-full justify-center">
                                            <CheckCircle size={18} /> Fully Converted Member
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. Visitor Cards */}
                        <div id="cards" className="bg-white rounded-[24px] border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <FileText className="text-blue-600" size={20} />
                                </div>
                                <h3 className="text-[18px] font-bold text-gray-900">Visitor Cards</h3>
                            </div>
                            <div className="p-8">
                                <p className="text-[12px] font-semibold text-gray-500 mb-4">Upload photos of visitor cards (Front/Back) or other relevant documents.</p>
                                <div className="border border-dashed border-gray-300 rounded-2xl bg-gray-50">
                                    <MultiImageUpload
                                        values={visitor.visitor_card_images || []}
                                        onChange={(urls) => update('visitor_card_images', urls)}
                                        folder="visitors"
                                        label=""
                                        description=""
                                    />
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
            </div>

            <ConvertToMemberModal
                visitor={visitor}
                isOpen={showConvertModal}
                onClose={() => setShowConvertModal(false)}
                onSuccess={handleConversionSuccess}
            />
        </div>
    );
};

export default VisitorForm;
