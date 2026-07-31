import React from "react";

interface EditingStudent {
    id: string;
    first_name: string;
    surname: string;
    phone_number: string;
    home_address: string;
    date_of_birth: string;
    gender: string;
    civil_status: string;
}

interface Props {
    editingStudent: EditingStudent;
    studentSaving: boolean;
    onClose: () => void;
    onSave: () => void;
    onChange: (student: EditingStudent) => void;
}

const StudentEditorModal: React.FC<Props> = ({
    editingStudent,
    studentSaving,
    onClose,
    onSave,
    onChange,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-none shadow-2xl w-full max-w-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Edit Student Profile</h3>
                    <p className="text-xs text-gray-500 mt-1">Update student details for your class roster.</p>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">First Name</label>
                        <input
                            type="text"
                            value={editingStudent.first_name}
                            onChange={(e) => onChange({ ...editingStudent, first_name: e.target.value })}
                            className="w-full border border-gray-200 rounded-none p-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Surname</label>
                        <input
                            type="text"
                            value={editingStudent.surname}
                            onChange={(e) => onChange({ ...editingStudent, surname: e.target.value })}
                            className="w-full border border-gray-200 rounded-none p-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                        <input
                            type="text"
                            value={editingStudent.phone_number}
                            onChange={(e) => onChange({ ...editingStudent, phone_number: e.target.value })}
                            className="w-full border border-gray-200 rounded-none p-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date of Birth</label>
                        <input
                            type="date"
                            value={editingStudent.date_of_birth || ""}
                            onChange={(e) => onChange({ ...editingStudent, date_of_birth: e.target.value })}
                            className="w-full border border-gray-200 rounded-none p-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Home Address</label>
                        <input
                            type="text"
                            value={editingStudent.home_address}
                            onChange={(e) => onChange({ ...editingStudent, home_address: e.target.value })}
                            className="w-full border border-gray-200 rounded-none p-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                        />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-none border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={studentSaving}
                        className="px-5 py-2 rounded-none bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {studentSaving ? "Saving..." : "Save Student"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentEditorModal;
