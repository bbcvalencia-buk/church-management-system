import React from "react";
import { TrendingUp, Banknote } from "lucide-react";

interface FinancialSummaryProps {
    financials: { year: number; total_given: number }[];
}

const FinancialSummary: React.FC<FinancialSummaryProps> = ({ financials }) => {
    if (!financials || financials.length === 0) {
        return (
            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500" /> Financial Summary
                    </h3>
                </div>
                <p className="text-[12px] font-semibold text-gray-400 italic mb-6">No financial records found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6 flex flex-col h-auto">
            <div className="flex justify-between items-start mb-6">
                <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-500" /> Financial Summary
                </h3>
            </div>
            
            <div className="space-y-4">
                {financials.map((f, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-emerald-50 rounded-none border border-emerald-100/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-none bg-emerald-100 flex items-center justify-center shrink-0">
                                <Banknote size={14} className="text-emerald-600" />
                            </div>
                            <span className="font-bold text-gray-700 text-sm">Faith Promise {f.year}</span>
                        </div>
                        <span className="font-bold text-emerald-600">₱{f.total_given.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FinancialSummary;
