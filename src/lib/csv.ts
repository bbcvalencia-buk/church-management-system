
/**
 * Utility to export data to CSV
 */
export const exportToCSV = (filename: string, data: any[], headers: { key: string, label: string }[]) => {
    if (!data || !data.length) return;

    const csvRows = [];

    // Add headers
    csvRows.push(headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(','));

    // Add data rows
    for (const row of data) {
        const values = headers.map(h => {
            const val = row[h.key];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }

    const csvContent = "\uFEFF" + csvRows.join('\n'); // Add BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Parses a CSV string into a 2D array of strings.
 * Handles quoted fields properly.
 */
export const parseCSV = (csvStr: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let inQuotedField = false;
    let field = '';

    // Remove BOM if present
    if (csvStr.charCodeAt(0) === 0xFEFF) {
        csvStr = csvStr.slice(1);
    }

    // Normalize newlines
    const str = csvStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const nextChar = str[i + 1];

        if (inQuotedField) {
            if (char === '"' && nextChar === '"') {
                field += '"';
                i++; // Skip the escaped quote
            } else if (char === '"') {
                inQuotedField = false;
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                inQuotedField = true;
            } else if (char === ',') {
                row.push(field);
                field = '';
            } else if (char === '\n') {
                row.push(field);
                if (row.length > 0 && row.some(c => c !== '')) {
                    result.push(row);
                }
                row = [];
                field = '';
            } else {
                field += char;
            }
        }
    }

    // Add the last field and row if any
    row.push(field);
    if (row.length > 0 && row.some(c => c !== '')) {
        result.push(row);
    }

    // Skip header row
    if (result.length > 0) {
        // If the first field contains 'member_number', shift
        if (result[0][0].toLowerCase().includes('member_number')) {
            result.shift();
        }
    }

    return result;
};

