const fs = require('fs');

let sql = fs.readFileSync('schema_v2.sql', 'utf8');

// 1. Remove columns from public.members
sql = sql.replace(/^\s*is_regular_member\s+BOOLEAN\s+DEFAULT\s+FALSE,?\r?\n?/gm, '');
sql = sql.replace(/^\s*is_visitor\s+BOOLEAN\s+DEFAULT\s+FALSE,?\r?\n?/gm, '');
sql = sql.replace(/^\s*is_pastor\s+BOOLEAN\s+DEFAULT\s+FALSE,?\r?\n?/gm, '');
sql = sql.replace(/^\s*is_pastors_wife\s+BOOLEAN\s+DEFAULT\s+FALSE,?\r?\n?/gm, '');
// And is_saved ? Let's check where is_saved was. It was on wait, visitors table? Let's check later.

// Remove id_number
sql = sql.replace(/^\s*id_number\s+SERIAL\s+UNIQUE\s+NOT\s+NULL,?\r?\n?/gm, '');

// 2. Remove the enforce_fixed_ids trigger and function
const enforceFixedIdsRegex = /-- Enforces fixed id_numbers for specialized roles \(Pastor and Pastor's Wife\)[\s\S]*?FOR EACH ROW EXECUTE FUNCTION enforce_fixed_ids\(\);/gi;
sql = sql.replace(enforceFixedIdsRegex, '');

// 3. Update sync_membership_baptism
const syncBaptismOld = `CREATE OR REPLACE FUNCTION sync_membership_baptism() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.baptism_date IS NOT NULL THEN
    NEW.membership_date = NEW.baptism_date;
    NEW.is_regular_member = TRUE;
    NEW.is_visitor = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`;
const syncBaptismNew = `CREATE OR REPLACE FUNCTION sync_membership_baptism() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.baptism_date IS NOT NULL THEN
    NEW.membership_date = NEW.baptism_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`;
sql = sql.replace(syncBaptismOld, syncBaptismNew);
// if it fails to match exactly, use regex
sql = sql.replace(/NEW\.is_regular_member = TRUE;\n\s*NEW\.is_visitor = FALSE;\n/g, '');


// 4. Update Policy: members_insert_policy
const insertPolRegex = /CREATE POLICY members_insert_policy ON public\.members FOR INSERT WITH CHECK \([\s\S]*?\);/g;
sql = sql.replace(insertPolRegex, `CREATE POLICY members_insert_policy ON public.members FOR INSERT WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
);`);

// 5. Update Policy: members_update_policy
const updatePolRegex = /CREATE POLICY members_update_policy ON public\.members FOR UPDATE USING \([\s\S]*?\) WITH CHECK \([\s\S]*?\);/g;
sql = sql.replace(updatePolRegex, `CREATE POLICY members_update_policy ON public.members FOR UPDATE USING (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR (public.app_has_role('sunday_school_admin') AND public.app_member_has_sunday_school_assignment(public.members.id))
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
) WITH CHECK (
  public.app_has_any_role(ARRAY['church_administrator', 'church_clerk'])
  OR public.app_has_role('sunday_school_admin')
  OR (public.app_is_sunday_school_teacher() AND public.app_member_in_teacher_scope(public.members.id))
);`);

fs.writeFileSync('schema_v2.sql', sql);
console.log('Successfully stripped V1 leftover columns. Lines:', sql.split(/\\r?\\n/).length);
