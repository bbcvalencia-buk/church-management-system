import React from 'react';
import type { ActivityRecord } from './types';
import { getTypeLabel } from './utils';
import { Calendar, Trash2, Edit2, FileText, ImageIcon, ExternalLink, MapPin, Users, Heart } from 'lucide-react';

interface ActivityViewModalProps {
    viewActivity: ActivityRecord;
    setViewActivity: (activity: ActivityRecord | null) => void;
    setConfirmDelete: (state: { isOpen: boolean; id: string | null }) => void;
    handleOpenModal: (activity?: ActivityRecord) => void;
}

export const ActivityViewModal: React.FC<ActivityViewModalProps> = ({
    viewActivity,
    setViewActivity,
    setConfirmDelete,
    handleOpenModal
}) => {
    if (!viewActivity) return null;
    
    return (
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
    );
};
