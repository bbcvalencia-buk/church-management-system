import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Church } from 'lucide-react';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            navigate('/');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9fa]">
            {/* Left Panel - Blue Gradient */}
            <div className="hidden lg:flex flex-col w-[48%] relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1a237e 0%, #1565c0 40%, #1976d2 60%, #42a5f5 100%)' }}
            >
                {/* Header - Church branding */}
                <div className="relative z-10 p-8 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white/40 flex items-center justify-center">
                        <Church className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-white font-black text-sm tracking-[0.15em] uppercase leading-tight">Bible Baptist Church</h1>
                        <p className="text-white/60 text-[11px] tracking-[0.2em] uppercase">Management System</p>
                    </div>
                </div>

                {/* Decorative geometric shapes */}
                <div className="flex-1 relative flex items-center justify-center">
                    {/* Large chevron / arrow shape */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%]">
                        <div className="relative">
                            {/* Back shape - darker */}
                            <div className="w-[220px] h-[260px] bg-white/[0.06] rounded-2xl transform rotate-0 absolute -top-4 -left-4"></div>
                            {/* Front shape - lighter with border */}
                            <div className="w-[220px] h-[260px] bg-white/[0.08] rounded-2xl border border-white/[0.12] backdrop-blur-sm relative">
                                {/* Inner chevron pointing down */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg viewBox="0 0 120 140" className="w-24 h-28 opacity-20" fill="white">
                                        <path d="M60 140 L120 50 L90 50 L90 0 L30 0 L30 50 L0 50 Z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Subtle curved light arc */}
                    <div className="absolute top-[20%] right-0 w-[300px] h-[300px] rounded-full border border-white/[0.06]"></div>
                    <div className="absolute top-[25%] right-[-20px] w-[260px] h-[260px] rounded-full border border-white/[0.04]"></div>
                </div>

                {/* Bottom content - Tagline */}
                <div className="relative z-10 p-10 pb-12">
                    <h2 className="text-white text-[2.2rem] leading-[1.15] font-bold mb-4">
                        Faithfully serving<br />the congregation.
                    </h2>
                    <p className="text-white/60 text-sm leading-relaxed max-w-[340px]">
                        Access your ministry tools, manage member records, and organize events with ease and security.
                    </p>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-[52%] flex flex-col items-center justify-center p-4 sm:p-8 lg:p-16 relative">
                <div className="w-full max-w-[440px] space-y-8">
                    <div className="mb-10">
                        {/* Mobile-only church branding */}
                        <div className="lg:hidden flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-full bg-[#1565c0] flex items-center justify-center">
                                <Church className="text-white w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-[#1f2937] font-black text-sm tracking-wide uppercase">Bible Baptist Church</h1>
                                <p className="text-[#6b7280] text-[11px] tracking-wider uppercase">Management System</p>
                            </div>
                        </div>

                        <h2 className="text-[24px] sm:text-[32px] font-bold text-[#1f2937] leading-tight mb-2">Welcome back</h2>
                        <p className="text-[#6b7280] text-[15px]">
                            Please enter your credentials to access the portal.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-lg flex items-center gap-3 text-sm">
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-bold text-[#1f2937] mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full border border-gray-300 bg-white pl-12 pr-4 py-3.5 rounded-lg text-[#1f2937] placeholder-gray-400 focus:border-[#1565c0] focus:ring-2 focus:ring-[#1565c0]/20 outline-none transition-all sm:text-[15px]"
                                        placeholder="admin@church.org"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-bold text-[#1f2937] mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full border border-gray-300 bg-white pl-12 pr-12 py-3.5 rounded-lg text-[#1f2937] placeholder-gray-400 focus:border-[#1565c0] focus:ring-2 focus:ring-[#1565c0]/20 outline-none transition-all sm:text-xl font-mono tracking-widest"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                                        ) : (
                                            <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center mt-6 mb-8">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-[#1565c0] focus:ring-[#1565c0] cursor-pointer"
                                />
                                <label htmlFor="remember-me" className="ml-2.5 block text-[14px] text-[#4b5563] cursor-pointer">
                                    Remember me
                                </label>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center py-4 px-4 border border-transparent text-sm font-bold text-white rounded-lg bg-[#1565c0] hover:bg-[#0d47a1] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1565c0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wide shadow-lg shadow-blue-500/25"
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "SIGN IN SECURELY"
                            )}
                        </button>

                        <div className="pt-6 mt-6 border-t border-gray-200">
                            <p className="text-center text-[13px] text-[#6b7280]">
                                To get access, contact your church administrator
                            </p>
                        </div>
                    </form>
                </div>

                {/* Bottom Bible verse */}
                <div className="mt-8 lg:absolute lg:bottom-8 lg:left-0 lg:right-0 text-center px-4 sm:px-8">
                    <p className="text-[#9ca3af] italic text-[13px] font-serif">
                        "Be thou diligent to know the state of thy flocks, and look well to thy herds."
                    </p>
                    <p className="text-[#1565c0] font-bold text-[11px] tracking-[0.15em] uppercase mt-2">
                        Proverbs 27:23
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
