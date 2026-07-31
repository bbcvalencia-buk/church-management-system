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
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4">
            <div className="w-full max-w-[480px] bg-[var(--color-surface)] border border-[var(--color-border)] p-10">
                <div className="space-y-8 text-center">

                    {/* Icon */}
                    <div className="mx-auto w-14 h-14 border border-[var(--color-border)] flex items-center justify-center">
                        <KeyRound className="text-[var(--color-text-main)] w-6 h-6" />
                    </div>

                    {/* Header */}
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-[var(--color-text-main)] font-outfit uppercase tracking-tight">
                            Set New Password
                        </h2>
                        <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-widest font-bold max-w-sm mx-auto">
                            Ensure it differs from previously used passwords.
                        </p>
                    </div>

                    <form onSubmit={handleReset} className="mt-8 space-y-8 text-left">
                        {/* New Password */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-[var(--color-text-main)] focus:border-[var(--color-text-main)] outline-none transition-colors text-sm font-mono tracking-widest"
                                    placeholder="••••••••"
                                />
                                <div
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <Eye className="h-4 w-4" />
                                </div>
                            </div>
                        </div>

                        {/* Password Requirements Box */}
                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-5">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">
                                Security Requirements
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    {hasLength ? (
                                        <CheckCircle2 className="w-4 h-4 text-[var(--color-text-main)]" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-[var(--color-text-muted)]" />
                                    )}
                                    <span className={`text-xs uppercase tracking-widest font-bold ${hasLength ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                        8+ Characters
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {hasNumber ? (
                                        <CheckCircle2 className="w-4 h-4 text-[var(--color-text-main)]" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-[var(--color-text-muted)]" />
                                    )}
                                    <span className={`text-xs uppercase tracking-widest font-bold ${hasNumber ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                        One Number
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {hasSymbol ? (
                                        <CheckCircle2 className="w-4 h-4 text-[var(--color-text-main)]" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-[var(--color-text-muted)]" />
                                    )}
                                    <span className={`text-xs uppercase tracking-widest font-bold ${hasSymbol ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                        One Symbol
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`block w-full border ${password === confirmPassword && confirmPassword.length > 0 ? 'border-[var(--color-text-main)]' : 'border-[var(--color-border)]'} bg-[var(--color-background)] px-4 py-3 text-[var(--color-text-main)] focus:border-[var(--color-text-main)] outline-none transition-colors text-sm font-mono tracking-widest`}
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!isReady || loading}
                            className="btn-primary w-full py-4 mt-8"
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    RESET PASSWORD <ArrowRight size={14} />
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="pt-8 mt-8 border-t border-[var(--color-border)]">
                        <Link to="/login" className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                            <ArrowLeft size={14} /> Return to Portal
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
