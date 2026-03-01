-- Fix for duplicate key value violates unique constraint "members_id_number_key"
-- Run this script in your Supabase SQL Editor.

-- This command will reset the PostgreSQL sequence so that the next generated
-- ID number is guaranteed to be higher than the maximum existing ID.
SELECT setval(
    pg_get_serial_sequence('public.members', 'id_number'), 
    COALESCE((SELECT MAX(id_number) FROM public.members), 0)
) FROM public.members;

-- Notify postgrest to reload the schema cache just in case
NOTIFY pgrst, 'reload schema';
