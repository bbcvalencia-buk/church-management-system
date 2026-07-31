import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as memberService from "../services/memberService";
import type { Member } from "../types";
import { MemberCard } from "../components/MemberCard";
import { Plus, Search, Filter, Download } from "lucide-react";
import { exportToCSV } from "../lib/csv";

const MembersDirectory: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(() => {
        try {
            const saved = sessionStorage.getItem('members-directory-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.searchTerm) return parsed.searchTerm;
            }
        } catch (e) { console.error(e); }
        return "";
    });
    const [filterStatus, setFilterStatus] = useState<string>(() => {
        try {
            const saved = sessionStorage.getItem('members-directory-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.filterStatus) return parsed.filterStatus;
            }
        } catch (e) { console.error(e); }
        return "all";
    });

    // Add debug mount/unmount logging
    useEffect(() => {
        console.log('[MembersDirectory] Mounted! State restored:', { searchTerm, filterStatus });
        return () => {
            console.log('[MembersDirectory] Unmounted!');
        };
    }, []);

    useEffect(() => {
        console.log('[MembersDirectory] State Changed:', { searchTerm, filterStatus });
        try {
            sessionStorage.setItem('members-directory-state', JSON.stringify({
                searchTerm,
                filterStatus
            }));
        } catch (e) { console.error(e); }
    }, [searchTerm, filterStatus]);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const data = await memberService.getAllMembers();
            setMembers(data || []);
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = members.filter((member) => {
        const matchesSearch =
            member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.member_number?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter =
            (filterStatus === "all") ||
            (filterStatus === "regular" && member.is_regular_member) ||
            (filterStatus === "visitors" && member.is_regular_member === false) ||
            (member.membership_status === filterStatus);

        return matchesSearch && matchesFilter;
    });

    const regularMembers = filterStatus === 'all' ? filteredMembers.filter(member => member.is_regular_member) : [];
    const visitorMembers = filterStatus === 'all' ? filteredMembers.filter(member => !member.is_regular_member) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)]">
                        People Directory
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Manage church members and visitors, track details, and view profiles.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            const exportData = filteredMembers.map(m => ({
                                member_number: m.member_number || '',
                                surname: m.surname,
                                first_name: m.first_name,
                                middle_name: m.middle_name || '',
                                nickname: m.nickname || '',
                                gender: m.gender,
                                civil_status: m.civil_status,
                                phone_number: m.phone_number,
                                home_address: m.home_address,
                                membership_status: m.membership_status
                            }));
                            exportToCSV('Church_People_Directory.csv', exportData, [
                                { key: 'member_number', label: 'Member #' },
                                { key: 'surname', label: 'Surname' },
                                { key: 'first_name', label: 'First Name' },
                                { key: 'middle_name', label: 'Middle Name' },
                                { key: 'nickname', label: 'Nickname' },
                                { key: 'gender', label: 'Gender' },
                                { key: 'civil_status', label: 'Civil Status' },
                                { key: 'phone_number', label: 'Phone' },
                                { key: 'home_address', label: 'Address' },
                                { key: 'membership_status', label: 'Status' }
                            ]);
                        }}
                        className="bg-white border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-gray-50 px-4 py-2 rounded-none flex items-center gap-2 transition-colors shadow-sm font-medium"
                    >
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                    <Link
                        to="/members/new"
                        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-text-main)] px-4 py-2 rounded-none flex items-center gap-2 transition-colors"
                    >
                        <Plus size={18} />
                        <span>Add Member</span>
                    </Link>
                </div>
            </div>

            {/* Filters & Search - Floating Style */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-transparent">
                <div className="relative flex-1 w-full">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search by name or nickname..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white border border-[var(--color-border)] shadow-sm text-[var(--color-text-main)] placeholder-gray-400 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] rounded-none transition-all h-11"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={18} className="text-[var(--color-text-muted)]" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-[var(--color-border)] shadow-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] rounded-none transition-all h-11 px-4"
                    >
                        <option value="all">All People</option>
                        <option value="regular">Regular Members</option>
                        <option value="visitors">Visitors / Non-Members</option>
                        <option value="active">Active Members</option>
                        <option value="inactive">Inactive</option>
                        <option value="under_discipline">Under Discipline</option>
                    </select>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="card-panel p-4 flex items-center gap-4 bg-white min-h-[96px] overflow-hidden border border-[var(--color-border)] shadow-sm mb-4 break-inside-avoid">
                            <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse shrink-0"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredMembers.length > 0 ? (
                <>
                    {filterStatus === 'all' && regularMembers.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-[var(--color-text-main)]">Regular Members</h2>
                                    <p className="text-sm text-[var(--color-text-muted)]">{regularMembers.length} regular member{regularMembers.length === 1 ? '' : 's'}</p>
                                </div>
                            </div>
                            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
                                {regularMembers.map((member) => (
                                    <MemberCard key={member.id} member={member} />
                                ))}
                            </div>
                        </section>
                    )}

                    {filterStatus === 'all' && visitorMembers.length > 0 && (
                        <section className="space-y-4 pt-8">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-[var(--color-text-main)]">Visitors / Non-Members</h2>
                                    <p className="text-sm text-[var(--color-text-muted)]">{visitorMembers.length} visitor record{visitorMembers.length === 1 ? '' : 's'}</p>
                                </div>
                            </div>
                            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
                                {visitorMembers.map((member) => (
                                    <MemberCard key={member.id} member={member} />
                                ))}
                            </div>
                        </section>
                    )}

                    {filterStatus !== 'all' && (
                        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
                            {filteredMembers.map((member) => (
                                <MemberCard key={member.id} member={member} />
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-12 text-[var(--color-text-muted)] card-panel bg-white">
                    <p>No members found matching your criteria.</p>
                </div>
            )}
        </div>
    );
};

export default MembersDirectory;
