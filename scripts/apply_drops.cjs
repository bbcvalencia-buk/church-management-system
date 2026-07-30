const fs = require('fs');

let sql = fs.readFileSync('schema_v2.sql', 'utf8');

// 1. Constraints
const constraintRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(public\.[a-zA-Z0-9_]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)/gi;
sql = sql.replace(/ALTER\s+TABLE\s+(?:ONLY\s+)?public\.[a-zA-Z0-9_]+\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+[a-zA-Z0-9_]+;\r?\n?/gi, '');
sql = sql.replace(constraintRegex, 'ALTER TABLE $1 DROP CONSTRAINT IF EXISTS $2;\nALTER TABLE $1 ADD CONSTRAINT $2');

// 2. Triggers
sql = sql.replace(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+[a-zA-Z0-9_]+\s+ON\s+public\.[a-zA-Z0-9_]+;\r?\n?/gi, '');
const triggerRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)[\s\S]{1,150}?ON\s+(public\.[a-zA-Z0-9_]+)/gi;
sql = sql.replace(triggerRegex, (match, triggerName, tableName) => {
    return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${match}`;
});

// 3. Indexes
sql = sql.replace(/DROP\s+INDEX\s+IF\s+EXISTS\s+[a-zA-Z0-9_]+;\r?\n?/gi, '');
const indexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+(public\.[a-zA-Z0-9_]+)/gi;
sql = sql.replace(indexRegex, (match, uniqueStr, indexName, tableName) => {
    return `DROP INDEX IF EXISTS ${indexName};\n${match}`;
});

fs.writeFileSync('schema_v2.sql', sql);

console.log('Constraints drops:', (sql.match(/DROP CONSTRAINT IF EXISTS/gi) || []).length);
console.log('Triggers drops:', (sql.match(/DROP TRIGGER IF EXISTS/gi) || []).length);
console.log('Indexes drops:', (sql.match(/DROP INDEX IF EXISTS/gi) || []).length);
console.log('Total lines:', sql.split(/\r?\n/).length);
