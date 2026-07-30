-- ============================================================================
-- SQL PATCH: UPDATE MEMBERS TABLE RLS POLICIES FOR VISITORS CREATION
-- ============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to allow recording_secretary, sunday_school_admin, and sunday_school_teacher
-- to create and update visitor shadow member records (where is_regular_member = false).

BEGIN;

-- 1. DROP old policies on public.members
DROP POLICY IF EXISTS members_insert_policy ON public.members;
DROP POLICY IF EXISTS members_update_policy ON public.members;

-- 2. CREATE members_insert_policy
-- Allows church_administrator and church_clerk full access.
-- Allows sunday_school_admin, recording_secretary, and sunday_school_teacher to create shadow records (is_regular_member = false).
CREATE POLICY members_insert_policy ON public.members FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'super_admin'])
  OR (
    public.app_has_any_role(ARRAY['sunday_school_admin', 'recording_secretary'])
    AND coalesce(is_regular_member, FALSE) = FALSE
  )
  OR (
    public.app_is_sunday_school_teacher()
    AND coalesce(is_regular_member, FALSE) = FALSE
  )
);

-- 3. CREATE members_update_policy
-- Allows church_administrator and church_clerk full access.
-- Allows sunday_school_admin, recording_secretary, and sunday_school_teacher to update shadow records (is_regular_member = false).
CREATE POLICY members_update_policy ON public.members FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'super_admin'])
  OR (
    public.app_has_any_role(ARRAY['sunday_school_admin', 'recording_secretary'])
    AND coalesce(is_regular_member, FALSE) = FALSE
  )
  OR (
    public.app_is_sunday_school_teacher()
    AND (
      coalesce(is_regular_member, FALSE) = FALSE
      OR public.app_member_in_teacher_scope(public.members.id)
    )
  )
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'super_admin'])
  OR (
    public.app_has_any_role(ARRAY['sunday_school_admin', 'recording_secretary'])
    AND coalesce(is_regular_member, FALSE) = FALSE
  )
  OR (
    public.app_is_sunday_school_teacher()
    AND (
      coalesce(is_regular_member, FALSE) = FALSE
      OR public.app_member_in_teacher_scope(public.members.id)
    )
  )
);

COMMIT;
