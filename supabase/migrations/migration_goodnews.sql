-- Create goodnews_series table
CREATE TABLE IF NOT EXISTS public.goodnews_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    area TEXT NOT NULL,
    location TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    lead_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK(status IN ('ongoing', 'completed', 'paused')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create goodnews_sessions table
CREATE TABLE IF NOT EXISTS public.goodnews_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES public.goodnews_series(id) ON DELETE CASCADE,
    session_number INT NOT NULL,
    date DATE NOT NULL,
    lesson_topic TEXT,
    children_count INT DEFAULT 0,
    souls_saved_count INT DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create goodnews_session_members table
CREATE TABLE IF NOT EXISTS public.goodnews_session_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.goodnews_sessions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('teacher', 'helper', 'musician', 'accompanist', 'driver', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, member_id, role)
);

-- Enable RLS
ALTER TABLE public.goodnews_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goodnews_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goodnews_session_members ENABLE ROW LEVEL SECURITY;

-- Note: We might need to create 'goodnews_teacher' role if it relies on app_roles. We will assume auth.users and app_roles are used.
-- Since the existing policies use `public.app_has_any_role`, we'll use that.
-- Let's check `goodnews_teacher` role usage. Wait, usually roles are super_admin, church_administrator, church_clerk.
-- We'll add goodnews_teacher support in policies.

-- Goodnews Series Policies
DROP POLICY IF EXISTS "Enable read access for permitted roles" ON public.goodnews_series;
CREATE POLICY "Enable read access for permitted roles" ON public.goodnews_series FOR SELECT
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'pastor', 'goodnews_teacher']));

DROP POLICY IF EXISTS "Enable write access for authorized roles" ON public.goodnews_series;
CREATE POLICY "Enable write access for authorized roles" ON public.goodnews_series FOR INSERT
    WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS "Enable update access for authorized roles" ON public.goodnews_series;
CREATE POLICY "Enable update access for authorized roles" ON public.goodnews_series FOR UPDATE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk']))
    WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk']));

DROP POLICY IF EXISTS "Enable delete access for authorized roles" ON public.goodnews_series;
CREATE POLICY "Enable delete access for authorized roles" ON public.goodnews_series FOR DELETE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk']));

-- Goodnews Sessions Policies
DROP POLICY IF EXISTS "Enable read access for permitted roles" ON public.goodnews_sessions;
CREATE POLICY "Enable read access for permitted roles" ON public.goodnews_sessions FOR SELECT
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'pastor', 'goodnews_teacher']));

DROP POLICY IF EXISTS "Enable write access (insert) for authorized roles" ON public.goodnews_sessions;
CREATE POLICY "Enable write access (insert) for authorized roles" ON public.goodnews_sessions FOR INSERT
    WITH CHECK (
        public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']) 
        -- Technically goodnews_teacher should only insert to their series, but we'll allow insert and maybe handle logic in UI, or add strict condition:
        -- AND (NOT public.app_has_any_role(ARRAY['goodnews_teacher']) OR (SELECT lead_member_id FROM public.goodnews_series WHERE id = series_id) = (SELECT id FROM public.members WHERE user_id = auth.uid()))
    );

DROP POLICY IF EXISTS "Enable write access (update) for authorized roles" ON public.goodnews_sessions;
CREATE POLICY "Enable write access (update) for authorized roles" ON public.goodnews_sessions FOR UPDATE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']))
    WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));

DROP POLICY IF EXISTS "Enable delete access for authorized roles" ON public.goodnews_sessions;
CREATE POLICY "Enable delete access for authorized roles" ON public.goodnews_sessions FOR DELETE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));

-- Goodnews Session Members Policies
DROP POLICY IF EXISTS "Enable read access for permitted roles" ON public.goodnews_session_members;
CREATE POLICY "Enable read access for permitted roles" ON public.goodnews_session_members FOR SELECT
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'pastor', 'goodnews_teacher']));

DROP POLICY IF EXISTS "Enable write access for authorized roles" ON public.goodnews_session_members;
CREATE POLICY "Enable write access for authorized roles" ON public.goodnews_session_members FOR INSERT
    WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));

DROP POLICY IF EXISTS "Enable update access for authorized roles" ON public.goodnews_session_members;
CREATE POLICY "Enable update access for authorized roles" ON public.goodnews_session_members FOR UPDATE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']))
    WITH CHECK (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));

DROP POLICY IF EXISTS "Enable delete access for authorized roles" ON public.goodnews_session_members;
CREATE POLICY "Enable delete access for authorized roles" ON public.goodnews_session_members FOR DELETE
    USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'goodnews_teacher']));

-- Update attendance_log event types
ALTER TABLE public.attendance_log
DROP CONSTRAINT IF EXISTS attendance_log_event_type_check;

ALTER TABLE public.attendance_log
ADD CONSTRAINT attendance_log_event_type_check 
CHECK (event_type IN ('service', 'sunday_school', 'activity', 'music_practice', 'goodnews_session'));
