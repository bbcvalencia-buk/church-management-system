import React from "react";
import { DollarSign, CreditCard, PieChart } from "lucide-react";

interface Totals {
    tithe: number;
    faith_promise: number;
    love_gift: number;
    total: number;
}

interface TreasurySummaryCardsProps {
    totals: Totals;
    formatCurrency: (amount: number) => string;
}

export const TreasurySummaryCards: React.FC<TreasurySummaryCardsProps> = ({ totals, formatCurrency }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--color-border)] border border-[var(--color-border)] mb-12">
            <div className="p-8 bg-white flex flex-col justify-between">
                <div className="flex justify-between items-start mb-12">
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">Total Tithes</p>
                    <DollarSign size={16} className="text-gray-300" />
                </div>
                <h3 className="text-5xl font-normal tracking-tighter text-[var(--color-text-main)]" style={{ fontFamily: "var(--font-display, inherit)" }}>{formatCurrency(totals.tithe)}</h3>
            </div>

            <div className="p-8 bg-white flex flex-col justify-between">
                <div className="flex justify-between items-start mb-12">
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">Faith Promise</p>
                    <CreditCard size={16} className="text-gray-300" />
                </div>
                <h3 className="text-5xl font-normal tracking-tighter text-[var(--color-text-main)]" style={{ fontFamily: "var(--font-display, inherit)" }}>{formatCurrency(totals.faith_promise)}</h3>
            </div>

            <div className="p-8 bg-white flex flex-col justify-between">
                <div className="flex justify-between items-start mb-12">
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">Offerings & Pledges</p>
                    <PieChart size={16} className="text-gray-300" />
                </div>
                <h3 className="text-5xl font-normal tracking-tighter text-[var(--color-text-main)]" style={{ fontFamily: "var(--font-display, inherit)" }}>{formatCurrency(totals.love_gift)}</h3>
            </div>
        </div>
    );
};
