import React from 'react';

interface TableSkeletonProps {
    columns: number;
    rows?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ columns, rows = 5 }) => {
    return (
        <div className="w-full bg-white rounded-none shadow-sm border border-[var(--color-border)] overflow-hidden">
            {/* Header */}
            <div className="flex border-b border-[var(--color-border)] bg-gray-50/50 p-4">
                {Array.from({ length: columns }).map((_, i) => (
                    <div key={i} className="flex-1 font-bold">
                        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                    </div>
                ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-[var(--color-border)]">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex p-4">
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <div key={colIndex} className="flex-1">
                                <div
                                    className="h-4 bg-gray-100 rounded animate-pulse"
                                    style={{ width: `${Math.random() * 40 + 40}%` }}
                                ></div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};
