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
        <div className="min-h-screen flex bg-[var(--color-background)]">
            {/* Left Panel - Minimalist Editorial */}
            <div className="hidden lg:flex flex-col w-[48%] border-r border-[var(--color-border)] bg-[var(--color-surface)] relative p-12">
                {/* Header - Church branding */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 border border-[var(--color-border)] flex items-center justify-center">
                        <Church className="text-[var(--color-text-main)] w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-[var(--color-text-main)] font-black text-sm tracking-[0.2em] uppercase leading-tight font-outfit">Bible Baptist Church</h1>
                        <p className="text-[var(--color-text-muted)] text-[10px] tracking-[0.3em] uppercase mt-1">Management System</p>
                    </div>
                </div>

                {/* Center text */}
                <div className="flex-1 flex items-center">
                    <div>
                        <h2 className="text-[var(--color-text-main)] text-5xl leading-[1.1] font-black font-outfit uppercase tracking-tight mb-6">
                            Faithfully<br />Serving<br />The Flock.
                        </h2>
                        <p className="text-[var(--color-text-muted)] text-sm leading-relaxed max-w-sm font-inter">
                            Access your ministry tools, manage member records, and organize events with austere precision.
                        </p>
                    </div>
                </div>

                {/* Bottom line */}
                <div className="border-t border-[var(--color-border)] pt-8">
                    <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-[0.2em] font-bold">EST. 1980 // SYSTEM V2.0</p>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-[52%] flex flex-col items-center justify-center p-6 sm:p-12 relative bg-[var(--color-background)]">
                <div className="w-full max-w-[400px] bg-[var(--color-surface)] border border-[var(--color-border)] p-10">
                    <div className="mb-10">
                        {/* Mobile-only church branding */}
                        <div className="lg:hidden flex items-center gap-3 mb-10 border-b border-[var(--color-border)] pb-6">
                            <div className="w-10 h-10 border border-[var(--color-border)] flex items-center justify-center">
                                <Church className="text-[var(--color-text-main)] w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-[var(--color-text-main)] font-black text-sm tracking-[0.15em] uppercase font-outfit">BBC</h1>
                                <p className="text-[var(--color-text-muted)] text-[10px] tracking-[0.2em] uppercase">System</p>
                            </div>
                        </div>

                        <h2 className="text-3xl font-black text-[var(--color-text-main)] font-outfit uppercase tracking-tight mb-2">Portal Access</h2>
                        <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-widest font-bold">
                            Enter credentials to proceed
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-8">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label htmlFor="email" className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-4 w-4 text-[var(--color-text-muted)]" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full border border-[var(--color-border)] bg-[var(--color-background)] pl-12 pr-4 py-3 text-[var(--color-text-main)] focus:border-[var(--color-text-main)] outline-none transition-colors text-sm font-inter"
                                        placeholder="ADMIN@CHURCH.ORG"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-[var(--color-text-muted)]" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full border border-[var(--color-border)] bg-[var(--color-background)] pl-12 pr-12 py-3 text-[var(--color-text-main)] focus:border-[var(--color-text-main)] outline-none transition-colors text-sm font-mono tracking-widest"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-main)] focus:ring-0 focus:ring-offset-0 cursor-pointer rounded-none"
                            />
                            <label htmlFor="remember-me" className="ml-3 block text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] cursor-pointer">
                                Remember Session
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-4 mt-2"
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                                "AUTHENTICATE"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
