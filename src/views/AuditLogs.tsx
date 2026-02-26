import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ActivitySquare, Loader2, ArrowLeft, ArrowRight, ServerCrash, RefreshCw } from 'lucide-react';

interface AuditLog {
    id: string;
    actor_id: string | null;
    entity_type: string;
    entity_id: string;
    action: string;
    description: string;
    changes: any;
    created_at: string;
}

const AuditLogs: React.FC = () => {
    const [logs, setLogs] = null as any; // placeholder to trigger proper typing down
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 50;

    const fetchLogs = async (pageNumber: number) => {
        try {
            setLoading(true);
            setError(null);

            const { data, error, count } = await supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE - 1);

            if (error) {
                // Ignore relation does not exist error if the table isn't created yet
                if (error.code === '42P01') {
                    setAuditLogs([]);
                    setHasMore(false);
                    return;
                }
                throw error;
            }

            setAuditLogs(data || []);
            setHasMore(count !== null && (pageNumber + 1) * PAGE_SIZE < count);
        } catch (e: any) {
            console.error('Error fetching audit logs:', e);
            setError(e.message || 'Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    const getActionColor = (action: string) => {
        switch (action.toUpperCase()) {
            case 'INSERT': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'UPDATE': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'DELETE': return 'bg-rose-100 text-rose-800 border-rose-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto space-y-6 pb-20 font-sans">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <ActivitySquare className="text-primary-600" size={32} />
                        System Audit Logs
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">History of all data operations performed by members with roles.</p>
                </div>
                <button
                    onClick={() => fetchLogs(page)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 rounded-xl font-bold shadow-sm transition-all text-sm"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {error ? (
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex items-center gap-4">
                    <ServerCrash className="shrink-0" size={32} />
                    <div>
                        <h3 className="font-bold text-lg">Error loading logs</h3>
                        <p className="text-sm opacity-80">{error}</p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="text-xs text-gray-500 uppercase font-black bg-gray-50/80 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-[20px]">Time</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">Actor ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading && auditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                            <Loader2 size={32} className="animate-spin mx-auto mb-4 text-gray-300" />
                                            <p className="font-medium animate-pulse">Loading system history...</p>
                                        </td>
                                    </tr>
                                ) : auditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-16 text-center text-gray-400">
                                            <p className="font-medium text-lg">No audit logs found.</p>
                                            <p className="text-xs mt-1 italic opacity-70">If the migration was just run, records will automatically appear when people use the system.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    auditLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-500">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-900 font-bold">{new Date(log.created_at).toLocaleDateString()}</span>
                                                    <span className="text-xs">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5 max-w-[400px] overflow-hidden">
                                                    <span className="text-gray-900 font-medium truncate" title={log.description}>{log.description}</span>
                                                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">{log.entity_type}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 font-mono text-[10px]">
                                                {log.actor_id || 'SYSTEM'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Page {page + 1}
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 0 || loading}
                                onClick={() => setPage(p => p - 1)}
                                className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-50 transition-colors"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <button
                                disabled={!hasMore || loading}
                                onClick={() => setPage(p => p + 1)}
                                className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-50 transition-colors"
                            >
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
