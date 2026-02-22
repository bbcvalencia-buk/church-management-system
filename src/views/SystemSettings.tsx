import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
    Settings,
    Save,
    Database,
    Shield,
    Activity,
    Upload,
    Image,
    Trash2,
    Loader2
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { uploadFile, deleteFile } from "@/lib/storage";

const SystemSettings: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('general');
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
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    useEffect(() => {
        fetchSettings();
        fetchAuditLogs();
    }, []);

    const fetchSettings = async () => {
        const { data } = await supabase.from('system_settings').select('*').single();
        if (data) {
            setSettings({
                church_name: data.church_name || '',
                church_address: data.church_address || '',
                system_name: data.system_name || '',
                system_version: data.system_version || 'v1.0.0',
                church_logo_url: data.church_logo_url || ''
            });
        }
    };

    const fetchAuditLogs = async () => {
        const { data } = await supabase
            .from('audit_log')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(20);

        if (data) setAuditLogs(data);
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            // Save DB settings
            const { count } = await supabase.from('system_settings').select('*', { count: 'exact', head: true });

            if (count === 0) {
                await supabase.from('system_settings').insert(settings);
            } else {
                const { data } = await supabase.from('system_settings').select('id').single();
                if (data?.id) {
                    await supabase.from('system_settings').update(settings).eq('id', data.id);
                }
            }

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
            setSettings(prev => ({ ...prev, church_logo_url: url }));

            // Save to DB immediately
            const { data } = await supabase.from('system_settings').select('id').single();
            if (data?.id) {
                await supabase.from('system_settings').update({ church_logo_url: url }).eq('id', data.id);
            }

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

            const { data } = await supabase.from('system_settings').select('id').single();
            if (data?.id) {
                await supabase.from('system_settings').update({ church_logo_url: null }).eq('id', data.id);
            }

            showToast("Logo removed.", 'success');
        } catch (err) {
            console.error(err);
            showToast("Failed to remove logo.", 'error');
        } finally {
            setLogoUploading(false);
        }
    };

    const handleBackup = async () => {
        const tables = ['members', 'services', 'financial_records', 'visitors'];
        const backup: any = {};

        setLoading(true);
        try {
            for (const table of tables) {
                const { data } = await supabase.from(table).select('*');
                if (data) backup[table] = data;
            }

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `church_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            showToast("Backup downloaded successfully.", 'success');
        } catch (err) {
            showToast("Backup failed.", 'error');
        } finally {
            setLoading(false);
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
                    className="bg-[var(--color-primary)] hover:bg-opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg"
                >
                    <Save size={18} /> {loading ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1 relative">
                    <div className="flex lg:flex-col lg:sticky lg:top-24 gap-2 bg-[var(--color-bg)] p-3 sm:p-4 rounded-xl shadow-sm border border-[var(--color-border)] overflow-x-auto lg:overflow-visible">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`whitespace-nowrap lg:w-full text-left p-2.5 sm:p-3 rounded-lg flex items-center gap-2 sm:gap-3 transition-colors font-medium text-sm ${activeTab === 'general' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-[var(--color-text-muted)]'}`}
                        >
                            <Settings size={18} /> General Identity
                        </button>
                        <div className="h-px bg-[var(--color-border)] my-1 sm:my-2 hidden lg:block"></div>
                        <button
                            onClick={() => setActiveTab('maintenance')}
                            className={`whitespace-nowrap lg:w-full text-left p-2.5 sm:p-3 rounded-lg flex items-center gap-2 sm:gap-3 transition-colors font-medium text-sm ${activeTab === 'maintenance' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-[var(--color-text-muted)]'}`}
                        >
                            <Database size={18} /> Maintenance
                        </button>
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`whitespace-nowrap lg:w-full text-left p-2.5 sm:p-3 rounded-lg flex items-center gap-2 sm:gap-3 transition-colors font-medium text-sm ${activeTab === 'audit' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-[var(--color-text-muted)]'}`}
                        >
                            <Activity size={18} /> Audit Logs
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-3 bg-[var(--color-bg)] rounded-xl shadow-sm border border-[var(--color-border)] p-4 sm:p-6 lg:p-8">
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--color-text-main)]">General Identity</h2>
                                <p className="text-[var(--color-text-muted)] mt-1 text-sm">Configure the core identity of your Church Management System.</p>
                            </div>

                            {/* Church Logo Section */}
                            <div className="p-6 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-white/5 space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <Image size={20} className="text-[var(--color-primary)]" />
                                    <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">Church Logo</label>
                                </div>

                                <div className="flex items-start gap-6">
                                    {/* Logo Preview */}
                                    <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center bg-white dark:bg-white/5 overflow-hidden flex-shrink-0">
                                        {settings.church_logo_url ? (
                                            <img
                                                src={settings.church_logo_url}
                                                alt="Church Logo"
                                                className="w-full h-full object-contain p-2"
                                            />
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <Image size={28} className="mx-auto mb-1 opacity-40" />
                                                <span className="text-[10px]">No logo</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload Controls */}
                                    <div className="flex-1 space-y-3">
                                        <p className="text-xs text-[var(--color-text-muted)]">
                                            Upload your church logo in PNG format. Recommended size: 512×512px. Max 2MB.
                                        </p>
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={logoUploading}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
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
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 border border-red-200"
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
                                        className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-xl p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">System Display Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Church Management System"
                                        value={settings.system_name}
                                        onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
                                        className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-xl p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm"
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
                                            className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-xl p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm"
                                        />
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Tracks the current deployment version of the system.</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--color-text-main)] uppercase tracking-wider">Church Full Address</label>
                                    <textarea
                                        value={settings.church_address}
                                        onChange={(e) => setSettings({ ...settings, church_address: e.target.value })}
                                        className="w-full bg-transparent border border-gray-300 dark:border-white/10 rounded-xl p-4 text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm min-h-[120px]"
                                        placeholder="123 Faith Avenue, Holy City..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'maintenance' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--color-text-main)]">System Maintenance</h2>
                                <p className="text-[var(--color-text-muted)] mt-1 text-sm">Manage data backups and system health.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="p-6 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-white/5 space-y-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4 text-blue-500">
                                        <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                                            <Database size={28} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-[var(--color-text-main)]">Data Backup</h3>
                                            <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                                Download a secure JSON backup of your congregation, finance, and system data.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button
                                            onClick={handleBackup}
                                            disabled={loading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto px-6 py-3 rounded-lg font-bold shadow-md transition-colors"
                                        >
                                            {loading ? 'Processing Backup...' : 'Download Full Backup'}
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6 border border-red-200 dark:border-red-900/50 rounded-xl bg-red-50 dark:bg-red-900/10 space-y-4">
                                    <div className="flex items-center gap-4 text-red-600">
                                        <div className="p-3 bg-red-100 dark:bg-red-500/20 rounded-lg">
                                            <Shield size={28} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-red-700 dark:text-red-400">Danger Zone</h3>
                                            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                                                Resetting system defaults is irreversible. Contact support if you need to wipe data.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audit' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Recent Activity</h2>
                                <p className="text-[var(--color-text-muted)] mt-1 text-sm">Review recent administrative changes and log events.</p>
                            </div>

                            <div className="overflow-hidden border border-gray-200 dark:border-white/10 rounded-xl">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-100 dark:bg-white/5">
                                        <tr className="border-b border-gray-200 dark:border-white/10 text-[var(--color-text-main)] font-semibold">
                                            <th className="p-4">Timestamp</th>
                                            <th className="p-4">Action</th>
                                            <th className="p-4">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                        {auditLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-8 text-center text-[var(--color-text-muted)] font-medium">
                                                    No recent activity found.
                                                </td>
                                            </tr>
                                        ) : (
                                            auditLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-mono text-[var(--color-text-muted)] text-xs">
                                                        {new Date(log.timestamp).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 uppercase font-bold text-[10px] tracking-wider text-[var(--color-primary)]">
                                                        {log.action_type}
                                                    </td>
                                                    <td className="p-4 text-[var(--color-text-main)]">{log.description}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;
