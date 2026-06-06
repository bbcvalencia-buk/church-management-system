-- Migration to add explicit Sunday School teacher roles
BEGIN;

-- 1. Drop existing check constraint and add the updated one
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (
  role IN (
    'church_administrator', 'pastor', 'church_clerk', 'treasurer', 'recording_secretary', 
    'music_minister', 'sunday_school_admin', 'goodnews_teacher', 'activity_coordinator', 'member',
    'sunday_school_teacher_beginners', 'sunday_school_teacher_children', 'sunday_school_teacher_adult'
  )
);

-- 2. Update public.app_sunday_school_teacher_departments helper function
CREATE OR REPLACE FUNCTION public.app_sunday_school_teacher_departments()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT dept), ARRAY[]::TEXT[])
  FROM (
    -- Position-based departments
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
    
    UNION
    
    -- Role-based departments
    SELECT 'beginners' AS dept
    WHERE public.app_has_role('sunday_school_teacher_beginners')
    
    UNION
    
    SELECT unnest(ARRAY['nursery_kinder_primary', 'junior']) AS dept
    WHERE public.app_has_role('sunday_school_teacher_children')
    
    UNION
    
    SELECT 'adult' AS dept
    WHERE public.app_has_role('sunday_school_teacher_adult')
  ) q
  WHERE dept IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.app_sunday_school_teacher_departments() TO anon, authenticated, service_role;

COMMIT;
