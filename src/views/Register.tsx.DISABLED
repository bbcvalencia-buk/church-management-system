
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            if (data?.session) {
                navigate('/');
            } else {
                setSuccess(true);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center space-y-6 glass-panel p-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                        <UserPlus size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Registration Successful!</h2>
                    <p className="text-[var(--color-text-muted)]">
                        Please check your email to confirm your account.
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-[var(--color-primary)] font-bold hover:underline"
                    >
                        Go to Login <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                {/* Logo / Header */}
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Create Account</h2>
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                        Join the Church Management System
                    </p>
                </div>

                {/* Form */}
                <div className="mt-8 space-y-6 glass-panel p-8 border border-white/10">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3 text-sm">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full rounded-lg bg-black/20 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] sm:text-sm transition-colors"
                                    placeholder="yourname@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full rounded-lg bg-black/20 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] sm:text-sm transition-colors"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="block w-full rounded-lg bg-black/20 border border-white/10 pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] sm:text-sm transition-colors"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6"
                        >
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>

                        <p className="text-center text-xs text-[var(--color-text-muted)] mt-4">
                            Already have an account? <Link to="/login" className="text-[var(--color-primary)] hover:underline">Sign in</Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;
