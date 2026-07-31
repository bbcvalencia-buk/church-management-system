import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

const ChangePassword: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const hasLength = newPassword.length >= 8;
    const hasNumber = /\d/.test(newPassword);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    const matches = newPassword === confirmPassword && newPassword.length > 0;
    const isReady = hasLength && hasNumber && hasSymbol && matches;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isReady) return;

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            showToast("Password changed successfully.", "success");
            navigate("/profile");
        } catch (err: any) {
            showToast(err.message || "Failed to change password.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto pb-20">
            <div className="bg-white rounded-none border border-gray-100 shadow-sm p-6 sm:p-8">
                <h1 className="text-2xl font-bold text-[var(--color-text-main)] flex items-center gap-2">
                    <KeyRound className="text-[var(--color-primary)]" size={22} />
                    Change Password
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Update your account password securely.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[var(--color-text-main)]">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full border border-gray-200 rounded-none px-4 py-3 pr-12 text-[var(--color-text-main)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
                                placeholder="Enter new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[var(--color-text-main)]">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full border border-gray-200 rounded-none px-4 py-3 text-[var(--color-text-main)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
                            placeholder="Re-enter new password"
                        />
                    </div>

                    <div className="rounded-none border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600 space-y-1">
                        <p className={hasLength ? "text-green-700 font-semibold" : ""}>At least 8 characters</p>
                        <p className={hasNumber ? "text-green-700 font-semibold" : ""}>At least 1 number</p>
                        <p className={hasSymbol ? "text-green-700 font-semibold" : ""}>At least 1 symbol</p>
                        <p className={matches ? "text-green-700 font-semibold" : ""}>Passwords match</p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-5 py-2.5 rounded-none border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isReady || loading}
                            className="px-6 py-2.5 rounded-none bg-[var(--color-primary)] text-[var(--color-text-main)] text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Saving..." : "Update Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePassword;

