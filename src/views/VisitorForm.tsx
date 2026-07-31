import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as visitorService from '@/services/visitorService';
import * as memberService from '@/services/memberService';
import { splitVisitorName } from '@/lib/visitorDedup';
import { getLatestSundayISODate } from '@/lib/date';
import type { Visitor, Member } from '@/types';
import MultiImageUpload from '@/components/MultiImageUpload';
import { useToast } from '@/contexts/ToastContext';
import { User, Phone, MapPin, Calendar, Heart, ArrowLeft, Save, FileText, CheckCircle } from 'lucide-react';
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
            const visitorData = {
                ...visitor,
                name: visitor.name?.trim() || 'Unknown',
                address: visitor.address?.trim() || 'Unknown',
                contact_number: visitor.contact_number?.trim() || 'N/A',
                visitor_card_images: visitor.visitor_card_images || []
            };

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
                await memberService.updateMember(memberId, memberPayload);
            } else {
                const newMember = await memberService.createMember(memberPayload);
                memberId = newMember.id;
                visitorData.member_id = memberId;

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
            <div className="animate-spin h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
        </div>
    );

    const inputClasses = "w-full bg-transparent border border-[var(--color-border)] rounded-[0.5rem] p-3 text-[var(--color-text-main)] outline-none font-medium text-[13px] focus:border-[var(--color-primary)] transition-colors";
    const labelClasses = "text-[11px] font-bold text-[var(--color-text-main)] uppercase tracking-widest";
    const sectionClasses = "bg-[var(--color-surface)] rounded-[0.5rem] border border-[var(--color-border)] overflow-hidden";

    return (
        <div className="max-w-6xl mx-auto pb-20 fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-[var(--color-surface)] p-6 rounded-[0.5rem] border border-[var(--color-border)] sticky top-4 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-[0.5rem] transition-colors text-gray-600">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-text-main)] tracking-tight leading-none mb-1 uppercase">
                            {isEditMode ? 'Edit Visitor' : 'New Visitor Registration'}
                        </h1>
                        <p className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                            {isEditMode ? `Managing ${visitor.name}` : 'Register a new visitor for follow-up'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={() => navigate('/visitors')} className="px-6 py-2.5 rounded-[0.5rem] text-[12px] font-bold text-[var(--color-text-main)] hover:bg-gray-100 transition-colors border border-[var(--color-border)] uppercase tracking-widest">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="bg-[var(--color-primary)] text-white px-8 py-2.5 rounded-[0.5rem] flex items-center gap-2 transition-all font-bold text-[12px] disabled:opacity-50 uppercase tracking-widest">
                        <Save size={16} />
                        {loading ? 'Saving...' : 'Save Visitor'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-64 shrink-0">
                    <div className="bg-[var(--color-surface)] rounded-[0.5rem] border border-[var(--color-border)] p-3 sticky top-36">
                        <nav className="flex flex-col gap-1">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-[0.5rem] text-[11px] font-bold transition-all uppercase tracking-widest ${activeTab === tab.id
                                        ? 'bg-gray-100 text-[var(--color-text-main)]'
                                        : 'text-[var(--color-text-muted)] hover:bg-gray-50'
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                <div className="flex-1 space-y-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div id="visit" className={sectionClasses}>
                            <div className="p-6 border-b border-[var(--color-border)] flex items-center gap-3">
                                <Calendar className="text-[var(--color-text-main)]" size={18} />
                                <h3 className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-text-main)]">Visit Details</h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className={labelClasses}>Visit Date</label>
                                    <input type="date" value={visitor.visit_date} onChange={(e) => update('visit_date', e.target.value)} className={inputClasses} required />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Service Time</label>
                                    <select value={visitor.visit_time} onChange={(e) => update('visit_time', e.target.value)} className={inputClasses}>
                                        <option value="AM">AM Service</option>
                                        <option value="PM">PM Service</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className={labelClasses}>Invited By</label>
                                    <input type="text" className={inputClasses} value={visitor.invited_by || ''} onChange={(e) => update('invited_by', e.target.value)} placeholder="MEMBER / TEACHER NAME" />
                                </div>
                            </div>
                        </div>

                        <div id="personal" className={sectionClasses}>
                            <div className="p-6 border-b border-[var(--color-border)] flex items-center gap-3">
                                <User className="text-[var(--color-text-main)]" size={18} />
                                <h3 className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-text-main)]">Personal Information</h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 md:col-span-2">
                                    <label className={labelClasses}>Full Name</label>
                                    <input type="text" className={inputClasses} value={visitor.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="E.G. MARIA CLARA" required />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Age</label>
                                    <input type="number" className={inputClasses} value={visitor.age || ''} onChange={(e) => {
                                        if (!e.target.value.trim()) {
                                            update('age', undefined);
                                            return;
                                        }
                                        update('age', parseInt(e.target.value, 10));
                                    }} placeholder="E.G. 25" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Date of Birth</label>
                                    <input type="date" className={inputClasses} value={visitor.date_of_birth || ''} onChange={(e) => update('date_of_birth', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Gender</label>
                                    <select className={inputClasses} value={visitor.gender} onChange={(e) => update('gender', e.target.value as any)}>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Marital Status</label>
                                    <select className={inputClasses} value={visitor.marital_status} onChange={(e) => update('marital_status', e.target.value as any)}>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Widow">Widow</option>
                                        <option value="Widower">Widower</option>
                                        <option value="Separated">Separated</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className={labelClasses}>Current Church</label>
                                    <input type="text" className={inputClasses} value={visitor.church_name || ''} onChange={(e) => update('church_name', e.target.value)} placeholder="CHURCH AFFILIATION (IF ANY)" />
                                </div>
                            </div>
                        </div>

                        <div id="contact" className={sectionClasses}>
                            <div className="p-6 border-b border-[var(--color-border)] flex items-center gap-3">
                                <MapPin className="text-[var(--color-text-main)]" size={18} />
                                <h3 className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-text-main)]">Contact Details</h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className={labelClasses}>Home Address</label>
                                    <textarea value={visitor.address || ''} onChange={(e) => update('address', e.target.value)} placeholder="COMPLETE ADDRESS" required className={`${inputClasses} min-h-[100px] resize-none`} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Office Address (Optional)</label>
                                    <textarea value={visitor.office_address || ''} onChange={(e) => update('office_address', e.target.value)} placeholder="OFFICE ADDRESS" className={`${inputClasses} min-h-[90px] resize-none`} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Contact Number</label>
                                    <div className="flex bg-transparent border border-[var(--color-border)] rounded-[0.5rem] focus-within:border-[var(--color-primary)] transition-colors overflow-hidden">
                                        <div className="p-3 text-[var(--color-text-muted)] border-r border-[var(--color-border)]"><Phone size={16} /></div>
                                        <input type="tel" className="w-full p-3 text-[var(--color-text-main)] outline-none font-medium text-[13px] bg-transparent" value={visitor.contact_number || ''} onChange={(e) => update('contact_number', e.target.value)} placeholder="+1 (555) 000-0000" required />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="spiritual" className={sectionClasses}>
                            <div className="p-6 border-b border-[var(--color-border)] flex items-center gap-3">
                                <Heart className="text-[var(--color-text-main)]" size={18} />
                                <h3 className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-text-main)]">Spiritual Status</h3>
                            </div>
                            <div className="p-8 space-y-4">
                                <label className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-[0.5rem] cursor-pointer hover:bg-gray-50 transition-colors">
                                    <div>
                                        <span className={labelClasses}>Is Saved?</span>
                                        <p className="text-[11px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-widest">Check if visitor has accepted Christ</p>
                                    </div>
                                    <input type="checkbox" checked={visitor.is_saved || false} onChange={(e) => update('is_saved', e.target.checked)} className="rounded-[0.25rem] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4" />
                                </label>
                                <label className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-[0.5rem] cursor-pointer hover:bg-gray-50 transition-colors">
                                    <div>
                                        <span className={labelClasses}>Prospect for Baptism?</span>
                                        <p className="text-[11px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-widest">Check if visitor is a candidate for baptism</p>
                                    </div>
                                    <input type="checkbox" checked={visitor.is_prospect_for_baptism || false} onChange={(e) => update('is_prospect_for_baptism', e.target.checked)} className="rounded-[0.25rem] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4" />
                                </label>

                                {isEditMode && canConvert && !visitor.converted_to_member && visitor.status !== 'converted' && (
                                    <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex items-center justify-between p-4 border border-[var(--color-border)] rounded-[0.5rem]">
                                        <div>
                                            <span className={labelClasses}>Convert to Member</span>
                                            <p className="text-[11px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-widest">Convert this visitor fully to the main Member Registry</p>
                                        </div>
                                        <button type="button" onClick={() => setShowConvertModal(true)} className="text-[var(--color-text-main)] hover:bg-gray-100 px-4 py-2 rounded-[0.5rem] flex items-center gap-2 transition-colors text-[11px] font-bold border border-[var(--color-border)] uppercase tracking-widest">
                                            <CheckCircle size={14} />
                                            Convert to Member
                                        </button>
                                    </div>
                                )}
                                {(visitor.converted_to_member || visitor.status === 'converted') && (
                                    <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                                        <div className="flex items-center gap-2 text-[var(--color-primary)] text-[11px] font-bold px-4 py-3 bg-gray-50 rounded-[0.5rem] border border-[var(--color-border)] w-full justify-center uppercase tracking-widest">
                                            <CheckCircle size={14} /> Fully Converted Member
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div id="cards" className={sectionClasses}>
                            <div className="p-6 border-b border-[var(--color-border)] flex items-center gap-3">
                                <FileText className="text-[var(--color-text-main)]" size={18} />
                                <h3 className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-text-main)]">Visitor Cards</h3>
                            </div>
                            <div className="p-8">
                                <p className="text-[11px] font-bold text-[var(--color-text-muted)] mb-4 uppercase tracking-widest">Upload photos of visitor cards (Front/Back) or other relevant documents.</p>
                                <div className="border border-[var(--color-border)] rounded-[0.5rem] bg-transparent">
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
