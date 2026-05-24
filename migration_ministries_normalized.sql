-- Normalize ministry identity and attendance event metadata.
-- This migration keeps church_positions intact as a legacy compatibility source.

BEGIN;

-- ---------------------------------------------------------------------------
-- Ministries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'leadership',
      'music_ministry',
      'sunday_school',
      'operations',
      'other_ministries'
    )
  ),
  description TEXT,
  schedule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ministry_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  is_leader BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, ministry_id, role_name, start_date)
);

CREATE INDEX IF NOT EXISTS idx_ministry_assignments_member_id
  ON public.ministry_assignments(member_id);

CREATE INDEX IF NOT EXISTS idx_ministry_assignments_ministry_id
  ON public.ministry_assignments(ministry_id);

CREATE INDEX IF NOT EXISTS idx_ministries_category
  ON public.ministries(category);

CREATE OR REPLACE FUNCTION public.app_slug_code(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '_' FROM regexp_replace(upper(coalesce(value, 'MINISTRY')), '[^A-Z0-9]+', '_', 'g'));
$$;

-- Backfill ministries from the existing overloaded church_positions table.
WITH legacy_ministries AS (
  SELECT
    public.app_slug_code(coalesce(nullif(trim(cp.department), ''), cp.position_name)) AS code,
    coalesce(nullif(trim(cp.department), ''), cp.position_name) AS name,
    CASE
      WHEN cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class') THEN 'sunday_school'
      WHEN cp.position_category = 'music_ministry' THEN 'music_ministry'
      WHEN cp.position_category = 'leadership' THEN 'leadership'
      WHEN cp.position_category = 'other_ministries' THEN 'operations'
      ELSE 'other_ministries'
    END AS category,
    nullif(trim(cp.assignment_reason), '') AS schedule,
    row_number() OVER (
      PARTITION BY public.app_slug_code(coalesce(nullif(trim(cp.department), ''), cp.position_name))
      ORDER BY
        CASE WHEN nullif(trim(cp.department), '') IS NOT NULL THEN 0 ELSE 1 END,
        cp.created_at DESC NULLS LAST,
        cp.id
    ) AS rn
  FROM public.church_positions cp
  WHERE cp.is_active = TRUE
    AND coalesce(nullif(trim(cp.department), ''), nullif(trim(cp.position_name), '')) IS NOT NULL
)
INSERT INTO public.ministries (code, name, category, schedule, is_active)
SELECT code, name, category, schedule, TRUE
FROM legacy_ministries
WHERE rn = 1
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  schedule = coalesce(public.ministries.schedule, EXCLUDED.schedule),
  is_active = TRUE,
  updated_at = NOW();

-- Backfill assignments. This is intentionally additive and idempotent.
WITH legacy_assignments AS (
  SELECT
    cp.member_id,
    m.id AS ministry_id,
    cp.position_name AS role_name,
    coalesce(cp.is_ministry_head, FALSE) AS is_leader,
    coalesce(cp.start_date, CURRENT_DATE) AS start_date,
    cp.end_date,
    CASE WHEN cp.is_active THEN 'active' ELSE 'inactive' END AS status,
    row_number() OVER (
      PARTITION BY
        cp.member_id,
        m.id,
        cp.position_name,
        coalesce(cp.start_date, CURRENT_DATE)
      ORDER BY
        CASE WHEN cp.is_active THEN 0 ELSE 1 END,
        cp.created_at DESC NULLS LAST,
        cp.id
    ) AS rn
  FROM public.church_positions cp
  JOIN public.ministries m
    ON m.code = public.app_slug_code(coalesce(nullif(trim(cp.department), ''), cp.position_name))
  WHERE coalesce(nullif(trim(cp.position_name), ''), '') <> ''
)
INSERT INTO public.ministry_assignments (
  member_id,
  ministry_id,
  role_name,
  is_leader,
  start_date,
  end_date,
  status
)
SELECT
  member_id,
  ministry_id,
  role_name,
  is_leader,
  start_date,
  end_date,
  status
FROM legacy_assignments
WHERE rn = 1
ON CONFLICT (member_id, ministry_id, role_name, start_date) DO UPDATE SET
  is_leader = EXCLUDED.is_leader,
  end_date = EXCLUDED.end_date,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Church offices, separate from ministry participation.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.church_office_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.church_offices(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(office_id, member_id, start_date)
);

-- ---------------------------------------------------------------------------
-- Sunday School, separate from ministry membership.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sunday_school_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('adult', 'beginners', 'nursery', 'kinder', 'primary', 'junior')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sunday_school_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.sunday_school_classes(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'assistant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, member_id, role, start_date)
);

-- ---------------------------------------------------------------------------
-- Music practice should be able to point directly at a ministry.
-- ---------------------------------------------------------------------------

ALTER TABLE public.music_practice_sessions
  ADD COLUMN IF NOT EXISTS ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_music_practice_sessions_ministry_id
  ON public.music_practice_sessions(ministry_id);

-- ---------------------------------------------------------------------------
-- Canonical attendance event shape.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS services_select_policy ON public.services;
DROP POLICY IF EXISTS sunday_school_sessions_select_policy ON public.sunday_school_sessions;
DROP POLICY IF EXISTS attendance_log_select_policy ON public.attendance_log;
DROP POLICY IF EXISTS attendance_log_insert_policy ON public.attendance_log;
DROP POLICY IF EXISTS attendance_log_update_policy ON public.attendance_log;
DROP POLICY IF EXISTS attendance_log_delete_policy ON public.attendance_log;

ALTER TABLE public.attendance_log
  ADD COLUMN IF NOT EXISTS was_tardy BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.attendance_log
  ALTER COLUMN event_id TYPE TEXT USING event_id::TEXT;

ALTER TABLE public.attendance_log
  DROP CONSTRAINT IF EXISTS attendance_log_event_type_check;

ALTER TABLE public.attendance_log
  ADD CONSTRAINT attendance_log_event_type_check
  CHECK (event_type IN (
    'service',
    'activity',
    'sunday_school',
    'music_practice',
    'church_event',
    'goodnews_session'
  ));

CREATE POLICY attendance_log_select_policy ON public.attendance_log
FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND public.app_has_any_role(ARRAY['sunday_school_admin']))
  OR CASE WHEN event_type = 'sunday_school' THEN public.app_can_manage_sunday_school_session(event_id::UUID) ELSE FALSE END
  OR (public.app_has_role('activity_coordinator') AND event_type IN ('activity', 'church_event'))
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR (public.app_has_role('goodnews_teacher') AND event_type = 'goodnews_session')
  OR member_id = public.app_current_member_id()
);

CREATE POLICY attendance_log_insert_policy ON public.attendance_log
FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND public.app_has_any_role(ARRAY['sunday_school_admin']))
  OR CASE WHEN event_type = 'sunday_school' THEN public.app_can_manage_sunday_school_session(event_id::UUID) ELSE FALSE END
  OR (public.app_has_role('activity_coordinator') AND event_type IN ('activity', 'church_event'))
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR (public.app_has_role('goodnews_teacher') AND event_type = 'goodnews_session')
);

CREATE POLICY attendance_log_update_policy ON public.attendance_log
FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND public.app_has_any_role(ARRAY['sunday_school_admin']))
  OR CASE WHEN event_type = 'sunday_school' THEN public.app_can_manage_sunday_school_session(event_id::UUID) ELSE FALSE END
  OR (public.app_has_role('activity_coordinator') AND event_type IN ('activity', 'church_event'))
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR (public.app_has_role('goodnews_teacher') AND event_type = 'goodnews_session')
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND public.app_has_any_role(ARRAY['sunday_school_admin']))
  OR CASE WHEN event_type = 'sunday_school' THEN public.app_can_manage_sunday_school_session(event_id::UUID) ELSE FALSE END
  OR (public.app_has_role('activity_coordinator') AND event_type IN ('activity', 'church_event'))
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR (public.app_has_role('goodnews_teacher') AND event_type = 'goodnews_session')
);

CREATE POLICY attendance_log_delete_policy ON public.attendance_log
FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND public.app_has_any_role(ARRAY['sunday_school_admin']))
  OR CASE WHEN event_type = 'sunday_school' THEN public.app_can_manage_sunday_school_session(event_id::UUID) ELSE FALSE END
  OR (public.app_has_role('activity_coordinator') AND event_type IN ('activity', 'church_event'))
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR (public.app_has_role('goodnews_teacher') AND event_type = 'goodnews_session')
);

CREATE POLICY services_select_policy ON public.services
FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin'])
  OR EXISTS (
    SELECT 1
    FROM public.attendance_log al
    WHERE al.event_type = 'service'
      AND al.event_id = public.services.id::TEXT
      AND al.member_id = public.app_current_member_id()
  )
);

CREATE POLICY sunday_school_sessions_select_policy ON public.sunday_school_sessions
FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(public.sunday_school_sessions.department)
  OR EXISTS (
    SELECT 1
    FROM public.attendance_log al
    WHERE al.event_type = 'sunday_school'
      AND al.event_id = public.sunday_school_sessions.id::TEXT
      AND al.member_id = public.app_current_member_id()
  )
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministry_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_office_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_school_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ministries_select_policy ON public.ministries;
CREATE POLICY ministries_select_policy ON public.ministries
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS ministries_write_policy ON public.ministries;
CREATE POLICY ministries_write_policy ON public.ministries
FOR ALL USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']))
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS ministry_assignments_select_policy ON public.ministry_assignments;
CREATE POLICY ministry_assignments_select_policy ON public.ministry_assignments
FOR SELECT USING (
  auth.role() = 'authenticated'
  OR member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS ministry_assignments_write_policy ON public.ministry_assignments;
CREATE POLICY ministry_assignments_write_policy ON public.ministry_assignments
FOR ALL USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']))
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS church_offices_select_policy ON public.church_offices;
CREATE POLICY church_offices_select_policy ON public.church_offices
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS church_offices_write_policy ON public.church_offices;
CREATE POLICY church_offices_write_policy ON public.church_offices
FOR ALL USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']))
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS church_office_assignments_select_policy ON public.church_office_assignments;
CREATE POLICY church_office_assignments_select_policy ON public.church_office_assignments
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS church_office_assignments_write_policy ON public.church_office_assignments;
CREATE POLICY church_office_assignments_write_policy ON public.church_office_assignments
FOR ALL USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']))
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS sunday_school_classes_select_policy ON public.sunday_school_classes;
CREATE POLICY sunday_school_classes_select_policy ON public.sunday_school_classes
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS sunday_school_classes_write_policy ON public.sunday_school_classes;
CREATE POLICY sunday_school_classes_write_policy ON public.sunday_school_classes
FOR ALL USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin']))
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin']));

DROP POLICY IF EXISTS sunday_school_enrollments_select_policy ON public.sunday_school_enrollments;
CREATE POLICY sunday_school_enrollments_select_policy ON public.sunday_school_enrollments
FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS sunday_school_enrollments_write_policy ON public.sunday_school_enrollments;
CREATE POLICY sunday_school_enrollments_write_policy ON public.sunday_school_enrollments
FOR ALL USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin']))
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin']));

COMMIT;
