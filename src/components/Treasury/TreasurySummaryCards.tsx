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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bento-grid">
            <div className="card-panel p-6 relative overflow-hidden group bg-gradient-to-br from-blue-50 to-white border border-blue-100 shadow-sm rounded-2xl">
                <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <DollarSign size={64} className="text-blue-500" />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Total Tithes</p>
                <h3 className="text-4xl font-extrabold text-[var(--color-text-main)] mt-2 tracking-tight">{formatCurrency(totals.tithe)}</h3>
            </div>

            <div className="card-panel p-6 relative overflow-hidden group bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 shadow-sm rounded-2xl">
                <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <CreditCard size={64} className="text-green-500" />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Faith Promise</p>
                <h3 className="text-4xl font-extrabold text-[var(--color-text-main)] mt-2 tracking-tight">{formatCurrency(totals.faith_promise)}</h3>
            </div>

            <div className="card-panel p-6 relative overflow-hidden group bg-gradient-to-br from-pink-50 to-white border border-pink-100 shadow-sm rounded-2xl">
                <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <PieChart size={64} className="text-pink-500" />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Offerings & Pledges</p>
                <h3 className="text-4xl font-extrabold text-[var(--color-text-main)] mt-2 tracking-tight">{formatCurrency(totals.love_gift)}</h3>
            </div>
        </div>
    );
};
