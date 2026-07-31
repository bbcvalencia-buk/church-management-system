import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface PinConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
    message?: string;
    actionLabel?: string;
}

export const PinConfirmModal: React.FC<PinConfirmModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    title = "Verify Identity",
    message = "Please enter your password to confirm this action.",
    actionLabel = "Confirm"
}) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            showToast("Password is required", "error");
            return;
        }

        if (!user?.email) {
            showToast("No active user email found", "error");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password,
            });

            if (error) {
                showToast("Invalid password", "error");
            } else {
                setPassword('');
                onSuccess();
            }
        } catch (err: any) {
            showToast("Error verifying password", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-none w-full max-w-sm overflow-hidden shadow-2xl relative">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Lock className="text-amber-500" size={20} />
                        <h3 className="font-bold text-gray-900">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <p className="text-sm text-gray-600">{message}</p>

                    <div>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-none p-2.5 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            autoFocus
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 hover:bg-gray-100 text-gray-600 font-medium rounded-none transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[var(--color-text-main)] font-medium rounded-none transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : actionLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
