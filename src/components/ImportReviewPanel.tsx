import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Check, AlertCircle, Plus, Search, User, Play, RefreshCw, X } from 'lucide-react';
import { SearchMemberModal } from '@/components/SearchMemberModal';

export const ImportReviewPanel: React.FC = () => {
    const { showToast } = useToast();
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    // Modal state
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [resolvingConflict, setResolvingConflict] = useState<any>(null);

    useEffect(() => {
        fetchConflicts();
    }, []);

    const fetchConflicts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('import_conflicts')
            .select('*')
            .is('resolved_at', null)
            .order('created_at', { ascending: true });

        if (error) {
            showToast('Failed to fetch conflicts', 'error');
            console.error(error);
        } else {
            setConflicts(data || []);
        }
        setLoading(false);
    };

    const handleResolveWithMember = async (memberId: string) => {
        if (!resolvingConflict) return;
        setResolvingId(resolvingConflict.id);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Here we would typically insert the main record into the correct table.
            // For now, let's just mark the conflict as resolved.
            // A full implementation would retry the insert into members/visitors/financials using memberId

            const { error } = await supabase
                .from('import_conflicts')
                .update({
                    resolved_by: user?.id,
                    resolved_at: new Date().toISOString(),
                    resolution: `matched_to_member:${memberId}`
                })
                .eq('id', resolvingConflict.id);

            if (error) throw error;

            showToast('Conflict resolved successfully', 'success');
            setConflicts(c => c.filter(x => x.id !== resolvingConflict.id));
        } catch (err: any) {
            showToast('Error resolving conflict', 'error');
            console.error(err);
        } finally {
            setResolvingId(null);
            setSearchModalOpen(false);
            setResolvingConflict(null);
        }
    };

    const handleSkip = async (conflict: any) => {
        setResolvingId(conflict.id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('import_conflicts')
                .update({
                    resolved_by: user?.id,
                    resolved_at: new Date().toISOString(),
                    resolution: 'skipped'
                })
                .eq('id', conflict.id);

            if (error) throw error;
            setConflicts(c => c.filter(x => x.id !== conflict.id));
            showToast('Record skipped', 'success');
        } catch (err) {
            showToast('Error skipping', 'error');
        } finally {
            setResolvingId(null);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center p-8"><RefreshCw className="animate-spin text-[var(--color-primary)]" /></div>;
    }

    if (conflicts.length === 0) {
        return (
            <div className="text-center p-12 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800/30">
                <Check className="mx-auto h-12 w-12 text-green-500 mb-3" />
                <h3 className="text-lg font-medium text-green-800 dark:text-green-400">All Clear!</h3>
                <p className="text-green-600 dark:text-green-500 text-sm mt-1">There are no pending import conflicts to resolve.</p>
            </div>
        );
    }

    // Group conflicts by type
    const grouped = conflicts.reduce((acc, curr) => {
        if (!acc[curr.import_type]) acc[curr.import_type] = [];
        acc[curr.import_type].push(curr);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-500">Action Required</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-600/80 mt-1">
                        There are {conflicts.length} records that could not be automatically imported. Please review and resolve them below.
                    </p>
                </div>
            </div>

            {Object.entries(grouped).map(([type, items]: any) => (
                <div key={type} className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                    <div className="bg-gray-50 dark:bg-white/5 border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
                        <h3 className="font-semibold text-[var(--color-text-main)] capitalize">
                            {type.replace('_', ' ')} Imports ({items.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-[var(--color-border)]">
                        {items.map((conflict: any) => (
                            <div key={conflict.id} className="p-4 flex flex-col lg:flex-row gap-4 justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                            {conflict.conflict_reason.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            ID: {conflict.raw_data.id || conflict.raw_data.legacy_v1_id || 'N/A'}
                                        </span>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {Object.entries(conflict.raw_data).map(([k, v]) => {
                                                if (!v || k === 'id' || k === 'created_at' || k === 'updated_at') return null;
                                                return (
                                                    <div key={k} className="truncate">
                                                        <span className="text-[var(--color-text-muted)]">{k}:</span>{' '}
                                                        <span className="font-medium">{String(v)}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 shrink-0 lg:w-48">
                                    <button
                                        onClick={() => { setResolvingConflict(conflict); setSearchModalOpen(true); }}
                                        disabled={resolvingId === conflict.id}
                                        className="w-full bg-[var(--color-primary)] text-white text-sm font-medium py-2 px-3 rounded-lg hover:bg-opacity-90 flex items-center justify-center gap-2"
                                    >
                                        <Search size={14} /> Match Member
                                    </button>

                                    {(type === 'member' || type === 'visitor') && (
                                        <button
                                            disabled={resolvingId === conflict.id}
                                            className="w-full bg-white dark:bg-transparent border border-[var(--color-border)] text-[var(--color-text-main)] text-sm font-medium py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-center gap-2"
                                        >
                                            <Plus size={14} /> Create New
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleSkip(conflict)}
                                        disabled={resolvingId === conflict.id}
                                        className="w-full bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium py-2 px-3 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center gap-2"
                                    >
                                        <X size={14} /> Skip Record
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {searchModalOpen && (
                <SearchMemberModal
                    isOpen={searchModalOpen}
                    onClose={() => { setSearchModalOpen(false); setResolvingConflict(null); }}
                    onSelect={handleResolveWithMember}
                />
            )}
        </div>
    );
};
