import React, { useState, useEffect } from 'react';
import * as memberService from '@/services/memberService';
import { Search, Loader2, X } from 'lucide-react';

interface SearchMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (memberId: string) => void;
}

export const SearchMemberModal: React.FC<SearchMemberModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
            setResults([]);
        } else {
            // fetch all on initial load or let them type
            searchMembers('');
        }
    }, [isOpen]);

    const searchMembers = async (query: string) => {
        setLoading(true);
        try {
            const data = await memberService.searchMembers(query, 50);
            setResults(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) searchMembers(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Match Member</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pt-0">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="animate-spin text-[var(--color-primary)]" />
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center p-4 text-gray-500">No members found.</div>
                    ) : (
                        <div className="space-y-2">
                            {results.map(member => (
                                <button
                                    key={member.id}
                                    onClick={() => onSelect(member.id)}
                                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-[var(--color-primary)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between"
                                >
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {member.surname}, {member.first_name}
                                        </div>
                                        <div className="text-sm text-gray-500 flex items-center gap-2">
                                            <span className="font-mono">{member.member_number || 'No Number'}</span>
                                            {false && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-purple-100 text-purple-700">Visitor</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[var(--color-primary)] opacity-0 group-hover:opacity-100">
                                        Select
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
