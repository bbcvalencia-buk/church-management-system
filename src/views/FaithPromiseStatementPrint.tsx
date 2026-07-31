import React, { useEffect, useState } from 'react';
import * as systemService from '@/services/systemService';
import * as financeService from '@/services/financeService';
import type { FaithPromiseLedger, SystemSettings } from '@/types';
import { useLocation, useNavigate } from 'react-router-dom';

const FaithPromiseStatementPrint: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const yearStr = query.get('year') || new Date().getFullYear().toString();
    const year = parseInt(yearStr, 10);
    const memberId = query.get('member_id'); // If empty, batch print all

    const [ledgers, setLedgers] = useState<FaithPromiseLedger[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [churchSettings, setChurchSettings] = useState<Partial<SystemSettings>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [year, memberId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const settings = await systemService.getSettings();
            if (settings) setChurchSettings(settings);

            const ledgerData = await financeService.getFaithPromiseLedger(year, memberId || undefined);
            setLedgers(ledgerData);

            const ids = ledgerData.map(l => l.member_id);
            if (ids.length > 0) {
                const txData = await financeService.getFaithPromiseTransactions(year, ids);
                setTransactions(txData || []);
            }
        } catch (err) {
            console.error("Error fetching print data", err);
        } finally {
            setLoading(false);
            setTimeout(() => window.print(), 1000);
        }
    };

    const getSundays = (y: number) => {
        const sundays: Date[] = [];
        let d = new Date(y, 0, 1);
        while (d.getFullYear() === y) {
            if (d.getDay() === 0) sundays.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }
        return pdSundaysMonths(sundays);
    };

    const pdSundaysMonths = (s: Date[]) => {
        const map = new Map<number, Date[]>();
        s.forEach(d => {
            const min = d.getMonth();
            if (!map.has(min)) map.set(min, []);
            map.get(min)!.push(d);
        });
        return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    };

    const formatAmount = (v: number) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2 }).format(v);

    if (loading) return <div className="p-8 text-center text-gray-500">Preparing printing template...</div>;

    if (ledgers.length === 0) return <div className="p-8 text-center">No pledges found to print.</div>;

    const generatePages = () => {
        const months = getSundays(year);

        return ledgers.map(l => {
            let runningBalance = l.committed_amount;
            const memberTx = transactions.filter(t => t.member_id === l.member_id);

            return (
                <div key={l.id} className="print-page w-full max-w-[800px] mx-auto bg-white p-8 mb-8 shadow-sm print:shadow-none font-sans text-sm relative" style={{ pageBreakAfter: 'always' }}>

                    {/* Header */}
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-black uppercase tracking-widest">{churchSettings.church_name || 'Bible Baptist Church'}</h1>
                        {churchSettings.church_address && <p className="text-xs text-gray-600">{churchSettings.church_address}</p>}
                        <div className="mt-4 pb-2 border-b-2 border-slate-800">
                            <h2 className="text-xl font-bold uppercase">Faith Promise Statement</h2>
                            <p className="text-gray-500 text-xs">For Fiscal Year {year}</p>
                        </div>
                    </div>

                    {/* Member Info */}
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Member Name</p>
                            <p className="text-2xl font-black">{l.first_name} {l.surname}</p>
                            {l.member_number && <p className="text-sm font-mono text-gray-600 mt-1">ID: {l.member_number}</p>}
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Pledged Amount</p>
                            <p className="text-2xl font-black">₱{formatAmount(l.committed_amount)}</p>
                        </div>
                    </div>

                    {/* Weekly Log */}
                    <div className="mb-6 border border-gray-300 rounded overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800 text-[var(--color-text-main)] uppercase tracking-wider text-[10px]">
                                    <th className="p-2 border border-slate-700 w-1/4">Sunday Date</th>
                                    <th className="p-2 border border-slate-700 text-right w-1/4">Given Amount</th>
                                    <th className="p-2 border border-slate-700 text-right w-1/4">Running Balance</th>
                                    <th className="p-2 border border-slate-700 w-1/4">Notes or Initials</th>
                                </tr>
                            </thead>
                            <tbody>
                                {months.map(([monthIndex, sundayDates]) => (
                                    <React.Fragment key={monthIndex}>
                                        <tr className="bg-slate-100">
                                            <td colSpan={4} className="p-2 border border-gray-300 font-bold uppercase tracking-widest text-slate-700">
                                                {new Date(year, monthIndex).toLocaleString('default', { month: 'long' })}
                                            </td>
                                        </tr>
                                        {sundayDates.map(sunday => {
                                            const sDateObj = new Date(sunday);
                                            sDateObj.setHours(0, 0, 0, 0);

                                            // Find payments near this sunday
                                            let matchAmt = 0;
                                            memberTx.forEach(t => {
                                                const tDate = new Date(t.transaction_date);
                                                tDate.setHours(0, 0, 0, 0);

                                                // check if within same week approx. (actually let's just use exact match or within -3/+3 days)
                                                const diffTime = Math.abs(tDate.getTime() - sDateObj.getTime());
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                if (diffDays <= 3) {
                                                    matchAmt += t.amount;
                                                }
                                            });

                                            runningBalance -= matchAmt;

                                            return (
                                                <tr key={sunday.toISOString()}>
                                                    <td className="p-2 border border-gray-300 font-mono text-gray-600">{sunday.toISOString().split('T')[0]}</td>
                                                    <td className="p-2 border border-gray-300 text-right font-mono font-medium">{matchAmt > 0 ? formatAmount(matchAmt) : '-'}</td>
                                                    <td className="p-2 border border-gray-300 text-right font-mono font-medium text-slate-500">{formatAmount(runningBalance < 0 ? 0 : runningBalance)}</td>
                                                    <td className="p-2 border border-gray-300 bg-gray-50/30"></td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Box */}
                    <div className="border-t-2 border-slate-800 pt-4 flex justify-between items-center">
                        <div className="space-y-1">
                            <p className="text-sm">Total Paid: <span className="font-bold text-blue-700">₱{formatAmount(l.total_paid)}</span></p>
                            <p className="text-sm">Status: <span className="font-bold">{l.status} ({l.fulfillment_pct.toFixed(1)}%)</span></p>
                        </div>
                        <div className="text-right">
                            {l.status === 'FULFILLED' ? (
                                <div className="px-6 py-2 border-2 border-green-600 text-green-700 font-black rounded uppercase tracking-widest text-lg transform -rotate-2">
                                    FULFILLED!
                                </div>
                            ) : (
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Final Balance</p>
                                    <p className="text-xl font-black text-rose-600">₱{formatAmount(l.remaining_balance)}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/finance')}
                        className="absolute top-4 right-4 bg-gray-200 px-4 py-2 rounded text-sm print:hidden hover:bg-gray-300"
                    >
                        Back
                    </button>

                    {/* Add print styles inline for safety */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            body { background: white; }
                            .print-page { box-shadow: none !important; border: none !important; }
                        }
                    `}} />
                </div>
            );
        });
    };

    return <div className="min-h-screen bg-gray-100 py-8 print:p-0 print:bg-white">{generatePages()}</div>;
};

export default FaithPromiseStatementPrint;
