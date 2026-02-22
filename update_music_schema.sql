-- Remove the strict CHECK constraint to allow dynamic ministries from the Directory to be assigned as Practice Types.
ALTER TABLE music_practice_sessions DROP CONSTRAINT IF EXISTS music_practice_sessions_practice_type_check;
