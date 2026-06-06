import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Clock, Search, Users, X } from "lucide-react";
import * as memberService from "@/services/memberService";
import * as serviceService from "@/services/serviceService";
import type { Member, Service } from "@/types";
import type { PrimaryServiceType, ServiceAttendanceLog } from "@/services/serviceService";

const SERVICE_TYPE_LABELS: Record<PrimaryServiceType, string> = {
    sunday_morning: "Sunday Morning",
    sunday_afternoon: "Sunday Afternoon",
    wednesday_prayer: "Wednesday Prayer"
};

const SERVICE_TYPE_ACCENTS: Record<PrimaryServiceType, string> = {
    sunday_morning: "bg-blue-50 text-blue-700 border-blue-100",
    sunday_afternoon: "bg-indigo-50 text-indigo-700 border-indigo-100",
    wednesday_prayer: "bg-violet-50 text-violet-700 border-violet-100"
};

const PRIMARY_SERVICE_TYPES: PrimaryServiceType[] = ["sunday_morning", "sunday_afternoon", "wednesday_prayer"];

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const getMonthRange = (offset = 0) => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const last = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
    return { startDate: toISODate(first), endDate: toISODate(last) };
};

const getYearRange = () => {
    const today = new Date();
    return {
        startDate: `${today.getFullYear()}-01-01`,
        endDate: `${today.getFullYear()}-12-31`
    };
};

const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("en-US", options || { month: "short", day: "numeric" });

const getMemberName = (member?: Pick<Member, "first_name" | "surname"> | null) =>
    member ? `${member.surname || ""}, ${member.first_name || ""}`.trim().replace(/^, /, "") : "Unknown member";

const Attendance: React.FC = () => {
    const defaultRange = getMonthRange();
    const [startDate, setStartDate] = useState(defaultRange.startDate);
    const [endDate, setEndDate] = useState(defaultRange.endDate);
    const [serviceType, setServiceType] = useState<PrimaryServiceType | "all">("all");
    const [services, setServices] = useState<Service[]>([]);
    const [logs, setLogs] = useState<ServiceAttendanceLog[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const selectedServiceTypes = useMemo(
        () => serviceType === "all" ? PRIMARY_SERVICE_TYPES : [serviceType],
        [serviceType]
    );

    useEffect(() => {
        const fetchAttendance = async () => {
            setLoading(true);
            setErrorMessage("");
            try {
                const [report, allMembers] = await Promise.all([
                    serviceService.getServiceAttendanceReport({
                        startDate,
                        endDate,
                        serviceTypes: selectedServiceTypes
                    }),
                    memberService.getAllMembers()
                ]);
                setServices(report.services);
                setLogs(report.logs);
                setMembers((allMembers || []).filter((member) => member.is_regular_member !== false));
                setSelectedServiceId((current) =>
                    current && report.services.some((service) => service.id === current) ? current : report.services[0]?.id || null
                );
            } catch (error: any) {
                setErrorMessage(error.message || "Failed to load attendance.");
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [startDate, endDate, selectedServiceTypes]);

    const logsByService = useMemo(() => {
        const map = new Map<string, ServiceAttendanceLog[]>();
        logs.forEach((log) => {
            const existing = map.get(log.event_id) || [];
            existing.push(log);
            map.set(log.event_id, existing);
        });
        return map;
    }, [logs]);

    const logByMemberAndService = useMemo(() => {
        const map = new Map<string, ServiceAttendanceLog>();
        logs.forEach((log) => {
            map.set(`${log.member_id}:${log.event_id}`, log);
        });
        return map;
    }, [logs]);

    const filteredMembers = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return members
            .filter((member) => {
                if (!q) return true;
                return `${member.first_name} ${member.surname} ${member.member_number || ""}`.toLowerCase().includes(q);
            })
            .sort((a, b) => `${a.surname} ${a.first_name}`.localeCompare(`${b.surname} ${b.first_name}`));
    }, [members, searchTerm]);

    const selectedMember = useMemo(
        () => members.find((member) => member.id === selectedMemberId) || filteredMembers[0] || null,
        [members, selectedMemberId, filteredMembers]
    );

    useEffect(() => {
        if (!selectedMemberId && filteredMembers[0]) {
            setSelectedMemberId(filteredMembers[0].id);
        }
    }, [filteredMembers, selectedMemberId]);

    const selectedService = useMemo(
        () => services.find((service) => service.id === selectedServiceId) || services[0] || null,
        [services, selectedServiceId]
    );

    const summary = useMemo(() => {
        const totalServices = services.length;
        const totalAttendance = services.reduce((sum, service) => sum + (Number(service.total_attendance) || 0), 0);
        const averageAttendance = totalServices > 0 ? Math.round(totalAttendance / totalServices) : 0;
        const sorted = [...services].sort((a, b) => (b.total_attendance || 0) - (a.total_attendance || 0));
        return {
            totalServices,
            averageAttendance,
            mostAttended: sorted[0] || null,
            lowAttendanceDates: [...services]
                .sort((a, b) => (a.total_attendance || 0) - (b.total_attendance || 0))
                .slice(0, 3)
        };
    }, [services]);

    const memberHistory = useMemo(() => {
        if (!selectedMember) return {};
        const history: Partial<Record<PrimaryServiceType, Service[]>> = {};
        PRIMARY_SERVICE_TYPES.forEach((type) => {
            history[type] = services.filter((service) => {
                const log = logByMemberAndService.get(`${selectedMember.id}:${service.id}`);
                return service.service_type === type && log?.was_present !== false;
            });
        });
        return history;
    }, [selectedMember, services, logByMemberAndService]);

    const serviceTypeTotals = useMemo(() => {
        if (!selectedMember) return {};
        const totals: Partial<Record<PrimaryServiceType, { attended: number; possible: number; rate: number }>> = {};
        PRIMARY_SERVICE_TYPES.forEach((type) => {
            const possible = services.filter((service) => service.service_type === type).length;
            const attended = memberHistory[type]?.length || 0;
            totals[type] = {
                attended,
                possible,
                rate: possible > 0 ? Math.round((attended / possible) * 100) : 0
            };
        });
        return totals;
    }, [memberHistory, selectedMember, services]);

    const selectedServiceLogs = useMemo(() => {
        if (!selectedService) return [];
        return (logsByService.get(selectedService.id) || [])
            .filter((log) => log.was_present !== false)
            .sort((a, b) => getMemberName(a.member).localeCompare(getMemberName(b.member)));
    }, [logsByService, selectedService]);

    const applyQuickRange = (range: "this_month" | "last_month" | "this_year") => {
        const next = range === "this_year" ? getYearRange() : getMonthRange(range === "last_month" ? -1 : 0);
        setStartDate(next.startDate);
        setEndDate(next.endDate);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)]">Attendance</h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Track who attended each Sunday and Wednesday service.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => applyQuickRange("this_month")} className="btn btn-ghost text-sm px-3 py-2">This Month</button>
                    <button onClick={() => applyQuickRange("last_month")} className="btn btn-ghost text-sm px-3 py-2">Last Month</button>
                    <button onClick={() => applyQuickRange("this_year")} className="btn btn-ghost text-sm px-3 py-2">This Year</button>
                </div>
            </div>

            <div className="card-panel bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="form-label">Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-control" />
                </div>
                <div>
                    <label className="form-label">End Date</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-control" />
                </div>
                <div>
                    <label className="form-label">Service Type</label>
                    <div className="relative">
                        <select
                            value={serviceType}
                            onChange={(e) => setServiceType(e.target.value as PrimaryServiceType | "all")}
                            className="form-control appearance-none pr-10"
                        >
                            <option value="all">All Primary Services</option>
                            {PRIMARY_SERVICE_TYPES.map((type) => (
                                <option key={type} value={type}>{SERVICE_TYPE_LABELS[type]}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <label className="form-label">Search Member</label>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Name or member no."
                            className="form-control pl-9"
                        />
                    </div>
                </div>
            </div>

            {errorMessage && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 text-sm font-semibold">
                    {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card-panel bg-white p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2"><CalendarDays size={14} /> Total Services</p>
                    <p className="text-3xl font-black mt-2 text-gray-900">{summary.totalServices}</p>
                </div>
                <div className="card-panel bg-white p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2"><Users size={14} /> Avg Attendance</p>
                    <p className="text-3xl font-black mt-2 text-gray-900">{summary.averageAttendance}</p>
                </div>
                <div className="card-panel bg-white p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Most Attended</p>
                    <p className="text-lg font-black mt-2 text-gray-900">{summary.mostAttended ? summary.mostAttended.total_attendance : 0}</p>
                    <p className="text-xs text-gray-500 truncate">
                        {summary.mostAttended ? `${formatDate(summary.mostAttended.service_date)} | ${SERVICE_TYPE_LABELS[summary.mostAttended.service_type as PrimaryServiceType]}` : "No services"}
                    </p>
                </div>
                <div className="card-panel bg-white p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Low Attendance</p>
                    <div className="mt-2 space-y-1">
                        {summary.lowAttendanceDates.length > 0 ? summary.lowAttendanceDates.map((service) => (
                            <button
                                key={service.id}
                                onClick={() => setSelectedServiceId(service.id)}
                                className="block w-full text-left text-xs text-gray-600 hover:text-blue-700 truncate"
                            >
                                {formatDate(service.service_date)} | {service.total_attendance} attended
                            </button>
                        )) : (
                            <p className="text-xs text-gray-400">No services</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-8 card-panel bg-white overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Member Attendance Matrix</h2>
                            <p className="text-xs text-gray-500 mt-1">P = present, T = tardy, A = absent.</p>
                        </div>
                        {loading && <span className="text-xs font-bold text-blue-600">Loading...</span>}
                    </div>
                    <div className="overflow-auto max-h-[560px]">
                        <table className="w-full min-w-[780px] text-sm">
                            <thead className="sticky top-0 bg-gray-50 z-10">
                                <tr>
                                    <th className="sticky left-0 bg-gray-50 text-left p-3 border-b border-gray-100 min-w-[220px] text-xs uppercase tracking-widest text-gray-500">Member</th>
                                    {services.map((service) => (
                                        <th key={service.id} className="p-2 border-b border-gray-100 text-center min-w-[76px]">
                                            <button
                                                onClick={() => setSelectedServiceId(service.id)}
                                                className={`w-full rounded-lg border px-2 py-1.5 text-[10px] font-black uppercase leading-tight ${selectedService?.id === service.id ? "bg-gray-900 text-white border-gray-900" : SERVICE_TYPE_ACCENTS[service.service_type as PrimaryServiceType]}`}
                                            >
                                                <span className="block">{formatDate(service.service_date)}</span>
                                                <span className="block opacity-80">{SERVICE_TYPE_LABELS[service.service_type as PrimaryServiceType].replace("Sunday ", "").replace("Wednesday ", "Wed ")}</span>
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.length === 0 ? (
                                    <tr>
                                        <td colSpan={services.length + 1} className="p-8 text-center text-gray-400">No matching members.</td>
                                    </tr>
                                ) : (
                                    filteredMembers.map((member) => (
                                        <tr key={member.id} className="border-b border-gray-50 hover:bg-gray-50/70">
                                            <td className="sticky left-0 bg-white p-3 font-semibold text-gray-900">
                                                <button
                                                    onClick={() => setSelectedMemberId(member.id)}
                                                    className={`text-left hover:text-blue-700 ${selectedMember?.id === member.id ? "text-blue-700" : ""}`}
                                                >
                                                    <span className="block">{member.surname}, {member.first_name}</span>
                                                    {member.member_number && <span className="block text-[10px] text-gray-400 font-bold">{member.member_number}</span>}
                                                </button>
                                            </td>
                                            {services.map((service) => {
                                                const log = logByMemberAndService.get(`${member.id}:${service.id}`);
                                                const status = log?.was_tardy ? "T" : log?.was_present ? "P" : "A";
                                                const className = status === "T"
                                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                                    : status === "P"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                        : "bg-gray-50 text-gray-300 border-gray-100";
                                                return (
                                                    <td key={service.id} className="p-2 text-center">
                                                        <span className={`inline-flex w-8 h-8 items-center justify-center rounded-lg border text-xs font-black ${className}`}>
                                                            {status}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6">
                    <div className="card-panel bg-white p-5">
                        <h2 className="text-lg font-bold text-gray-900">Member Attendance History</h2>
                        {selectedMember ? (
                            <div className="mt-4 space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                                        {selectedMember.first_name?.[0]}{selectedMember.surname?.[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 truncate">{selectedMember.first_name} {selectedMember.surname}</p>
                                        <p className="text-xs text-gray-500">{selectedMember.member_number || "No member number"}</p>
                                    </div>
                                </div>
                                {PRIMARY_SERVICE_TYPES.map((type) => {
                                    const total = serviceTypeTotals[type];
                                    const dates = memberHistory[type] || [];
                                    return (
                                        <div key={type} className="border-t border-gray-100 pt-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-black uppercase tracking-widest text-gray-500">{SERVICE_TYPE_LABELS[type]}</p>
                                                <span className="text-xs font-black text-gray-900">
                                                    {total?.attended || 0}/{total?.possible || 0} | {total?.rate || 0}%
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {dates.length > 0 ? dates.map((service) => (
                                                    <button
                                                        key={service.id}
                                                        onClick={() => setSelectedServiceId(service.id)}
                                                        className="px-2 py-1 rounded-md bg-gray-50 hover:bg-blue-50 text-[11px] font-semibold text-gray-600 hover:text-blue-700"
                                                    >
                                                        {formatDate(service.service_date, { month: "short", day: "numeric", year: "numeric" })}
                                                    </button>
                                                )) : (
                                                    <span className="text-xs text-gray-400">No dates present in this range.</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="mt-4 text-sm text-gray-400">Select a member from the matrix.</p>
                        )}
                    </div>

                    <div className="card-panel bg-white p-5">
                        <h2 className="text-lg font-bold text-gray-900">Service Attendance Detail</h2>
                        {selectedService ? (
                            <div className="mt-4 space-y-4">
                                <div className={`rounded-xl border p-4 ${SERVICE_TYPE_ACCENTS[selectedService.service_type as PrimaryServiceType]}`}>
                                    <p className="text-xs font-black uppercase tracking-widest">{SERVICE_TYPE_LABELS[selectedService.service_type as PrimaryServiceType]}</p>
                                    <p className="text-xl font-black mt-1">{formatDate(selectedService.service_date, { month: "long", day: "numeric", year: "numeric" })}</p>
                                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                                        <div className="bg-white/80 rounded-lg p-2">
                                            <p className="text-[10px] uppercase font-bold opacity-70">Members</p>
                                            <p className="font-black">{selectedService.members_present}</p>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2">
                                            <p className="text-[10px] uppercase font-bold opacity-70">Visitors</p>
                                            <p className="font-black">{selectedService.visitors_present}</p>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2">
                                            <p className="text-[10px] uppercase font-bold opacity-70">Total</p>
                                            <p className="font-black">{selectedService.total_attendance}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                    {selectedServiceLogs.length > 0 ? selectedServiceLogs.map((log) => (
                                        <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900 truncate">{getMemberName(log.member)}</p>
                                                <p className="text-[11px] text-gray-400">{log.member?.member_number || "No member number"}</p>
                                            </div>
                                            {log.was_tardy ? (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
                                                    <Clock size={12} /> Tardy
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                                                    <Check size={12} /> Present
                                                </span>
                                            )}
                                        </div>
                                    )) : (
                                        <div className="p-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                            No member attendance logs for this service.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 p-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                No service selected.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Attendance;
