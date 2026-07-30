-- Migration: Add assessment_score column to attendance_log
-- This allows Sunday School teachers to track student scores for assessment review questions.
-- A NULL value means no score was recorded. 0 = did not submit, positive number = score achieved.

ALTER TABLE attendance_log
ADD COLUMN IF NOT EXISTS assessment_score smallint DEFAULT NULL;

-- Add an index for performance when querying scores
CREATE INDEX IF NOT EXISTS idx_attendance_log_assessment_score
ON attendance_log (event_type, event_id)
WHERE assessment_score IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN attendance_log.assessment_score IS 'Tracks Sunday School assessment/review question scores. NULL = not recorded, 0 = did not submit, positive = score.';
