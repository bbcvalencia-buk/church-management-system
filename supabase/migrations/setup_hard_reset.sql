-- This function safely cascades a hard reset across all standard tables.
-- It works by destroying all rows in the root tables, and relying on CASCADE 
-- to automatically delete all linked rows in positions, attendance, relationships, etc.

CREATE OR REPLACE FUNCTION public.messy_hard_reset_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Truncate root tables. Providing CASCADE ensures any tables that depend on these 
  -- (like attendance logs, positions, and family relationships) are also wiped automatically.
  TRUNCATE TABLE 
    public.members,
    public.visitors,
    public.services,
    public.financial_records,
    public.faith_promise_commitments,
    public.sunday_school_sessions,
    public.music_practice_sessions,
    public.activities,
    public.import_export_log
  CASCADE;
END;
$$;
