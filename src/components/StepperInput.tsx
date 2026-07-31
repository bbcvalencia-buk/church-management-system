import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface StepperInputProps {
    label: string;
    subtitle?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}

const StepperInput: React.FC<StepperInputProps> = ({
    label,
    subtitle,
    value,
    onChange,
    min = 0,
    max = 9999
}) => {
    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    const handleIncrement = () => {
        if (value < max) {
            onChange(value + 1);
        }
    };

    return (
        <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div className="pr-4">
                <div className="text-[15px] font-bold text-gray-900">{label}</div>
                {subtitle && <div className="text-[12px] font-semibold text-gray-500 mt-0.5">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-3 bg-gray-50/80 p-1.5 rounded-[20px] border border-gray-200">
                <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={value <= min}
                    className="w-11 h-11 flex items-center justify-center bg-white rounded-none shadow-sm text-gray-700 disabled:opacity-50 disabled:shadow-none border border-gray-200 active:scale-95 transition-transform"
                >
                    <Minus size={20} strokeWidth={3} />
                </button>
                <div className="w-10 text-center text-[18px] font-black text-gray-900">
                    {value}
                </div>
                <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={value >= max}
                    className="w-11 h-11 flex items-center justify-center bg-white rounded-none shadow-sm text-gray-700 disabled:opacity-50 disabled:shadow-none border border-gray-200 active:scale-95 transition-transform"
                >
                    <Plus size={20} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};

export default StepperInput;
