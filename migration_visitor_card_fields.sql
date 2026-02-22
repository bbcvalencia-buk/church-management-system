
-- Add missing fields to visitors table to match the Visitor Card
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS office_address TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS church_name TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS date_of_birth DATE;
