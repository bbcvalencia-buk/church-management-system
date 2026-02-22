-- Sunday School teacher scoped access:
-- - Teachers can manage sessions and attendance for their assigned departments.
-- - Teachers can edit student profiles assigned to their department.
-- - Teachers can manage visitors linked to sessions in their department.

BEGIN;

CREATE OR REPLACE FUNCTION public.app_normalize_sunday_school_department(target_department TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT := lower(coalesce(target_department, ''));
BEGIN
  normalized := regexp_replace(normalized, '[_-]+', ' ', 'g');
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');
  normalized := btrim(normalized);

  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  IF normalized LIKE '%nursery%' OR normalized LIKE '%kinder%' OR normalized LIKE '%toddler%' OR normalized LIKE '%primary%' THEN
    RETURN 'nursery_kinder_primary';
  END IF;

  IF normalized LIKE '%beginner%' THEN
    RETURN 'beginners';
  END IF;

  IF normalized LIKE '%junior%' OR normalized LIKE '%youth%' THEN
    RETURN 'junior';
  END IF;

  IF normalized LIKE '%adult%' THEN
    RETURN 'adult';
  END IF;

  IF normalized IN ('adult', 'beginners', 'nursery kinder primary', 'junior') THEN
    RETURN replace(normalized, ' ', '_');
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_sunday_school_department_key(
  position_category TEXT,
  department TEXT,
  position_name TEXT,
  specific_role TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := public.app_normalize_sunday_school_department(
    coalesce(department, '') || ' ' || coalesce(position_name, '') || ' ' || coalesce(specific_role, '')
  );
  IF normalized IS NOT NULL THEN
    RETURN normalized;
  END IF;

  IF position_category = 'beginners_class' THEN
    RETURN 'beginners';
  END IF;

  IF position_category = 'sunday_school_adult' THEN
    RETURN 'adult';
  END IF;

  IF position_category = 'sunday_school_children' THEN
    RETURN 'junior';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_is_sunday_school_teacher_assignment(
  position_name TEXT,
  specific_role TEXT,
  is_ministry_head BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_text TEXT := lower(coalesce(position_name, '') || ' ' || coalesce(specific_role, ''));
BEGIN
  IF coalesce(is_ministry_head, FALSE) THEN
    RETURN TRUE;
  END IF;

  RETURN (
    role_text LIKE '%teacher%'
    OR role_text LIKE '%assistant teacher%'
    OR role_text LIKE '%coordinator%'
    OR role_text LIKE '%director%'
    OR role_text LIKE '%superintendent%'
    OR role_text LIKE '%head%'
    OR role_text LIKE '%leader%'
    OR role_text LIKE '%advisor%'
    OR role_text LIKE '%adviser%'
    OR role_text LIKE '%facilitator%'
    OR role_text LIKE '%mentor%'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_sunday_school_teacher_departments()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT dept), ARRAY[]::TEXT[])
  FROM (
    SELECT public.app_sunday_school_department_key(
      cp.position_category,
      cp.department,
      cp.position_name,
      cp.specific_role
    ) AS dept
    FROM public.church_positions cp
    WHERE cp.member_id = public.app_current_member_id()
      AND cp.is_active = TRUE
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class')
      AND public.app_is_sunday_school_teacher_assignment(cp.position_name, cp.specific_role, cp.is_ministry_head)
  ) q
  WHERE dept IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.app_is_sunday_school_teacher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cardinality(public.app_sunday_school_teacher_departments()) > 0;
$$;

CREATE OR REPLACE FUNCTION public.app_can_manage_sunday_school_department(target_department TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
    OR (
      public.app_is_sunday_school_teacher()
      AND public.app_normalize_sunday_school_department(target_department) = ANY(public.app_sunday_school_teacher_departments())
    );
$$;

CREATE OR REPLACE FUNCTION public.app_member_in_teacher_scope(target_member UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_positions cp
    WHERE cp.member_id = target_member
      AND cp.is_active = TRUE
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class')
      AND NOT public.app_is_sunday_school_teacher_assignment(cp.position_name, cp.specific_role, cp.is_ministry_head)
      AND public.app_sunday_school_department_key(cp.position_category, cp.department, cp.position_name, cp.specific_role)
            = ANY(public.app_sunday_school_teacher_departments())
  );
$$;

CREATE OR REPLACE FUNCTION public.app_can_manage_sunday_school_session(target_session UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sunday_school_sessions s
    WHERE s.id = target_session
      AND public.app_can_manage_sunday_school_department(s.department)
  );
$$;

CREATE OR REPLACE FUNCTION public.app_member_has_sunday_school_assignment(target_member UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_positions cp
    WHERE cp.member_id = target_member
      AND cp.is_active = TRUE
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class')
      AND public.app_sunday_school_department_key(cp.position_category, cp.department, cp.position_name, cp.specific_role) IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_normalize_sunday_school_department(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_sunday_school_department_key(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_sunday_school_teacher_assignment(TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_sunday_school_teacher_departments() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_sunday_school_teacher() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_manage_sunday_school_department(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_member_in_teacher_scope(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_manage_sunday_school_session(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_member_has_sunday_school_assignment(UUID) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS members_select_policy ON public.members;
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
  OR (
    public.app_is_sunday_school_teacher()
    AND public.app_member_in_teacher_scope(public.members.id)
  )
);

DROP POLICY IF EXISTS members_insert_policy ON public.members;
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
  OR (
    public.app_is_sunday_school_teacher()
    AND is_visitor = TRUE
    AND coalesce(is_regular_member, FALSE) = FALSE
  )
);

DROP POLICY IF EXISTS members_update_policy ON public.members;
CREATE POLICY members_update_policy
ON public.members
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    public.app_has_role('sunday_school_admin')
    AND (
      is_visitor = TRUE
      OR public.app_member_has_sunday_school_assignment(public.members.id)
    )
  )
  OR (
    public.app_is_sunday_school_teacher()
    AND public.app_member_in_teacher_scope(public.members.id)
  )
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    public.app_has_role('sunday_school_admin')
    AND (
      is_visitor = TRUE
      OR public.app_member_has_sunday_school_assignment(public.members.id)
    )
  )
  OR (
    public.app_is_sunday_school_teacher()
    AND public.app_member_in_teacher_scope(public.members.id)
  )
);

DROP POLICY IF EXISTS church_positions_select_policy ON public.church_positions;
CREATE POLICY church_positions_select_policy
ON public.church_positions
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'music_minister', 'sunday_school_admin'])
  OR member_id = public.app_current_member_id()
  OR (
    public.app_is_sunday_school_teacher()
    AND position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class')
    AND public.app_sunday_school_department_key(position_category, department, position_name, specific_role)
          = ANY(public.app_sunday_school_teacher_departments())
  )
);

DROP POLICY IF EXISTS visitors_select_policy ON public.visitors;
CREATE POLICY visitors_select_policy
ON public.visitors
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
  OR (
    public.app_is_sunday_school_teacher()
    AND sunday_school_session_id IS NOT NULL
    AND public.app_can_manage_sunday_school_session(sunday_school_session_id)
  )
);

DROP POLICY IF EXISTS visitors_insert_policy ON public.visitors;
CREATE POLICY visitors_insert_policy
ON public.visitors
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
  OR (
    public.app_is_sunday_school_teacher()
    AND sunday_school_session_id IS NOT NULL
    AND public.app_can_manage_sunday_school_session(sunday_school_session_id)
  )
);

DROP POLICY IF EXISTS visitors_update_policy ON public.visitors;
CREATE POLICY visitors_update_policy
ON public.visitors
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
  OR (
    public.app_is_sunday_school_teacher()
    AND sunday_school_session_id IS NOT NULL
    AND public.app_can_manage_sunday_school_session(sunday_school_session_id)
  )
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
  OR (
    public.app_is_sunday_school_teacher()
    AND sunday_school_session_id IS NOT NULL
    AND public.app_can_manage_sunday_school_session(sunday_school_session_id)
  )
);

DROP POLICY IF EXISTS visitors_delete_policy ON public.visitors;
CREATE POLICY visitors_delete_policy
ON public.visitors
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
  OR (
    public.app_is_sunday_school_teacher()
    AND sunday_school_session_id IS NOT NULL
    AND public.app_can_manage_sunday_school_session(sunday_school_session_id)
  )
);

DROP POLICY IF EXISTS sunday_school_sessions_select_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_select_policy
ON public.sunday_school_sessions
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(public.sunday_school_sessions.department)
  OR EXISTS (
    SELECT 1
    FROM public.attendance_log al
    WHERE al.event_type = 'sunday_school'
      AND al.event_id = public.sunday_school_sessions.id
      AND al.member_id = public.app_current_member_id()
  )
);

DROP POLICY IF EXISTS sunday_school_sessions_insert_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_insert_policy
ON public.sunday_school_sessions
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

DROP POLICY IF EXISTS sunday_school_sessions_update_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_update_policy
ON public.sunday_school_sessions
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

DROP POLICY IF EXISTS sunday_school_sessions_delete_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_delete_policy
ON public.sunday_school_sessions
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

DROP POLICY IF EXISTS attendance_log_select_policy ON public.attendance_log;
CREATE POLICY attendance_log_select_policy
ON public.attendance_log
FOR SELECT
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    event_type = 'sunday_school'
    AND (
      public.app_has_role('sunday_school_admin')
      OR public.app_can_manage_sunday_school_session(event_id)
    )
  )
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS attendance_log_insert_policy ON public.attendance_log;
CREATE POLICY attendance_log_insert_policy
ON public.attendance_log
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    event_type = 'sunday_school'
    AND (
      public.app_has_role('sunday_school_admin')
      OR public.app_can_manage_sunday_school_session(event_id)
    )
  )
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

DROP POLICY IF EXISTS attendance_log_update_policy ON public.attendance_log;
CREATE POLICY attendance_log_update_policy
ON public.attendance_log
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    event_type = 'sunday_school'
    AND (
      public.app_has_role('sunday_school_admin')
      OR public.app_can_manage_sunday_school_session(event_id)
    )
  )
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    event_type = 'sunday_school'
    AND (
      public.app_has_role('sunday_school_admin')
      OR public.app_can_manage_sunday_school_session(event_id)
    )
  )
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

DROP POLICY IF EXISTS attendance_log_delete_policy ON public.attendance_log;
CREATE POLICY attendance_log_delete_policy
ON public.attendance_log
FOR DELETE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    event_type = 'sunday_school'
    AND (
      public.app_has_role('sunday_school_admin')
      OR public.app_can_manage_sunday_school_session(event_id)
    )
  )
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

COMMIT;
