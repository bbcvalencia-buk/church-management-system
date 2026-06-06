-- ============================================================================
-- SQL PATCH: FIX SUNDAY SCHOOL ROLES AND RLS ACCESS POLICIES
-- ============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to allow Sunday School teachers to:
-- 1. Correctly access and manage all Children departments (nursery, kinder, primary, junior).
-- 2. View, insert, and update visitor shadow member records (where is_regular_member = false).

BEGIN;

-- 1. Re-define app_sunday_school_teacher_departments to expand 'sunday_school_children' to all children departments
CREATE OR REPLACE FUNCTION public.app_sunday_school_teacher_departments()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT[];
  dept_rec RECORD;
  final_depts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR dept_rec IN 
    SELECT 
      cp.position_category,
      cp.department,
      cp.position_name,
      cp.specific_role
    FROM public.church_positions cp
    WHERE cp.member_id = public.app_current_member_id()
      AND cp.is_active = TRUE
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class', 'nursery_class', 'kinder_class')
      AND public.app_is_sunday_school_teacher_assignment(cp.position_name, cp.specific_role, cp.is_ministry_head)
  LOOP
    IF dept_rec.position_category = 'sunday_school_children' THEN
      final_depts := array_cat(final_depts, ARRAY['nursery', 'kinder', 'primary', 'junior']::TEXT[]);
    ELSE
      DECLARE
        d TEXT;
      BEGIN
        d := public.app_sunday_school_department_key(
          dept_rec.position_category,
          dept_rec.department,
          dept_rec.position_name,
          dept_rec.specific_role
        );
        IF d IS NOT NULL THEN
          final_depts := array_append(final_depts, d);
        END IF;
      END;
    END IF;
  END LOOP;

  -- Return unique departments
  SELECT array_agg(DISTINCT x) INTO result
  FROM unnest(final_depts) x;

  RETURN coalesce(result, ARRAY[]::TEXT[]);
END;
$$;

-- 2. Update members SELECT policy to allow Sunday School and Goodnews teachers to view member records
DROP POLICY IF EXISTS members_select_policy ON public.members;
CREATE POLICY members_select_policy ON public.members FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator', 'recording_secretary'])
  OR id = public.app_current_member_id()
  OR (public.app_has_role('music_minister') AND EXISTS (
      SELECT 1 FROM public.church_positions cp 
      WHERE cp.member_id = public.members.id AND cp.position_category = 'music_ministry' AND cp.is_active = TRUE
  ))
  OR public.app_is_sunday_school_teacher()
  OR public.app_is_goodnews_teacher()
);

-- 3. Update members INSERT policy to allow Sunday School teachers to insert visitor shadow records
DROP POLICY IF EXISTS members_insert_policy ON public.members;
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

-- 4. Update members UPDATE policy to allow Sunday School teachers to update visitor shadow records and scope students
DROP POLICY IF EXISTS members_update_policy ON public.members;
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
