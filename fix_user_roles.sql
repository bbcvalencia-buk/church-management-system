
-- FIX USER ROLES TABLE
-- Run this script in your Supabase SQL Editor to resolve the "400 Bad Request" error.

-- 1. Drop existing table to clear any bad schema/data
DROP TABLE IF EXISTS user_roles;

-- 2. Re-create the table with the correct structure matching our Auth System
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin', 'church_clerk', 'treasurer', 'music_minister', 'sunday_school_admin', 'activity_coordinator', 'member')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_member_role UNIQUE (member_id, role)
);

-- 3. Enable RLS (Security) but allow access for now
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy: Allow everyone to read/write for now (Development Mode)
CREATE POLICY "Enable all for user_roles" 
ON user_roles 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Insert a Super Admin Role for yourself (OPTIONAL - Replace with your Member ID)
-- INSERT INTO user_roles (member_id, role) 
-- VALUES ('YOUR-MEMBER-ID-HERE', 'super_admin');
