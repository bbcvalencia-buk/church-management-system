import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Search, Users } from "lucide-react";
import * as memberService from "@/services/memberService";
import * as serviceService from "@/services/serviceService";
import type { Member, Service } from "@/types";
import type { PrimaryServiceType, ServiceAttendanceLog } from "@/services/serviceService";
import { AttendanceCard } from "@/components/Attendance/AttendanceCard";

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
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const selectedServiceTypes = useMemo(
        () => serviceType === "all" ? PRIMARY_SERVICE_TYPES : [serviceType],
        [serviceType]
    );

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

    useEffect(() => {
        fetchAttendance();
    }, [startDate, endDate, selectedServiceTypes]);

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

    const selectedService = useMemo(
        () => services.find((service) => service.id === selectedServiceId) || null,
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

    const applyQuickRange = (range: "this_month" | "last_month" | "this_year") => {
        const next = range === "this_year" ? getYearRange() : getMonthRange(range === "last_month" ? -1 : 0);
        setStartDate(next.startDate);
        setEndDate(next.endDate);
    };

    const handleCheckIn = async (memberId: string, status: 'present' | 'absent' | 'tardy') => {
        if (!selectedServiceId) return;
        
        const existingLog = logByMemberAndService.get(`${memberId}:${selectedServiceId}`);
        const logData = {
            id: existingLog?.id, // Optional, Supabase upsert requires this for updating if it exists
            member_id: memberId,
            event_id: selectedServiceId,
            event_type: 'service',
            event_date: selectedService?.service_date || new Date().toISOString().slice(0,10),
            was_present: status === 'present' || status === 'tardy',
            was_tardy: status === 'tardy',
        };

        // Optimistic UI update
        const updatedLog = { ...existingLog, ...logData } as ServiceAttendanceLog;
        setLogs(prev => {
            const next = prev.filter(l => !(l.member_id === memberId && l.event_id === selectedServiceId));
            return [...next, updatedLog];
        });

        try {
            await serviceService.upsertAttendanceLog(logData);
        } catch (err: any) {
            console.error(err);
            setErrorMessage("Failed to update attendance: " + err.message);
            fetchAttendance(); // Revert on failure
        }
    };

    return (
        <div className="space-y-6 pb-20">
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
                <div className="card-panel bg-white p-5 md:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Select Service to Edit</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {services.map((service) => (
                            <button
                                key={service.id}
                                onClick={() => setSelectedServiceId(service.id)}
                                className={`flex-shrink-0 flex flex-col items-start p-2 rounded-xl border min-w-[120px] transition-colors ${selectedServiceId === service.id ? 'bg-gray-900 text-white border-gray-900' : SERVICE_TYPE_ACCENTS[service.service_type as PrimaryServiceType]}`}
                            >
                                <span className="text-[11px] font-black uppercase opacity-80">{SERVICE_TYPE_LABELS[service.service_type as PrimaryServiceType].replace("Sunday ", "").replace("Wednesday ", "Wed ")}</span>
                                <span className="text-sm font-bold mt-1">{formatDate(service.service_date)}</span>
                            </button>
                        ))}
                        {services.length === 0 && <span className="text-sm text-gray-400 py-2">No services found</span>}
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Member Check-in</h2>
                    {loading && <span className="text-xs font-bold text-blue-600">Loading...</span>}
                </div>
                
                {filteredMembers.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                        No matching members found.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredMembers.map(member => {
                            const log = logByMemberAndService.get(`${member.id}:${selectedServiceId}`);
                            const historyLogs = services.map(service => ({
                                service,
                                log: logByMemberAndService.get(`${member.id}:${service.id}`)
                            })).filter(h => h.service.id !== selectedServiceId);
                            
                            return (
                                <AttendanceCard
                                    key={member.id}
                                    member={member}
                                    selectedService={selectedService}
                                    log={log}
                                    historyLogs={historyLogs}
                                    onCheckIn={(status) => handleCheckIn(member.id, status)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Attendance;
