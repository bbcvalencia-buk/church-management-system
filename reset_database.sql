-- ============================================================
-- CHURCH MANAGEMENT SYSTEM — DATABASE RESET
-- ============================================================
-- Run this ONCE in the Supabase SQL Editor to create the
-- reset functions. After that, the app buttons will work.
-- ============================================================

-- ┌─────────────────────────────────────────┐
-- │  1. HARD RESET (wipe everything)        │
-- └─────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER          -- bypasses RLS
SET search_path = public
AS $$
DECLARE
  tbl text;
  tables_to_truncate text[] := ARRAY[
    'financial_records',
    'faith_promise_commitments',
    'attendance',
    'church_service_attendance',
    'sunday_school_attendance',
    'ministry_members',
    'pastoral_notes',
    'family_relationships',
    'church_positions',
    'user_roles',
    'visitors',
    'activities',
    'services',
    'sunday_school_sessions',
    'members'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_truncate
  LOOP
    -- Only truncate if the table actually exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', tbl);
    END IF;
  END LOOP;

  RETURN 'OK: All data wiped and IDs reset.';
END;
$$;

-- ┌─────────────────────────────────────────┐
-- │  2. FINANCIAL RESET (keep members)      │
-- └─────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION reset_financial_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbl text;
  tables_to_truncate text[] := ARRAY[
    'financial_records',
    'faith_promise_commitments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_truncate
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', tbl);
    END IF;
  END LOOP;

  RETURN 'OK: Financial data wiped and IDs reset.';
END;
$$;

-- ============================================================
-- DONE! Now the app's reset buttons will call these functions.
-- ============================================================
