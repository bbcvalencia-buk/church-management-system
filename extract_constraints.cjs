const fs = require('fs');

let sql = fs.readFileSync('schema_v2.sql', 'utf8');

// The embedded constraints find them and extract + put below CREATE TABLE
function extractConstraints() {
    // regex to find CREATE TABLE blocks
    const createTableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(public\.[a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;

    sql = sql.replace(createTableRegex, (match, tableName, tableBody) => {
        let constraints = [];
        let newBody = tableBody;

        // find named constraints
        const inlineConstraintRegex = /,\s*CONSTRAINT\s+([a-zA-Z0-9_]+)\s+(CHECK|UNIQUE|FOREIGN KEY|PRIMARY KEY)\s*\(([\s\S]*?)\)(?=[,\n])/gi;

        let m;
        while ((m = inlineConstraintRegex.exec(tableBody)) !== null) {
            let constraintFullText = m[0]; // will be removed from body
            let constraintName = m[1];
            let constraintType = m[2];
            let constraintBody = m[3];

            constraints.push(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};\nALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${constraintType} (${constraintBody.trim()});`);

            // Note: need to handle edge cases if it doesn't match properly, but let's assume valid sql
            // Because removing it might leave dangling commas, we can just grab the exact matched substring and replace with empty string
        }

        // Just doing a simple approach for known inline constraints to be extremely safe:
        return match;
    });
}

// Let's do it specifically for the manual ones found to be safe:
const inlineConstraints = [
    { table: 'public.user_roles', name: 'unique_member_role', definition: 'UNIQUE (member_id, role)' },
    { table: 'public.members', name: 'pastor_id_check', definition: 'CHECK (NOT is_pastor OR id_number = 1)' },
    { table: 'public.members', name: 'pastors_wife_id_check', definition: 'CHECK (NOT is_pastors_wife OR id_number = 2)' },
    { table: 'public.family_relationships', name: 'check_relation_target', definition: 'CHECK (related_member_id IS NOT NULL OR non_member_name IS NOT NULL)' },
    { table: 'public.services', name: 'services_primary_results_only_chk', definition: 'CHECK (\n    status <> \'completed\' OR\n    (\n      NOT (sunday_school_session_ids IS NULL AND sunday_school_sessions_included = true) AND\n      NOT (goodnews_attendance_ids IS NULL AND goodnews_classes_included = true)\n    )\n  )' },
    { table: 'public.financial_period_locks', name: 'period_unique', definition: 'UNIQUE(year, month)' }
];

for (let c of inlineConstraints) {
    // 1. Remove from CREATE TABLE
    let r1 = new RegExp(`,\\s*CONSTRAINT\\s+${c.name}\\s+` + c.definition.replace(/[.*+?^$\{()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));
    sql = sql.replace(r1, '');
    let r2 = new RegExp(`CONSTRAINT\\s+${c.name}\\s+` + c.definition.replace(/[.*+?^$\{()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*') + `,?`);
    sql = sql.replace(r2, '');

    // 2. Add to after table
    // We can inject it right after the exact CREATE TABLE sequence, but that's hard. 
    // Wait, better to just append all constraint alterations right after the tables before RLS policies?
    // Let's just simply append them to the very end of the SECTION: TABLES, or before RLS.
    // Easiest is to add them right below the table creation.
    let tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${c.table.replace('.', '\\.')}\\s*\\([\\s\\S]*?\\);`, 'i');
    sql = sql.replace(tableRegex, (match) => {
        return match + `\n\nALTER TABLE ${c.table} DROP CONSTRAINT IF EXISTS ${c.name};\nALTER TABLE ${c.table} ADD CONSTRAINT ${c.name} ${c.definition};`;
    });
}

// Ensure no commas left dangling 
sql = sql.replace(/,\s*\)/g, '\n)');

fs.writeFileSync('schema_v2.sql', sql);
console.log('Modified lines:', sql.split(/\r?\n/).length);
