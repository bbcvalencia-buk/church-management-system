const fs = require('fs');

let sql = fs.readFileSync('schema_v2.sql', 'utf8');
const lines = sql.split(/\r?\n/);

// Find the boundary lines
// The duplicate block starts after the GRANT statements from the first block  
// and ends right before "-- SECTION: ROLES & AUTH"
let startDelete = -1;
let endDelete = -1;

for (let i = 0; i < lines.length; i++) {
    // Find the first GRANT EXECUTE line after line 403 (the correct helpers end)
    if (i > 403 && startDelete === -1 && lines[i].includes('GRANT EXECUTE ON FUNCTION public.app_member_has_sunday_school_assignment')) {
        // The very next non-blank line after this should be start of duplicate block
        startDelete = i + 1; // We want to cut after the first GRANT block 
    }

    if (startDelete > 0 && lines[i].includes('-- SECTION: ROLES & AUTH')) {
        // We want to keep this line, so delete up to 2 lines before it (the === line)
        endDelete = i - 1; // the blank line before SECTION: ROLES
        break;
    }
}

if (startDelete > 0 && endDelete > 0) {
    console.log('Removing lines', startDelete + 1, 'to', endDelete + 1, '(0-indexed:', startDelete, 'to', endDelete, ')');
    console.log('First line to remove:', JSON.stringify(lines[startDelete]));
    console.log('Last line to remove:', JSON.stringify(lines[endDelete]));

    const newLines = [...lines.slice(0, startDelete), ...lines.slice(endDelete + 1)];
    fs.writeFileSync('schema_v2.sql', newLines.join('\n'));
    console.log('New total lines:', newLines.length);
} else {
    console.log('Could not find boundaries. startDelete:', startDelete, 'endDelete:', endDelete);
}
