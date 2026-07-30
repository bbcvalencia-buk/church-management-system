-- Add editable practice time window for music practices.
ALTER TABLE music_practice_sessions
  ADD COLUMN IF NOT EXISTS practice_start_time TIME,
  ADD COLUMN IF NOT EXISTS practice_end_time TIME;

UPDATE music_practice_sessions
SET
  practice_start_time = COALESCE(practice_start_time, '18:30:00'::time),
  practice_end_time = COALESCE(practice_end_time, '20:30:00'::time)
WHERE practice_start_time IS NULL OR practice_end_time IS NULL;

ALTER TABLE music_practice_sessions
  ALTER COLUMN practice_start_time SET DEFAULT '18:30:00'::time,
  ALTER COLUMN practice_end_time SET DEFAULT '20:30:00'::time,
  ALTER COLUMN practice_start_time SET NOT NULL,
  ALTER COLUMN practice_end_time SET NOT NULL;
