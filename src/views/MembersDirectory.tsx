
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Member } from "../types";
import { MemberCard } from "../components/MemberCard";
import { Plus, Search, Filter, Download } from "lucide-react";
import { exportToCSV } from "../lib/csv";

const MembersDirectory: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const { data, error } = await supabase
                .from("members")
                .select("*")
                .order("surname", { ascending: true });

            if (error) {
                console.error("Error fetching members:", error);
            } else {
                setMembers(data as Member[]);
            }
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
            (member.membership_status === filterStatus);

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)]">
                        Members Directory
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Manage church members, track details, and view profiles.
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
                            exportToCSV('Church_Members_Directory.csv', exportData, [
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
                        className="bg-white border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
                    >
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                    <Link
                        to="/members/new"
                        className="bg-[var(--color-primary)] hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20"
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
                        className="pl-10 bg-white border border-[var(--color-border)] shadow-sm text-[var(--color-text-main)] placeholder-gray-400 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] rounded-xl transition-all h-11"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={18} className="text-[var(--color-text-muted)]" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-[var(--color-border)] shadow-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] rounded-xl transition-all h-11 px-4"
                    >
                        <option value="all">All People</option>
                        <option value="regular">Regular Members</option>
                        <option value="active">Active Members</option>
                        <option value="inactive">Inactive</option>
                        <option value="under_discipline">Under Discipline</option>
                    </select>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
                </div>
            ) : filteredMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMembers.map((member) => (
                        <MemberCard key={member.id} member={member} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-[var(--color-text-muted)] card-panel bg-white">
                    <p>No members found matching your criteria.</p>
                </div>
            )}
        </div>
    );
};

export default MembersDirectory;
