-- ============================================================
-- Migration: Allow goodnews_teacher to manage goodnews_series
-- ============================================================
-- Problem: goodnews_teacher could only READ (SELECT) series.
-- INSERT, UPDATE, DELETE were restricted to admin/clerk only.
-- A teacher needs to create, edit, and delete their own areas.
-- ============================================================

-- 1. Allow goodnews_teacher to INSERT new series
DROP POLICY IF EXISTS "Enable write access for authorized roles" ON public.goodnews_series;
CREATE POLICY "Enable write access for authorized roles" ON public.goodnews_series FOR INSERT
    WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));

-- 2. Allow goodnews_teacher to UPDATE series
DROP POLICY IF EXISTS "Enable update access for authorized roles" ON public.goodnews_series;
CREATE POLICY "Enable update access for authorized roles" ON public.goodnews_series FOR UPDATE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']))
    WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));

-- 3. Allow goodnews_teacher to DELETE series
DROP POLICY IF EXISTS "Enable delete access for authorized roles" ON public.goodnews_series;
CREATE POLICY "Enable delete access for authorized roles" ON public.goodnews_series FOR DELETE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));
