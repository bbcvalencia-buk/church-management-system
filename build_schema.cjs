const fs = require('fs');

// Read files
let originalSchema = fs.readFileSync('schema_v2.sql', 'utf8');
let goodnews = fs.readFileSync('migration_goodnews.sql', 'utf8');
let events = fs.readFileSync('migration_church_events.sql', 'utf8');
let finance = fs.readFileSync('migration_financial_security.sql', 'utf8');
let auditLogs = fs.readFileSync('migration_audit_logs.sql', 'utf8');

// The new Helper Functions block entirely replacing everything from line 13 to line 377 of old schema
const newHelpers = fs.readFileSync('new_helpers.txt', 'utf8');

// Process Old Schema 
// We split by "CREATE TABLE IF NOT EXISTS public.user_roles" and keep the bottom half
const oldSchemaBottom = originalSchema.substring(originalSchema.indexOf('-- ============================================================================\r\n-- SECTION: TABLES\r\n') !== -1 ? originalSchema.indexOf('-- ============================================================================\r\n-- SECTION: TABLES\r\n') : originalSchema.indexOf('-- ============================================================================\n-- SECTION: TABLES\n'));

let finalSchema = "-- ============================================================================\n-- BBC VALENCIA CHURCH MANAGEMENT SYSTEM - SCHEMA V2\n-- ============================================================================\n\nCREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n\n" + newHelpers + "\n\n" + oldSchemaBottom;

// Strip out the old audit_log block
const auditLogRegex = /CREATE TABLE IF NOT EXISTS public\.audit_log[\s\S]*?timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)\s*\);[\s\S]*?CREATE POLICY audit_log_insert_policy[\s\S]*?;/g;
finalSchema = finalSchema.replace(auditLogRegex, '');

// Process all files to replace super_admin with church_administrator
finalSchema = finalSchema.replace(/super_admin/g, 'church_administrator');
goodnews = goodnews.replace(/super_admin/g, 'church_administrator');
events = events.replace(/super_admin/g, 'church_administrator');
events = events.replace(/goodnews_classes/g, 'goodnews_series');
finance = finance.replace(/super_admin/g, 'church_administrator');
auditLogs = auditLogs.replace(/super_admin/g, 'church_administrator');
auditLogs = auditLogs.replace(/goodnews_classes/g, 'goodnews_series');

// Merge AuditLogs correctly into the schema, we replace from 'BEGIN;' to 'COMMIT;'
auditLogs = auditLogs.replace('BEGIN;', '').replace('COMMIT;', '');
finance = finance.replace('BEGIN;', '').replace('COMMIT;', '');

// The church_events trigger completion
const replacementEvents = `EXECUTE FUNCTION public.set_church_event_number();\n\n-- RLS Policies for church_events\nALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "church_events_select_policy" ON public.church_events FOR SELECT USING (true);\nCREATE POLICY "church_events_insert_policy" ON public.church_events FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));\nCREATE POLICY "church_events_update_policy" ON public.church_events FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));\nCREATE POLICY "church_events_delete_policy" ON public.church_events FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor']));\n`;
events = events.replace('DROP POLICY IF EXISTS services_select_policy ON public.services;', replacementEvents);

// Clean up trigger sections and combine
finalSchema += "\n\n-- ============================================================================\n-- SECTION: NEW V2 TABLES (GOODNEWS, EVENTS, FINANCE, AUDIT)\n-- ============================================================================\n\n";

// GOODNEWS
const gnSchemaMatch = goodnews.match(/CREATE TABLE IF NOT EXISTS public\.goodnews_series[\s\S]*?CREATE TABLE IF NOT EXISTS public\.goodnews_attendance[\s\S]*?FOR DELETE USING \(public\.app_has_any_role\(ARRAY\['church_administrator', 'pastor', 'church_clerk', 'goodnews_teacher'\]\)\);/);
if (gnSchemaMatch) finalSchema += gnSchemaMatch[0] + "\n\n";

// EVENTS
const evtSchemaMatch = events.match(/CREATE TABLE IF NOT EXISTS public\.church_events[\s\S]*?CREATE POLICY "church_events_delete_policy" ON public\.church_events FOR DELETE USING \(public\.app_has_any_role\(ARRAY\['church_administrator', 'pastor'\]\)\);/);
if (evtSchemaMatch) finalSchema += evtSchemaMatch[0] + "\n\n";

// FINANCE
const finSchemaMatch = finance.match(/CREATE TABLE IF NOT EXISTS public\.financial_period_locks[\s\S]*?ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth\.users\(id\);/);
if (finSchemaMatch) finalSchema += finSchemaMatch[0] + "\n\n";

// SYSTEM AUDIT LOGS
const auditSchemaMatch = auditLogs.match(/CREATE TABLE IF NOT EXISTS public\.audit_logs[\s\S]*?END LOOP;\r?\nEND;\r?\n\$\$;/);
if (auditSchemaMatch) {
    finalSchema += auditSchemaMatch[0] + "\n\n";
} else {
    // If regex fails (because of line endings), append the whole processed auditLogs text
    finalSchema += auditLogs + "\n\n";
}

fs.writeFileSync('schema_v2.sql', finalSchema);

console.log('Successfully wrote schema_v2.sql with ' + finalSchema.split('\\n').length + ' original lines approx.');
