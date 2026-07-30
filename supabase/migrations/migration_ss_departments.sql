BEGIN;

-- 1. Remove constraint from sunday_school_sessions
ALTER TABLE public.sunday_school_sessions DROP CONSTRAINT IF EXISTS sunday_school_sessions_department_check;

-- 2. Migrate existing records in sunday_school_sessions
UPDATE public.sunday_school_sessions
SET department = CASE 
  WHEN visitor_card_url ILIKE '%nursery%' OR visitor_card_url ILIKE '%kinder%' OR visitor_card_url ILIKE '%toddler%' THEN 'nursery'
  WHEN visitor_card_url ILIKE '%primary%' THEN 'primary'
  ELSE 'nursery' 
END
WHERE department = 'nursery_kinder_primary';

-- 3. Add new check constraint
ALTER TABLE public.sunday_school_sessions ADD CONSTRAINT sunday_school_sessions_department_check 
  CHECK (department IN ('adult', 'beginners', 'nursery', 'kinder', 'primary', 'junior'));

-- 4. Update church_positions (teachers)
UPDATE public.church_positions
SET department = CASE 
  WHEN specific_role ILIKE '%nursery%' OR specific_role ILIKE '%kinder%' OR specific_role ILIKE '%toddler%'
       OR position_name ILIKE '%nursery%' OR position_name ILIKE '%kinder%' OR position_name ILIKE '%toddler%' THEN 'nursery'
  WHEN specific_role ILIKE '%primary%' OR position_name ILIKE '%primary%' THEN 'primary'
  ELSE 'nursery'
END
WHERE department = 'nursery_kinder_primary';

-- 5. Update functions
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

COMMIT;
