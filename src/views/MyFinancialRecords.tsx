import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { FinancialRecord, SystemSettings } from "@/types";
import { CreditCard, Calendar } from "lucide-react";

interface SundayRow {
    date: string;
    day: number;
    tithe: number;
    fp: number;
    loveGift: number;
}

interface MonthStatement {
    monthIndex: number;
    monthLabel: string;
    rows: SundayRow[];
    totals: {
        tithe: number;
        fp: number;
        loveGift: number;
    };
}

const monthNames = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER"
];

const toIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const getSundaysByMonth = (year: number): Date[][] => {
    return Array.from({ length: 12 }, (_, month) => {
        const sundays: Date[] = [];
        const cursor = new Date(year, month, 1);
        while (cursor.getMonth() === month) {
            if (cursor.getDay() === 0) sundays.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return sundays;
    });
};

const formatAmount = (value: number, showDashForZero = true) => {
    const safe = Number(value) || 0;
    if (showDashForZero && Math.abs(safe) < 0.005) return "-";
    return safe.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MyFinancialRecords: React.FC = () => {
    const { member, loading: authLoading } = useAuth();
    const [records, setRecords] = useState<FinancialRecord[]>([]);
    const [annualFpGoal, setAnnualFpGoal] = useState(0);
    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [loading, setLoading] = useState(true);
    const [churchSettings, setChurchSettings] = useState<Pick<SystemSettings, "church_name" | "church_address">>({
        church_name: "Bible Baptist Church",
        church_address: ""
    });

    useEffect(() => {
        fetchSystemSettings();
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!member?.id) {
            setRecords([]);
            setAnnualFpGoal(0);
            setLoading(false);
            return;
        }
        fetchFinancialData(member.id, selectedYear);
    }, [authLoading, member?.id, selectedYear]);

    const fetchSystemSettings = async () => {
        try {
            const { data } = await supabase
                .from("system_settings")
                .select("church_name, church_address")
                .maybeSingle();

            if (!data) return;

            setChurchSettings({
                church_name: data.church_name || "Bible Baptist Church",
                church_address: data.church_address || ""
            });
        } catch (err) {
            console.error("Failed to load system settings:", err);
        }
    };

    const fetchFinancialData = async (memberId: string, year: number) => {
        setLoading(true);
        try {
            const [recordsResult, fpResult] = await Promise.all([
                supabase
                    .from("financial_records")
                    .select("id, member_id, transaction_date, transaction_type, amount, pledge_purpose, notes, description, created_at")
                    .eq("member_id", memberId)
                    .is("deleted_at", null)
                    .in("transaction_type", ["tithe", "faith_promise", "love_gift"])
                    .gte("transaction_date", `${year}-01-01`)
                    .lte("transaction_date", `${year}-12-31`)
                    .order("transaction_date", { ascending: false }),
                supabase
                    .from("faith_promise_commitments")
                    .select("promised_amount")
                    .eq("member_id", memberId)
                    .eq("year", year)
                    .maybeSingle()
            ]);

            if (recordsResult.error) throw recordsResult.error;
            if (fpResult.error) throw fpResult.error;

            setRecords((recordsResult.data || []) as FinancialRecord[]);
            setAnnualFpGoal(Number(fpResult.data?.promised_amount) || 0);
        } catch (err) {
            console.error("Failed to fetch own financial records:", err);
            setRecords([]);
            setAnnualFpGoal(0);
        } finally {
            setLoading(false);
        }
    };

    const totals = useMemo(() => {
        return records.reduce((acc, row) => {
            const amount = Number(row.amount) || 0;
            if (row.transaction_type === "tithe") acc.tithe += amount;
            if (row.transaction_type === "faith_promise") acc.faith_promise += amount;
            if (row.transaction_type === "love_gift") acc.love_gift += amount;
            acc.total += amount;
            return acc;
        }, { tithe: 0, faith_promise: 0, love_gift: 0, total: 0 });
    }, [records]);

    const statementMonths = useMemo<MonthStatement[]>(() => {
        const sundayMonths = getSundaysByMonth(selectedYear);
        const byDate = new Map<string, { tithe: number; fp: number; loveGift: number }>();

        records.forEach((record) => {
            const key = record.transaction_date;
            if (!byDate.has(key)) {
                byDate.set(key, { tithe: 0, fp: 0, loveGift: 0 });
            }

            const entry = byDate.get(key)!;
            const amount = Number(record.amount) || 0;
            if (record.transaction_type === "tithe") entry.tithe += amount;
            if (record.transaction_type === "faith_promise") entry.fp += amount;
            if (record.transaction_type === "love_gift") entry.loveGift += amount;
        });

        return sundayMonths.map((dates, monthIndex) => {
            const rows = dates.map((date) => {
                const key = toIsoDate(date);
                const entry = byDate.get(key) || { tithe: 0, fp: 0, loveGift: 0 };
                return {
                    date: key,
                    day: date.getDate(),
                    tithe: entry.tithe,
                    fp: entry.fp,
                    loveGift: entry.loveGift
                };
            });

            const totalsByMonth = rows.reduce((acc, row) => {
                acc.tithe += row.tithe;
                acc.fp += row.fp;
                acc.loveGift += row.loveGift;
                return acc;
            }, { tithe: 0, fp: 0, loveGift: 0 });

            return {
                monthIndex,
                monthLabel: monthNames[monthIndex],
                rows,
                totals: totalsByMonth
            };
        });
    }, [records, selectedYear]);

    const fpPerSunday52 = annualFpGoal > 0 ? annualFpGoal / 52 : 0;
    const fpBalance = Math.max(annualFpGoal - totals.faith_promise, 0);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

    const renderMonthTable = (month: MonthStatement) => {
        return (
            <div key={month.monthIndex} className="mb-3 border border-gray-200 rounded-sm overflow-hidden">
                <div className="bg-slate-100 text-slate-800 text-[10px] font-bold tracking-widest px-2 py-1">
                    {month.monthLabel}
                </div>
                <table className="w-full text-[11px] table-fixed border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-[var(--color-text-main)] uppercase text-[10px]">
                            <th className="text-left px-2 py-1 w-10">Day</th>
                            <th className="text-right px-2 py-1">Tithe</th>
                            <th className="text-right px-2 py-1">FP</th>
                            <th className="text-right px-2 py-1">Love Gift</th>
                        </tr>
                    </thead>
                    <tbody>
                        {month.rows.map((row) => (
                            <tr key={row.date} className="border-b border-gray-100 last:border-b-0">
                                <td className="px-2 py-1 text-slate-700 font-semibold">{row.day}</td>
                                <td className="px-2 py-1 text-right">{formatAmount(row.tithe)}</td>
                                <td className="px-2 py-1 text-right text-blue-700">{formatAmount(row.fp)}</td>
                                <td className="px-2 py-1 text-right">{formatAmount(row.loveGift)}</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                            <td className="px-2 py-1">TOTAL</td>
                            <td className="px-2 py-1 text-right">{formatAmount(month.totals.tithe)}</td>
                            <td className="px-2 py-1 text-right text-blue-700">{formatAmount(month.totals.fp)}</td>
                            <td className="px-2 py-1 text-right">{formatAmount(month.totals.loveGift)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    if (authLoading || loading) {
        return <div className="text-sm text-gray-500">Loading your financial records...</div>;
    }

    if (!member?.id) {
        return (
            <div className="bg-white border border-yellow-100 rounded-none p-6">
                <h1 className="text-xl font-bold text-yellow-700">No Linked Member Profile</h1>
                <p className="text-sm text-gray-600 mt-2">
                    Your account is not linked to a member record yet, so personal financial records cannot be displayed.
                </p>
            </div>
        );
    }

    const leftMonths = statementMonths.slice(0, 6);
    const rightMonths = statementMonths.slice(6, 12);

    return (
        <div className="space-y-6">
            <div className="bg-white border border-[var(--color-border)] rounded-none overflow-hidden">
                <div className="p-6 border-b border-[var(--color-border)] space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                <CreditCard size={22} className="text-[var(--color-text-main)]" />
                                My Financial Records
                            </h1>
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                Read-only view of your own giving and recorded transactions.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Fiscal Year</label>
                            <div className="flex items-center gap-2 bg-white border border-[var(--color-border)] rounded-none px-3 py-2">
                                <Calendar size={16} className="text-gray-500" />
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="w-full bg-transparent text-sm outline-none"
                                >
                                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-500/10 border-t border-blue-500/20">
                    <p className="text-sm text-blue-800">
                        Note: The records below are for {selectedYear} only and do not include last year. If you notice errors, please contact the admin.
                    </p>
                </div>
            </div>

            <div className="bg-white text-black shadow-2xl rounded-none p-8">
                <div className="text-center">
                    <h1 className="text-[38px] font-black uppercase tracking-wide text-slate-900">{churchSettings.church_name}</h1>
                    {churchSettings.church_address && (
                        <p className="text-xs text-slate-600 mt-1">{churchSettings.church_address}</p>
                    )}
                    <div className="mt-3 border-t border-slate-500 pt-3">
                        <p className="text-xl font-bold uppercase tracking-wide">Individual Financial Statement</p>
                        <p className="text-[11px] text-slate-500">Fiscal Year {selectedYear}</p>
                    </div>
                </div>

                <div className="mt-5 flex justify-between items-end">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Member Name</p>
                        <p className="text-3xl font-black text-slate-900">{member.first_name} {member.surname}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">FP / Sunday (Annual / 52)</p>
                        <p className="text-[32px] font-black text-blue-700">P{formatAmount(fpPerSunday52, false)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>{leftMonths.map(renderMonthTable)}</div>
                    <div>{rightMonths.map(renderMonthTable)}</div>
                </div>

                <div className="mt-6 border-t-2 border-slate-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                    <div>
                        <p className="text-sm font-black uppercase text-slate-900">Financial Summary</p>
                        <div className="mt-2 space-y-1 text-sm">
                            <p>Total Tithes: <span className="font-bold">P{formatAmount(totals.tithe, false)}</span></p>
                            <p>Total Faith Promise Given: <span className="font-bold text-blue-700">P{formatAmount(totals.faith_promise, false)}</span></p>
                            <p>Total Love Gifts: <span className="font-bold">P{formatAmount(totals.love_gift, false)}</span></p>
                            <p>Total Recorded: <span className="font-bold">P{formatAmount(totals.total, false)}</span></p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Faith Promise Balance</p>
                        <div className="mt-1 inline-block bg-red-50 border border-red-100 rounded-none px-5 py-2">
                            <p className="text-3xl font-black text-red-600">P{formatAmount(fpBalance, false)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 rounded-none p-4">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Tithe</p>
                    <p className="text-lg font-black text-gray-900 mt-2">{formatCurrency(totals.tithe)}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-none p-4">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Faith Promise</p>
                    <p className="text-lg font-black text-gray-900 mt-2">{formatCurrency(totals.faith_promise)}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-none p-4">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Love Gift</p>
                    <p className="text-lg font-black text-gray-900 mt-2">{formatCurrency(totals.love_gift)}</p>
                </div>
                <div className="bg-gray-50 border border-blue-100 rounded-none p-4">
                    <p className="text-[11px] font-bold text-[var(--color-text-main)] uppercase tracking-widest">Total</p>
                    <p className="text-lg font-black text-blue-700 mt-2">{formatCurrency(totals.total)}</p>
                </div>
            </div>
        </div>
    );
};

export default MyFinancialRecords;
