import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle, FileUp, Loader2 } from 'lucide-react';
import * as memberService from '@/services/memberService';
import * as financeService from '@/services/financeService';
import { useToast } from '@/contexts/ToastContext';
import { parseCSV } from '@/lib/csv';

interface FaithPromiseImportProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface PreviewRow {
    member_number: string;
    resolved_name: string;
    member_id: string | null;
    year: string;
    amount: string;
    transaction_date: string;
    transaction_type: string;
    notes: string;
    isValid: boolean;
    errorMsg?: string;
}

export const FaithPromiseImport: React.FC<FaithPromiseImportProps> = ({ isOpen, onClose, onSuccess }) => {
    const { showToast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [membersMap, setMembersMap] = useState<Map<string, { id: string, name: string }>>(new Map());
    const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchMembersMap();
            resetState();
        }
    }, [isOpen]);

    const fetchMembersMap = async () => {
        try {
            const members = await memberService.getAllMembers();
            const map = new Map();
            members.forEach(m => {
                if (m.member_number) {
                    map.set(m.member_number.trim().toUpperCase(), {
                        id: m.id,
                        name: `${m.surname}, ${m.first_name}`
                    });
                }
            });
            setMembersMap(map);
        } catch (err) {
            console.error("Failed to fetch members map", err);
        }
    };

    const resetState = () => {
        setFile(null);
        setPreviewData([]);
        setIsParsing(false);
        setIsImporting(false);
        setImportSummary(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDownloadTemplate = async () => {
        try {
            const members = await memberService.getAllMembers();

            let csvContent = "member_number,full_name,year,amount,transaction_date,transaction_type,notes\n";

            members.forEach(m => {
                if (m.member_number) {
                    const fullName = `"${m.surname}, ${m.first_name}"`; // Quote to handle commas
                    csvContent += `${m.member_number},${fullName},,,faith_promise,\n`;
                }
            });

            // If no members, just provide headers
            if (members.length === 0) {
                // Keep the default line
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "faith_promise_import_template.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Error generating template", err);
            showToast("Failed to generate template", "error");
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
            showToast('Please upload a valid CSV file', 'error');
            return;
        }

        setFile(selectedFile);
        setIsParsing(true);
        setImportSummary(null);

        try {
            const text = await selectedFile.text();
            const parsed = parseCSV(text);

            if (parsed.length === 0) {
                showToast("CSV file is empty", "error");
                setPreviewData([]);
                setIsParsing(false);
                return;
            }

            // Headers are expected to be: member_number, full_name, year, amount, transaction_date, transaction_type, notes
            const previewRows: PreviewRow[] = [];

            for (const row of parsed) {
                // If the vital fields are empty, skip row.
                // We assume indexes based on template.
                const member_num = (row[0] || '').trim().toUpperCase();
                const amount = (row[3] || '').trim();
                const tx_date = (row[4] || '').trim();
                const tx_type = (row[5] || 'faith_promise').trim() || 'faith_promise';
                const notes = (row[6] || '').trim();

                // Allow specific empty rows, just don't process if no amount
                if (!member_num || !amount || !tx_date) {
                    continue; // Skip lines where user didn't fill in amount or date
                }

                const memberLookup = membersMap.get(member_num);
                const isValidMember = !!memberLookup;
                const isValidAmount = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
                // Basic date validation (YYYY-MM-DD or similar standard format)
                const isValidDate = !isNaN(Date.parse(tx_date));

                let errorMsg = '';
                if (!isValidMember) errorMsg = 'Member not found';
                else if (!isValidAmount) errorMsg = 'Invalid amount';
                else if (!isValidDate) errorMsg = 'Invalid date';

                previewRows.push({
                    member_number: member_num,
                    resolved_name: memberLookup ? memberLookup.name : 'Unknown Member',
                    member_id: memberLookup ? memberLookup.id : null,
                    year: (row[2] || '').trim(), // Note: year field is in CSV, but often tx_date implies it. Let's keep it.
                    amount,
                    transaction_date: tx_date,
                    transaction_type: tx_type,
                    notes,
                    isValid: isValidMember && isValidAmount && isValidDate,
                    errorMsg
                });
            }

            setPreviewData(previewRows);
            if (previewRows.length === 0) {
                showToast("No valid data rows found (make sure amount/date are filled)", "info");
            }
        } catch (err: any) {
            console.error("Error parsing CSV", err);
            showToast(`Failed to parse CSV: ${err.message}`, 'error');
            setPreviewData([]);
        } finally {
            setIsParsing(false);
        }
    };

    const handleImport = async () => {
        const validRows = previewData.filter(r => r.isValid && r.member_id);

        if (validRows.length === 0) {
            showToast("No valid rows to import", "error");
            return;
        }

        setIsImporting(true);
        let importedCount = 0;
        let skippedCount = previewData.length - validRows.length;

        try {
            const recordsToInsert = validRows.map(row => ({
                member_id: row.member_id,
                transaction_date: new Date(row.transaction_date).toISOString().split('T')[0],
                transaction_type: row.transaction_type, // 'faith_promise', 'tithe', etc. Default 'faith_promise'
                amount: parseFloat(row.amount),
                pledge_purpose: row.notes || null, // repurposing pledge_purpose or using another standard field, but records don't have strictly 'notes'. Let's map to pledge_purpose.
                source: 'faith_promise_import',
                imported_from_v1: false
            }));

            // submitFinancialMutation can take an array in action 'INSERT'
            await financeService.submitFinancialMutation('INSERT', { records: recordsToInsert });

            importedCount = validRows.length;

            setImportSummary({
                imported: importedCount,
                skipped: skippedCount
            });

            showToast(`Successfully imported ${importedCount} records`, "success");
            onSuccess();
        } catch (err: any) {
            console.error("Import failed", err);
            showToast(`Import failed: ${err.message}`, "error");
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    const validCount = previewData.filter(r => r.isValid).length;
    const invalidCount = previewData.length - validCount;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-blue-900">
                            <FileUp className="text-blue-600" />
                            Import Faith Promise Records
                        </h2>
                        <p className="text-xs text-blue-700/70 mt-1">Upload a CSV to batch import financial records.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {importSummary ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">Import Complete!</h3>
                            <div className="flex gap-8 mt-4 p-6 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-center">
                                    <p className="text-3xl font-black text-green-600">{importSummary.imported}</p>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Valid Records Imported</p>
                                </div>
                                <div className="w-px bg-gray-200"></div>
                                <div className="text-center">
                                    <p className={`text-3xl font-black ${importSummary.skipped > 0 ? 'text-amber-500' : 'text-gray-400'}`}>{importSummary.skipped}</p>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Rows Skipped</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="mt-6 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors"
                            >
                                Close & Return to Dashboard
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Step 1 & 2 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-300 transition-colors group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 group-hover:bg-blue-100 transition-colors"></div>
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                        Download Template
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-2">Get the pre-filled CSV template containing all current members and their IDs.</p>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="mt-4 w-full py-2 px-4 bg-white border border-gray-300 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 text-gray-700 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <Download size={16} /> Download CSV Template
                                    </button>
                                </div>

                                <div className="p-5 border border-gray-200 rounded-xl bg-white flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                        {isParsing ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                                    </div>
                                    <h3 className="font-bold text-gray-900 flex items-center justify-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                        Upload Completed CSV
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{file ? file.name : "Click to select file or drag and drop"}</p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".csv,text/csv"
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* Step 3: Preview Data */}
                            {previewData.length > 0 && (
                                <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col flex-1 max-h-[400px]">
                                    <div className="bg-gray-50 p-3 border-b border-gray-200 flex items-center justify-between">
                                        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                            Review Data ({previewData.length} records)
                                        </h3>
                                        <div className="flex gap-3 text-xs font-medium">
                                            <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14} /> {validCount} Valid</span>
                                            {invalidCount > 0 && <span className="text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {invalidCount} Invalid</span>}
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto overflow-y-auto flex-1 bg-white">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                                <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                                    <th className="p-3 font-semibold">Status</th>
                                                    <th className="p-3 font-semibold">Member #</th>
                                                    <th className="p-3 font-semibold">Name</th>
                                                    <th className="p-3 font-semibold">Date</th>
                                                    <th className="p-3 font-semibold">Amount</th>
                                                    <th className="p-3 font-semibold">Type</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {previewData.map((row, idx) => (
                                                    <tr key={idx} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50/50 hover:bg-red-50'}>
                                                        <td className="p-3" title={row.isValid ? undefined : row.errorMsg}>
                                                            {row.isValid
                                                                ? <CheckCircle size={16} className="text-green-500" />
                                                                : <AlertCircle size={16} className="text-red-500" />
                                                            }
                                                        </td>
                                                        <td className="p-3 font-mono">{row.member_number}</td>
                                                        <td className={`p-3 font-medium ${row.resolved_name === 'Unknown Member' ? 'text-red-600' : 'text-gray-900'}`}>{row.resolved_name}</td>
                                                        <td className="p-3 text-gray-600">{row.transaction_date}</td>
                                                        <td className="p-3 font-medium">₱{row.amount}</td>
                                                        <td className="p-3 text-gray-500 capitalize">{row.transaction_type.replace('_', ' ')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {!importSummary && (
                    <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={isImporting || validCount === 0}
                            className={`px-5 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 ${validCount > 0 && !isImporting ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                            {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            {isImporting ? 'Importing...' : `Import ${validCount} Valid Row${validCount !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
