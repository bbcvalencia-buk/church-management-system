-- Allow attendance reports to include people not yet in the member registry.
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS non_member_attendance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE music_practice_sessions
ADD COLUMN IF NOT EXISTS non_member_attendance INTEGER NOT NULL DEFAULT 0;

