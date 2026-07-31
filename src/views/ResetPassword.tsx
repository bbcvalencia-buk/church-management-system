import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, CheckCircle2, Circle, ArrowLeft, ArrowRight, KeyRound } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Validation checks
    const hasLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isReady = hasLength && hasNumber && hasSymbol && password === confirmPassword && password.length > 0;

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isReady) return;

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            showToast("Password updated successfully!", "success");
            navigate('/login');
        } catch (err: any) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] p-4">
            <div className="w-full max-w-[480px] bg-white rounded-none shadow-xl border-b-4 border-blue-500 overflow-hidden">
                <div className="p-10 space-y-6 text-center">

                    {/* Icon */}
                    <div className="mx-auto w-14 h-14 bg-[#f0f4f8] rounded-none flex items-center justify-center mb-6">
                        <KeyRound className="text-[#2a3b5c] w-6 h-6" />
                    </div>

                    {/* Header */}
                    <div className="space-y-3">
                        <h2 className="text-[28px] font-bold text-[#1f2937] font-serif tracking-wide">
                            Set new password
                        </h2>
                        <p className="text-[#6b7280] text-[15px] max-w-sm mx-auto leading-relaxed">
                            Your new password must be different from previously used passwords.
                        </p>
                    </div>

                    <form onSubmit={handleReset} className="mt-8 space-y-6 text-left">
                        {/* New Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-[#374151]">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full border border-gray-200 bg-[#fbfcfd] px-4 py-3 text-[#1f2937] focus:border-[#2a3b5c] focus:ring-1 focus:ring-[#2a3b5c] outline-none transition-colors sm:text-lg tracking-widest rounded-none font-mono"
                                    placeholder="••••••••"
                                />
                                <div
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <Eye className="h-5 w-5" />
                                </div>
                            </div>
                        </div>

                        {/* Password Requirements Box */}
                        <div className="bg-[#f8f9fa] rounded-none p-5 border border-gray-100">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-4">
                                Password Requirements
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    {hasLength ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-gray-300" />
                                    )}
                                    <span className={`text-[14px] ${hasLength ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                                        At least 8 characters
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {hasNumber ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-gray-300" />
                                    )}
                                    <span className={`text-[14px] ${hasNumber ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                                        One number
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {hasSymbol ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-gray-300" />
                                    )}
                                    <span className={`text-[14px] ${hasSymbol ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                                        One symbol
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-[#374151]">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`block w-full border ${password === confirmPassword && confirmPassword.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-[#fbfcfd]'} px-4 py-3 text-[#1f2937] focus:border-[#2a3b5c] focus:ring-1 focus:ring-[#2a3b5c] outline-none transition-colors sm:text-lg tracking-widest rounded-none font-mono`}
                                placeholder="Re-enter new password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!isReady || loading}
                            className="w-full flex justify-center items-center py-4 px-4 border border-transparent text-sm font-bold text-[var(--color-text-main)] bg-[#203158] hover:bg-[#152342] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#203158] disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wide rounded-none shadow-md mt-8"
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-none animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    RESET PASSWORD <ArrowRight size={16} />
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="pt-6 mt-6">
                        <Link to="/login" className="inline-flex items-center justify-center gap-2 text-[14px] font-medium text-[#6b7280] hover:text-[#1f2937] transition-colors">
                            <ArrowLeft size={16} /> Back to login
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
