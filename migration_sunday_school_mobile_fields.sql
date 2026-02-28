-- Add new fields for Sunday School mobile redesign
ALTER TABLE sunday_school_sessions ADD COLUMN IF NOT EXISTS lesson_topic TEXT;
ALTER TABLE sunday_school_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sunday_school_sessions ADD COLUMN IF NOT EXISTS offering_amount NUMERIC(10,2);
