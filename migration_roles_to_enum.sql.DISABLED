-- migration_roles_to_enum.sql
-- Run this in the Supabase SQL Editor to switch the "role" text column to an enum type

-- 1. Create the enum type 'app_role' 
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM (
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
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Drop the existing text constraint/check on the role column 
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- 3. Alter the "role" column to use the new app_role enum type.
-- The USING clause safely casts existing text values to the new enum type.
ALTER TABLE public.user_roles 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role,
  ALTER COLUMN role SET DEFAULT 'member'::public.app_role;
