BEGIN;

-- 1. Create table church_events
CREATE TABLE IF NOT EXISTS public.church_events (
    id TEXT PRIMARY KEY, -- Format: EVT-YYYY-NNN
    event_name TEXT NOT NULL,
    event_type TEXT CHECK(event_type IN('fellowship','bible_quiz','camp','anniversary','special_program','other')),
    event_date DATE NOT NULL,
    location TEXT,
    total_attendance INT DEFAULT 0,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hidden sequence columns for ID generation
    event_year INTEGER,
    event_seq INTEGER
);

-- 2. Create function to generate event number
CREATE OR REPLACE FUNCTION public.set_church_event_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    IF NEW.id IS NULL THEN
        v_year := EXTRACT(YEAR FROM NEW.event_date)::INTEGER;
        
        -- Lock the table to prevent duplicate sequence numbers during concurrent inserts
        -- This is a simple way for moderate traffic sites
        LOCK TABLE public.church_events IN EXCLUSIVE MODE;
        
        SELECT COALESCE(MAX(event_seq), 0) + 1
        INTO v_seq
        FROM public.church_events
        WHERE event_year = v_year;

        NEW.event_year := v_year;
        NEW.event_seq := v_seq;
        NEW.id := 'EVT-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_set_church_event_number ON public.church_events;
CREATE TRIGGER trigger_set_church_event_number
BEFORE INSERT ON public.church_events
-- First, drop policies that depend on this column to allow the type change
DROP POLICY IF EXISTS services_select_policy ON public.services;
DROP POLICY IF EXISTS sunday_school_sessions_select_policy ON public.sunday_school_sessions;
DROP POLICY IF EXISTS attendance_log_select_policy ON public.attendance_log;
DROP POLICY IF EXISTS attendance_log_insert_policy ON public.attendance_log;
DROP POLICY IF EXISTS attendance_log_update_policy ON public.attendance_log;
DROP POLICY IF EXISTS attendance_log_delete_policy ON public.attendance_log;

-- Now change event_id from UUID to TEXT
ALTER TABLE public.attendance_log ALTER COLUMN event_id TYPE TEXT USING event_id::TEXT;

-- Recreate the dropped policies with the column casted back for comparing against UUID ids
CREATE POLICY attendance_log_select_policy ON public.attendance_log FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR member_id = public.app_current_member_id()
);

CREATE POLICY attendance_log_insert_policy ON public.attendance_log FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

CREATE POLICY attendance_log_update_policy ON public.attendance_log FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

CREATE POLICY attendance_log_delete_policy ON public.attendance_log FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
);

-- Recreate the dropped policies with the column casted back for comparing against UUID ids
CREATE POLICY services_select_policy ON public.services FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin'])
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'service' AND al.event_id = public.services.id::TEXT AND al.member_id = public.app_current_member_id())
);

CREATE POLICY sunday_school_sessions_select_policy ON public.sunday_school_sessions FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin'])
  OR public.app_can_manage_sunday_school_department(public.sunday_school_sessions.department)
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'sunday_school' AND al.event_id = public.sunday_school_sessions.id::TEXT AND al.member_id = public.app_current_member_id())
);

-- Update event_type constraint
ALTER TABLE public.attendance_log DROP CONSTRAINT IF EXISTS attendance_log_event_type_check;
ALTER TABLE public.attendance_log ADD CONSTRAINT attendance_log_event_type_check 
CHECK (event_type IN ('service', 'activity', 'sunday_school', 'music_practice', 'goodnews_session', 'church_event'));

-- 5. RLS Policies for church_events
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;

-- SELECT for all authenticated
DROP POLICY IF EXISTS church_events_select_policy ON public.church_events;
CREATE POLICY church_events_select_policy ON public.church_events
FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE for specific roles
DROP POLICY IF EXISTS church_events_all_policy ON public.church_events;
CREATE POLICY church_events_all_policy ON public.church_events
FOR ALL USING (
    public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'activity_coordinator', 'super_admin'])
);

COMMIT;
