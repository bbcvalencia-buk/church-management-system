-- Link visitors directly to Sunday School sessions for card/source tracing
ALTER TABLE visitors
ADD COLUMN IF NOT EXISTS sunday_school_session_id UUID REFERENCES sunday_school_sessions(id);

CREATE INDEX IF NOT EXISTS idx_visitors_service_id ON visitors(service_id);
CREATE INDEX IF NOT EXISTS idx_visitors_sunday_school_session_id ON visitors(sunday_school_session_id);
