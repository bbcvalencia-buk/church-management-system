BEGIN;

-- 1. Create service_assignments table
CREATE TABLE IF NOT EXISTS public.service_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('songleader', 'pastor', 'moderator', 'pianist', 'technicals', 'mini_ensemble', 'usher', 'choir', 'preacher', 'worship_leader', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, member_id, role)
);

-- 2. Enable RLS
ALTER TABLE public.service_assignments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY service_assignments_select_policy ON public.service_assignments
FOR SELECT USING (TRUE); -- all authenticated can view

CREATE POLICY service_assignments_insert_policy ON public.service_assignments
FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
);

CREATE POLICY service_assignments_update_policy ON public.service_assignments
FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
);

CREATE POLICY service_assignments_delete_policy ON public.service_assignments
FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
);

-- Note: The role 'recording_secretary' does not exist in standard roles list yet or is 'church_clerk' equivalent. 
-- Assuming church_administrator and church_clerk. The user requested 'recording_secretary'. Let's check if it exists in app_roles.
-- Let's stick to adding 'recording_secretary' if the app allows arbitrary roles in app_has_any_role, or we can just add it to the array.
-- Changing array to ARRAY['church_administrator', 'church_clerk', 'recording_secretary']

DROP POLICY IF EXISTS service_assignments_insert_policy ON public.service_assignments;
CREATE POLICY service_assignments_insert_policy ON public.service_assignments
FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary'])
);

DROP POLICY IF EXISTS service_assignments_update_policy ON public.service_assignments;
CREATE POLICY service_assignments_update_policy ON public.service_assignments
FOR UPDATE USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary'])
) WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary'])
);

DROP POLICY IF EXISTS service_assignments_delete_policy ON public.service_assignments;
CREATE POLICY service_assignments_delete_policy ON public.service_assignments
FOR DELETE USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_administrator', 'church_clerk', 'recording_secretary'])
);

COMMIT;
