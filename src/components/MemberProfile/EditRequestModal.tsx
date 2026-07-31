import React from "react";
import { MessageSquare } from "lucide-react";

interface Props {
    editRequestMessage: string;
    onChange: (msg: string) => void;
    submitting: boolean;
    onSubmit: () => void;
    onClose: () => void;
}

const EditRequestModal: React.FC<Props> = ({
    editRequestMessage,
    onChange,
    submitting,
    onSubmit,
    onClose,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-none border border-gray-100 shadow-xl w-full max-w-lg p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MessageSquare size={18} className="text-amber-600" />
                    Request Profile Edit
                </h3>
                <p className="text-sm text-gray-600">
                    Describe what needs to be corrected. Admin will review this request.
                </p>
                <textarea
                    value={editRequestMessage}
                    onChange={(e) => onChange(e.target.value)}
                    rows={5}
                    className="w-full rounded-none border border-gray-200 p-3 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    placeholder="Example: Please update my phone number and home address."
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-none border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={submitting || !editRequestMessage.trim()}
                        className="px-4 py-2 rounded-none bg-amber-600 text-[var(--color-text-main)] text-sm font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Submitting..." : "Send Request"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditRequestModal;
