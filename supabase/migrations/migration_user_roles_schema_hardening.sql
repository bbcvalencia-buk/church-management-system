-- Harden user_roles structure so role assignments are strict and clean
DELETE FROM user_roles WHERE member_id IS NULL;

ALTER TABLE user_roles
ALTER COLUMN member_id SET NOT NULL;

ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles
ADD CONSTRAINT user_roles_role_check
CHECK (role IN (
  'super_admin',
  'church_clerk',
  'treasurer',
  'music_minister',
  'sunday_school_admin',
  'activity_coordinator',
  'member'
));

CREATE INDEX IF NOT EXISTS idx_user_roles_member_id ON user_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
