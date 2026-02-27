# Schema V2 Modifications Master List

The following fixes and structural rebuilds have been successfully consolidated into `schema_v2.sql`.

### 1. Unified Audit Logs
- **Action:** Dropped original `audit_log` system table and transitioned strictly to `audit_logs`.
- **Reasoning:** `audit_log` was redundant and lacked standard column coverage compared to the robust `audit_logs` created for global data migrations. 
- **Application Change:** Also modified `src/services/systemService.ts` to seamlessly hit `audit_logs` by matching its interface (changing `action_type` to `action` and `timestamp` to `created_at`).

### 2. Family Relationships Standardization
- **Action:** Ensured only `family_relationships` exists and is tracked.
- **Reasoning:** Enforces a single source of truth for household data grouping as dictated.

### 3. Role Rename: `super_admin` to `church_administrator`
- **Action:** Performed a global search-and-replace deleting all instances of `super_admin`.
- **Details:** This securely retrofits all database RLS policy logic on `church_events`, `goodnews_series`, `service_assignments`, `financial_audit_log`, `financial_period_locks`, and `audit_logs` to exclusively look for the renamed `church_administrator` role.

### 4. Helper Functions Column Security Fix
- **Action:** Rewrote all `app_is_*` functions permanently bypassing `user_roles.user_id` mapping.
- **Details:** Helper functions are now standardized around `app_has_role()`, which universally extracts and verifies against `user_roles.member_id` via `app_current_member_id()`. 

### 5. Church Events Trigger Rebuild
- **Action:** Fixed the unfinished trigger creation for setting the Church Event incremental ID sequence.
- **Details:** Finished resolving `trigger_set_church_event_number` securely, ensuring it successfully cascades into assigning event numbers BEFORE inserting into `church_events`, while successfully securing the appended RLS policies at the end.

### 6. Goodnews Audit Schema Fix
- **Action:** Realigned `goodnews_classes` to `goodnews_series` in the comprehensive audit log trigger map (`migration_audit_logs.sql`). 
- **Reasoning:** Prevents dead triggers on missing tables and correctly ensures attendance activity on `goodnews_series` is mapped in the system logs.

### 7. Financial Security Consistency
- **Action:** Removed embedded role lookup functions strictly housed in `financial_security.sql`.
- **Details:** Standardized them exactly into the unified `schema_v2` Helper Functions block ensuring they run exactly identical security policies relying primarily on `app_has_role` execution scopes.

> **Status:** No queries have been run against the live database; exactly one clean build template was saved to disk locally.
