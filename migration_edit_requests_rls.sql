-- Enable RLS on member_profile_edit_requests and allow all operations (dev mode)
ALTER TABLE member_profile_edit_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to insert edit requests
CREATE POLICY "Enable insert for all authenticated users"
  ON member_profile_edit_requests
  FOR INSERT
  WITH CHECK (true);

-- Allow all authenticated users to read edit requests
CREATE POLICY "Enable read for all authenticated users"
  ON member_profile_edit_requests
  FOR SELECT
  USING (true);

-- Allow all authenticated users to update (for admin approval)
CREATE POLICY "Enable update for all authenticated users"
  ON member_profile_edit_requests
  FOR UPDATE
  USING (true);

-- Allow delete
CREATE POLICY "Enable delete for all authenticated users"
  ON member_profile_edit_requests
  FOR DELETE
  USING (true);
