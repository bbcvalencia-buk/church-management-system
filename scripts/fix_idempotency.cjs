const fs = require('fs');
let sql = fs.readFileSync('schema_v2.sql', 'utf8');

// 1. Regex to match ALTER TABLE ADD CONSTRAINT
// ALTER TABLE [ONLY] public.table_name ADD CONSTRAINT constraint_name ...;
let constraintRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(public\.[a-zA-Z0-9_]+)\s*ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)([\s\S]*?;)/gi;
// Let's remove any existing DROP CONSTRAINT IF EXISTS to avoid doubling
sql = sql.replace(/ALTER\s+TABLE\s+(?:ONLY\s+)?public\.[a-zA-Z0-9_]+\s*DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+[a-zA-Z0-9_]+;\r?\n?/gi, '');
sql = sql.replace(constraintRegex, 'ALTER TABLE $1 DROP CONSTRAINT IF EXISTS $2;\nALTER TABLE $1 ADD CONSTRAINT $2$3');

// 2. Regex to match CREATE TRIGGER
// CREATE TRIGGER trigger_name ... ON public.table_name ...;
// We need to capture trigger name and table name. Table name might be on a different line.
// We'll use a relatively greedy approach for table name within reason.
// First remove existing DROP TRIGGER
sql = sql.replace(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+[a-zA-Z0-9_]+\s+ON\s+public\.[a-zA-Z0-9_]+;\r?\n?/gi, '');
let triggerRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)[\s\S]{1,150}ON\s+(public\.[a-zA-Z0-9_]+)/gi;
sql = sql.replace(triggerRegex, 'DROP TRIGGER IF EXISTS $1 ON $2;\nCREATE TRIGGER $1$&'.replace('$&', ''));
// Actually JS replace with function is safer
sql = sql.replace(triggerRegex, (match, triggerName, tableName) => {
    return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${match}`;
});

// 3. Regex to match CREATE INDEX
let indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+(public\.[a-zA-Z0-9_]+)/gi;
// First remove existing DROP INDEX
sql = sql.replace(/DROP\s+INDEX\s+IF\s+EXISTS\s+[a-zA-Z0-9_]+;\r?\n?/gi, '');
sql = sql.replace(indexRegex, (match, indexName, tableName) => {
    // If original already has IF NOT EXISTS, we still replace it or just leave IF NOT EXISTS? 
    // The user wants DROP INDEX IF EXISTS.
    let cleanMatch = match.replace(/IF\s+NOT\s+EXISTS\s+/gi, ''); // remove it so we don't have redundant terms if we want, but actually it's fine
    return `DROP INDEX IF EXISTS ${indexName};\n${match}`;
});

fs.writeFileSync('schema_v2.sql', sql);

console.log('Processed constraints, triggers, and indexes.');
console.log('Constraints added drops:', (sql.match(/DROP CONSTRAINT IF EXISTS/gi) || []).length);
console.log('Triggers added drops:', (sql.match(/DROP TRIGGER IF EXISTS/gi) || []).length);
console.log('Indexes added drops:', (sql.match(/DROP INDEX IF EXISTS/gi) || []).length);
