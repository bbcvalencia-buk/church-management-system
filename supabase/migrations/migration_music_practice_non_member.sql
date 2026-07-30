-- Add non_member_attendance column to music_practice_sessions
ALTER TABLE music_practice_sessions
  ADD COLUMN IF NOT EXISTS non_member_attendance INTEGER NOT NULL DEFAULT 0;
