-- Strict backend security: replace permissive policies with role-based RLS.
-- This enforces access at the database layer (not just UI/routes).

BEGIN;

-- -----------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_current_member_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id
  FROM public.members m
  WHERE m.email IS NOT NULL
    AND lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ORDER BY m.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_has_role(target_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.member_id = public.app_current_member_id()
      AND ur.role = target_role
  );
$$;

CREATE OR REPLACE FUNCTION public.app_has_any_role(target_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.member_id = public.app_current_member_id()
      AND ur.role = ANY(target_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_current_member_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_role(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_any_role(TEXT[]) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_members_email_lower ON public.members (lower(email));
CREATE INDEX IF NOT EXISTS idx_user_roles_member_role ON public.user_roles (member_id, role);

-- -----------------------------------------------------------------------------
-- Remove existing policies for managed tables
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'members',
        'user_roles',
        'services',
        'visitors',
        'church_positions',
        'family_relationships',
        'financial_records',
        'faith_promise_commitments',
        'activities',
        'sunday_school_sessions',
        'music_practice_sessions',
        'attendance_log',
        'system_settings',
        'audit_log',
        'import_export_log',
        'member_profile_edit_requests'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Enable RLS on all secured tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faith_promise_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_school_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_export_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profile_edit_requests ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- MEMBERS
-- -----------------------------------------------------------------------------

CREATE POLICY members_select_policy
ON public.members
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator'])
  OR id = public.app_current_member_id()
  OR (
    public.app_has_role('music_minister')
    AND EXISTS (
      SELECT 1
      FROM public.church_positions cp
      WHERE cp.member_id = public.members.id
        AND cp.position_category = 'music_ministry'
        AND cp.is_active = TRUE
    )
  )
);

CREATE POLICY members_insert_policy
ON public.members
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    public.app_has_role('sunday_school_admin')
    AND is_visitor = TRUE
    AND coalesce(is_regular_member, FALSE) = FALSE
  )
);

CREATE POLICY members_update_policy
ON public.members
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    public.app_has_role('sunday_school_admin')
    AND is_visitor = TRUE
  )
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR public.app_has_role('sunday_school_admin')
);

CREATE POLICY members_delete_policy
ON public.members
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

-- -----------------------------------------------------------------------------
-- USER ROLES
-- -----------------------------------------------------------------------------

CREATE POLICY user_roles_select_policy
ON public.user_roles
FOR SELECT
USING (
  public.app_has_role('super_admin')
  OR member_id = public.app_current_member_id()
);

CREATE POLICY user_roles_insert_policy
ON public.user_roles
FOR INSERT
WITH CHECK (
  public.app_has_role('super_admin')
);

CREATE POLICY user_roles_update_policy
ON public.user_roles
FOR UPDATE
USING (
  public.app_has_role('super_admin')
)
WITH CHECK (
  public.app_has_role('super_admin')
);

CREATE POLICY user_roles_delete_policy
ON public.user_roles
FOR DELETE
USING (
  public.app_has_role('super_admin')
);

-- -----------------------------------------------------------------------------
-- SERVICES
-- -----------------------------------------------------------------------------

CREATE POLICY services_select_policy
ON public.services
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer', 'sunday_school_admin'])
  OR EXISTS (
    SELECT 1
    FROM public.attendance_log al
    WHERE al.event_type = 'service'
      AND al.event_id = public.services.id
      AND al.member_id = public.app_current_member_id()
  )
);

CREATE POLICY services_insert_policy
ON public.services
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

CREATE POLICY services_update_policy
ON public.services
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

CREATE POLICY services_delete_policy
ON public.services
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

-- -----------------------------------------------------------------------------
-- VISITORS
-- -----------------------------------------------------------------------------

CREATE POLICY visitors_select_policy
ON public.visitors
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
);

CREATE POLICY visitors_insert_policy
ON public.visitors
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
);

CREATE POLICY visitors_update_policy
ON public.visitors
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
);

CREATE POLICY visitors_delete_policy
ON public.visitors
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
);

-- -----------------------------------------------------------------------------
-- CHURCH POSITIONS
-- -----------------------------------------------------------------------------

CREATE POLICY church_positions_select_policy
ON public.church_positions
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'music_minister', 'sunday_school_admin'])
  OR member_id = public.app_current_member_id()
);

CREATE POLICY church_positions_insert_policy
ON public.church_positions
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

CREATE POLICY church_positions_update_policy
ON public.church_positions
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

CREATE POLICY church_positions_delete_policy
ON public.church_positions
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

-- -----------------------------------------------------------------------------
-- FAMILY RELATIONSHIPS
-- -----------------------------------------------------------------------------

CREATE POLICY family_relationships_select_policy
ON public.family_relationships
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR member_id = public.app_current_member_id()
  OR related_member_id = public.app_current_member_id()
);

CREATE POLICY family_relationships_insert_policy
ON public.family_relationships
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

CREATE POLICY family_relationships_update_policy
ON public.family_relationships
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

CREATE POLICY family_relationships_delete_policy
ON public.family_relationships
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

-- -----------------------------------------------------------------------------
-- FINANCIAL RECORDS
-- -----------------------------------------------------------------------------

CREATE POLICY financial_records_select_policy
ON public.financial_records
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer'])
  OR member_id = public.app_current_member_id()
);

CREATE POLICY financial_records_insert_policy
ON public.financial_records
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'treasurer'])
);

CREATE POLICY financial_records_update_policy
ON public.financial_records
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'treasurer'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'treasurer'])
);

CREATE POLICY financial_records_delete_policy
ON public.financial_records
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'treasurer'])
);

-- -----------------------------------------------------------------------------
-- FAITH PROMISE COMMITMENTS
-- -----------------------------------------------------------------------------

CREATE POLICY faith_promise_commitments_select_policy
ON public.faith_promise_commitments
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer'])
  OR member_id = public.app_current_member_id()
);

CREATE POLICY faith_promise_commitments_insert_policy
ON public.faith_promise_commitments
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer'])
);

CREATE POLICY faith_promise_commitments_update_policy
ON public.faith_promise_commitments
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer'])
);

CREATE POLICY faith_promise_commitments_delete_policy
ON public.faith_promise_commitments
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer'])
);

-- -----------------------------------------------------------------------------
-- ACTIVITIES
-- -----------------------------------------------------------------------------

CREATE POLICY activities_select_policy
ON public.activities
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator'])
);

CREATE POLICY activities_insert_policy
ON public.activities
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'activity_coordinator'])
);

CREATE POLICY activities_update_policy
ON public.activities
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'activity_coordinator'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'activity_coordinator'])
);

CREATE POLICY activities_delete_policy
ON public.activities
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'activity_coordinator'])
);

-- -----------------------------------------------------------------------------
-- SUNDAY SCHOOL SESSIONS
-- -----------------------------------------------------------------------------

CREATE POLICY sunday_school_sessions_select_policy
ON public.sunday_school_sessions
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
  OR EXISTS (
    SELECT 1
    FROM public.attendance_log al
    WHERE al.event_type = 'sunday_school'
      AND al.event_id = public.sunday_school_sessions.id
      AND al.member_id = public.app_current_member_id()
  )
);

CREATE POLICY sunday_school_sessions_insert_policy
ON public.sunday_school_sessions
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
);

CREATE POLICY sunday_school_sessions_update_policy
ON public.sunday_school_sessions
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
);

CREATE POLICY sunday_school_sessions_delete_policy
ON public.sunday_school_sessions
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
);

-- -----------------------------------------------------------------------------
-- MUSIC PRACTICE SESSIONS
-- -----------------------------------------------------------------------------

CREATE POLICY music_practice_sessions_select_policy
ON public.music_practice_sessions
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'music_minister'])
);

CREATE POLICY music_practice_sessions_insert_policy
ON public.music_practice_sessions
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'music_minister'])
);

CREATE POLICY music_practice_sessions_update_policy
ON public.music_practice_sessions
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'music_minister'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'music_minister'])
);

CREATE POLICY music_practice_sessions_delete_policy
ON public.music_practice_sessions
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'music_minister'])
);

-- -----------------------------------------------------------------------------
-- ATTENDANCE LOG
-- -----------------------------------------------------------------------------

CREATE POLICY attendance_log_select_policy
ON public.attendance_log
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND event_type = 'sunday_school')
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR member_id = public.app_current_member_id()
);

CREATE POLICY attendance_log_insert_policy
ON public.attendance_log
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND event_type = 'sunday_school')
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

CREATE POLICY attendance_log_update_policy
ON public.attendance_log
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND event_type = 'sunday_school')
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND event_type = 'sunday_school')
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

CREATE POLICY attendance_log_delete_policy
ON public.attendance_log
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND event_type = 'sunday_school')
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

-- -----------------------------------------------------------------------------
-- SYSTEM SETTINGS
-- -----------------------------------------------------------------------------

CREATE POLICY system_settings_select_policy
ON public.system_settings
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY system_settings_insert_policy
ON public.system_settings
FOR INSERT
WITH CHECK (
  public.app_has_role('super_admin')
);

CREATE POLICY system_settings_update_policy
ON public.system_settings
FOR UPDATE
USING (
  public.app_has_role('super_admin')
)
WITH CHECK (
  public.app_has_role('super_admin')
);

CREATE POLICY system_settings_delete_policy
ON public.system_settings
FOR DELETE
USING (
  public.app_has_role('super_admin')
);

-- -----------------------------------------------------------------------------
-- AUDIT LOG
-- -----------------------------------------------------------------------------

CREATE POLICY audit_log_select_policy
ON public.audit_log
FOR SELECT
USING (
  public.app_has_role('super_admin')
);

CREATE POLICY audit_log_insert_policy
ON public.audit_log
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'treasurer'])
);

-- -----------------------------------------------------------------------------
-- IMPORT / EXPORT LOG
-- -----------------------------------------------------------------------------

CREATE POLICY import_export_log_select_policy
ON public.import_export_log
FOR SELECT
USING (
  public.app_has_role('super_admin')
);

CREATE POLICY import_export_log_insert_policy
ON public.import_export_log
FOR INSERT
WITH CHECK (
  public.app_has_role('super_admin')
);

CREATE POLICY import_export_log_update_policy
ON public.import_export_log
FOR UPDATE
USING (
  public.app_has_role('super_admin')
)
WITH CHECK (
  public.app_has_role('super_admin')
);

CREATE POLICY import_export_log_delete_policy
ON public.import_export_log
FOR DELETE
USING (
  public.app_has_role('super_admin')
);

-- -----------------------------------------------------------------------------
-- MEMBER PROFILE EDIT REQUESTS
-- -----------------------------------------------------------------------------

CREATE POLICY member_profile_edit_requests_select_policy
ON public.member_profile_edit_requests
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR target_member_id = public.app_current_member_id()
  OR requested_by_member_id = public.app_current_member_id()
);

CREATE POLICY member_profile_edit_requests_insert_policy
ON public.member_profile_edit_requests
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    public.app_current_member_id() IS NOT NULL
    AND target_member_id = public.app_current_member_id()
    AND (requested_by_member_id IS NULL OR requested_by_member_id = public.app_current_member_id())
    AND status = 'pending'
  )
);

CREATE POLICY member_profile_edit_requests_update_policy
ON public.member_profile_edit_requests
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

CREATE POLICY member_profile_edit_requests_delete_policy
ON public.member_profile_edit_requests
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

COMMIT;
