-- ============================================================================
-- SQL PATCH: GRANT RECORDING SECRETARY RLS ACCESS FOR ATTENDANCE
-- ============================================================================
-- Run this in your Supabase SQL Editor to update RLS permissions for the 
-- 'recording_secretary' role so they can search all members, load services/activities/SS,
-- and manage attendance logs & visitors.

BEGIN;

-- 1. MEMBERS SELECT POLICY
DROP POLICY IF EXISTS members_select_policy ON public.members;
CREATE POLICY members_select_policy ON public.members FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator', 'recording_secretary'])
  OR id = public.app_current_member_id()
  OR (public.app_has_role('music_minister') AND EXISTS (
      SELECT 1 FROM public.church_positions cp 
      WHERE cp.member_id = public.members.id AND cp.position_category = 'music_ministry' AND cp.is_active = TRUE
  ))
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
);

-- 2. SERVICES SELECT POLICY
DROP POLICY IF EXISTS services_select_policy ON public.services;
CREATE POLICY services_select_policy ON public.services FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'recording_secretary'])
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'service' AND al.event_id::text = public.services.id::text AND al.member_id = public.app_current_member_id())
);

-- 3. SUNDAY SCHOOL SESSIONS SELECT POLICY
DROP POLICY IF EXISTS sunday_school_sessions_select_policy ON public.sunday_school_sessions;
CREATE POLICY sunday_school_sessions_select_policy ON public.sunday_school_sessions FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR public.app_can_manage_sunday_school_department(public.sunday_school_sessions.department)
  OR EXISTS (SELECT 1 FROM public.attendance_log al WHERE al.event_type = 'sunday_school' AND al.event_id::text = public.sunday_school_sessions.id::text AND al.member_id = public.app_current_member_id())
);

-- 4. ACTIVITIES SELECT POLICY
DROP POLICY IF EXISTS activities_select_policy ON public.activities;
CREATE POLICY activities_select_policy ON public.activities FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'treasurer', 'sunday_school_admin', 'activity_coordinator', 'recording_secretary'])
);

-- 5. ATTENDANCE LOG POLICIES (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS attendance_log_select_policy ON public.attendance_log;
CREATE POLICY attendance_log_select_policy ON public.attendance_log FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
  OR member_id = public.app_current_member_id()
);

DROP POLICY IF EXISTS attendance_log_insert_policy ON public.attendance_log;
CREATE POLICY attendance_log_insert_policy ON public.attendance_log FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

DROP POLICY IF EXISTS attendance_log_update_policy ON public.attendance_log;
CREATE POLICY attendance_log_update_policy ON public.attendance_log FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

DROP POLICY IF EXISTS attendance_log_delete_policy ON public.attendance_log;
CREATE POLICY attendance_log_delete_policy ON public.attendance_log FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'recording_secretary'])
  OR (event_type = 'sunday_school' AND (public.app_has_role('sunday_school_admin') OR public.app_can_manage_sunday_school_session(event_id::UUID)))
  OR (public.app_has_role('activity_coordinator') AND event_type = 'activity')
  OR (public.app_has_role('music_minister') AND event_type = 'music_practice')
);

-- 6. VISITORS POLICIES (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS visitors_select_policy ON public.visitors;
CREATE POLICY visitors_select_policy ON public.visitors FOR SELECT USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

DROP POLICY IF EXISTS visitors_insert_policy ON public.visitors;
CREATE POLICY visitors_insert_policy ON public.visitors FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

DROP POLICY IF EXISTS visitors_update_policy ON public.visitors;
CREATE POLICY visitors_update_policy ON public.visitors FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

DROP POLICY IF EXISTS visitors_delete_policy ON public.visitors;
CREATE POLICY visitors_delete_policy ON public.visitors FOR DELETE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk', 'sunday_school_admin', 'recording_secretary'])
  OR (public.app_is_sunday_school_teacher() AND sunday_school_session_id IS NOT NULL AND public.app_can_manage_sunday_school_session(sunday_school_session_id::UUID))
);

COMMIT;
