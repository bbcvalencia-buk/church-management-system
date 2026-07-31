import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Church, Lock, AlertCircle, Eye, EyeOff, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

const SetPassword: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<'valid' | 'invalid' | 'checking'>('checking');

    const hasLength = password.length >= 8;
    const hasMatch = password === confirmPassword && confirmPassword.length > 0;
    const isReady = hasLength && hasMatch;

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setSessionStatus('valid');
            } else {
                // If no session but hash exists, wait a moment for Supabase client to parse it
                if (window.location.hash.includes('access_token')) {
                    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                        if (session) {
                            setSessionStatus('valid');
                        }
                    });
                    setTimeout(() => {
                        setSessionStatus(prev => prev === 'checking' ? 'invalid' : prev);
                    }, 2000);
                    return () => subscription.unsubscribe();
                } else {
                    setSessionStatus('invalid');
                }
            }
            setInitializing(false);
        };
        checkSession();
    }, []);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isReady) return;
        setLoading(true);
        setError(null);

        try {
            const { data: { user }, error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;
            if (!user?.email) throw new Error("Could not determine user email.");

            // Find matching member by email
            const { data: members, error: memberError } = await supabase
                .from('members')
                .select('id')
                .eq('email', user.email)
                .limit(1);

            if (memberError) {
                console.error("Error looking up member email:", memberError);
            } else if (members && members.length > 0) {
                const memberId = members[0].id;

                // Assign role (if not already assigned)
                const { error: roleError } = await supabase
                    .from('user_roles')
                    .insert({ member_id: memberId, role: 'member' });

                if (roleError && !roleError.message.includes('duplicate key value')) {
                    console.error("Error assigning role:", roleError);
                }
            }

            showToast("Password set successfully!", "success");
            navigate('/announcements');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (initializing || sessionStatus === 'checking') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
                <div className="h-8 w-8 border-2 border-[var(--color-text-main)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (sessionStatus === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4">
                <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-10 text-center space-y-6">
                    <div className="w-16 h-16 border border-[var(--color-border)] flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8 text-[var(--color-text-main)]" />
                    </div>
                    <h2 className="text-2xl font-black text-[var(--color-text-main)] font-outfit uppercase tracking-tight">Invalid Link</h2>
                    <p className="text-[var(--color-text-muted)] text-sm font-inter">
                        This invite link is invalid or has expired. Please contact your church administrator for a new invite.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="btn-primary w-full py-4 mt-4"
                    >
                        RETURN TO PORTAL
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4">
            <div className="w-full max-w-[480px] bg-[var(--color-surface)] border border-[var(--color-border)] p-10">
                <div className="space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-4 border-b border-[var(--color-border)] pb-8">
                        <div className="mx-auto w-16 h-16 border border-[var(--color-border)] flex items-center justify-center mb-2">
                            <Church className="text-[var(--color-text-main)] w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-black text-[var(--color-text-main)] font-outfit uppercase tracking-tight leading-tight">
                            System<br />Activation
                        </h2>
                        <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-widest font-bold">
                            Initialize account credentials
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSetPassword} className="space-y-8">
                        {/* New Password */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-[var(--color-text-muted)]" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full border border-[var(--color-border)] bg-[var(--color-background)] pl-12 pr-12 py-3 text-[var(--color-text-main)] focus:border-[var(--color-text-main)] outline-none transition-colors text-sm font-mono tracking-widest"
                                    placeholder="••••••••"
                                />
                                <div
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </div>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-[var(--color-text-muted)]" />
                                </div>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`block w-full border ${password === confirmPassword && confirmPassword.length > 0 ? 'border-[var(--color-text-main)]' : 'border-[var(--color-border)]'} bg-[var(--color-background)] pl-12 pr-4 py-3 text-[var(--color-text-main)] focus:border-[var(--color-text-main)] outline-none transition-colors text-sm font-mono tracking-widest`}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {/* Password Requirements */}
                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4 flex justify-between">
                            <div className="flex items-center gap-3">
                                {hasLength ? <CheckCircle2 className="w-4 h-4 text-[var(--color-text-main)]" /> : <Circle className="w-4 h-4 text-[var(--color-text-muted)]" />}
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${hasLength ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                    8+ Characters
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                {hasMatch ? <CheckCircle2 className="w-4 h-4 text-[var(--color-text-main)]" /> : <Circle className="w-4 h-4 text-[var(--color-text-muted)]" />}
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${hasMatch ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                    Match
                                </span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!isReady || loading}
                            className="btn-primary w-full py-4 mt-2"
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                                "INITIALIZE CREDENTIALS"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SetPassword;
