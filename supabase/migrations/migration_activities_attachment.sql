-- Run this in your Supabase SQL Editor to fix the Activities table
-- This adds the 'attachment_url' column which was missing and causing the 400 Bad Request error.

ALTER TABLE activities ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- We also noticed a missing 'description' column which might be useful for your new Detailed View
ALTER TABLE activities ADD COLUMN IF NOT EXISTS description TEXT;
