import React, { useState, useEffect, useRef } from "react";
import * as systemService from "@/services/systemService";
import {
    Settings,
    Save,
    Upload,
    Image,
    Trash2,
    Loader2
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { uploadFile, deleteFile } from "@/lib/storage";

const SystemSettings: React.FC = () => {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Core database settings
    const [settings, setSettings] = useState({
        church_name: '',
        church_address: '',
        system_name: '',
        system_version: '',
        church_logo_url: ''
    });

    const [loading, setLoading] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoPreviewError, setLogoPreviewError] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await systemService.getSettings();
            if (data) {
                setSettings({
                    church_name: data.church_name || '',
                    church_address: data.church_address || '',
                    system_name: data.system_name || '',
                    system_version: data.system_version || 'v1.0.0',
                    church_logo_url: data.church_logo_url || ''
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            await systemService.upsertSettings(settings);
            showToast("Settings saved successfully.", 'success');
        } catch (err) {
            console.error(err);
            showToast("Failed to save settings.", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate PNG
        if (file.type !== 'image/png') {
            showToast("Please upload a PNG image only.", 'error');
            return;
        }

        // Validate size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast("Image must be under 2MB.", 'error');
            return;
        }

        setLogoUploading(true);
        try {
            // Delete old logo if exists
            if (settings.church_logo_url) {
                await deleteFile(settings.church_logo_url);
            }

            const url = await uploadFile(file, 'system/logo');
            setLogoPreviewError(false);
            setSettings(prev => ({ ...prev, church_logo_url: url }));

            // Save to DB immediately
            await systemService.upsertSettings({ church_logo_url: url });

            showToast("Church logo uploaded successfully.", 'success');
        } catch (err) {
            console.error(err);
            showToast("Failed to upload logo.", 'error');
        } finally {
            setLogoUploading(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveLogo = async () => {
        if (!settings.church_logo_url) return;

        setLogoUploading(true);
        try {
            await deleteFile(settings.church_logo_url);
            setSettings(prev => ({ ...prev, church_logo_url: '' }));
            setLogoPreviewError(false);

            await systemService.upsertSettings({ church_logo_url: "" });

            showToast("Logo removed.", 'success');
        } catch (err) {
            console.error(err);
            showToast("Failed to remove logo.", 'error');
        } finally {
            setLogoUploading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--color-text-main)]">
                    <Settings className="text-[var(--color-primary)]" />
                    System Settings
                </h1>
                <button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="bg-[var(--color-primary)] hover:bg-opacity-90 text-[var(--color-text-main)] px-6 py-2 rounded-none font-medium transition-colors flex items-center gap-2 shadow-lg"
                >
                    <Save size={18} /> {loading ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>

            <div className="bg-[var(--color-bg)] rounded-none shadow-sm border border-[var(--color-border)] p-4 sm:p-6 lg:p-8">
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--color-text-main)]">General Identity</h2>
                                <p className="text-[var(--color-text-muted)] mt-1 text-sm">Configure the core identity of your Church Management System.</p>
                            </div>

                            {/* Church Logo Section */}
                            <div className="p-6 border border-gray-200 dark:border-white/10 rounded-none bg-gray-50 dark:bg-white/5 space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <Image size={20} className="text-[var(--color-primary)]" />
                                    <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">Church Logo</label>
                                </div>

                                <div className="flex items-start gap-6">
                                    {/* Logo Preview */}
                                    <div className="w-28 h-28 rounded-none border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center bg-white dark:bg-white/5 overflow-hidden flex-shrink-0">
                                        {settings.church_logo_url && !logoPreviewError ? (
                                            <img
                                                src={settings.church_logo_url}
                                                alt="Church Logo"
                                                className="w-full h-full object-contain p-2"
                                                onError={() => setLogoPreviewError(true)}
                                            />
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <Image size={28} className="mx-auto mb-1 opacity-40" />
                                                <span className="text-[10px]">{logoPreviewError ? "Logo failed to load" : "No logo"}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload Controls */}
                                    <div className="flex-1 space-y-3">
                                        <p className="text-xs text-[var(--color-text-muted)]">
                                            Upload your church logo in PNG format. Recommended size: 512×512px. Max 2MB.
                                        </p>
                                        {logoPreviewError && settings.church_logo_url && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-red-600 break-all">
                                                    Could not load logo URL: {settings.church_logo_url}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setLogoPreviewError(false)}
                                                    className="text-xs text-[var(--color-primary)] hover:underline"
                                                >
                                                    Retry loading logo
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={logoUploading}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-none hover:bg-opacity-90 transition-colors disabled:opacity-50"
                                            >
                                                {logoUploading ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Upload size={16} />
                                                )}
                                                {settings.church_logo_url ? 'Replace Logo' : 'Upload Logo'}
                                            </button>
                                            {settings.church_logo_url && (
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveLogo}
                                                    disabled={logoUploading}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-none hover:bg-red-100 transition-colors disabled:opacity-50 border border-red-200"
                                                >
                                                    <Trash2 size={16} />
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".png,image/png"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">Church Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Bible Baptist Church"
                                        value={settings.church_name}
                                        onChange={(e) => setSettings({ ...settings, church_name: e.target.value })}
                                        className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-none p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">System Display Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Church Management System"
                                        value={settings.system_name}
                                        onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
                                        className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-none p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm"
                                    />
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">This appears in the sidebar header and browser tabs.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">System Version</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. v1.0.0"
                                            value={settings.system_version}
                                            onChange={(e) => setSettings({ ...settings, system_version: e.target.value })}
                                            className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-none p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm"
                                        />
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Tracks the current deployment version of the system.</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">Church Full Address</label>
                                    <textarea
                                        value={settings.church_address}
                                        onChange={(e) => setSettings({ ...settings, church_address: e.target.value })}
                                        className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-none p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm min-h-[120px]"
                                        placeholder="123 Faith Avenue, Holy City..."
                                    />
                                </div>
                            </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;
