-- a. Update super_admin to church_administrator
UPDATE user_roles SET role = 'church_administrator' WHERE role = 'super_admin';

-- b. Update the CHECK constraint on user_roles.role
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (
  role IN (
    'church_administrator', 'pastor', 'church_clerk', 'treasurer', 'recording_secretary', 
    'music_minister', 'sunday_school_admin', 'goodnews_teacher', 'activity_coordinator', 'member'
  )
);

-- c. Create helper functions
CREATE OR REPLACE FUNCTION public.app_is_pastor()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.app_has_role('pastor');
END;
$$;

CREATE OR REPLACE FUNCTION public.app_is_recording_secretary()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.app_has_role('recording_secretary');
END;
$$;

CREATE OR REPLACE FUNCTION public.app_is_goodnews_teacher()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.app_has_role('goodnews_teacher');
END;
$$;

-- d. Updates RLS SELECT policies on ALL tables to also permit pastor role (read-only)
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'user_roles', 'members', 'family_relationships', 'church_positions',
            'member_profile_edit_requests', 'services', 'attendance_log', 'visitors',
            'sunday_school_sessions', 'financial_records', 'faith_promise_commitments',
            'activities', 'music_practice_sessions', 'import_conflicts', 'import_errors'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS pastor_select_all ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY pastor_select_all ON public.%I FOR SELECT USING (public.app_has_role(''pastor''));', tbl);
    END LOOP;
END $$;

-- e. Updates services, sunday_school_sessions, activities INSERT/UPDATE policies to permit recording_secretary
-- services
DROP POLICY IF EXISTS recording_secretary_insert_services ON public.services;
CREATE POLICY recording_secretary_insert_services ON public.services FOR INSERT WITH CHECK (public.app_has_role('recording_secretary'));

DROP POLICY IF EXISTS recording_secretary_update_services ON public.services;
CREATE POLICY recording_secretary_update_services ON public.services FOR UPDATE USING (public.app_has_role('recording_secretary')) WITH CHECK (public.app_has_role('recording_secretary'));

-- sunday_school_sessions
DROP POLICY IF EXISTS recording_secretary_insert_sunday_school_sessions ON public.sunday_school_sessions;
CREATE POLICY recording_secretary_insert_sunday_school_sessions ON public.sunday_school_sessions FOR INSERT WITH CHECK (public.app_has_role('recording_secretary'));

DROP POLICY IF EXISTS recording_secretary_update_sunday_school_sessions ON public.sunday_school_sessions;
CREATE POLICY recording_secretary_update_sunday_school_sessions ON public.sunday_school_sessions FOR UPDATE USING (public.app_has_role('recording_secretary')) WITH CHECK (public.app_has_role('recording_secretary'));

-- activities
DROP POLICY IF EXISTS recording_secretary_insert_activities ON public.activities;
CREATE POLICY recording_secretary_insert_activities ON public.activities FOR INSERT WITH CHECK (public.app_has_role('recording_secretary'));

DROP POLICY IF EXISTS recording_secretary_update_activities ON public.activities;
CREATE POLICY recording_secretary_update_activities ON public.activities FOR UPDATE USING (public.app_has_role('recording_secretary')) WITH CHECK (public.app_has_role('recording_secretary'));

