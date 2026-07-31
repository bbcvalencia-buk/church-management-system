import React from "react";
import { Users, User } from "lucide-react";

interface Mate {
    id: string;
    name: string;
    position: string;
    isHead: boolean;
    avatar?: string;
}

const MINISTRY_DEPARTMENT_LABELS: Record<string, string> = {
    adult: "Sunday School Adult",
    beginners: "Sunday School Beginners Class",
    nursery: "Sunday School Nursery/Toddler",
    kinder: "Sunday School Kindergarten",
    primary: "Sunday School Primary",
    junior: "Sunday School Junior",
};

const formatMinistryDepartment = (department?: string | null) => {
    if (!department) return "";
    return MINISTRY_DEPARTMENT_LABELS[department] || department;
};

interface Props {
    ministryName: string;
    mates: Mate[];
    loading: boolean;
    onClose: () => void;
}

const MinistryMatesModal: React.FC<Props> = ({ ministryName, mates, loading, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[18px] font-bold text-gray-900">
                        Ministry: {formatMinistryDepartment(ministryName) || ministryName}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {loading ? (
                        <div className="text-center py-6 text-gray-400 animate-pulse font-medium text-sm">Loading members...</div>
                    ) : mates.length > 0 ? (
                        mates.map((mate, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                    {mate.avatar ? (
                                        <img src={mate.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <User size={20} className="text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 text-sm truncate">{mate.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{mate.position}</p>
                                </div>
                                {mate.isHead && (
                                    <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 uppercase">Head</span>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 px-4">
                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                                <Users size={20} className="text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium text-sm">No other mates found in this ministry yet.</p>
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <button onClick={onClose} className="w-full py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MinistryMatesModal;
