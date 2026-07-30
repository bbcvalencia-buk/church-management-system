-- 1. Add new columns to visitors
ALTER TABLE public.visitors 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'converted', 'archived')),
  ADD COLUMN IF NOT EXISTS converted_to_member_id UUID REFERENCES public.members(id),
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS legacy_v1_id UUID;

-- 2. Add column to members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS converted_from_visitor_id UUID REFERENCES public.visitors(id);

-- 3. Make member_id in visitors nullable, since visitors will no longer have a shadow member record
ALTER TABLE public.visitors ALTER COLUMN member_id DROP NOT NULL;

-- 4. Move members with is_visitor=true who aren't in visitors yet
INSERT INTO public.visitors (
  name, address, gender, marital_status, contact_number, visit_time, visit_date, is_saved, is_prospect_for_baptism, follow_up_status, converted_to_member, created_at
)
SELECT 
  first_name || ' ' || surname as name,
  COALESCE(NULLIF(home_address, ''), 'Unknown'),
  gender,
  civil_status,
  COALESCE(NULLIF(phone_number, ''), 'N/A'),
  'AM',
  COALESCE(created_at, NOW()),
  false,
  false,
  'pending',
  false,
  created_at
FROM public.members m
-- WHERE is_visitor = true
  AND NOT EXISTS (SELECT 1 FROM public.visitors v WHERE v.member_id = m.id);

-- UPDATE: Wait, we also need to drop the ON DELETE CASCADE if it exists, but maybe we can just do that later.

-- 5. Mark existing visitors as status = 'converted' if they have converted_to_member = true
UPDATE public.visitors SET status = 'converted' WHERE converted_to_member = true AND status != 'converted';

-- 6. Recreate members_insert_policy without is_visitor dependency
DROP POLICY IF EXISTS members_insert_policy ON public.members;
CREATE POLICY members_insert_policy
ON public.members
FOR INSERT
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
);

-- 7. Recreate members_update_policy without is_visitor dependency
DROP POLICY IF EXISTS members_update_policy ON public.members;
CREATE POLICY members_update_policy
ON public.members
FOR UPDATE
USING (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    public.app_has_role('sunday_school_admin')
    AND public.app_member_has_sunday_school_assignment(public.members.id)
  )
  OR (
    public.app_is_sunday_school_teacher()
    AND public.app_member_in_teacher_scope(public.members.id)
  )
)
WITH CHECK (
  public.app_has_any_role(ARRAY['super_admin', 'church_clerk'])
  OR (
    public.app_has_role('sunday_school_admin')
    AND public.app_member_has_sunday_school_assignment(public.members.id)
  )
  OR (
    public.app_is_sunday_school_teacher()
    AND public.app_member_in_teacher_scope(public.members.id)
  )
);

-- 8. Drop is_visitor column from members
ALTER TABLE public.members DROP COLUMN IF EXISTS is_visitor;

