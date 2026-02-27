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
            <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8]">
                <div className="h-8 w-8 border-4 border-[#1565c0] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (sessionStatus === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border-t-4 border-red-500 overflow-hidden p-8 text-center space-y-4">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-gray-900">Invalid or Expired Link</h2>
                    <p className="text-gray-600">
                        This invite link is invalid or has expired. Please contact your church administrator for a new invite.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="mt-6 px-6 py-2 bg-[#1565c0] text-white rounded-lg font-medium hover:bg-[#0d47a1] transition-colors inline-block"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] p-4">
            <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-xl border-t-4 border-[#1565c0] overflow-hidden">
                <div className="p-10 space-y-6">
                    {/* Header */}
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-[#1565c0] rounded-full flex items-center justify-center mb-2">
                            <Church className="text-white w-8 h-8" />
                        </div>
                        <h2 className="text-[26px] font-bold text-[#1f2937] leading-tight">
                            Welcome to BBC<br />Management System
                        </h2>
                        <p className="text-[#6b7280] text-[15px]">
                            Please set your password to activate your account.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-lg flex items-center gap-3 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSetPassword} className="space-y-6">
                        {/* New Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-[#374151]">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full border border-gray-300 bg-white pl-12 pr-12 py-3 text-[#1f2937] focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0] outline-none transition-colors rounded-lg font-mono tracking-widest"
                                    placeholder="••••••••"
                                />
                                <div
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </div>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-[#374151]">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`block w-full border ${password === confirmPassword && confirmPassword.length > 0 ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white'} pl-12 pr-4 py-3 text-[#1f2937] focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0] outline-none transition-colors rounded-lg font-mono tracking-widest`}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {/* Password Requirements */}
                        <div className="bg-[#f8f9fa] rounded-xl p-4 border border-gray-100 flex justify-between">
                            <div className="flex items-center gap-2">
                                {hasLength ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                <span className={`text-[13px] ${hasLength ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                                    At least 8 characters
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasMatch ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                <span className={`text-[13px] ${hasMatch ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                                    Passwords match
                                </span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!isReady || loading}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-bold text-white bg-[#1565c0] hover:bg-[#0d47a1] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1565c0] disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wide rounded-lg shadow-md mt-6"
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "SET PASSWORD"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SetPassword;
