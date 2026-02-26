-- Migration: Human-readable member numbers
-- Format: BBC-YYYY-NNN (e.g., BBC-2024-001)

BEGIN;

-- 1. Add columns to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS member_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS member_number_year INTEGER,
ADD COLUMN IF NOT EXISTS member_number_seq INTEGER,
ADD COLUMN IF NOT EXISTS legacy_v1_id UUID;

-- 2. Create function to generate member number
CREATE OR REPLACE FUNCTION public.generate_member_number(p_year INTEGER) 
RETURNS VARCHAR 
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(member_number_seq), 0)
    INTO v_max_seq
    FROM public.members
    WHERE member_number_year = p_year;

    RETURN 'BBC-' || p_year::TEXT || '-' || LPAD((v_max_seq + 1)::TEXT, 3, '0');
END;
$$;

-- 3. Create BEFORE INSERT trigger function
CREATE OR REPLACE FUNCTION public.set_member_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.member_number IS NULL THEN
        v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
        
        SELECT COALESCE(MAX(member_number_seq), 0) + 1
        INTO v_seq
        FROM public.members
        WHERE member_number_year = v_year;

        NEW.member_number_year := v_year;
        NEW.member_number_seq := v_seq;
        NEW.member_number := 'BBC-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_member_number ON public.members;
CREATE TRIGGER trigger_set_member_number
BEFORE INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.set_member_number();

-- 5. Backfill existing members
DO $$
DECLARE
    m RECORD;
    v_current_year INTEGER := 0;
    v_seq INTEGER := 0;
BEGIN
    FOR m IN 
        SELECT id, created_at 
        FROM public.members 
        ORDER BY EXTRACT(YEAR FROM created_at), created_at ASC
    LOOP
        IF EXTRACT(YEAR FROM m.created_at)::INTEGER != v_current_year THEN
            v_current_year := EXTRACT(YEAR FROM m.created_at)::INTEGER;
            v_seq := 1;
        ELSE
            v_seq := v_seq + 1;
        END IF;

        UPDATE public.members 
        SET 
            member_number_year = v_current_year,
            member_number_seq = v_seq,
            member_number = 'BBC-' || v_current_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0')
        WHERE id = m.id;
    END LOOP;
END $$;

COMMIT;
