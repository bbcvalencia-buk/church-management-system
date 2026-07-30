-- Add JSONB column to activities table for type-specific fields
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS activity_data JSONB DEFAULT '{}'::jsonb;
