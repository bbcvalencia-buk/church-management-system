import React from 'react';
import type { Member, Service } from '@/types';
import type { ServiceAttendanceLog } from '@/services/serviceService';

interface AttendanceCardProps {
    member: Member;
    selectedService: Service | null;
    log: ServiceAttendanceLog | undefined;
    historyLogs: { service: Service; log: ServiceAttendanceLog | undefined }[];
    onCheckIn: (status: 'present' | 'absent' | 'tardy') => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({ member, selectedService, log, historyLogs, onCheckIn }) => {
    const status = log?.was_tardy ? 'tardy' : log?.was_present ? 'present' : log?.was_present === false ? 'absent' : null;

    return (
        <div className="bg-white p-5 flex flex-col h-full rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-black text-lg">
                    {member.first_name?.[0]}{member.surname?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 truncate">{member.first_name} {member.surname}</h3>
                    <p className="text-xs text-gray-500">{member.member_number || "No member number"}</p>
                </div>
            </div>

            {selectedService ? (
                <div className="mt-auto">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Check-in</p>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => onCheckIn('present')}
                            className={`flex flex-col items-center justify-center min-h-[44px] rounded-xl border transition-all duration-200 ${status === 'present' ? 'bg-emerald-500 text-white border-emerald-600 scale-[1.02] shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 border-gray-100'}`}
                        >
                            <span className="text-xs font-black">Present</span>
                        </button>
                        <button
                            onClick={() => onCheckIn('tardy')}
                            className={`flex flex-col items-center justify-center min-h-[44px] rounded-xl border transition-all duration-200 ${status === 'tardy' ? 'bg-amber-500 text-white border-amber-600 scale-[1.02] shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-600 border-gray-100'}`}
                        >
                            <span className="text-xs font-black">Late</span>
                        </button>
                        <button
                            onClick={() => onCheckIn('absent')}
                            className={`flex flex-col items-center justify-center min-h-[44px] rounded-xl border transition-all duration-200 ${status === 'absent' ? 'bg-red-500 text-white border-red-600 scale-[1.02] shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 border-gray-100'}`}
                        >
                            <span className="text-xs font-black">Absent</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-auto p-3 bg-gray-50 rounded-xl text-center">
                    <p className="text-xs text-gray-400">Select a service to check in</p>
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recent History</p>
                <div className="flex gap-1.5 flex-wrap">
                    {historyLogs.slice(0, 7).map(({ service, log: hLog }) => {
                        const s = hLog?.was_tardy ? 'T' : hLog?.was_present ? 'P' : hLog?.was_present === false ? 'A' : '-';
                        const c = s === 'T' ? 'bg-amber-50 text-amber-700 border-amber-100' : s === 'P' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : s === 'A' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100';
                        return (
                            <div key={service.id} className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[10px] font-black ${c}`} title={new Date(service.service_date).toLocaleDateString()}>
                                {s}
                            </div>
                        );
                    })}
                    {historyLogs.length === 0 && <span className="text-xs text-gray-400">No history</span>}
                </div>
            </div>
        </div>
    );
};
