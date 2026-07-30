-- Add system_version column to system_settings table
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS system_version TEXT DEFAULT 'v1.0.0';
