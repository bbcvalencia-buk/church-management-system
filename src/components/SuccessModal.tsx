import React from 'react';
import { Check } from 'lucide-react';

interface SuccessModalProps {
    isOpen: boolean;
    title?: string;
    message?: string;
    onDone: () => void;
    onView?: () => void;
    viewText?: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
    isOpen,
    title = "Report Submitted Successfully",
    message = "Your ministry report has been securely logged and sent to the administration team. Thank you for your faithful service.",
    onDone,
    onView,
    viewText = "View Submitted Report"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[440px] p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <Check size={28} className="text-green-500" strokeWidth={3} />
                    </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">
                    {title}
                </h2>

                <p className="text-[14px] text-gray-500 leading-relaxed mb-8 max-w-[320px]">
                    {message}
                </p>

                <div className="flex items-center gap-3 w-full justify-center">
                    <button
                        onClick={onDone}
                        className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Done
                    </button>
                    {onView && (
                        <button
                            onClick={onView}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                        >
                            {viewText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuccessModal;
