import React from "react";
import { X, Save } from "lucide-react";
import type { AggregatedTransaction, EditTransactionForm } from "./types";

interface EditTransactionModalProps {
    editingRow: AggregatedTransaction;
    editForm: EditTransactionForm;
    setEditForm: (form: EditTransactionForm) => void;
    closeEditModal: () => void;
    prepareUpdate: () => void;
    updating: boolean;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
    editingRow,
    editForm,
    setEditForm,
    closeEditModal,
    prepareUpdate,
    updating
}) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Edit Transaction History</h3>
                        <p className="text-xs text-gray-500 mt-1">{editingRow.member_name} | {editingRow.date}</p>
                    </div>
                    <button
                        type="button"
                        onClick={closeEditModal}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-blue-600 uppercase tracking-wide">Tithe</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.tithe_amount}
                            onChange={(e) => setEditForm({ ...editForm, tithe_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-green-600 uppercase tracking-wide">Faith Promise</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.faith_promise_amount}
                            onChange={(e) => setEditForm({ ...editForm, faith_promise_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-pink-600 uppercase tracking-wide">Love Gift</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.love_gift_amount}
                            onChange={(e) => setEditForm({ ...editForm, love_gift_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Pledge</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.pledge_amount}
                            onChange={(e) => setEditForm({ ...editForm, pledge_amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Pledge Purpose</label>
                        <input
                            type="text"
                            value={editForm.pledge_purpose}
                            onChange={(e) => setEditForm({ ...editForm, pledge_purpose: e.target.value })}
                            placeholder="Purpose (if pledge is used)"
                            className="w-full mt-1 border border-gray-200 rounded-lg p-2.5"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={closeEditModal}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={prepareUpdate}
                        disabled={updating}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save size={14} />
                        {updating ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
