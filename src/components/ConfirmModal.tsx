
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    isDanger = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="card-panel w-full max-w-sm p-6 relative animate-in zoom-in-95 duration-200 shadow-2xl bg-white">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-red-500 p-1 hover:bg-gray-100 rounded-none transition-colors"
                >
                    <X size={18} />
                </button>

                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-none ${isDanger ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-yellow-500'}`}>
                        <AlertTriangle size={32} />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-[var(--color-text-main)]">{title}</h2>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full pt-4">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-none bg-gray-100 hover:bg-gray-200 text-[var(--color-text-main)] font-medium transition-colors border border-[var(--color-border)]"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-2.5 rounded-none font-bold text-[var(--color-text-main)] shadow-lg transition-all active:scale-95 ${isDanger
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                                : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
