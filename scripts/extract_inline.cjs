const fs = require('fs');

let sql = fs.readFileSync('schema_v2.sql', 'utf8');

const inlineConstraints = [
    { table: 'public.user_roles', name: 'unique_member_role', expr: 'UNIQUE (member_id, role)' },
    { table: 'public.members', name: 'pastor_id_check', expr: 'CHECK (NOT is_pastor OR id_number = 1)' },
    { table: 'public.members', name: 'pastors_wife_id_check', expr: 'CHECK (NOT is_pastors_wife OR id_number = 2)' },
    { table: 'public.family_relationships', name: 'check_relation_target', expr: 'CHECK (related_member_id IS NOT NULL OR non_member_name IS NOT NULL)' },
    { table: 'public.financial_period_locks', name: 'period_unique', expr: 'UNIQUE(year, month)' }
];

for (let c of inlineConstraints) {
    // Escape specific chars for regex
    let escapedExpr = c.expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regDropRaw = new RegExp(`\\s*,?\\s*CONSTRAINT\\s+${c.name}\\s+${escapedExpr}`, 'ig');
    sql = sql.replace(regDropRaw, '');

    // Append after the table creation
    let tableRegex = new RegExp(`(CREATE TABLE IF NOT EXISTS ${c.table.replace('.', '\\.')}\\s*\\([\\s\\S]*?\\);)`, 'i');
    sql = sql.replace(tableRegex, `$1\n\nALTER TABLE ${c.table} DROP CONSTRAINT IF EXISTS ${c.name};\nALTER TABLE ${c.table} ADD CONSTRAINT ${c.name} ${c.expr};`);
}

// Manually extract the difficult multi-line one from services
let svcConstraint = `\n  CONSTRAINT services_primary_results_only_chk CHECK (\n    service_type IN ('sunday_morning', 'sunday_afternoon', 'wednesday_prayer')\n    OR (coalesce(visitors_present, 0) = 0 AND coalesce(visitors_saved, 0) = 0 AND coalesce(souls_saved, 0) = 0)\n  )`;
sql = sql.replace(svcConstraint, '');
sql = sql.replace(/(CREATE TABLE IF NOT EXISTS public\.services\s*\([\s\S]*?\);)/i, `$1\n\nALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_primary_results_only_chk;\nALTER TABLE public.services ADD CONSTRAINT services_primary_results_only_chk CHECK (\n    service_type IN ('sunday_morning', 'sunday_afternoon', 'wednesday_prayer')\n    OR (coalesce(visitors_present, 0) = 0 AND coalesce(visitors_saved, 0) = 0 AND coalesce(souls_saved, 0) = 0)\n);`);

// Clean trailing commas that might have been left behind when grabbing constraints
sql = sql.replace(/,\s*\n\)/g, '\n)');

fs.writeFileSync('schema_v2.sql', sql);
