-- Member profile edit requests for admin review/notification workflow.
CREATE TABLE IF NOT EXISTS member_profile_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  requested_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  request_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_profile_edit_requests_target_member
  ON member_profile_edit_requests(target_member_id);

CREATE INDEX IF NOT EXISTS idx_member_profile_edit_requests_status_created
  ON member_profile_edit_requests(status, created_at DESC);

-- Keep only one open request per target member to avoid duplicate spam.
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_profile_edit_requests_pending_target
  ON member_profile_edit_requests(target_member_id)
  WHERE status = 'pending';

