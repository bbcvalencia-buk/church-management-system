import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FinancialRecord, Member, SystemSettings } from "@/types";
import { Printer, ArrowLeft, Download, Loader2 } from "lucide-react";
// @ts-ignore
import { jsPDF } from "jspdf";

interface RecordWithMember extends FinancialRecord {
    members: Member | null;
}

interface ReportData {
    member: Member;
    records: FinancialRecord[];
}

type ChurchStatementSettings = Pick<SystemSettings, "church_name" | "church_address">;

interface FaithPromiseCommitmentRow {
    member_id: string;
    promised_amount: number;
}

interface SundayRow {
    date: string;
    day: number;
    tithe: number;
    fpGiven: number;
    loveGift: number;
    pledge: number;
}

interface MonthStatement {
    monthIndex: number;
    monthLabel: string;
    rows: SundayRow[];
    totals: {
        tithe: number;
        loveGift: number;
        pledge: number;
        other: number;
        fpGiven: number;
    };
}

interface MemberStatement {
    months: MonthStatement[];
    annualFpGoal: number;
    fpPerSunday52: number;
    fpGiven: number;
    fpBalance: number;
    yearTithe: number;
    yearLoveGift: number;
    yearPledge: number;
    yearOther: number;
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
            if (cursor.getDay() === 0) {
                sundays.push(new Date(cursor));
            }
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

const FinancialReportPrint: React.FC = () => {
    const [year, setYear] = useState(2026);
    const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
    const [includeLoveGifts, setIncludeLoveGifts] = useState(true);
    const [includePledges, setIncludePledges] = useState(true);
    const [showOnlyGiftAndPledgeContributors, setShowOnlyGiftAndPledgeContributors] = useState(true);

    const [members, setMembers] = useState<Member[]>([]);
    const [reportData, setReportData] = useState<ReportData[]>([]);
    const [annualCommitmentByMember, setAnnualCommitmentByMember] = useState<Record<string, number>>({});
    const [churchSettings, setChurchSettings] = useState<ChurchStatementSettings>({
        church_name: "Bible Baptist Church",
        church_address: ""
    });
    const [loading, setLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 6 }, (_, i) => currentYear - 3 + i).sort((a, b) => b - a);
    }, []);

    useEffect(() => {
        fetchMembers();
        fetchSystemSettings();
    }, []);

    useEffect(() => {
        generateReport();
    }, [year, selectedMemberId, showOnlyGiftAndPledgeContributors, includeLoveGifts, includePledges, members]);

    const isIncludedOtherType = (type: FinancialRecord["transaction_type"]) => {
        if (type === "love_gift") return includeLoveGifts;
        if (type === "pledge") return includePledges;
        return false;
    };

    const fetchMembers = async () => {
        const { data } = await supabase.from("members").select("*").order("surname");
        if (data) setMembers(data as Member[]);
    };

    const fetchSystemSettings = async () => {
        try {
            const { data, error } = await supabase
                .from("system_settings")
                .select("church_name, church_address")
                .maybeSingle();

            if (error) throw error;
            if (!data) return;

            setChurchSettings({
                church_name: data.church_name || "Bible Baptist Church",
                church_address: data.church_address || ""
            });
        } catch (err) {
            console.error("Failed to fetch system settings for statement header:", err);
        }
    };

    const generateReport = async () => {
        setLoading(true);

        try {
            let query = supabase
                .from("financial_records")
                .select("*, members(*)")
                .gte("transaction_date", `${year}-01-01`)
                .lte("transaction_date", `${year}-12-31`)
                .order("transaction_date");

            if (selectedMemberId !== "all") {
                query = query.eq("member_id", selectedMemberId);
            }

            const { data, error } = await query;
            if (error) throw error;

            const records = (data || []) as RecordWithMember[];
            const grouped = new Map<string, ReportData>();

            if (selectedMemberId !== "all") {
                const selectedMember = members.find((m) => m.id === selectedMemberId);
                if (selectedMember) {
                    grouped.set(selectedMember.id, { member: selectedMember, records: [] });
                }
            }

            records.forEach((record) => {
                const memberData = record.members || members.find((m) => m.id === record.member_id);
                if (!memberData) return;

                if (!grouped.has(record.member_id)) {
                    grouped.set(record.member_id, { member: memberData, records: [] });
                }
                grouped.get(record.member_id)!.records.push(record);
            });

            let sortedData = Array.from(grouped.values()).sort((a, b) => {
                const surnameCompare = a.member.surname.localeCompare(b.member.surname);
                if (surnameCompare !== 0) return surnameCompare;
                return a.member.first_name.localeCompare(b.member.first_name);
            });

            if (showOnlyGiftAndPledgeContributors && selectedMemberId === "all" && (includeLoveGifts || includePledges)) {
                sortedData = sortedData.filter((entry) =>
                    entry.records.some((r) => isIncludedOtherType(r.transaction_type))
                );
            }

            setReportData(sortedData);

            const memberIds = sortedData.map((entry) => entry.member.id);
            if (memberIds.length === 0) {
                setAnnualCommitmentByMember({});
                return;
            }

            const { data: commitmentRows, error: commitmentError } = await supabase
                .from("faith_promise_commitments")
                .select("member_id, promised_amount")
                .eq("year", year)
                .in("member_id", memberIds);

            if (commitmentError) throw commitmentError;

            const commitmentMap: Record<string, number> = {};
            ((commitmentRows || []) as FaithPromiseCommitmentRow[]).forEach((row) => {
                commitmentMap[row.member_id] = Number(row.promised_amount) || 0;
            });
            setAnnualCommitmentByMember(commitmentMap);
        } catch (err) {
            console.error("Error generating report:", err);
            setReportData([]);
            setAnnualCommitmentByMember({});
        } finally {
            setLoading(false);
        }
    };

    const statementsByMember = useMemo(() => {
        const sundayMonths = getSundaysByMonth(year);
        const result: Record<string, MemberStatement> = {};

        reportData.forEach((entry) => {
            const byDate = new Map<string, { tithe: number; fpGiven: number; loveGift: number; pledge: number }>();

            entry.records.forEach((record) => {
                const key = record.transaction_date;
                if (!byDate.has(key)) {
                    byDate.set(key, { tithe: 0, fpGiven: 0, loveGift: 0, pledge: 0 });
                }
                const dayEntry = byDate.get(key)!;
                const amount = Number(record.amount) || 0;

                if (record.transaction_type === "tithe") dayEntry.tithe += amount;
                if (record.transaction_type === "faith_promise") dayEntry.fpGiven += amount;
                if (record.transaction_type === "love_gift" && includeLoveGifts) dayEntry.loveGift += amount;
                if (record.transaction_type === "pledge" && includePledges) dayEntry.pledge += amount;
            });

            const annualFpGoal = Number(annualCommitmentByMember[entry.member.id]) || 0;
            const months: MonthStatement[] = sundayMonths.map((dates, monthIndex) => {
                const rows: SundayRow[] = dates.map((date) => {
                    const key = toIsoDate(date);
                    const dayEntry = byDate.get(key) || { tithe: 0, fpGiven: 0, loveGift: 0, pledge: 0 };

                    return {
                        date: key,
                        day: date.getDate(),
                        tithe: dayEntry.tithe,
                        fpGiven: dayEntry.fpGiven,
                        loveGift: dayEntry.loveGift,
                        pledge: dayEntry.pledge
                    };
                });

                const totals = rows.reduce(
                    (acc, row) => {
                        acc.tithe += row.tithe;
                        acc.loveGift += row.loveGift;
                        acc.pledge += row.pledge;
                        acc.other += row.loveGift + row.pledge;
                        acc.fpGiven += row.fpGiven;
                        return acc;
                    },
                    { tithe: 0, loveGift: 0, pledge: 0, other: 0, fpGiven: 0 }
                );

                return {
                    monthIndex,
                    monthLabel: monthNames[monthIndex],
                    rows,
                    totals
                };
            });

            const yearTithe = months.reduce((sum, month) => sum + month.totals.tithe, 0);
            const yearLoveGift = months.reduce((sum, month) => sum + month.totals.loveGift, 0);
            const yearPledge = months.reduce((sum, month) => sum + month.totals.pledge, 0);
            const yearOther = yearLoveGift + yearPledge;
            const fpGiven = months.reduce((sum, month) => sum + month.totals.fpGiven, 0);
            const fpBalance = Math.max(annualFpGoal - fpGiven, 0);
            const fpPerSunday52 = annualFpGoal > 0 ? annualFpGoal / 52 : 0;

            result[entry.member.id] = {
                months,
                annualFpGoal,
                fpPerSunday52,
                fpGiven,
                fpBalance,
                yearTithe,
                yearLoveGift,
                yearPledge,
                yearOther
            };
        });

        return result;
    }, [reportData, annualCommitmentByMember, year, includeLoveGifts, includePledges]);

    const drawMonthBlockPdf = (
        pdf: jsPDF,
        month: MonthStatement,
        x: number,
        yStart: number,
        width: number,
        pageHeight: number
    ) => {
        let y = yStart;
        const dayCol = 16;
        const valueColumns = [
            { key: "tithe" as const, label: "TITHE" },
            { key: "fpGiven" as const, label: "FP" },
            ...(includeLoveGifts ? [{ key: "loveGift" as const, label: "L.GIFT" }] : []),
            ...(includePledges ? [{ key: "pledge" as const, label: "PLEDGE" }] : [])
        ];
        const valueCol = (width - dayCol) / valueColumns.length;
        const rowH = 3.7;

        if (y > pageHeight - 45) return y;

        pdf.setFillColor(241, 245, 249);
        pdf.rect(x, y, width, 4.6, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(30, 41, 59);
        pdf.text(month.monthLabel, x + 1.5, y + 3.1);
        y += 5;

        pdf.setFillColor(30, 41, 59);
        pdf.rect(x, y, width, 4.2, "F");
        pdf.setFontSize(6.8);
        pdf.setTextColor(255, 255, 255);
        pdf.text("DAY", x + 1.3, y + 2.9);
        valueColumns.forEach((col, idx) => {
            pdf.text(col.label, x + dayCol + (valueCol * (idx + 1)) - 1.2, y + 2.9, { align: "right" });
        });
        y += 4.6;

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(6.8);

        month.rows.forEach((row) => {
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.2);
            pdf.line(x, y + rowH - 0.8, x + width, y + rowH - 0.8);

            pdf.text(String(row.day), x + 1.5, y + 2.6);
            valueColumns.forEach((col, idx) => {
                const amount = col.key === "tithe"
                    ? row.tithe
                    : col.key === "fpGiven"
                        ? row.fpGiven
                        : col.key === "loveGift"
                            ? row.loveGift
                            : row.pledge;
                pdf.text(formatAmount(amount), x + dayCol + (valueCol * (idx + 1)) - 1.2, y + 2.6, { align: "right" });
            });

            y += rowH;
        });

        pdf.setFillColor(248, 250, 252);
        pdf.rect(x, y, width, 4.2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 41, 59);
        pdf.text("TOTAL", x + 1.5, y + 2.9);
        valueColumns.forEach((col, idx) => {
            const amount = col.key === "tithe"
                ? month.totals.tithe
                : col.key === "fpGiven"
                    ? month.totals.fpGiven
                    : col.key === "loveGift"
                        ? month.totals.loveGift
                        : month.totals.pledge;
            pdf.text(formatAmount(amount), x + dayCol + (valueCol * (idx + 1)) - 1.2, y + 2.9, { align: "right" });
        });

        return y + 6;
    };

    const handleDownloadPdf = async () => {
        setGeneratingPdf(true);
        try {
            if (reportData.length === 0) return;

            const pdf = new jsPDF("p", "mm", "a4");
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 12;
            const contentWidth = pageWidth - margin * 2;

            reportData.forEach((entry, index) => {
                const statement = statementsByMember[entry.member.id];
                if (!statement) return;
                if (index > 0) pdf.addPage();

                let y = margin;

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(14);
                pdf.setTextColor(15, 23, 42);
                pdf.text((churchSettings.church_name || "Bible Baptist Church").toUpperCase(), pageWidth / 2, y, { align: "center" });
                y += 4.8;

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(7);
                pdf.setTextColor(100, 116, 139);
                const address = (churchSettings.church_address || "").trim();
                if (address) {
                    pdf.text(address, pageWidth / 2, y, { align: "center" });
                    y += 4;
                }

                pdf.setDrawColor(148, 163, 184);
                pdf.setLineWidth(0.35);
                pdf.line(margin, y, pageWidth - margin, y);
                y += 6;

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(9.5);
                pdf.setTextColor(15, 23, 42);
                pdf.text("INDIVIDUAL FINANCIAL STATEMENT", pageWidth / 2, y, { align: "center" });
                y += 4;

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(7);
                pdf.setTextColor(100, 116, 139);
                pdf.text(`Fiscal Year ${year}`, pageWidth / 2, y, { align: "center" });
                y += 8;

                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(15, 23, 42);
                pdf.setFontSize(7);
                pdf.text("MEMBER NAME", margin, y);
                pdf.text("FP / SUNDAY (ANNUAL / 52)", pageWidth - margin, y, { align: "right" });
                y += 4;

                pdf.setFontSize(11);
                pdf.text(`${entry.member.first_name} ${entry.member.surname}`, margin, y);
                pdf.setTextColor(37, 99, 235);
                pdf.text(`P${formatAmount(statement.fpPerSunday52, false)}`, pageWidth - margin, y, { align: "right" });
                y += 6;

                const columnGap = 4;
                const columnWidth = (contentWidth - columnGap) / 2;
                let yLeft = y;
                let yRight = y;

                statement.months.slice(0, 6).forEach((month) => {
                    yLeft = drawMonthBlockPdf(pdf, month, margin, yLeft, columnWidth, pageHeight);
                });
                statement.months.slice(6, 12).forEach((month) => {
                    yRight = drawMonthBlockPdf(pdf, month, margin + columnWidth + columnGap, yRight, columnWidth, pageHeight);
                });

                let ySummary = Math.max(yLeft, yRight) + 2;

                pdf.setDrawColor(148, 163, 184);
                pdf.setLineWidth(0.35);
                pdf.line(margin, ySummary, pageWidth - margin, ySummary);
                ySummary += 5;

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(8.3);
                pdf.setTextColor(15, 23, 42);
                pdf.text("FINANCIAL SUMMARY", margin, ySummary);

                ySummary += 4.2;
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(7.4);
                pdf.text(`Total Tithes: P${formatAmount(statement.yearTithe, false)}`, margin, ySummary);
                ySummary += 3.7;
                pdf.text(`Total Faith Promise Given: P${formatAmount(statement.fpGiven, false)}`, margin, ySummary);
                ySummary += 3.7;
                if (includeLoveGifts) {
                    pdf.text(`Total Love Gifts: P${formatAmount(statement.yearLoveGift, false)}`, margin, ySummary);
                    ySummary += 3.7;
                }
                if (includePledges) {
                    pdf.text(`Total Pledges: P${formatAmount(statement.yearPledge, false)}`, margin, ySummary);
                    ySummary += 3.7;
                }
                pdf.text(`Total Others: P${formatAmount(statement.yearOther, false)}`, margin, ySummary);

                const boxX = pageWidth - margin - 62;
                const boxY = ySummary - 11;
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(7);
                pdf.setTextColor(100, 116, 139);
                pdf.text("FAITH PROMISE BALANCE", boxX + 31, boxY, { align: "center" });

                pdf.setFillColor(254, 242, 242);
                pdf.setDrawColor(254, 226, 226);
                pdf.roundedRect(boxX, boxY + 1.5, 62, 9.5, 2, 2, "FD");
                pdf.setFontSize(11);
                pdf.setTextColor(220, 38, 38);
                pdf.text(`P${formatAmount(statement.fpBalance, false)}`, boxX + 31, boxY + 7.8, { align: "center" });

                const noteText = `Note: These records are for ${year} only and do not include last year. If you see an error, please contact the admin.`;
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(6.5);
                pdf.setTextColor(100, 116, 139);
                pdf.text(noteText, margin, pageHeight - 9);
            });

            pdf.save(`Individual_Financial_Statement_${year}.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
            alert("Failed to generate PDF: " + (error as Error).message);
        } finally {
            setGeneratingPdf(false);
        }
    };

    const renderMonthTable = (month: MonthStatement) => {
        const showLoveGift = includeLoveGifts;
        const showPledge = includePledges;
        return (
            <div key={month.monthIndex} className="mb-3 border border-gray-200 rounded-sm overflow-hidden">
                <div className="bg-slate-100 text-slate-800 text-[10px] font-bold tracking-widest px-2 py-1">
                    {month.monthLabel}
                </div>
                <table className="w-full text-[11px] table-fixed border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white uppercase text-[10px]">
                            <th className="text-left px-2 py-1 w-10">Day</th>
                            <th className="text-right px-2 py-1">Tithe</th>
                            <th className="text-right px-2 py-1">FP</th>
                            {showLoveGift && <th className="text-right px-2 py-1">Love Gift</th>}
                            {showPledge && <th className="text-right px-2 py-1">Pledge</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {month.rows.map((row) => (
                            <tr key={row.date} className="border-b border-gray-100 last:border-b-0">
                                <td className="px-2 py-1 text-slate-700 font-semibold">{row.day}</td>
                                <td className="px-2 py-1 text-right">{formatAmount(row.tithe)}</td>
                                <td className="px-2 py-1 text-right text-blue-700">{formatAmount(row.fpGiven)}</td>
                                {showLoveGift && <td className="px-2 py-1 text-right">{formatAmount(row.loveGift)}</td>}
                                {showPledge && <td className="px-2 py-1 text-right">{formatAmount(row.pledge)}</td>}
                            </tr>
                        ))}
                        <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                            <td className="px-2 py-1">TOTAL</td>
                            <td className="px-2 py-1 text-right">{formatAmount(month.totals.tithe)}</td>
                            <td className="px-2 py-1 text-right text-blue-700">{formatAmount(month.totals.fpGiven)}</td>
                            {showLoveGift && <td className="px-2 py-1 text-right">{formatAmount(month.totals.loveGift)}</td>}
                            {showPledge && <td className="px-2 py-1 text-right">{formatAmount(month.totals.pledge)}</td>}
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)]">
            <div className="p-6 border-b border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Printer size={20} /> Report Configuration
                    </h1>
                    <button
                        onClick={() => window.history.back()}
                        className="text-sm text-[var(--color-text-muted)] hover:text-white flex items-center gap-1"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)]">FISCAL YEAR</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white"
                        >
                            {yearOptions.map((optionYear) => (
                                <option key={optionYear} value={optionYear}>{optionYear}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)]">SELECT MEMBER</label>
                        <select
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-white"
                        >
                            <option value="all">-- Print All Contributors --</option>
                            {members.map((member) => (
                                <option key={member.id} value={member.id}>{member.surname}, {member.first_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-6 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeLoveGifts}
                                onChange={(e) => setIncludeLoveGifts(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 bg-black/20 text-[var(--color-primary)]"
                            />
                            <span className="text-sm">Show Love Gifts</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includePledges}
                                onChange={(e) => setIncludePledges(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 bg-black/20 text-[var(--color-primary)]"
                            />
                            <span className="text-sm">Show Pledges</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showOnlyGiftAndPledgeContributors}
                                onChange={(e) => setShowOnlyGiftAndPledgeContributors(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 bg-black/20 text-[var(--color-primary)]"
                            />
                            <span className="text-sm">Show Only Love Gift/Pledge Contributors</span>
                        </label>
                    </div>

                    <button
                        onClick={handleDownloadPdf}
                        disabled={generatingPdf || loading || reportData.length === 0}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {generatingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        Download PDF
                    </button>
                </div>
            </div>

            <div className="flex justify-center bg-gray-100 p-8 min-h-screen overflow-auto">
                <div className="md:w-[210mm] w-full bg-white text-black shadow-2xl p-8 min-h-[297mm]">
                    {loading ? (
                        <div className="text-center py-20 text-gray-400">Generating Report...</div>
                    ) : reportData.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">No records found for this criteria.</div>
                    ) : (
                        reportData.map((entry) => {
                            const statement = statementsByMember[entry.member.id];
                            if (!statement) return null;

                            const leftMonths = statement.months.slice(0, 6);
                            const rightMonths = statement.months.slice(6, 12);

                            return (
                                <div key={entry.member.id} className="mb-10 pb-8 border-b-2 border-dashed border-gray-200 last:border-0">
                                    <div className="text-center">
                                        <h1 className="text-[38px] font-black uppercase tracking-wide text-slate-900">{churchSettings.church_name}</h1>
                                        {churchSettings.church_address && (
                                            <p className="text-xs text-slate-600 mt-1">{churchSettings.church_address}</p>
                                        )}
                                        <div className="mt-3 border-t border-slate-500 pt-3">
                                            <p className="text-xl font-bold uppercase tracking-wide">Individual Financial Statement</p>
                                            <p className="text-[11px] text-slate-500">Fiscal Year {year}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Member Name</p>
                                            <p className="text-3xl font-black text-slate-900">{entry.member.first_name} {entry.member.surname}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">FP / Sunday (Annual / 52)</p>
                                            <p className="text-[32px] font-black text-blue-700">P{formatAmount(statement.fpPerSunday52, false)}</p>
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
                                                <p>Total Tithes: <span className="font-bold">P{formatAmount(statement.yearTithe, false)}</span></p>
                                                <p>Total Faith Promise Given: <span className="font-bold text-blue-700">P{formatAmount(statement.fpGiven, false)}</span></p>
                                                {includeLoveGifts && <p>Total Love Gifts: <span className="font-bold">P{formatAmount(statement.yearLoveGift, false)}</span></p>}
                                                {includePledges && <p>Total Pledges: <span className="font-bold">P{formatAmount(statement.yearPledge, false)}</span></p>}
                                                <p>Total Others: <span className="font-bold">P{formatAmount(statement.yearOther, false)}</span></p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Faith Promise Balance</p>
                                            <div className="mt-1 inline-block bg-red-50 border border-red-100 rounded-lg px-5 py-2">
                                                <p className="text-3xl font-black text-red-600">P{formatAmount(statement.fpBalance, false)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-5 text-[11px] text-slate-500 text-center">
                                        Note: These records are for {year} only and do not include last year. If you see an error, please contact the admin.
                                    </p>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default FinancialReportPrint;
