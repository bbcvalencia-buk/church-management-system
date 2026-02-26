
-- ============================================================================
-- BIBLE BAPTIST CHURCH MANAGEMENT SYSTEM
-- COMPLETE DATABASE SCHEMA
-- ============================================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CLEANUP (CAREFUL: DROPS EVERYTHING)
DROP MATERIALIZED VIEW IF EXISTS dashboard_stats CASCADE;
DROP VIEW IF EXISTS active_members CASCADE;
DROP VIEW IF EXISTS current_visitors CASCADE;
DROP VIEW IF EXISTS member_attendance_summary CASCADE;
DROP VIEW IF EXISTS member_financial_summary CASCADE;

DROP TABLE IF EXISTS faith_promise_commitments CASCADE;
DROP TABLE IF EXISTS music_practice_sessions CASCADE;
DROP TABLE IF EXISTS sunday_school_sessions CASCADE;
DROP TABLE IF EXISTS attendance_log CASCADE;
DROP TABLE IF EXISTS church_positions CASCADE;
DROP TABLE IF EXISTS visitors CASCADE;
DROP TABLE IF EXISTS family_relationships CASCADE;
DROP TABLE IF EXISTS financial_records CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS import_export_log CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS members CASCADE;

-- 1. MEMBERS
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_number SERIAL UNIQUE NOT NULL,
  
  -- Biographical
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  name_ext TEXT,
  nickname TEXT,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  civil_status TEXT NOT NULL CHECK (civil_status IN ('Single', 'Married', 'Widow', 'Widower', 'Separated')),
  nationality TEXT NOT NULL DEFAULT 'Filipino',
  place_of_birth TEXT,
  
  -- Contact
  home_address TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  alternative_phone TEXT,
  email TEXT,
  
  -- Emergency
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Spiritual
  salvation_date DATE,
  baptism_date DATE,
  membership_date DATE,
  previous_church TEXT,
  previous_religion TEXT,
  
  -- Status
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'inactive', 'under_discipline')),
  is_regular_member BOOLEAN DEFAULT FALSE,
  is_visitor BOOLEAN DEFAULT FALSE,
  is_pastor BOOLEAN DEFAULT FALSE,
  is_pastors_wife BOOLEAN DEFAULT FALSE,
  
  -- Media
  profile_picture_url TEXT,
  id_card_url TEXT,
  attachment_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT pastor_id_check CHECK (NOT is_pastor OR id_number = 1),
  CONSTRAINT pastors_wife_id_check CHECK (NOT is_pastors_wife OR id_number = 2)
);

-- 1.1 USER ROLES
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin', 'church_clerk', 'treasurer', 'music_minister', 'sunday_school_admin', 'activity_coordinator', 'member')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_member_role UNIQUE (member_id, role)
);

-- 2. SERVICES
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN ('sunday_morning', 'sunday_afternoon', 'wednesday_prayer', 'pre_service', 'funeral')),
  service_date DATE NOT NULL,
  service_time TIME,
  
  members_present INTEGER NOT NULL DEFAULT 0,
  total_attendance INTEGER NOT NULL DEFAULT 0,
  visitors_present INTEGER NOT NULL DEFAULT 0,
  visitors_saved INTEGER NOT NULL DEFAULT 0,
  
  prospects_for_baptism INTEGER DEFAULT 0,
  souls_saved INTEGER NOT NULL DEFAULT 0,
  members_who_prayed INTEGER DEFAULT 0,
  
  visitor_card_url TEXT,
  sermon_title TEXT,
  sermon_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(service_date, service_type)
);

-- 3. VISITORS
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  office_address TEXT,
  marital_status TEXT NOT NULL,
  gender TEXT NOT NULL,
  church_name TEXT,
  age INTEGER,
  date_of_birth DATE,
  contact_number TEXT NOT NULL,
  invited_by TEXT,
  
  visit_time TEXT CHECK (visit_time IN ('AM', 'PM')),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_id UUID REFERENCES services(id),
  sunday_school_session_id UUID,
  
  address_sketch_url TEXT,
  visitor_card_image_url TEXT,
  visitor_card_images TEXT[] DEFAULT '{}',
  
  is_saved BOOLEAN DEFAULT FALSE,
  is_prospect_for_baptism BOOLEAN DEFAULT FALSE,
  follow_up_status TEXT NOT NULL DEFAULT 'pending',
  
  converted_to_member BOOLEAN DEFAULT FALSE,
  conversion_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CHURCH POSITIONS
CREATE TABLE church_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  position_category TEXT NOT NULL CHECK (position_category IN ('leadership', 'music_ministry', 'sunday_school_adult', 'sunday_school_children', 'beginners_class', 'other_ministries')),
  department TEXT,
  specific_role TEXT,
  is_ministry_head BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assignment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. FAMILY RELATIONSHIPS
CREATE TABLE family_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  related_member_id UUID REFERENCES members(id),
  non_member_name TEXT,
  relationship_type TEXT NOT NULL,
  non_member_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_relation_target CHECK (related_member_id IS NOT NULL OR non_member_name IS NOT NULL)
);

-- 6. FINANCIAL RECORDS
CREATE TABLE financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('tithe', 'faith_promise', 'love_gift', 'pledge')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  pledge_purpose TEXT,
  faith_promise_year INTEGER,
  notes TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id)
);

-- 7. FAITH PROMISE COMMITMENTS
CREATE TABLE faith_promise_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  promised_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, year)
);

-- 8. ACTIVITIES
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('goodnews_class', 'soul_winning', 'bible_study', 'outreach')),
  activity_date DATE NOT NULL,
  members_present INTEGER DEFAULT 0,
  non_member_attendance INTEGER NOT NULL DEFAULT 0,
  total_attendance INTEGER DEFAULT 0,
  kids_attended INTEGER DEFAULT 0,
  area TEXT,
  souls_saved INTEGER DEFAULT 0,
  tracts_distributed INTEGER DEFAULT 0,
  facebook_post_link TEXT,
  bible_study_type TEXT,
  family_name TEXT,
  mission_church_name TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8b. SERVICE ASSIGNMENTS
CREATE TABLE service_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('songleader', 'pastor', 'moderator', 'pianist', 'technicals', 'mini_ensemble', 'usher', 'choir', 'preacher', 'worship_leader', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, member_id, role)
);

-- 9. SUNDAY SCHOOL SESSIONS
CREATE TABLE sunday_school_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL CHECK (department IN ('adult', 'beginners', 'nursery', 'kinder', 'primary', 'junior')),
  session_date DATE NOT NULL,
  members_present INTEGER DEFAULT 0,
  total_attendance INTEGER DEFAULT 0,
  souls_saved INTEGER DEFAULT 0,
  visitors_present INTEGER DEFAULT 0,
  visitor_card_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE visitors
  ADD CONSTRAINT fk_visitors_sunday_school_session
  FOREIGN KEY (sunday_school_session_id) REFERENCES sunday_school_sessions(id);

-- 10. MUSIC PRACTICE SESSIONS
CREATE TABLE music_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_type TEXT NOT NULL CHECK (practice_type IN ('choir', 'mini_ensemble')),
  practice_date DATE NOT NULL,
  practice_start_time TIME NOT NULL DEFAULT '18:30:00',
  practice_end_time TIME NOT NULL DEFAULT '20:30:00',
  members_present INTEGER DEFAULT 0,
  non_member_attendance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. ATTENDANCE LOG (Individual)
CREATE TABLE attendance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('service', 'activity', 'sunday_school', 'music_practice')),
  event_id UUID NOT NULL, -- references one of the session/service tables depending on type
  event_date DATE NOT NULL,
  was_present BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, event_type, event_id)
);

-- 12. SYSTEM SETTINGS
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_name TEXT NOT NULL DEFAULT 'Bible Baptist Church',
  system_name TEXT NOT NULL DEFAULT 'Church Management System',
  church_address TEXT NOT NULL,
  church_logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. AUDIT LOG
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. IMPORT EXPORT LOG
CREATE TABLE import_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  file_format TEXT DEFAULT 'TSV',
  file_url TEXT,
  records_processed INTEGER,
  records_successful INTEGER,
  records_failed INTEGER,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. MEMBER PROFILE EDIT REQUESTS
CREATE TABLE member_profile_edit_requests (
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

CREATE INDEX idx_member_profile_edit_requests_target_member
  ON member_profile_edit_requests(target_member_id);

CREATE INDEX idx_member_profile_edit_requests_status_created
  ON member_profile_edit_requests(status, created_at DESC);

CREATE UNIQUE INDEX uq_member_profile_edit_requests_pending_target
  ON member_profile_edit_requests(target_member_id)
  WHERE status = 'pending';

-- TRIGGERS

-- Auto-membership on baptism
CREATE OR REPLACE FUNCTION sync_membership_baptism() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.baptism_date IS NOT NULL THEN
    NEW.membership_date = NEW.baptism_date;
    NEW.is_regular_member = TRUE;
    NEW.is_visitor = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_membership_baptism
BEFORE INSERT OR UPDATE ON members
FOR EACH ROW EXECUTE FUNCTION sync_membership_baptism();

-- Fixed IDs
CREATE OR REPLACE FUNCTION enforce_fixed_ids() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_pastor THEN NEW.id_number = 1;
  ELSIF NEW.is_pastors_wife THEN NEW.id_number = 2;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_fixed_ids
BEFORE INSERT ON members
FOR EACH ROW EXECUTE FUNCTION enforce_fixed_ids();

-- Financial Audit
CREATE OR REPLACE FUNCTION audit_financial_changes() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action_type, table_name, record_id, old_values, new_values, description)
  VALUES (auth.uid(), TG_OP, 'financial_records', COALESCE(NEW.id, OLD.id), to_jsonb(OLD), to_jsonb(NEW), 'Financial Record Change');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_financial
AFTER UPDATE OR DELETE ON financial_records
FOR EACH ROW EXECUTE PROCEDURE audit_financial_changes();

-- RLS POLICIES (Simulated "Allow All" for development)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for members" ON members FOR ALL USING (true);

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for visitors" ON visitors FOR ALL USING (true);

-- (Repeat for all tables in production, just a few key ones here for example)
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for financial_records" ON financial_records FOR ALL USING (true);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for services" ON services FOR ALL USING (true);

-- SEED DATA
INSERT INTO system_settings (church_name, church_address) VALUES 
('Bible Baptist Church', 'Purok 17 Hindangon, Poblacion, Valencia City, Bukidnon, Philippines');

-- DASHBOARD STATS VIEW
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM members WHERE membership_status = 'active' AND is_regular_member = TRUE AND deleted_at IS NULL) as active_members,
  (SELECT COALESCE(SUM(souls_saved), 0) FROM services WHERE service_date >= DATE_TRUNC('week', CURRENT_DATE)) as souls_saved_this_week,
  NOW() as last_updated;
