-- Refine Sunday School departments:
-- 1) remove legacy `children` department
-- 2) keep `beginners`, `nursery_kinder_primary`, and `junior`

-- Move existing legacy records to Nursery/Kinder/Toddler bucket
UPDATE sunday_school_sessions
SET department = 'nursery_kinder_primary'
WHERE department = 'children';

ALTER TABLE sunday_school_sessions
DROP CONSTRAINT IF EXISTS sunday_school_sessions_department_check;

ALTER TABLE sunday_school_sessions
ADD CONSTRAINT sunday_school_sessions_department_check
CHECK (department IN ('adult', 'beginners', 'nursery_kinder_primary', 'junior'));
