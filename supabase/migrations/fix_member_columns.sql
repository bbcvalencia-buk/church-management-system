-- FIX MISSING COLUMNS IN MEMBERS TABLE
-- Run this script in your Supabase SQL Editor to resolve "Could not find column" errors.

ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS name_ext TEXT,
  ADD COLUMN IF NOT EXISTS civil_status TEXT DEFAULT 'Single',
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Filipino',
  ADD COLUMN IF NOT EXISTS place_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS alternative_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS salvation_date DATE,
  ADD COLUMN IF NOT EXISTS baptism_date DATE,
  ADD COLUMN IF NOT EXISTS membership_date DATE,
  ADD COLUMN IF NOT EXISTS previous_church TEXT,
  ADD COLUMN IF NOT EXISTS previous_religion TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS id_card_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;
  
-- To ensure the schema cache is forcibly refreshed for the API:
NOTIFY pgrst, 'reload schema';
