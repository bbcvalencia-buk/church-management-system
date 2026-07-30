-- Allow explicit ministry head selection in church_positions
ALTER TABLE church_positions
ADD COLUMN IF NOT EXISTS is_ministry_head BOOLEAN NOT NULL DEFAULT FALSE;

