-- ============================================================================
-- BBC VALENCIA CHURCH MANAGEMENT SYSTEM - SCHEMA V2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Check if the current user has a specific role using member_id
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

-- Check if the current user has any of the specified roles using member_id
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

-- ============================================================================
-- SPECIFIC ROLE SHORTCUTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.app_is_church_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_administrator'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_treasurer()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('treasurer'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_pastor()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('pastor'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_recording_secretary()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('recording_secretary'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_goodnews_teacher()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('goodnews_teacher'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_church_clerk()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_clerk'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_activity_coordinator()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('activity_coordinator'); END; $$;

-- ============================================================================
-- SUNDAY SCHOOL SPECIFIC HELPERS
-- ============================================================================

-- Normalize Sunday School department names
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
  -- 1. Nursery (Ages 0-2)
  IF normalized LIKE '%nursery%' OR normalized LIKE '%toddler%' OR normalized LIKE '%baby%' OR normalized LIKE '%infant%' THEN
    RETURN 'nursery';
  END IF;

  -- 2. Kinder (Ages 3-5)
  IF normalized LIKE '%kinder%' OR normalized LIKE '%kindergarten%' OR normalized LIKE '%prep%' THEN
    RETURN 'kinder';
  END IF;

  -- 3. Primary (Ages 6-8)
  IF normalized LIKE '%primary%' OR normalized LIKE '%elementary%' OR normalized LIKE '%kids%' OR normalized LIKE '%children%' THEN
    RETURN 'primary';
  END IF;

  -- 4. Junior (Ages 9-12)
  IF normalized LIKE '%junior%' OR normalized LIKE '%youth%' OR normalized LIKE '%teen%' OR normalized LIKE '%high school%' THEN
    RETURN 'junior';
  END IF;

  -- 5. Beginners
  IF normalized LIKE '%beginner%' THEN
    RETURN 'beginners';
  END IF;

  -- 6. Adult
  IF normalized LIKE '%adult%' OR normalized LIKE '%men%' OR normalized LIKE '%women%' OR normalized LIKE '%senior%' OR normalized LIKE '%couple%' THEN
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

  IF position_category = 'nursery_class' THEN
    RETURN 'nursery';
  END IF;

  IF position_category = 'kinder_class' THEN
    RETURN 'kinder';
  END IF;

  IF position_category = 'sunday_school_children' THEN
    RETURN 'primary'; 
  END IF;

  IF position_category = 'beginners_class' THEN
    RETURN 'beginners';
  END IF;
  
  IF position_category = 'sunday_school_adult' THEN
    RETURN 'adult';
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
  dept_rec RECORD;
  final_depts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. Check database roles
  IF public.app_has_role('sunday_school_teacher_beginners') THEN
    final_depts := array_append(final_depts, 'beginners');
  END IF;

  IF public.app_has_role('sunday_school_teacher_children') THEN
    final_depts := array_cat(final_depts, ARRAY['nursery', 'kinder', 'primary', 'junior']::TEXT[]);
  END IF;

  IF public.app_has_role('sunday_school_teacher_adult') THEN
    final_depts := array_append(final_depts, 'adult');
  END IF;

  -- 2. Check position assignments (backwards compatibility)
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

-- ============================================================================
-- COMMON TRIGGERS
-- ============================================================================

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


-- ============================================================================
-- BBC VALENCIA CHURCH MANAGEMENT SYSTEM - SCHEMA V2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Check if the current user has a specific role using member_id
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

-- Check if the current user has any of the specified roles using member_id
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

-- ============================================================================
-- SPECIFIC ROLE SHORTCUTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.app_is_church_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_administrator'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_treasurer()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('treasurer'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_pastor()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('pastor'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_recording_secretary()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('recording_secretary'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_goodnews_teacher()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('goodnews_teacher'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_church_clerk()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_clerk'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_activity_coordinator()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('activity_coordinator'); END; $$;

-- ============================================================================
-- SUNDAY SCHOOL SPECIFIC HELPERS
-- ============================================================================

-- Normalize Sunday School department names
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
  -- 1. Nursery (Ages 0-2)
  IF normalized LIKE '%nursery%' OR normalized LIKE '%toddler%' OR normalized LIKE '%baby%' OR normalized LIKE '%infant%' THEN
    RETURN 'nursery';
  END IF;

  -- 2. Kinder (Ages 3-5)
  IF normalized LIKE '%kinder%' OR normalized LIKE '%kindergarten%' OR normalized LIKE '%prep%' THEN
    RETURN 'kinder';
  END IF;

  -- 3. Primary (Ages 6-8)
  IF normalized LIKE '%primary%' OR normalized LIKE '%elementary%' OR normalized LIKE '%kids%' OR normalized LIKE '%children%' THEN
    RETURN 'primary';
  END IF;

  -- 4. Junior (Ages 9-12)
  IF normalized LIKE '%junior%' OR normalized LIKE '%youth%' OR normalized LIKE '%teen%' OR normalized LIKE '%high school%' THEN
    RETURN 'junior';
  END IF;

  -- 5. Beginners
  IF normalized LIKE '%beginner%' THEN
    RETURN 'beginners';
  END IF;

  -- 6. Adult
  IF normalized LIKE '%adult%' OR normalized LIKE '%men%' OR normalized LIKE '%women%' OR normalized LIKE '%senior%' OR normalized LIKE '%couple%' THEN
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

  IF position_category = 'nursery_class' THEN
    RETURN 'nursery';
  END IF;

  IF position_category = 'kinder_class' THEN
    RETURN 'kinder';
  END IF;

  IF position_category = 'sunday_school_children' THEN
    RETURN 'primary'; 
  END IF;

  IF position_category = 'beginners_class' THEN
    RETURN 'beginners';
  END IF;
  
  IF position_category = 'sunday_school_adult' THEN
    RETURN 'adult';
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
  dept_rec RECORD;
  final_depts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. Check database roles
  IF public.app_has_role('sunday_school_teacher_beginners') THEN
    final_depts := array_append(final_depts, 'beginners');
  END IF;

  IF public.app_has_role('sunday_school_teacher_children') THEN
    final_depts := array_cat(final_depts, ARRAY['nursery', 'kinder', 'primary', 'junior']::TEXT[]);
  END IF;

  IF public.app_has_role('sunday_school_teacher_adult') THEN
    final_depts := array_append(final_depts, 'adult');
  END IF;

  -- 2. Check position assignments (backwards compatibility)
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

-- ============================================================================
-- COMMON TRIGGERS
-- ============================================================================

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


-- ============================================================================
-- BBC VALENCIA CHURCH MANAGEMENT SYSTEM - SCHEMA V2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Check if the current user has a specific role using member_id
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

-- Check if the current user has any of the specified roles using member_id
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

-- ============================================================================
-- SPECIFIC ROLE SHORTCUTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.app_is_church_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_administrator'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_treasurer()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('treasurer'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_pastor()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('pastor'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_recording_secretary()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('recording_secretary'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_goodnews_teacher()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('goodnews_teacher'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_church_clerk()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_clerk'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_activity_coordinator()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('activity_coordinator'); END; $$;

-- ============================================================================
-- SUNDAY SCHOOL SPECIFIC HELPERS
-- ============================================================================

-- Normalize Sunday School department names
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
  -- 1. Nursery (Ages 0-2)
  IF normalized LIKE '%nursery%' OR normalized LIKE '%toddler%' OR normalized LIKE '%baby%' OR normalized LIKE '%infant%' THEN
    RETURN 'nursery';
  END IF;

  -- 2. Kinder (Ages 3-5)
  IF normalized LIKE '%kinder%' OR normalized LIKE '%kindergarten%' OR normalized LIKE '%prep%' THEN
    RETURN 'kinder';
  END IF;

  -- 3. Primary (Ages 6-8)
  IF normalized LIKE '%primary%' OR normalized LIKE '%elementary%' OR normalized LIKE '%kids%' OR normalized LIKE '%children%' THEN
    RETURN 'primary';
  END IF;

  -- 4. Junior (Ages 9-12)
  IF normalized LIKE '%junior%' OR normalized LIKE '%youth%' OR normalized LIKE '%teen%' OR normalized LIKE '%high school%' THEN
    RETURN 'junior';
  END IF;

  -- 5. Beginners
  IF normalized LIKE '%beginner%' THEN
    RETURN 'beginners';
  END IF;

  -- 6. Adult
  IF normalized LIKE '%adult%' OR normalized LIKE '%men%' OR normalized LIKE '%women%' OR normalized LIKE '%senior%' OR normalized LIKE '%couple%' THEN
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

  IF position_category = 'nursery_class' THEN
    RETURN 'nursery';
  END IF;

  IF position_category = 'kinder_class' THEN
    RETURN 'kinder';
  END IF;

  IF position_category = 'sunday_school_children' THEN
    RETURN 'primary'; 
  END IF;

  IF position_category = 'beginners_class' THEN
    RETURN 'beginners';
  END IF;
  
  IF position_category = 'sunday_school_adult' THEN
    RETURN 'adult';
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

-- ============================================================================
-- COMMON TRIGGERS
-- ============================================================================

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


-- ============================================================================
-- BBC VALENCIA CHURCH MANAGEMENT SYSTEM - SCHEMA V2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Check if the current user has a specific role using member_id
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

-- Check if the current user has any of the specified roles using member_id
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

-- ============================================================================
-- SPECIFIC ROLE SHORTCUTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.app_is_church_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_administrator'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_treasurer()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('treasurer'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_pastor()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('pastor'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_recording_secretary()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('recording_secretary'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_goodnews_teacher()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('goodnews_teacher'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_church_clerk()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_clerk'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_activity_coordinator()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('activity_coordinator'); END; $$;

-- ============================================================================
-- SUNDAY SCHOOL SPECIFIC HELPERS
-- ============================================================================

-- Normalize Sunday School department names
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
  -- 1. Nursery (Ages 0-2)
  IF normalized LIKE '%nursery%' OR normalized LIKE '%toddler%' OR normalized LIKE '%baby%' OR normalized LIKE '%infant%' THEN
    RETURN 'nursery';
  END IF;

  -- 2. Kinder (Ages 3-5)
  IF normalized LIKE '%kinder%' OR normalized LIKE '%kindergarten%' OR normalized LIKE '%prep%' THEN
    RETURN 'kinder';
  END IF;

  -- 3. Primary (Ages 6-8)
  IF normalized LIKE '%primary%' OR normalized LIKE '%elementary%' OR normalized LIKE '%kids%' OR normalized LIKE '%children%' THEN
    RETURN 'primary';
  END IF;

  -- 4. Junior (Ages 9-12)
  IF normalized LIKE '%junior%' OR normalized LIKE '%youth%' OR normalized LIKE '%teen%' OR normalized LIKE '%high school%' THEN
    RETURN 'junior';
  END IF;

  -- 5. Beginners
  IF normalized LIKE '%beginner%' THEN
    RETURN 'beginners';
  END IF;

  -- 6. Adult
  IF normalized LIKE '%adult%' OR normalized LIKE '%men%' OR normalized LIKE '%women%' OR normalized LIKE '%senior%' OR normalized LIKE '%couple%' THEN
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

  IF position_category = 'nursery_class' THEN
    RETURN 'nursery';
  END IF;

  IF position_category = 'kinder_class' THEN
    RETURN 'kinder';
  END IF;

  IF position_category = 'sunday_school_children' THEN
    RETURN 'primary'; 
  END IF;

  IF position_category = 'beginners_class' THEN
    RETURN 'beginners';
  END IF;
  
  IF position_category = 'sunday_school_adult' THEN
    RETURN 'adult';
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

-- ============================================================================
-- COMMON TRIGGERS
-- ============================================================================

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


-- ============================================================================
-- BBC VALENCIA CHURCH MANAGEMENT SYSTEM - SCHEMA V2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Check if the current user has a specific role using member_id
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

-- Check if the current user has any of the specified roles using member_id
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

-- ============================================================================
-- SPECIFIC ROLE SHORTCUTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.app_is_church_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_administrator'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_treasurer()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('treasurer'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_pastor()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('pastor'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_recording_secretary()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('recording_secretary'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_goodnews_teacher()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('goodnews_teacher'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_church_clerk()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_clerk'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_activity_coordinator()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('activity_coordinator'); END; $$;

-- ============================================================================
-- SUNDAY SCHOOL SPECIFIC HELPERS
-- ============================================================================

-- Normalize Sunday School department names
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
  -- 1. Nursery (Ages 0-2)
  IF normalized LIKE '%nursery%' OR normalized LIKE '%toddler%' OR normalized LIKE '%baby%' OR normalized LIKE '%infant%' THEN
    RETURN 'nursery';
  END IF;

  -- 2. Kinder (Ages 3-5)
  IF normalized LIKE '%kinder%' OR normalized LIKE '%kindergarten%' OR normalized LIKE '%prep%' THEN
    RETURN 'kinder';
  END IF;

  -- 3. Primary (Ages 6-8)
  IF normalized LIKE '%primary%' OR normalized LIKE '%elementary%' OR normalized LIKE '%kids%' OR normalized LIKE '%children%' THEN
    RETURN 'primary';
  END IF;

  -- 4. Junior (Ages 9-12)
  IF normalized LIKE '%junior%' OR normalized LIKE '%youth%' OR normalized LIKE '%teen%' OR normalized LIKE '%high school%' THEN
    RETURN 'junior';
  END IF;

  -- 5. Beginners
  IF normalized LIKE '%beginner%' THEN
    RETURN 'beginners';
  END IF;

  -- 6. Adult
  IF normalized LIKE '%adult%' OR normalized LIKE '%men%' OR normalized LIKE '%women%' OR normalized LIKE '%senior%' OR normalized LIKE '%couple%' THEN
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

  IF position_category = 'nursery_class' THEN
    RETURN 'nursery';
  END IF;

  IF position_category = 'kinder_class' THEN
    RETURN 'kinder';
  END IF;

  IF position_category = 'sunday_school_children' THEN
    RETURN 'primary'; 
  END IF;

  IF position_category = 'beginners_class' THEN
    RETURN 'beginners';
  END IF;
  
  IF position_category = 'sunday_school_adult' THEN
    RETURN 'adult';
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
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class', 'nursery_class', 'kinder_class')
      AND public.app_is_sunday_school_teacher_assignment(cp.position_name, cp.specific_role, cp.is_ministry_head)
  ) q
  WHERE dept IS NOT NULL;
  RETURN result;
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

-- ============================================================================
-- COMMON TRIGGERS
-- ============================================================================

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


-- ============================================================================
-- BBC VALENCIA CHURCH MANAGEMENT SYSTEM - SCHEMA V2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Safe to re-run: all policies dropped and recreated

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

-- Check if the current user has a specific role using member_id
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

-- Check if the current user has any of the specified roles using member_id
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

-- ============================================================================
-- SPECIFIC ROLE SHORTCUTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.app_is_church_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_administrator'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_treasurer()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('treasurer'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_pastor()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('pastor'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_recording_secretary()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('recording_secretary'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_goodnews_teacher()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('goodnews_teacher'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_church_clerk()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('church_clerk'); END; $$;

CREATE OR REPLACE FUNCTION public.app_is_activity_coordinator()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN public.app_has_role('activity_coordinator'); END; $$;

-- ============================================================================
-- SUNDAY SCHOOL SPECIFIC HELPERS
-- ============================================================================

-- Normalize Sunday School department names
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
  -- 1. Nursery (Ages 0-2)
  IF normalized LIKE '%nursery%' OR normalized LIKE '%toddler%' OR normalized LIKE '%baby%' OR normalized LIKE '%infant%' THEN
    RETURN 'nursery';
  END IF;

  -- 2. Kinder (Ages 3-5)
  IF normalized LIKE '%kinder%' OR normalized LIKE '%kindergarten%' OR normalized LIKE '%prep%' THEN
    RETURN 'kinder';
  END IF;

  -- 3. Primary (Ages 6-8)
  IF normalized LIKE '%primary%' OR normalized LIKE '%elementary%' OR normalized LIKE '%kids%' OR normalized LIKE '%children%' THEN
    RETURN 'primary';
  END IF;

  -- 4. Junior (Ages 9-12)
  IF normalized LIKE '%junior%' OR normalized LIKE '%youth%' OR normalized LIKE '%teen%' OR normalized LIKE '%high school%' THEN
    RETURN 'junior';
  END IF;

  -- 5. Beginners
  IF normalized LIKE '%beginner%' THEN
    RETURN 'beginners';
  END IF;

  -- 6. Adult
  IF normalized LIKE '%adult%' OR normalized LIKE '%men%' OR normalized LIKE '%women%' OR normalized LIKE '%senior%' OR normalized LIKE '%couple%' THEN
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

  IF position_category = 'nursery_class' THEN
    RETURN 'nursery';
  END IF;

  IF position_category = 'kinder_class' THEN
    RETURN 'kinder';
  END IF;

  IF position_category = 'sunday_school_children' THEN
    RETURN 'primary'; 
  END IF;

  IF position_category = 'beginners_class' THEN
    RETURN 'beginners';
  END IF;
  
  IF position_category = 'sunday_school_adult' THEN
    RETURN 'adult';
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
      AND cp.position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class', 'nursery_class', 'kinder_class')
      AND public.app_is_sunday_school_teacher_assignment(cp.position_name, cp.specific_role, cp.is_ministry_head)
  ) q
  WHERE dept IS NOT NULL;
  RETURN result;
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

-- ============================================================================
-- COMMON TRIGGERS
-- ============================================================================

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

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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
    'member',
    'sunday_school_teacher_beginners',
    'sunday_school_teacher_children',
    'sunday_school_teacher_adult'
  )),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_member_role UNIQUE (member_id, role)
);

DROP INDEX IF EXISTS idx_user_roles_member_id;
CREATE INDEX IF NOT EXISTS idx_user_roles_member_id ON public.user_roles(member_id);
DROP INDEX IF EXISTS idx_user_roles_role;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
DROP INDEX IF EXISTS idx_user_roles_member_role;
CREATE INDEX IF NOT EXISTS idx_user_roles_member_role ON public.user_roles (member_id, role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select_policy ON public.user_roles;
CREATE POLICY user_roles_select_policy ON public.user_roles FOR SELECT 
USING (public.app_has_role('church_administrator') OR member_id = public.app_current_member_id());

DROP POLICY IF EXISTS user_roles_insert_policy ON public.user_roles;
CREATE POLICY user_roles_insert_policy ON public.user_roles FOR INSERT 
WITH CHECK (public.app_has_role('church_administrator'));

DROP POLICY IF EXISTS user_roles_update_policy ON public.user_roles;
CREATE POLICY user_roles_update_policy ON public.user_roles FOR UPDATE 
USING (public.app_has_role('church_administrator')) 
WITH CHECK (public.app_has_role('church_administrator'));

DROP POLICY IF EXISTS user_roles_delete_policy ON public.user_roles;
CREATE POLICY user_roles_delete_policy ON public.user_roles FOR DELETE 
USING (public.app_has_role('church_administrator'));

-- ============================================================================
-- SECTION: MEMBERS
-- ============================================================================

-- Stores comprehensive personal and spiritual data for church members and visitors
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
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
  deleted_at TIMESTAMPTZ
);

DROP INDEX IF EXISTS idx_members_email_lower;
CREATE INDEX IF NOT EXISTS idx_members_email_lower ON public.members (lower(email));

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS fk_user_roles_member;
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

DROP POLICY IF EXISTS family_relationships_select_policy ON public.family_relationships;
CREATE POLICY family_relationships_select_policy ON public.family_relationships FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR member_id = public.app_current_member_id()
  OR related_member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS family_relationships_insert_policy ON public.family_relationships;
CREATE POLICY family_relationships_insert_policy ON public.family_relationships FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS family_relationships_update_policy ON public.family_relationships;
CREATE POLICY family_relationships_update_policy ON public.family_relationships FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS family_relationships_delete_policy ON public.family_relationships;
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

DROP POLICY IF EXISTS church_positions_select_policy ON public.church_positions;
CREATE POLICY church_positions_select_policy ON public.church_positions FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'music_minister', 'sunday_school_admin'])
  OR member_id = public.app_current_member_id()
  OR (public.app_is_sunday_school_teacher() AND position_category IN ('sunday_school_adult', 'sunday_school_children', 'beginners_class') 
      AND public.app_sunday_school_department_key(position_category, department, position_name, specific_role) = ANY(public.app_sunday_school_teacher_departments()))
);

DROP POLICY IF EXISTS church_positions_insert_policy ON public.church_positions;
CREATE POLICY church_positions_insert_policy ON public.church_positions FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS church_positions_update_policy ON public.church_positions;
CREATE POLICY church_positions_update_policy ON public.church_positions FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS church_positions_delete_policy ON public.church_positions;
CREATE POLICY church_positions_delete_policy ON public.church_positions FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

-- Members RLS policies (placed here because members_select_policy references church_positions table)
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

DROP POLICY IF EXISTS members_insert_policy ON public.members;
CREATE POLICY members_insert_policy ON public.members FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
);

DROP POLICY IF EXISTS members_update_policy ON public.members;
CREATE POLICY members_update_policy ON public.members FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND public.app_member_has_sunday_school_assignment(public.members.id))
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR public.app_has_role('sunday_school_admin')
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
);

DROP POLICY IF EXISTS members_delete_policy ON public.members;
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

DROP INDEX IF EXISTS idx_member_profile_edit_requests_target_member;
CREATE INDEX IF NOT EXISTS idx_member_profile_edit_requests_target_member ON public.member_profile_edit_requests(target_member_id);
DROP INDEX IF EXISTS idx_member_profile_edit_requests_status_created;
CREATE INDEX IF NOT EXISTS idx_member_profile_edit_requests_status_created ON public.member_profile_edit_requests(status, created_at DESC);
DROP INDEX IF EXISTS uq_member_profile_edit_requests_pending_target;
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_profile_edit_requests_pending_target ON public.member_profile_edit_requests(target_member_id) WHERE status = 'pending';

ALTER TABLE public.member_profile_edit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_profile_edit_requests_select_policy ON public.member_profile_edit_requests;
CREATE POLICY member_profile_edit_requests_select_policy ON public.member_profile_edit_requests FOR SELECT 
USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR target_member_id = public.app_current_member_id()
  OR requested_by_member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS member_profile_edit_requests_insert_policy ON public.member_profile_edit_requests;
CREATE POLICY member_profile_edit_requests_insert_policy ON public.member_profile_edit_requests FOR INSERT 
WITH CHECK (
    public.app_current_member_id() IS NOT NULL
    AND target_member_id = public.app_current_member_id()
    AND (requested_by_member_id IS NULL OR requested_by_member_id = public.app_current_member_id())
    AND status = 'pending'
);

DROP POLICY IF EXISTS member_profile_edit_requests_update_policy ON public.member_profile_edit_requests;
CREATE POLICY member_profile_edit_requests_update_policy ON public.member_profile_edit_requests FOR UPDATE 
USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) 
WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS member_profile_edit_requests_delete_policy ON public.member_profile_edit_requests;
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

DROP POLICY IF EXISTS services_select_policy ON public.services;
CREATE POLICY services_select_policy ON public.services FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'recording_secretary'])
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'service' AND al.event_id::text = public.services.id::text AND al.member_id = public.app_current_member_id())
);

DROP POLICY IF EXISTS services_insert_policy ON public.services;
CREATE POLICY services_insert_policy ON public.services FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS services_update_policy ON public.services;
CREATE POLICY services_update_policy ON public.services FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS services_delete_policy ON public.services;
CREATE POLICY services_delete_policy ON public.services FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk']));

ALTER TABLE public.attendance_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_log_select_policy ON public.attendance_log;
CREATE POLICY attendance_log_select_policy ON public.attendance_log FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS attendance_log_insert_policy ON public.attendance_log;
CREATE POLICY attendance_log_insert_policy ON public.attendance_log FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

DROP POLICY IF EXISTS attendance_log_update_policy ON public.attendance_log;
CREATE POLICY attendance_log_update_policy ON public.attendance_log FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

DROP POLICY IF EXISTS attendance_log_delete_policy ON public.attendance_log;
CREATE POLICY attendance_log_delete_policy ON public.attendance_log FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
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

DROP INDEX IF EXISTS idx_visitors_service_id;
CREATE INDEX IF NOT EXISTS idx_visitors_service_id ON public.visitors(service_id);
DROP INDEX IF EXISTS idx_visitors_sunday_school_session_id;
CREATE INDEX IF NOT EXISTS idx_visitors_sunday_school_session_id ON public.visitors(sunday_school_session_id);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visitors_select_policy ON public.visitors;
CREATE POLICY visitors_select_policy ON public.visitors FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

DROP POLICY IF EXISTS visitors_insert_policy ON public.visitors;
CREATE POLICY visitors_insert_policy ON public.visitors FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

DROP POLICY IF EXISTS visitors_update_policy ON public.visitors;
CREATE POLICY visitors_update_policy ON public.visitors FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

DROP POLICY IF EXISTS visitors_delete_policy ON public.visitors;
CREATE POLICY visitors_delete_policy ON public.visitors FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

-- ============================================================================
-- SECTION: SERVICE ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('songleader', 'pastor', 'moderator', 'pianist', 'technicals', 'mini_ensemble', 'usher', 'choir', 'preacher', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, member_id, role)
);
ALTER TABLE public.service_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_assignments_select_policy ON public.service_assignments;
CREATE POLICY service_assignments_select_policy ON public.service_assignments FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS service_assignments_insert_policy ON public.service_assignments;
CREATE POLICY service_assignments_insert_policy ON public.service_assignments FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator', 'church_clerk', 'recording_secretary']));
DROP POLICY IF EXISTS service_assignments_update_policy ON public.service_assignments;
CREATE POLICY service_assignments_update_policy ON public.service_assignments FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator', 'church_clerk', 'recording_secretary'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator', 'church_clerk', 'recording_secretary']));
DROP POLICY IF EXISTS service_assignments_delete_policy ON public.service_assignments;
CREATE POLICY service_assignments_delete_policy ON public.service_assignments FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator', 'church_clerk', 'recording_secretary']));

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

ALTER TABLE public.visitors DROP CONSTRAINT IF EXISTS fk_visitors_sunday_school_session;
ALTER TABLE public.visitors ADD CONSTRAINT fk_visitors_sunday_school_session FOREIGN KEY (sunday_school_session_id) REFERENCES public.sunday_school_sessions(id);

ALTER TABLE public.sunday_school_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sunday_school_sessions_select_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_select_policy ON public.sunday_school_sessions FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR public.app_can_manage_sunday_school_department(public.sunday_school_sessions.department)
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'sunday_school' AND al.event_id::text = public.sunday_school_sessions.id::text AND al.member_id = public.app_current_member_id())
);

DROP POLICY IF EXISTS sunday_school_sessions_insert_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_insert_policy ON public.sunday_school_sessions FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

DROP POLICY IF EXISTS sunday_school_sessions_update_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_update_policy ON public.sunday_school_sessions FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(department)
);

DROP POLICY IF EXISTS sunday_school_sessions_delete_policy ON public.sunday_school_sessions;
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

DROP POLICY IF EXISTS financial_records_select_policy ON public.financial_records;
CREATE POLICY financial_records_select_policy ON public.financial_records FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer'])
  OR member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS financial_records_insert_policy ON public.financial_records;
CREATE POLICY financial_records_insert_policy ON public.financial_records FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'treasurer']));

DROP POLICY IF EXISTS financial_records_update_policy ON public.financial_records;
CREATE POLICY financial_records_update_policy ON public.financial_records FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'treasurer'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'treasurer']));

DROP POLICY IF EXISTS financial_records_delete_policy ON public.financial_records;
CREATE POLICY financial_records_delete_policy ON public.financial_records FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'treasurer']));

-- Tracks annual faith promise commitments for members from year to year
CREATE TABLE IF NOT EXISTS public.faith_promise_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  promised_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  started_giving_date DATE,
  weeks_committed INT,
  status TEXT,
  fulfillment_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_v1_id UUID,
  UNIQUE(member_id, year)
);

ALTER TABLE public.faith_promise_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS faith_promise_commitments_select_policy ON public.faith_promise_commitments;
CREATE POLICY faith_promise_commitments_select_policy ON public.faith_promise_commitments FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer'])
  OR member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS faith_promise_commitments_insert_policy ON public.faith_promise_commitments;
CREATE POLICY faith_promise_commitments_insert_policy ON public.faith_promise_commitments FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer']));

DROP POLICY IF EXISTS faith_promise_commitments_update_policy ON public.faith_promise_commitments;
CREATE POLICY faith_promise_commitments_update_policy ON public.faith_promise_commitments FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer']));

DROP POLICY IF EXISTS faith_promise_commitments_delete_policy ON public.faith_promise_commitments;
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

DROP POLICY IF EXISTS activities_select_policy ON public.activities;
CREATE POLICY activities_select_policy ON public.activities FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator', 'recording_secretary'])
);

DROP POLICY IF EXISTS activities_insert_policy ON public.activities;
CREATE POLICY activities_insert_policy ON public.activities FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'activity_coordinator']));

DROP POLICY IF EXISTS activities_update_policy ON public.activities;
CREATE POLICY activities_update_policy ON public.activities FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'activity_coordinator'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'activity_coordinator']));

DROP POLICY IF EXISTS activities_delete_policy ON public.activities;
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

DROP POLICY IF EXISTS music_practice_sessions_select_policy ON public.music_practice_sessions;
CREATE POLICY music_practice_sessions_select_policy ON public.music_practice_sessions FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'music_minister']));

DROP POLICY IF EXISTS music_practice_sessions_insert_policy ON public.music_practice_sessions;
CREATE POLICY music_practice_sessions_insert_policy ON public.music_practice_sessions FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'music_minister']));

DROP POLICY IF EXISTS music_practice_sessions_update_policy ON public.music_practice_sessions;
CREATE POLICY music_practice_sessions_update_policy ON public.music_practice_sessions FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'music_minister'])) WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'music_minister']));

DROP POLICY IF EXISTS music_practice_sessions_delete_policy ON public.music_practice_sessions;
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

DROP POLICY IF EXISTS system_settings_select_policy ON public.system_settings;
CREATE POLICY system_settings_select_policy ON public.system_settings FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS system_settings_insert_policy ON public.system_settings;
CREATE POLICY system_settings_insert_policy ON public.system_settings FOR INSERT WITH CHECK (public.app_has_role('church_administrator'));

DROP POLICY IF EXISTS system_settings_update_policy ON public.system_settings;
CREATE POLICY system_settings_update_policy ON public.system_settings FOR UPDATE USING (public.app_has_role('church_administrator')) WITH CHECK (public.app_has_role('church_administrator'));

DROP POLICY IF EXISTS system_settings_delete_policy ON public.system_settings;
CREATE POLICY system_settings_delete_policy ON public.system_settings FOR DELETE USING (public.app_has_role('church_administrator'));

-- Generic audit trail for tracking sensitive data changes across the system


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

DROP POLICY IF EXISTS import_export_log_select_policy ON public.import_export_log;
CREATE POLICY import_export_log_select_policy ON public.import_export_log FOR SELECT USING (public.app_has_role('church_administrator'));

DROP POLICY IF EXISTS import_export_log_insert_policy ON public.import_export_log;
CREATE POLICY import_export_log_insert_policy ON public.import_export_log FOR INSERT WITH CHECK (public.app_has_role('church_administrator'));

DROP POLICY IF EXISTS import_export_log_update_policy ON public.import_export_log;
CREATE POLICY import_export_log_update_policy ON public.import_export_log FOR UPDATE USING (public.app_has_role('church_administrator')) WITH CHECK (public.app_has_role('church_administrator'));

DROP POLICY IF EXISTS import_export_log_delete_policy ON public.import_export_log;
CREATE POLICY import_export_log_delete_policy ON public.import_export_log FOR DELETE USING (public.app_has_role('church_administrator'));

-- ============================================================================
-- SECTION: TRIGGERS & FINAL SYNC
-- ============================================================================

DROP POLICY IF EXISTS "import_export_log_delete_policy" ON public.import_export_log;
CREATE POLICY import_export_log_delete_policy ON public.import_export_log FOR DELETE USING (public.app_has_role('church_administrator'));

-- ============================================================================
-- SECTION: TRIGGERS & FINAL SYNC
-- ============================================================================

-- Automates membership status and dates when a baptism date is recorded
CREATE OR REPLACE FUNCTION sync_membership_baptism() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.baptism_date IS NOT NULL THEN
    NEW.membership_date = NEW.baptism_date;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_membership_baptism ON public.members;
CREATE TRIGGER trigger_sync_membership_baptism
BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION sync_membership_baptism();



-- Automatically assigns a human-readable member number on creation
DROP TRIGGER IF EXISTS trigger_set_member_number ON public.members;
CREATE TRIGGER trigger_set_member_number
BEFORE INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.set_member_number();

-- NOTE: Financial audit is handled by log_financial_change() trigger defined in the financial security section

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

DROP INDEX IF EXISTS idx_import_conflicts_type;
CREATE INDEX IF NOT EXISTS idx_import_conflicts_type ON public.import_conflicts(import_type);
DROP INDEX IF EXISTS idx_import_conflicts_reason;
CREATE INDEX IF NOT EXISTS idx_import_conflicts_reason ON public.import_conflicts(conflict_reason);



-- ============================================================================
-- SECTION: NEW V2 TABLES (GOODNEWS, EVENTS, FINANCE, AUDIT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.church_events (
    id TEXT PRIMARY KEY, -- Format: EVT-YYYY-NNN
    event_name TEXT NOT NULL,
    event_theme TEXT,
    event_type TEXT CHECK(event_type IN('fellowship','bible_quiz','camp','anniversary','special_program','thanksgiving','other')),
    event_date DATE NOT NULL,
    location TEXT,
    total_attendance INT DEFAULT 0,
    visitors_count INT DEFAULT 0,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hidden sequence columns for ID generation
    event_year INTEGER,
    event_seq INTEGER
);

-- 2. Create function to generate event number
CREATE OR REPLACE FUNCTION public.set_church_event_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.id IS NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.event_date)::INTEGER;
        
        -- Lock the table to prevent duplicate sequence numbers during concurrent inserts
        -- This is a simple way for moderate traffic sites
        LOCK TABLE public.church_events IN EXCLUSIVE MODE;
        
        SELECT COALESCE(MAX(event_seq), 0) + 1
        INTO v_seq
        FROM public.church_events
        WHERE event_year = v_year;

        NEW.event_year := v_year;
        NEW.event_seq := v_seq;
        NEW.id := 'EVT-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_church_event_number ON public.church_events;
CREATE TRIGGER trigger_set_church_event_number
BEFORE INSERT ON public.church_events
FOR EACH ROW
EXECUTE FUNCTION public.set_church_event_number();

-- RLS Policies for church_events
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "church_events_select_policy" ON public.church_events;
CREATE POLICY "church_events_select_policy" ON public.church_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "church_events_insert_policy" ON public.church_events;
CREATE POLICY "church_events_insert_policy" ON public.church_events FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
DROP POLICY IF EXISTS "church_events_update_policy" ON public.church_events;
CREATE POLICY "church_events_update_policy" ON public.church_events FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
DROP POLICY IF EXISTS "church_events_delete_policy" ON public.church_events;
CREATE POLICY "church_events_delete_policy" ON public.church_events FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor']));

CREATE TABLE IF NOT EXISTS public.financial_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_reason TEXT,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT period_unique UNIQUE(year, month)
);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_date DATE;
    target_year INT;
    target_month INT;
    is_locked BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.transaction_date;
    ELSE
        target_date := NEW.transaction_date;
    END IF;

    target_year := EXTRACT(YEAR FROM target_date)::INT;
    target_month := EXTRACT(MONTH FROM target_date)::INT;

    SELECT EXISTS (
        SELECT 1 FROM public.financial_period_locks
        WHERE year = target_year 
          AND month = target_month 
          AND unlocked_at IS NULL
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Period %/% is locked. Contact Church Administrator.', target_year, target_month;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_trigger ON public.financial_records;
CREATE TRIGGER enforce_period_lock_trigger
    BEFORE INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_period_lock();


-- LAYER 2: Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    financial_record_id UUID NOT NULL,
    member_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

-- NOTE: app_is_church_admin() and app_is_treasurer() are defined in the HELPER FUNCTIONS section at the top

DROP POLICY IF EXISTS "audit_log_select" ON public.financial_audit_log;
CREATE POLICY "audit_log_select" ON public.financial_audit_log
    FOR SELECT TO authenticated
    USING (app_is_church_admin() OR app_is_treasurer());

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    changed_keys TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, after_data)
        VALUES ('INSERT', NEW.id, NEW.member_id, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Safely extract changed keys without relying on EXCEPT which can be tricky with composite types/nulls
        SELECT ARRAY(
            SELECT key FROM jsonb_each(to_jsonb(OLD)) o
            FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n USING(key)
            WHERE o.value IS DISTINCT FROM n.value
        ) INTO changed_keys;
        
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data, after_data, changed_fields)
        VALUES ('UPDATE', NEW.id, NEW.member_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_keys);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data)
        VALUES ('DELETE', OLD.id, OLD.member_id, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_financial_change_trigger ON public.financial_records;
CREATE TRIGGER log_financial_change_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_financial_change();


-- LAYER 3: Soft Delete Column
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator']));

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT WITH CHECK (true); 

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_desc TEXT;
    v_roles TEXT;
BEGIN
    -- Get current user ID
    BEGIN
        v_actor_id := public.app_current_member_id();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF v_actor_id IS NOT NULL THEN
        SELECT first_name || ' ' || surname INTO v_actor_name FROM public.members WHERE id = v_actor_id;
        
        -- Try to get primary role
        SELECT role INTO v_roles FROM public.user_roles WHERE member_id = v_actor_id LIMIT 1;
        
        IF v_roles IS NOT NULL THEN
            -- format role nicely
            v_actor_name := INITCAP(REPLACE(v_roles, '_', ' ')) || ' ' || v_actor_name;
        END IF;
    ELSE
        v_actor_name := 'System';
    END IF;

    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;
    
    IF v_action = 'DELETE' THEN
        v_entity_id := COALESCE(OLD.id::TEXT, 'Unknown');
    ELSE
        v_entity_id := COALESCE(NEW.id::TEXT, 'Unknown');
    END IF;

    -- Human readable defaults
    v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd record ' || v_entity_id || ' in ' || v_entity_type;

    IF v_entity_type = 'services' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Service (' || v_entity_id || ')';
    ELSIF v_entity_type = 'financial_records' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Financial Record (' || COALESCE(NEW.transaction_type, OLD.transaction_type) || ')';
    ELSIF v_entity_type = 'members' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Member Profile (' || v_entity_id || ')';
    ELSIF v_entity_type = 'church_events' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Church Event (' || v_entity_id || ')';
    ELSIF v_entity_type = 'activities' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Activity (' || v_entity_id || ')';
    ELSIF v_entity_type = 'goodnews_series' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Goodnews Class (' || v_entity_id || ')';
    END IF;

    INSERT INTO public.audit_logs (actor_id, entity_type, entity_id, action, description, changes)
    VALUES (
        v_actor_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_desc,
        CASE
            WHEN v_action = 'INSERT' THEN row_to_json(NEW)::jsonb
            WHEN v_action = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
            WHEN v_action = 'DELETE' THEN row_to_json(OLD)::jsonb
        END
    );
    
    IF v_action = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['services', 'financial_records', 'members', 'church_events', 'goodnews_series', 'sunday_school_sessions', 'activities'])
    LOOP
        -- Only add triggers if the table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_log ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
        END IF;
    END LOOP;
END;
$$;


-- ==============================================================================
-- ===== SECTION: VIEWS =====
-- ==============================================================================

-- 1. FAITH PROMISE LEDGER FUNCTIONS
CREATE OR REPLACE FUNCTION public.count_sundays(start_date DATE, end_date DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    sunday_count INT := 0;
    curr_date DATE := start_date;
BEGIN
    WHILE curr_date <= end_date LOOP
        IF EXTRACT(ISODOW FROM curr_date) = 7 THEN
            sunday_count := sunday_count + 1;
        END IF;
        curr_date := curr_date + 1;
    END LOOP;
    RETURN sunday_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_sundays_in_year(p_year INT)
RETURNS INT LANGUAGE plpgsql AS $$
BEGIN
    RETURN public.count_sundays(
        MAKE_DATE(p_year, 1, 1),
        MAKE_DATE(p_year, 12, 31)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sundays_elapsed_in_year(p_year INT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    end_date DATE;
BEGIN
    IF EXTRACT(YEAR FROM CURRENT_DATE) > p_year THEN
        end_date := MAKE_DATE(p_year, 12, 31);
    ELSIF EXTRACT(YEAR FROM CURRENT_DATE) < p_year THEN
        RETURN 0;
    ELSE
        end_date := CURRENT_DATE;
    END IF;
    
    RETURN public.count_sundays(MAKE_DATE(p_year, 1, 1), end_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.sundays_remaining_in_year(p_year INT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    start_date DATE;
BEGIN
    IF EXTRACT(YEAR FROM CURRENT_DATE) > p_year THEN
        RETURN 0;
    ELSIF EXTRACT(YEAR FROM CURRENT_DATE) < p_year THEN
        start_date := MAKE_DATE(p_year, 1, 1);
    ELSE
        start_date := CURRENT_DATE + 1;
    END IF;
    
    RETURN public.count_sundays(start_date, MAKE_DATE(p_year, 12, 31));
END;
$$;

-- 2. FAITH PROMISE LEDGER VIEW
DROP VIEW IF EXISTS public.faith_promise_ledger;

CREATE OR REPLACE VIEW public.faith_promise_ledger AS
WITH fp_totals AS (
    SELECT 
        member_id, 
        EXTRACT(YEAR FROM transaction_date)::INT AS record_year,
        SUM(amount) AS total_paid
    FROM public.financial_records
    WHERE transaction_type = 'faith_promise'
      AND deleted_at IS NULL
    GROUP BY member_id, EXTRACT(YEAR FROM transaction_date)
)
SELECT 
    fpc.id,
    fpc.member_id,
    m.first_name,
    m.surname,
    m.member_number,
    fpc.year,
    fpc.promised_amount AS committed_amount,
    fpc.started_giving_date,
    fpc.weeks_committed,
    fpc.status AS manual_status,
    fpc.fulfillment_date,
    fpc.notes,
    COALESCE(t.total_paid, 0) AS total_paid,
    (fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) AS weekly_target,
    (fpc.promised_amount - COALESCE(t.total_paid, 0)) AS remaining_balance,
    ((fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) * public.sundays_elapsed_in_year(fpc.year)) AS expected_paid_by_now,
    (COALESCE(t.total_paid, 0) - ((fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) * public.sundays_elapsed_in_year(fpc.year))) AS variance,
    (COALESCE(t.total_paid, 0) / NULLIF(fpc.promised_amount, 0) * 100) AS fulfillment_pct,
    ((fpc.promised_amount - COALESCE(t.total_paid, 0)) / CASE WHEN public.sundays_remaining_in_year(fpc.year) = 0 THEN 1 ELSE public.sundays_remaining_in_year(fpc.year) END) AS catchup_weekly,
    CASE 
        WHEN fpc.status IS NOT NULL THEN fpc.status
        WHEN COALESCE(t.total_paid, 0) >= fpc.promised_amount THEN 'FULFILLED'
        WHEN EXTRACT(YEAR FROM CURRENT_DATE) > fpc.year AND COALESCE(t.total_paid, 0) < fpc.promised_amount THEN 'INCOMPLETE'
        WHEN (COALESCE(t.total_paid, 0) - ((fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) * public.sundays_elapsed_in_year(fpc.year))) >= 0 THEN 'ON TRACK'
        ELSE 'BEHIND' 
    END AS status
FROM public.faith_promise_commitments fpc
JOIN public.members m ON fpc.member_id = m.id
LEFT JOIN fp_totals t ON fpc.member_id = t.member_id AND fpc.year = t.record_year;

GRANT SELECT ON public.faith_promise_ledger TO authenticated;

-- 3. ADDITIONAL INDEXES
DROP INDEX IF EXISTS idx_fin_records_fp;
CREATE INDEX idx_fin_records_fp 
ON public.financial_records(member_id, transaction_type, transaction_date) 
WHERE transaction_type = 'faith_promise';


-- ============================================================================
-- SECTION: NEW V2 TABLES (GOODNEWS, EVENTS, FINANCE, AUDIT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.church_events (
    id TEXT PRIMARY KEY, -- Format: EVT-YYYY-NNN
    event_name TEXT NOT NULL,
    event_type TEXT CHECK(event_type IN('fellowship','bible_quiz','camp','anniversary','special_program','other')),
    event_date DATE NOT NULL,
    location TEXT,
    total_attendance INT DEFAULT 0,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hidden sequence columns for ID generation
    event_year INTEGER,
    event_seq INTEGER
);

-- 2. Create function to generate event number
CREATE OR REPLACE FUNCTION public.set_church_event_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.id IS NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.event_date)::INTEGER;
        
        -- Lock the table to prevent duplicate sequence numbers during concurrent inserts
        -- This is a simple way for moderate traffic sites
        LOCK TABLE public.church_events IN EXCLUSIVE MODE;
        
        SELECT COALESCE(MAX(event_seq), 0) + 1
        INTO v_seq
        FROM public.church_events
        WHERE event_year = v_year;

        NEW.event_year := v_year;
        NEW.event_seq := v_seq;
        NEW.id := 'EVT-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_church_event_number ON public.church_events;
CREATE TRIGGER trigger_set_church_event_number
BEFORE INSERT ON public.church_events
-- First, drop policies that depend on this column to allow the type change
EXECUTE FUNCTION public.set_church_event_number();

-- RLS Policies for church_events
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "church_events_select_policy" ON public.church_events FOR SELECT USING (true);
CREATE POLICY "church_events_insert_policy" ON public.church_events FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_update_policy" ON public.church_events FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_delete_policy" ON public.church_events FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor']));

CREATE TABLE IF NOT EXISTS public.financial_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_reason TEXT,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT period_unique UNIQUE(year, month)
);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_date DATE;
    target_year INT;
    target_month INT;
    is_locked BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.transaction_date;
    ELSE
        target_date := NEW.transaction_date;
    END IF;

    target_year := EXTRACT(YEAR FROM target_date)::INT;
    target_month := EXTRACT(MONTH FROM target_date)::INT;

    SELECT EXISTS (
        SELECT 1 FROM public.financial_period_locks
        WHERE year = target_year 
          AND month = target_month 
          AND unlocked_at IS NULL
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Period %/% is locked. Contact Church Administrator.', target_year, target_month;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_trigger ON public.financial_records;
CREATE TRIGGER enforce_period_lock_trigger
    BEFORE INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_period_lock();


-- LAYER 2: Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    financial_record_id UUID NOT NULL,
    member_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_is_church_admin() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'church_administrator'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.app_is_treasurer() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'treasurer'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "audit_log_select" ON public.financial_audit_log
    FOR SELECT TO authenticated
    USING (app_is_church_admin() OR app_is_treasurer());

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    changed_keys TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, after_data)
        VALUES ('INSERT', NEW.id, NEW.member_id, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Safely extract changed keys without relying on EXCEPT which can be tricky with composite types/nulls
        SELECT ARRAY(
            SELECT key FROM jsonb_each(to_jsonb(OLD)) o
            FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n USING(key)
            WHERE o.value IS DISTINCT FROM n.value
        ) INTO changed_keys;
        
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data, after_data, changed_fields)
        VALUES ('UPDATE', NEW.id, NEW.member_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_keys);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data)
        VALUES ('DELETE', OLD.id, OLD.member_id, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_financial_change_trigger ON public.financial_records;
CREATE TRIGGER log_financial_change_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_financial_change();


-- LAYER 3: Soft Delete Column
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator']));

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT WITH CHECK (true); 

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_desc TEXT;
    v_roles TEXT;
BEGIN
    -- Get current user ID
    BEGIN
        v_actor_id := public.app_current_member_id();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF v_actor_id IS NOT NULL THEN
        SELECT first_name || ' ' || surname INTO v_actor_name FROM public.members WHERE id = v_actor_id;
        
        -- Try to get primary role
        SELECT role INTO v_roles FROM public.user_roles WHERE member_id = v_actor_id LIMIT 1;
        
        IF v_roles IS NOT NULL THEN
            -- format role nicely
            v_actor_name := INITCAP(REPLACE(v_roles, '_', ' ')) || ' ' || v_actor_name;
        END IF;
    ELSE
        v_actor_name := 'System';
    END IF;

    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;
    
    IF v_action = 'DELETE' THEN
        v_entity_id := COALESCE(OLD.id::TEXT, 'Unknown');
    ELSE
        v_entity_id := COALESCE(NEW.id::TEXT, 'Unknown');
    END IF;

    -- Human readable defaults
    v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd record ' || v_entity_id || ' in ' || v_entity_type;

    IF v_entity_type = 'services' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Service (' || v_entity_id || ')';
    ELSIF v_entity_type = 'financial_records' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Financial Record (' || COALESCE(NEW.transaction_type, OLD.transaction_type) || ')';
    ELSIF v_entity_type = 'members' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Member Profile (' || v_entity_id || ')';
    ELSIF v_entity_type = 'church_events' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Church Event (' || v_entity_id || ')';
    ELSIF v_entity_type = 'activities' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Activity (' || v_entity_id || ')';
    ELSIF v_entity_type = 'goodnews_series' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Goodnews Class (' || v_entity_id || ')';
    END IF;

    INSERT INTO public.audit_logs (actor_id, entity_type, entity_id, action, description, changes)
    VALUES (
        v_actor_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_desc,
        CASE
            WHEN v_action = 'INSERT' THEN row_to_json(NEW)::jsonb
            WHEN v_action = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
            WHEN v_action = 'DELETE' THEN row_to_json(OLD)::jsonb
        END
    );
    
    IF v_action = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['services', 'financial_records', 'members', 'church_events', 'goodnews_series', 'sunday_school_sessions', 'activities'])
    LOOP
        -- Only add triggers if the table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_log ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
        END IF;
    END LOOP;
END;
$$;



-- ============================================================================
-- SECTION: NEW V2 TABLES (GOODNEWS, EVENTS, FINANCE, AUDIT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.church_events (
    id TEXT PRIMARY KEY, -- Format: EVT-YYYY-NNN
    event_name TEXT NOT NULL,
    event_type TEXT CHECK(event_type IN('fellowship','bible_quiz','camp','anniversary','special_program','other')),
    event_date DATE NOT NULL,
    location TEXT,
    total_attendance INT DEFAULT 0,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hidden sequence columns for ID generation
    event_year INTEGER,
    event_seq INTEGER
);

-- 2. Create function to generate event number
CREATE OR REPLACE FUNCTION public.set_church_event_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.id IS NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.event_date)::INTEGER;
        
        -- Lock the table to prevent duplicate sequence numbers during concurrent inserts
        -- This is a simple way for moderate traffic sites
        LOCK TABLE public.church_events IN EXCLUSIVE MODE;
        
        SELECT COALESCE(MAX(event_seq), 0) + 1
        INTO v_seq
        FROM public.church_events
        WHERE event_year = v_year;

        NEW.event_year := v_year;
        NEW.event_seq := v_seq;
        NEW.id := 'EVT-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_church_event_number ON public.church_events;
CREATE TRIGGER trigger_set_church_event_number
BEFORE INSERT ON public.church_events
-- First, drop policies that depend on this column to allow the type change
EXECUTE FUNCTION public.set_church_event_number();

-- RLS Policies for church_events
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "church_events_select_policy" ON public.church_events FOR SELECT USING (true);
CREATE POLICY "church_events_insert_policy" ON public.church_events FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_update_policy" ON public.church_events FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_delete_policy" ON public.church_events FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor']));

CREATE TABLE IF NOT EXISTS public.financial_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_reason TEXT,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT period_unique UNIQUE(year, month)
);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_date DATE;
    target_year INT;
    target_month INT;
    is_locked BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.transaction_date;
    ELSE
        target_date := NEW.transaction_date;
    END IF;

    target_year := EXTRACT(YEAR FROM target_date)::INT;
    target_month := EXTRACT(MONTH FROM target_date)::INT;

    SELECT EXISTS (
        SELECT 1 FROM public.financial_period_locks
        WHERE year = target_year 
          AND month = target_month 
          AND unlocked_at IS NULL
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Period %/% is locked. Contact Church Administrator.', target_year, target_month;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_trigger ON public.financial_records;
CREATE TRIGGER enforce_period_lock_trigger
    BEFORE INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_period_lock();


-- LAYER 2: Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    financial_record_id UUID NOT NULL,
    member_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_is_church_admin() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'church_administrator'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.app_is_treasurer() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'treasurer'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "audit_log_select" ON public.financial_audit_log
    FOR SELECT TO authenticated
    USING (app_is_church_admin() OR app_is_treasurer());

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    changed_keys TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, after_data)
        VALUES ('INSERT', NEW.id, NEW.member_id, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Safely extract changed keys without relying on EXCEPT which can be tricky with composite types/nulls
        SELECT ARRAY(
            SELECT key FROM jsonb_each(to_jsonb(OLD)) o
            FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n USING(key)
            WHERE o.value IS DISTINCT FROM n.value
        ) INTO changed_keys;
        
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data, after_data, changed_fields)
        VALUES ('UPDATE', NEW.id, NEW.member_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_keys);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data)
        VALUES ('DELETE', OLD.id, OLD.member_id, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_financial_change_trigger ON public.financial_records;
CREATE TRIGGER log_financial_change_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_financial_change();


-- LAYER 3: Soft Delete Column
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator']));

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT WITH CHECK (true); 

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_desc TEXT;
    v_roles TEXT;
BEGIN
    -- Get current user ID
    BEGIN
        v_actor_id := public.app_current_member_id();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF v_actor_id IS NOT NULL THEN
        SELECT first_name || ' ' || surname INTO v_actor_name FROM public.members WHERE id = v_actor_id;
        
        -- Try to get primary role
        SELECT role INTO v_roles FROM public.user_roles WHERE member_id = v_actor_id LIMIT 1;
        
        IF v_roles IS NOT NULL THEN
            -- format role nicely
            v_actor_name := INITCAP(REPLACE(v_roles, '_', ' ')) || ' ' || v_actor_name;
        END IF;
    ELSE
        v_actor_name := 'System';
    END IF;

    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;
    
    IF v_action = 'DELETE' THEN
        v_entity_id := COALESCE(OLD.id::TEXT, 'Unknown');
    ELSE
        v_entity_id := COALESCE(NEW.id::TEXT, 'Unknown');
    END IF;

    -- Human readable defaults
    v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd record ' || v_entity_id || ' in ' || v_entity_type;

    IF v_entity_type = 'services' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Service (' || v_entity_id || ')';
    ELSIF v_entity_type = 'financial_records' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Financial Record (' || COALESCE(NEW.transaction_type, OLD.transaction_type) || ')';
    ELSIF v_entity_type = 'members' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Member Profile (' || v_entity_id || ')';
    ELSIF v_entity_type = 'church_events' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Church Event (' || v_entity_id || ')';
    ELSIF v_entity_type = 'activities' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Activity (' || v_entity_id || ')';
    ELSIF v_entity_type = 'goodnews_series' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Goodnews Class (' || v_entity_id || ')';
    END IF;

    INSERT INTO public.audit_logs (actor_id, entity_type, entity_id, action, description, changes)
    VALUES (
        v_actor_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_desc,
        CASE
            WHEN v_action = 'INSERT' THEN row_to_json(NEW)::jsonb
            WHEN v_action = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
            WHEN v_action = 'DELETE' THEN row_to_json(OLD)::jsonb
        END
    );
    
    IF v_action = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['services', 'financial_records', 'members', 'church_events', 'goodnews_series', 'sunday_school_sessions', 'activities'])
    LOOP
        -- Only add triggers if the table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_log ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
        END IF;
    END LOOP;
END;
$$;



-- ============================================================================
-- SECTION: NEW V2 TABLES (GOODNEWS, EVENTS, FINANCE, AUDIT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.church_events (
    id TEXT PRIMARY KEY, -- Format: EVT-YYYY-NNN
    event_name TEXT NOT NULL,
    event_type TEXT CHECK(event_type IN('fellowship','bible_quiz','camp','anniversary','special_program','other')),
    event_date DATE NOT NULL,
    location TEXT,
    total_attendance INT DEFAULT 0,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hidden sequence columns for ID generation
    event_year INTEGER,
    event_seq INTEGER
);

-- 2. Create function to generate event number
CREATE OR REPLACE FUNCTION public.set_church_event_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.id IS NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.event_date)::INTEGER;
        
        -- Lock the table to prevent duplicate sequence numbers during concurrent inserts
        -- This is a simple way for moderate traffic sites
        LOCK TABLE public.church_events IN EXCLUSIVE MODE;
        
        SELECT COALESCE(MAX(event_seq), 0) + 1
        INTO v_seq
        FROM public.church_events
        WHERE event_year = v_year;

        NEW.event_year := v_year;
        NEW.event_seq := v_seq;
        NEW.id := 'EVT-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_church_event_number ON public.church_events;
CREATE TRIGGER trigger_set_church_event_number
BEFORE INSERT ON public.church_events
-- First, drop policies that depend on this column to allow the type change
EXECUTE FUNCTION public.set_church_event_number();

-- RLS Policies for church_events
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "church_events_select_policy" ON public.church_events FOR SELECT USING (true);
CREATE POLICY "church_events_insert_policy" ON public.church_events FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_update_policy" ON public.church_events FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_delete_policy" ON public.church_events FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor']));

CREATE TABLE IF NOT EXISTS public.financial_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_reason TEXT,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT period_unique UNIQUE(year, month)
);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_date DATE;
    target_year INT;
    target_month INT;
    is_locked BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.transaction_date;
    ELSE
        target_date := NEW.transaction_date;
    END IF;

    target_year := EXTRACT(YEAR FROM target_date)::INT;
    target_month := EXTRACT(MONTH FROM target_date)::INT;

    SELECT EXISTS (
        SELECT 1 FROM public.financial_period_locks
        WHERE year = target_year 
          AND month = target_month 
          AND unlocked_at IS NULL
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Period %/% is locked. Contact Church Administrator.', target_year, target_month;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_trigger ON public.financial_records;
CREATE TRIGGER enforce_period_lock_trigger
    BEFORE INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_period_lock();


-- LAYER 2: Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    financial_record_id UUID NOT NULL,
    member_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_is_church_admin() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'church_administrator'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.app_is_treasurer() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'treasurer'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "audit_log_select" ON public.financial_audit_log
    FOR SELECT TO authenticated
    USING (app_is_church_admin() OR app_is_treasurer());

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    changed_keys TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, after_data)
        VALUES ('INSERT', NEW.id, NEW.member_id, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Safely extract changed keys without relying on EXCEPT which can be tricky with composite types/nulls
        SELECT ARRAY(
            SELECT key FROM jsonb_each(to_jsonb(OLD)) o
            FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n USING(key)
            WHERE o.value IS DISTINCT FROM n.value
        ) INTO changed_keys;
        
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data, after_data, changed_fields)
        VALUES ('UPDATE', NEW.id, NEW.member_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_keys);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data)
        VALUES ('DELETE', OLD.id, OLD.member_id, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_financial_change_trigger ON public.financial_records;
CREATE TRIGGER log_financial_change_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_financial_change();


-- LAYER 3: Soft Delete Column
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator']));

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT WITH CHECK (true); 

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_desc TEXT;
    v_roles TEXT;
BEGIN
    -- Get current user ID
    BEGIN
        v_actor_id := public.app_current_member_id();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF v_actor_id IS NOT NULL THEN
        SELECT first_name || ' ' || surname INTO v_actor_name FROM public.members WHERE id = v_actor_id;
        
        -- Try to get primary role
        SELECT role INTO v_roles FROM public.user_roles WHERE member_id = v_actor_id LIMIT 1;
        
        IF v_roles IS NOT NULL THEN
            -- format role nicely
            v_actor_name := INITCAP(REPLACE(v_roles, '_', ' ')) || ' ' || v_actor_name;
        END IF;
    ELSE
        v_actor_name := 'System';
    END IF;

    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;
    
    IF v_action = 'DELETE' THEN
        v_entity_id := COALESCE(OLD.id::TEXT, 'Unknown');
    ELSE
        v_entity_id := COALESCE(NEW.id::TEXT, 'Unknown');
    END IF;

    -- Human readable defaults
    v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd record ' || v_entity_id || ' in ' || v_entity_type;

    IF v_entity_type = 'services' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Service (' || v_entity_id || ')';
    ELSIF v_entity_type = 'financial_records' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Financial Record (' || COALESCE(NEW.transaction_type, OLD.transaction_type) || ')';
    ELSIF v_entity_type = 'members' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Member Profile (' || v_entity_id || ')';
    ELSIF v_entity_type = 'church_events' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Church Event (' || v_entity_id || ')';
    ELSIF v_entity_type = 'activities' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Activity (' || v_entity_id || ')';
    ELSIF v_entity_type = 'goodnews_series' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Goodnews Class (' || v_entity_id || ')';
    END IF;

    INSERT INTO public.audit_logs (actor_id, entity_type, entity_id, action, description, changes)
    VALUES (
        v_actor_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_desc,
        CASE
            WHEN v_action = 'INSERT' THEN row_to_json(NEW)::jsonb
            WHEN v_action = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
            WHEN v_action = 'DELETE' THEN row_to_json(OLD)::jsonb
        END
    );
    
    IF v_action = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['services', 'financial_records', 'members', 'church_events', 'goodnews_series', 'sunday_school_sessions', 'activities'])
    LOOP
        -- Only add triggers if the table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_log ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
        END IF;
    END LOOP;
END;
$$;



-- ============================================================================
-- SECTION: NEW V2 TABLES (GOODNEWS, EVENTS, FINANCE, AUDIT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.church_events (
    id TEXT PRIMARY KEY, -- Format: EVT-YYYY-NNN
    event_name TEXT NOT NULL,
    event_type TEXT CHECK(event_type IN('fellowship','bible_quiz','camp','anniversary','special_program','other')),
    event_date DATE NOT NULL,
    location TEXT,
    total_attendance INT DEFAULT 0,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hidden sequence columns for ID generation
    event_year INTEGER,
    event_seq INTEGER
);

-- 2. Create function to generate event number
CREATE OR REPLACE FUNCTION public.set_church_event_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.id IS NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.event_date)::INTEGER;
        
        -- Lock the table to prevent duplicate sequence numbers during concurrent inserts
        -- This is a simple way for moderate traffic sites
        LOCK TABLE public.church_events IN EXCLUSIVE MODE;
        
        SELECT COALESCE(MAX(event_seq), 0) + 1
        INTO v_seq
        FROM public.church_events
        WHERE event_year = v_year;

        NEW.event_year := v_year;
        NEW.event_seq := v_seq;
        NEW.id := 'EVT-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_church_event_number ON public.church_events;
CREATE TRIGGER trigger_set_church_event_number
BEFORE INSERT ON public.church_events
-- First, drop policies that depend on this column to allow the type change
EXECUTE FUNCTION public.set_church_event_number();

-- RLS Policies for church_events
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "church_events_select_policy" ON public.church_events FOR SELECT USING (true);
CREATE POLICY "church_events_insert_policy" ON public.church_events FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_update_policy" ON public.church_events FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_delete_policy" ON public.church_events FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor']));

CREATE TABLE IF NOT EXISTS public.financial_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_reason TEXT,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT period_unique UNIQUE(year, month)
);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_date DATE;
    target_year INT;
    target_month INT;
    is_locked BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.transaction_date;
    ELSE
        target_date := NEW.transaction_date;
    END IF;

    target_year := EXTRACT(YEAR FROM target_date)::INT;
    target_month := EXTRACT(MONTH FROM target_date)::INT;

    SELECT EXISTS (
        SELECT 1 FROM public.financial_period_locks
        WHERE year = target_year 
          AND month = target_month 
          AND unlocked_at IS NULL
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Period %/% is locked. Contact Church Administrator.', target_year, target_month;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_trigger ON public.financial_records;
CREATE TRIGGER enforce_period_lock_trigger
    BEFORE INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_period_lock();


-- LAYER 2: Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    financial_record_id UUID NOT NULL,
    member_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_is_church_admin() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'church_administrator'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.app_is_treasurer() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'treasurer'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "audit_log_select" ON public.financial_audit_log
    FOR SELECT TO authenticated
    USING (app_is_church_admin() OR app_is_treasurer());

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    changed_keys TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, after_data)
        VALUES ('INSERT', NEW.id, NEW.member_id, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Safely extract changed keys without relying on EXCEPT which can be tricky with composite types/nulls
        SELECT ARRAY(
            SELECT key FROM jsonb_each(to_jsonb(OLD)) o
            FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n USING(key)
            WHERE o.value IS DISTINCT FROM n.value
        ) INTO changed_keys;
        
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data, after_data, changed_fields)
        VALUES ('UPDATE', NEW.id, NEW.member_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_keys);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data)
        VALUES ('DELETE', OLD.id, OLD.member_id, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_financial_change_trigger ON public.financial_records;
CREATE TRIGGER log_financial_change_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_financial_change();


-- LAYER 3: Soft Delete Column
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator']));

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT WITH CHECK (true); 

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_desc TEXT;
    v_roles TEXT;
BEGIN
    -- Get current user ID
    BEGIN
        v_actor_id := public.app_current_member_id();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF v_actor_id IS NOT NULL THEN
        SELECT first_name || ' ' || surname INTO v_actor_name FROM public.members WHERE id = v_actor_id;
        
        -- Try to get primary role
        SELECT role INTO v_roles FROM public.user_roles WHERE member_id = v_actor_id LIMIT 1;
        
        IF v_roles IS NOT NULL THEN
            -- format role nicely
            v_actor_name := INITCAP(REPLACE(v_roles, '_', ' ')) || ' ' || v_actor_name;
        END IF;
    ELSE
        v_actor_name := 'System';
    END IF;

    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;
    
    IF v_action = 'DELETE' THEN
        v_entity_id := COALESCE(OLD.id::TEXT, 'Unknown');
    ELSE
        v_entity_id := COALESCE(NEW.id::TEXT, 'Unknown');
    END IF;

    -- Human readable defaults
    v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd record ' || v_entity_id || ' in ' || v_entity_type;

    IF v_entity_type = 'services' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Service (' || v_entity_id || ')';
    ELSIF v_entity_type = 'financial_records' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Financial Record (' || COALESCE(NEW.transaction_type, OLD.transaction_type) || ')';
    ELSIF v_entity_type = 'members' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Member Profile (' || v_entity_id || ')';
    ELSIF v_entity_type = 'church_events' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Church Event (' || v_entity_id || ')';
    ELSIF v_entity_type = 'activities' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Activity (' || v_entity_id || ')';
    ELSIF v_entity_type = 'goodnews_series' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Goodnews Class (' || v_entity_id || ')';
    END IF;

    INSERT INTO public.audit_logs (actor_id, entity_type, entity_id, action, description, changes)
    VALUES (
        v_actor_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_desc,
        CASE
            WHEN v_action = 'INSERT' THEN row_to_json(NEW)::jsonb
            WHEN v_action = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
            WHEN v_action = 'DELETE' THEN row_to_json(OLD)::jsonb
        END
    );
    
    IF v_action = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['services', 'financial_records', 'members', 'church_events', 'goodnews_series', 'sunday_school_sessions', 'activities'])
    LOOP
        -- Only add triggers if the table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_log ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
        END IF;
    END LOOP;
END;
$$;



-- ============================================================================
-- SECTION: NEW V2 TABLES (GOODNEWS, EVENTS, FINANCE, AUDIT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.church_events (
    id TEXT PRIMARY KEY, -- Format: EVT-YYYY-NNN
    event_name TEXT NOT NULL,
    event_type TEXT CHECK(event_type IN('fellowship','bible_quiz','camp','anniversary','special_program','other')),
    event_date DATE NOT NULL,
    location TEXT,
    total_attendance INT DEFAULT 0,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hidden sequence columns for ID generation
    event_year INTEGER,
    event_seq INTEGER
);

-- 2. Create function to generate event number
CREATE OR REPLACE FUNCTION public.set_church_event_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.id IS NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.event_date)::INTEGER;
        
        -- Lock the table to prevent duplicate sequence numbers during concurrent inserts
        -- This is a simple way for moderate traffic sites
        LOCK TABLE public.church_events IN EXCLUSIVE MODE;
        
        SELECT COALESCE(MAX(event_seq), 0) + 1
        INTO v_seq
        FROM public.church_events
        WHERE event_year = v_year;

        NEW.event_year := v_year;
        NEW.event_seq := v_seq;
        NEW.id := 'EVT-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_church_event_number ON public.church_events;
CREATE TRIGGER trigger_set_church_event_number
BEFORE INSERT ON public.church_events
-- First, drop policies that depend on this column to allow the type change
EXECUTE FUNCTION public.set_church_event_number();

-- RLS Policies for church_events
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "church_events_select_policy" ON public.church_events FOR SELECT USING (true);
CREATE POLICY "church_events_insert_policy" ON public.church_events FOR INSERT WITH CHECK (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_update_policy" ON public.church_events FOR UPDATE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor', 'church_clerk', 'activity_coordinator', 'recording_secretary']));
CREATE POLICY "church_events_delete_policy" ON public.church_events FOR DELETE USING (public.app_has_any_role(ARRAY['church_administrator', 'pastor']));

CREATE TABLE IF NOT EXISTS public.financial_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_reason TEXT,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT period_unique UNIQUE(year, month)
);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_date DATE;
    target_year INT;
    target_month INT;
    is_locked BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.transaction_date;
    ELSE
        target_date := NEW.transaction_date;
    END IF;

    target_year := EXTRACT(YEAR FROM target_date)::INT;
    target_month := EXTRACT(MONTH FROM target_date)::INT;

    SELECT EXISTS (
        SELECT 1 FROM public.financial_period_locks
        WHERE year = target_year 
          AND month = target_month 
          AND unlocked_at IS NULL
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Period %/% is locked. Contact Church Administrator.', target_year, target_month;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_trigger ON public.financial_records;
CREATE TRIGGER enforce_period_lock_trigger
    BEFORE INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_period_lock();


-- LAYER 2: Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    financial_record_id UUID NOT NULL,
    member_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_is_church_admin() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'church_administrator'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.app_is_treasurer() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'treasurer'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "audit_log_select" ON public.financial_audit_log
    FOR SELECT TO authenticated
    USING (app_is_church_admin() OR app_is_treasurer());

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    changed_keys TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, after_data)
        VALUES ('INSERT', NEW.id, NEW.member_id, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Safely extract changed keys without relying on EXCEPT which can be tricky with composite types/nulls
        SELECT ARRAY(
            SELECT key FROM jsonb_each(to_jsonb(OLD)) o
            FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n USING(key)
            WHERE o.value IS DISTINCT FROM n.value
        ) INTO changed_keys;
        
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data, after_data, changed_fields)
        VALUES ('UPDATE', NEW.id, NEW.member_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_keys);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data)
        VALUES ('DELETE', OLD.id, OLD.member_id, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_financial_change_trigger ON public.financial_records;
CREATE TRIGGER log_financial_change_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_financial_change();


-- LAYER 3: Soft Delete Column
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT USING (public.app_has_any_role(ARRAY['church_administrator', 'church_administrator']));

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT WITH CHECK (true); 

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_desc TEXT;
    v_roles TEXT;
BEGIN
    -- Get current user ID
    BEGIN
        v_actor_id := public.app_current_member_id();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF v_actor_id IS NOT NULL THEN
        SELECT first_name || ' ' || surname INTO v_actor_name FROM public.members WHERE id = v_actor_id;
        
        -- Try to get primary role
        SELECT role INTO v_roles FROM public.user_roles WHERE member_id = v_actor_id LIMIT 1;
        
        IF v_roles IS NOT NULL THEN
            -- format role nicely
            v_actor_name := INITCAP(REPLACE(v_roles, '_', ' ')) || ' ' || v_actor_name;
        END IF;
    ELSE
        v_actor_name := 'System';
    END IF;

    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;
    
    IF v_action = 'DELETE' THEN
        v_entity_id := COALESCE(OLD.id::TEXT, 'Unknown');
    ELSE
        v_entity_id := COALESCE(NEW.id::TEXT, 'Unknown');
    END IF;

    -- Human readable defaults
    v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd record ' || v_entity_id || ' in ' || v_entity_type;

    IF v_entity_type = 'services' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Service (' || v_entity_id || ')';
    ELSIF v_entity_type = 'financial_records' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Financial Record (' || COALESCE(NEW.transaction_type, OLD.transaction_type) || ')';
    ELSIF v_entity_type = 'members' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Member Profile (' || v_entity_id || ')';
    ELSIF v_entity_type = 'church_events' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Church Event (' || v_entity_id || ')';
    ELSIF v_entity_type = 'activities' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Activity (' || v_entity_id || ')';
    ELSIF v_entity_type = 'goodnews_series' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Goodnews Class (' || v_entity_id || ')';
    END IF;

    INSERT INTO public.audit_logs (actor_id, entity_type, entity_id, action, description, changes)
    VALUES (
        v_actor_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_desc,
        CASE
            WHEN v_action = 'INSERT' THEN row_to_json(NEW)::jsonb
            WHEN v_action = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
            WHEN v_action = 'DELETE' THEN row_to_json(OLD)::jsonb
        END
    );
    
    IF v_action = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['services', 'financial_records', 'members', 'church_events', 'goodnews_series', 'sunday_school_sessions', 'activities'])
    LOOP
        -- Only add triggers if the table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_log ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
        END IF;
    END LOOP;
END;
$$;



-- ============================================================================
-- SECTION: MINISTRIES NORMALIZATION
-- ============================================================================

-- Normalize ministry identity and attendance event metadata.
-- This migration keeps church_positions intact as a legacy compatibility source.



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




