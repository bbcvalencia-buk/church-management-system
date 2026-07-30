const fs = require('fs');

let sql = fs.readFileSync('schema_v2.sql', 'utf8');

// 1. Remove any existing DROP POLICY IF EXISTS
sql = sql.replace(/DROP POLICY IF EXISTS.+?;\r?\n?/gi, '');

// 2. Replace all CREATE POLICY to include the DROP POLICY IF EXISTS
sql = sql.replace(/CREATE POLICY\s+(["]?[a-zA-Z0-9_]+["]?)\s+ON\s+(public\.[a-zA-Z0-9_]+)/gi, 'DROP POLICY IF EXISTS $1 ON $2;\nCREATE POLICY $1 ON $2');

// 3. Add "Safe to re-run" comment after CREATE EXTENSION
let addedComment = "-- Safe to re-run: all policies dropped and recreated";
sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n' + addedComment);

// Write back to file
fs.writeFileSync('schema_v2.sql', sql);

console.log('Total files modifiled: 1');
