-- ============================================================================
-- BIBLE BAPTIST CHURCH MANAGEMENT SYSTEM V2
-- CONSOLIDATED UNIFIED SCHEMA
-- ============================================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- SECTION: HELPER FUNCTIONS
-- ============================================================================

-- Get the member_id of the currently authenticated user based on their email
CREATE OR REPLACE FUNCTION public.app_current_member_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result UUID;
BEGIN
  SELECT m.id INTO result
  FROM public.members m
  WHERE m.email IS NOT NULL
    AND lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ORDER BY m.created_at ASC
  LIMIT 1;
  RETURN result;
END;
$$;

-- Check if the current user has a specific role
CREATE OR REPLACE FUNCTION public.app_has_role(target_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.member_id = public.app_current_member_id()
      AND ur.role = target_role
  );
END;
$$;

-- Check if the current user has any of the specified roles
CREATE OR REPLACE FUNCTION public.app_has_any_role(target_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.member_id = public.app_current_member_id()
      AND ur.role = ANY(target_roles)
  );
END;
$$;

-- Normalize Sunday School department names for consistent lookup
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

  IF normalized LIKE '%nursery%' OR normalized LIKE '%toddler%' THEN
    RETURN 'nursery';
  END IF;

  IF normalized LIKE '%kinder%' THEN
    RETURN 'kinder';
  END IF;

  IF normalized LIKE '%primary%' THEN
    RETURN 'primary';
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

  IF normalized IN ('adult', 'beginners', 'nursery', 'kinder', 'primary', 'junior') THEN
    RETURN normalized;
  END IF;

  RETURN NULL;
END;
$$;

-- Determine the Sunday School department key from position details
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

-- Check if a position assignment represents a Sunday School teacher/leader role
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

-- Get all Sunday School departments the current user is assigned to as a teacher
CREATE OR REPLACE FUNCTION public.app_sunday_school_teacher_departments()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT dept), ARRAY[]::TEXT[]) INTO result
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
  RETURN result;
END;
$$;

-- Generates a human-readable member number (BBC-YYYY-NNN)
CREATE OR REPLACE FUNCTION public.generate_member_number(p_year INTEGER) 
RETURNS TEXT 
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(member_number_seq), 0)
    INTO v_max_seq
    FROM public.members
    WHERE member_number_year = p_year;

    RETURN 'BBC-' || p_year::TEXT || '-' || LPAD((v_max_seq + 1)::TEXT, 3, '0');
END;
$$;

-- Trigger function to automatically set member number on insert
CREATE OR REPLACE FUNCTION public.set_member_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.member_number IS NULL THEN
        v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
        
        SELECT COALESCE(MAX(member_number_seq), 0) + 1
        INTO v_seq
        FROM public.members
        WHERE member_number_year = v_year;

        NEW.member_number_year := v_year;
        NEW.member_number_seq := v_seq;
        NEW.member_number := 'BBC-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- Check if the current user is a Sunday School teacher
CREATE OR REPLACE FUNCTION public.app_is_sunday_school_teacher()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN cardinality(public.app_sunday_school_teacher_departments()) > 0;
END;
$$;

-- Check if the current user can manage a specific Sunday School department
CREATE OR REPLACE FUNCTION public.app_can_manage_sunday_school_department(target_department TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN
    public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
    OR (
      public.app_is_sunday_school_teacher()
      AND public.app_normalize_sunday_school_department(target_department) = ANY(public.app_sunday_school_teacher_departments())
    );
END;
$$;

-- Check if a member is within the teaching scope of the current teacher
CREATE OR REPLACE FUNCTION public.app_member_in_teacher_scope(target_member UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.church_positions cp
    WHERE cp.member_id = target_member
      AND cp.is_active = TRUE
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class')
      AND NOT public.app_is_sunday_school_teacher_assignment(cp.position_name, cp.specific_role, cp.is_ministry_head)
      AND public.app_sunday_school_department_key(cp.position_category, cp.department, cp.position_name, cp.specific_role)
            = ANY(public.app_sunday_school_teacher_departments())
  );
END;
$$;

-- Check if the current user can manage a specific Sunday School session
CREATE OR REPLACE FUNCTION public.app_can_manage_sunday_school_session(target_session UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.sunday_school_sessions s
    WHERE s.id = target_session
      AND public.app_can_manage_sunday_school_department(s.department)
  );
END;
$$;

-- Check if a member has any active Sunday School assignment
CREATE OR REPLACE FUNCTION public.app_member_has_sunday_school_assignment(target_member UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.church_positions cp
    WHERE cp.member_id = target_member
      AND cp.is_active = TRUE
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class')
      AND public.app_sunday_school_department_key(cp.position_category, cp.department, cp.position_name, cp.specific_role) IS NOT NULL
  );
END;
$$;

-- GRANT EXECUTE PERMISSIONS
GRANT EXECUTE ON FUNCTION public.app_current_member_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_role(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_any_role(TEXT[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_normalize_sunday_school_department(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_sunday_school_department_key(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_sunday_school_teacher_assignment(TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_sunday_school_teacher_departments() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_sunday_school_teacher() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_manage_sunday_school_department(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_member_in_teacher_scope(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_manage_sunday_school_session(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_member_has_sunday_school_assignment(UUID) TO anon, authenticated, service_role;

-- ============================================================================
-- SECTION: ROLES & AUTH
-- ============================================================================

-- Stores user role assignments linked to members
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL, -- references members(id) added later to avoid circularity during creation
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN (
    'church_administrator', 
    'pastor', 
    'church_clerk', 
    'treasurer', 
    'recording_secretary', 
    'music_minister', 
    'sunday_school_admin', 
    'goodnews_teacher', 
    'activity_coordinator', 
    'member'
  )),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_member_role UNIQUE (member_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_member_id ON public.user_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_member_role ON public.user_roles (member_id, role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_select_policy ON public.user_roles FOR SELECT 
USING (public.app_has_role('church_administrator') OR member_id = public.app_current_member_id());

CREATE POLICY user_roles_insert_policy ON public.user_roles FOR INSERT 
WITH CHECK (public.app_has_role('church_administrator'));

CREATE POLICY user_roles_update_policy ON public.user_roles FOR UPDATE 
USING (public.app_has_role('church_administrator')) 
WITH CHECK (public.app_has_role('church_administrator'));

CREATE POLICY user_roles_delete_policy ON public.user_roles FOR DELETE 
USING (public.app_has_role('church_administrator'));

-- ============================================================================
-- SECTION: MEMBERS
-- ============================================================================

-- Stores comprehensive personal and spiritual data for church members and visitors
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_number SERIAL UNIQUE NOT NULL,
  
  -- Biographical
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  name_ext TEXT,
  nickname TEXT,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  civil_status TEXT NOT NULL CHECK (civil_status IN ('Single', 'Married', 'Widow', 'Widower', 'Separated')),
  nationality TEXT NOT NULL DEFAULT 'Filipino',
  place_of_birth TEXT,
  
  -- Contact
  home_address TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  alternative_phone TEXT,
  email TEXT,
  
  -- Emergency
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Spiritual
  salvation_date DATE,
  baptism_date DATE,
  membership_date DATE,
  previous_church TEXT,
  previous_religion TEXT,
  
  -- Status
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'inactive', 'under_discipline')),
  is_regular_member BOOLEAN DEFAULT FALSE,
  is_visitor BOOLEAN DEFAULT FALSE,
  is_pastor BOOLEAN DEFAULT FALSE,
  is_pastors_wife BOOLEAN DEFAULT FALSE,

  -- Member Number System (BBC-YYYY-NNN)
  member_number TEXT UNIQUE,
  member_number_year INTEGER,
  member_number_seq INTEGER,
  legacy_v1_id UUID,
  
  -- Media
  profile_picture_url TEXT,
  id_card_url TEXT,
  attachment_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT pastor_id_check CHECK (NOT is_pastor OR id_number = 1),
  CONSTRAINT pastors_wife_id_check CHECK (NOT is_pastors_wife OR id_number = 2)
);

CREATE INDEX IF NOT EXISTS idx_members_email_lower ON public.members (lower(email));

ALTER TABLE public.user_roles ADD CONSTRAINT fk_user_roles_member FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
-- NOTE: Members RLS policies are defined AFTER church_positions table (dependency on that table in SELECT policy)

-- Tracks family connections between members and names of non-member relatives
CREATE TABLE IF NOT EXISTS public.family_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  related_member_id UUID REFERENCES public.members(id),
  non_member_name TEXT,
  relationship_type TEXT NOT NULL,
  non_member_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_relation_target CHECK (related_member_id IS NOT NULL OR non_member_name IS NOT NULL)
);

ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_relationships_select_policy ON public.family_relationships FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR member_id = public.app_current_member_id()
  OR related_member_id = public.app_current_member_id()
);

CREATE POLICY family_relationships_insert_policy ON public.family_relationships FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

CREATE POLICY family_relationships_update_policy ON public.family_relationships FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

CREATE POLICY family_relationships_delete_policy ON public.family_relationships FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

-- Stores official church positions and ministry assignments for members
CREATE TABLE IF NOT EXISTS public.church_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  position_category TEXT NOT NULL CHECK (position_category IN ('leadership', 'music_ministry', 'sunday_school_adult', 'sunday_school_children', 'beginners_class', 'other_ministries')),
  department TEXT,
  specific_role TEXT,
  is_ministry_head BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assignment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.church_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY church_positions_select_policy ON public.church_positions FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'music_minister', 'sunday_school_admin'])
  OR member_id = public.app_current_member_id()
  OR (public.app_is_sunday_school_teacher() AND position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class') 
      AND public.app_sunday_school_department_key(position_category, department, position_name, specific_role) = ANY(public.app_sunday_school_teacher_departments()))
);

CREATE POLICY church_positions_insert_policy ON public.church_positions FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

CREATE POLICY church_positions_update_policy ON public.church_positions FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

CREATE POLICY church_positions_delete_policy ON public.church_positions FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

-- Members RLS policies (placed here because members_select_policy references church_positions table)
CREATE POLICY members_select_policy ON public.members FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator'])
  OR id = public.app_current_member_id()
  OR (public.app_has_role('music_minister') AND EXISTS (
      SELECT 1 FROM public.church_positions cp 
      WHERE cp.member_id = public.members.id AND cp.position_category = 'music_ministry' AND cp.is_active = TRUE
  ))
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
);

CREATE POLICY members_insert_policy ON public.members FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND is_visitor = TRUE AND coalesce(is_regular_member, FALSE) = FALSE)
  OR (public.app_is_sunday_school_teacher() AND is_visitor = TRUE AND coalesce(is_regular_member, FALSE) = FALSE)
);

CREATE POLICY members_update_policy ON public.members FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND (is_visitor = TRUE OR public.app_member_has_sunday_school_assignment(public.members.id)))
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR public.app_has_role('sunday_school_admin')
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
);

CREATE POLICY members_delete_policy ON public.members FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

-- Captures user requests to edit member profile information for admin approval
CREATE TABLE IF NOT EXISTS public.member_profile_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  requested_by_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  request_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_profile_edit_requests_target_member ON public.member_profile_edit_requests(target_member_id);
CREATE INDEX IF NOT EXISTS idx_member_profile_edit_requests_status_created ON public.member_profile_edit_requests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_profile_edit_requests_pending_target ON public.member_profile_edit_requests(target_member_id) WHERE status = 'pending';

ALTER TABLE public.member_profile_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_profile_edit_requests_select_policy ON public.member_profile_edit_requests FOR SELECT 
USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR target_member_id = public.app_current_member_id()
  OR requested_by_member_id = public.app_current_member_id()
);

CREATE POLICY member_profile_edit_requests_insert_policy ON public.member_profile_edit_requests FOR INSERT 
WITH CHECK (
    public.app_current_member_id() IS NOT NULL
    AND target_member_id = public.app_current_member_id()
    AND (requested_by_member_id IS NULL OR requested_by_member_id = public.app_current_member_id())
    AND status = 'pending'
);

CREATE POLICY member_profile_edit_requests_update_policy ON public.member_profile_edit_requests FOR UPDATE 
USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) 
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

CREATE POLICY member_profile_edit_requests_delete_policy ON public.member_profile_edit_requests FOR DELETE 
USING (public.app_has_role('church_administrator'));

-- ============================================================================
-- SECTION: SERVICES
-- ============================================================================

-- Stores records for church services including attendance metrics and sermon info
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN ('sunday_morning', 'sunday_afternoon', 'wednesday_prayer', 'pre_service', 'funeral')),
  service_date DATE NOT NULL,
  service_time TIME,
  
  members_present INTEGER NOT NULL DEFAULT 0,
  total_attendance INTEGER NOT NULL DEFAULT 0,
  visitors_present INTEGER NOT NULL DEFAULT 0,
  visitors_saved INTEGER NOT NULL DEFAULT 0,
  
  prospects_for_baptism INTEGER DEFAULT 0,
  souls_saved INTEGER NOT NULL DEFAULT 0,
  members_who_prayed INTEGER DEFAULT 0,
  
  visitor_card_url TEXT,
  sermon_title TEXT,
  sermon_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_v1_id UUID,

  
  UNIQUE(service_date, service_type),
  CONSTRAINT services_primary_results_only_chk CHECK (
    service_type IN ('sunday_morning', 'sunday_afternoon', 'wednesday_prayer')
    OR (coalesce(visitors_present, 0) = 0 AND coalesce(visitors_saved, 0) = 0 AND coalesce(souls_saved, 0) = 0)
  )
);
-- NOTE: Services RLS policies are defined AFTER attendance_log table (dependency on that table in SELECT policy)

-- Individual attendance logs for services, activities, Sunday School, and music practices
CREATE TABLE IF NOT EXISTS public.attendance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('service', 'activity', 'sunday_school', 'music_practice')),
  event_id UUID NOT NULL, -- references one of the session/service tables depending on type
  event_date DATE NOT NULL,
  was_present BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, event_type, event_id)
);

-- Services RLS policies (placed here because services_select_policy references attendance_log table)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY services_select_policy ON public.services FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin'])
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'service' AND al.event_id = public.services.id AND al.member_id = public.app_current_member_id())
);

CREATE POLICY services_insert_policy ON public.services FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

CREATE POLICY services_update_policy ON public.services FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

CREATE POLICY services_delete_policy ON public.services FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

ALTER TABLE public.attendance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_log_select_policy ON public.attendance_log FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR member_id = public.app_current_member_id()
);

CREATE POLICY attendance_log_insert_policy ON public.attendance_log FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

CREATE POLICY attendance_log_update_policy ON public.attendance_log FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

CREATE POLICY attendance_log_delete_policy ON public.attendance_log FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

-- Stores visitor information and tracking for follow-ups and service attendance
CREATE TABLE IF NOT EXISTS public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  office_address TEXT,
  marital_status TEXT NOT NULL,
  gender TEXT NOT NULL,
  church_name TEXT,
  age INTEGER,
  date_of_birth DATE,
  contact_number TEXT NOT NULL,
  invited_by TEXT,
  
  visit_time TEXT CHECK (visit_time IN ('AM', 'PM')),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_id UUID REFERENCES public.services(id),
  sunday_school_session_id UUID,
  
  address_sketch_url TEXT,
  visitor_card_image_url TEXT,
  visitor_card_images TEXT[] DEFAULT '{}',
  
  is_saved BOOLEAN DEFAULT FALSE,
  is_prospect_for_baptism BOOLEAN DEFAULT FALSE,
  follow_up_status TEXT NOT NULL DEFAULT 'pending',
  
  converted_to_member BOOLEAN DEFAULT FALSE,
  conversion_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitors_service_id ON public.visitors(service_id);
CREATE INDEX IF NOT EXISTS idx_visitors_sunday_school_session_id ON public.visitors(sunday_school_session_id);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY visitors_select_policy ON public.visitors FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id))
);

CREATE POLICY visitors_insert_policy ON public.visitors FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id))
);

CREATE POLICY visitors_update_policy ON public.visitors FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id))
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id))
);

CREATE POLICY visitors_delete_policy ON public.visitors FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id))
);

-- ============================================================================
-- SECTION: SERVICE ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('songleader', 'pastor', 'moderator', 'pianist', 'technicals', 'mini_ensemble', 'usher', 'choir', 'preacher', 'worship_leader', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, member_id, role)
);
ALTER TABLE public.service_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_assignments_select_policy ON public.service_assignments FOR SELECT USING (TRUE);
CREATE POLICY service_assignments_insert_policy ON public.service_assignments FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary']));
CREATE POLICY service_assignments_update_policy ON public.service_assignments FOR UPDATE USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary'])) WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary']));
CREATE POLICY service_assignments_delete_policy ON public.service_assignments FOR DELETE USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary']));

-- ============================================================================
-- SECTION: SUNDAY SCHOOL
-- ============================================================================

-- Records Sunday School session demographics and attendance across departments
CREATE TABLE IF NOT EXISTS public.sunday_school_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL CHECK (department IN ('adult', 'beginners', 'nursery', 'kinder', 'primary', 'junior')),
  session_date DATE NOT NULL,
  members_present INTEGER DEFAULT 0,
  total_attendance INTEGER DEFAULT 0,
  souls_saved INTEGER DEFAULT 0,
  visitors_present INTEGER DEFAULT 0,
  visitor_card_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_v1_id UUID
);

ALTER TABLE public.visitors ADD CONSTRAINT fk_visitors_sunday_school_session FOREIGN KEY (sunday_school_session_id) REFERENCES public.sunday_school_sessions(id);

ALTER TABLE public.sunday_school_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sunday_school_sessions_select_policy ON public.sunday_school_sessions FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(public.sunday_school_sessions.department)
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'sunday_school' AND al.event_id = public.sunday_school_sessions.id AND al.member_id = public.app_current_member_id())
);

CREATE POLICY sunday_school_sessions_insert_policy ON public.sunday_school_sessions FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

CREATE POLICY sunday_school_sessions_update_policy ON public.sunday_school_sessions FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

CREATE POLICY sunday_school_sessions_delete_policy ON public.sunday_school_sessions FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

-- ============================================================================
-- SECTION: FINANCIAL
-- ============================================================================

-- Stores all financial contributions including tithes, faith promise, and pledges
CREATE TABLE IF NOT EXISTS public.financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('tithe', 'faith_promise', 'love_gift', 'pledge')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  pledge_purpose TEXT,
  faith_promise_year INTEGER,
  notes TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id),
  legacy_v1_id UUID
);

ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_records_select_policy ON public.financial_records FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer'])
  OR member_id = public.app_current_member_id()
);

CREATE POLICY financial_records_insert_policy ON public.financial_records FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'treasurer']));

CREATE POLICY financial_records_update_policy ON public.financial_records FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'treasurer'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'treasurer']));

CREATE POLICY financial_records_delete_policy ON public.financial_records FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'treasurer']));

-- Tracks annual faith promise commitments for members from year to year
CREATE TABLE IF NOT EXISTS public.faith_promise_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  promised_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_v1_id UUID,
  UNIQUE(member_id, year)
);

ALTER TABLE public.faith_promise_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY faith_promise_commitments_select_policy ON public.faith_promise_commitments FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer'])
  OR member_id = public.app_current_member_id()
);

CREATE POLICY faith_promise_commitments_insert_policy ON public.faith_promise_commitments FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer']));

CREATE POLICY faith_promise_commitments_update_policy ON public.faith_promise_commitments FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer']));

CREATE POLICY faith_promise_commitments_delete_policy ON public.faith_promise_commitments FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer']));

-- ============================================================================
-- SECTION: ACTIVITIES
-- ============================================================================

-- Records outreach, soul winning, and special church activities/events
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('goodnews_class', 'soul_winning', 'bible_study', 'outreach')),
  activity_date DATE NOT NULL,
  members_present INTEGER DEFAULT 0,
  non_member_attendance INTEGER NOT NULL DEFAULT 0,
  total_attendance INTEGER DEFAULT 0,
  kids_attended INTEGER DEFAULT 0,
  area TEXT,
  souls_saved INTEGER DEFAULT 0,
  tracts_distributed INTEGER DEFAULT 0,
  facebook_post_link TEXT,
  bible_study_type TEXT,
  family_name TEXT,
  mission_church_name TEXT,
  attachment_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY activities_select_policy ON public.activities FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator'])
);

CREATE POLICY activities_insert_policy ON public.activities FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'activity_coordinator']));

CREATE POLICY activities_update_policy ON public.activities FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'activity_coordinator'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'activity_coordinator']));

CREATE POLICY activities_delete_policy ON public.activities FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'activity_coordinator']));

-- ============================================================================
-- SECTION: MUSIC
-- ============================================================================

-- Tracks choir and ensemble practice sessions including time windows and attendance
CREATE TABLE IF NOT EXISTS public.music_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_type TEXT NOT NULL CHECK (practice_type IN ('choir', 'mini_ensemble')),
  practice_date DATE NOT NULL,
  practice_start_time TIME NOT NULL DEFAULT '18:30:00',
  practice_end_time TIME NOT NULL DEFAULT '20:30:00',
  members_present INTEGER DEFAULT 0,
  non_member_attendance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_v1_id UUID
);

ALTER TABLE public.music_practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY music_practice_sessions_select_policy ON public.music_practice_sessions FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'music_minister']));

CREATE POLICY music_practice_sessions_insert_policy ON public.music_practice_sessions FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'music_minister']));

CREATE POLICY music_practice_sessions_update_policy ON public.music_practice_sessions FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'music_minister'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'music_minister']));

CREATE POLICY music_practice_sessions_delete_policy ON public.music_practice_sessions FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'music_minister']));

-- ============================================================================
-- SECTION: SYSTEM & AUDIT
-- ============================================================================

-- Stores global application configuration preferences and church metadata
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_name TEXT NOT NULL DEFAULT 'Bible Baptist Church',
  system_name TEXT NOT NULL DEFAULT 'Church Management System',
  church_address TEXT NOT NULL,
  church_logo_url TEXT,
  system_version TEXT DEFAULT 'v1.0.0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_settings_select_policy ON public.system_settings FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY system_settings_insert_policy ON public.system_settings FOR INSERT WITH CHECK (public.app_has_role('church_administrator'));

CREATE POLICY system_settings_update_policy ON public.system_settings FOR UPDATE USING (public.app_has_role('church_administrator')) WITH CHECK (public.app_has_role('church_administrator'));

CREATE POLICY system_settings_delete_policy ON public.system_settings FOR DELETE USING (public.app_has_role('church_administrator'));

-- Generic audit trail for tracking sensitive data changes across the system
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_policy ON public.audit_log FOR SELECT USING (public.app_has_role('church_administrator'));

CREATE POLICY audit_log_insert_policy ON public.audit_log FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'treasurer']));

-- High-level log for system data migration events (CSV/TSV imports and exports)
CREATE TABLE IF NOT EXISTS public.import_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  file_format TEXT DEFAULT 'TSV',
  file_url TEXT,
  records_processed INTEGER,
  records_successful INTEGER,
  records_failed INTEGER,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.import_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_export_log_select_policy ON public.import_export_log FOR SELECT USING (public.app_has_role('church_administrator'));

CREATE POLICY import_export_log_insert_policy ON public.import_export_log FOR INSERT WITH CHECK (public.app_has_role('church_administrator'));

CREATE POLICY import_export_log_update_policy ON public.import_export_log FOR UPDATE USING (public.app_has_role('church_administrator')) WITH CHECK (public.app_has_role('church_administrator'));

CREATE POLICY import_export_log_delete_policy ON public.import_export_log FOR DELETE USING (public.app_has_role('church_administrator'));

-- ============================================================================
-- SECTION: TRIGGERS & FINAL SYNC
-- ============================================================================

-- Automates membership status and dates when a baptism date is recorded
CREATE OR REPLACE FUNCTION sync_membership_baptism() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.baptism_date IS NOT NULL THEN
    NEW.membership_date = NEW.baptism_date;
    NEW.is_regular_member = TRUE;
    NEW.is_visitor = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_membership_baptism ON public.members;
CREATE TRIGGER trigger_sync_membership_baptism
BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION sync_membership_baptism();

-- Enforces fixed id_numbers for specialized roles (Pastor and Pastor's Wife)
CREATE OR REPLACE FUNCTION enforce_fixed_ids() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_pastor THEN NEW.id_number = 1;
  ELSIF NEW.is_pastors_wife THEN NEW.id_number = 2;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_fixed_ids ON public.members;
CREATE TRIGGER trigger_enforce_fixed_ids
BEFORE INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION enforce_fixed_ids();

-- Automatically assigns a human-readable member number on creation
DROP TRIGGER IF EXISTS trigger_set_member_number ON public.members;
CREATE TRIGGER trigger_set_member_number
BEFORE INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.set_member_number();

-- Automatically records changes to financial data in the audit log
CREATE OR REPLACE FUNCTION audit_financial_changes() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action_type, table_name, record_id, old_values, new_values, description)
  VALUES (auth.uid(), TG_OP, 'financial_records', COALESCE(NEW.id, OLD.id), to_jsonb(OLD), to_jsonb(NEW), 'Financial Record Change');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_financial ON public.financial_records;
CREATE TRIGGER trigger_audit_financial
AFTER UPDATE OR DELETE ON public.financial_records
FOR EACH ROW EXECUTE PROCEDURE audit_financial_changes();

-- Stores conflicts encountered during data import/migration for manual resolution
CREATE TABLE IF NOT EXISTS public.import_conflicts (
  id BIGSERIAL PRIMARY KEY,
  import_type TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  conflict_reason TEXT NOT NULL,
  candidate_ids JSONB,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_conflicts_type ON public.import_conflicts(import_type);
CREATE INDEX IF NOT EXISTS idx_import_conflicts_reason ON public.import_conflicts(conflict_reason);

