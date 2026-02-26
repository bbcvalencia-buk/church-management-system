import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

function eventTableForType(type) {
  if (type === 'service') return 'services';
  if (type === 'sunday_school') return 'sunday_school_sessions';
  if (type === 'music_practice') return 'music_practice_sessions';
  if (type === 'activity') return 'activities';
  return null;
}

async function findMemberId(oldId) {
  if (!oldId) return null;
  const { data } = await supabase
    .from('members')
    .select('id')
    .or(`legacy_v1_id.eq.${oldId},id.eq.${oldId}`)
    .limit(1);
  return data?.[0]?.id || null;
}

async function findEventId(type, oldEventId) {
  const table = eventTableForType(type);
  if (!table || !oldEventId) return null;
  const { data } = await supabase
    .from(table)
    .select('id')
    .or(`legacy_v1_id.eq.${oldEventId},id.eq.${oldEventId}`)
    .limit(1);
  return data?.[0]?.id || null;
}

async function resolveConflict(id, resolution) {
  await supabase
    .from('import_conflicts')
    .update({
      resolved_at: new Date().toISOString(),
      resolution
    })
    .eq('id', id)
    .is('resolved_at', null);
}

async function run() {
  const { data: conflicts, error } = await supabase
    .from('import_conflicts')
    .select('id, import_type, conflict_reason, raw_data')
    .is('resolved_at', null)
    .order('id', { ascending: true });

  if (error) {
    console.error('Failed to fetch conflicts:', error.message);
    process.exit(1);
  }

  let resolved = 0;
  let checked = 0;

  for (const c of conflicts || []) {
    checked++;

    if (c.import_type === 'financial') {
      const legacy = c.raw_data?.id;
      const { data } = await supabase
        .from('financial_records')
        .select('id')
        .eq('legacy_v1_id', legacy)
        .limit(1);
      if (data && data.length > 0) {
        await resolveConflict(c.id, 'auto_resolved:financial_record_exists');
        resolved++;
      }
      continue;
    }

    if (c.import_type === 'faith_promise') {
      const memberId = await findMemberId(c.raw_data?.member_id);
      const year = c.raw_data?.year ? parseInt(c.raw_data.year, 10) : null;
      if (!memberId || !year) continue;
      const { data } = await supabase
        .from('faith_promise_commitments')
        .select('id')
        .eq('member_id', memberId)
        .eq('year', year)
        .limit(1);
      if (data && data.length > 0) {
        await resolveConflict(c.id, 'auto_resolved:faith_promise_exists');
        resolved++;
      }
      continue;
    }

    if (c.import_type === 'attendance') {
      const memberId = await findMemberId(c.raw_data?.member_id);
      const eventId = await findEventId(c.raw_data?.event_type, c.raw_data?.event_id);
      if (!memberId || !eventId) continue;
      const { data } = await supabase
        .from('attendance_log')
        .select('id')
        .eq('member_id', memberId)
        .eq('event_type', c.raw_data?.event_type)
        .eq('event_id', eventId)
        .limit(1);
      if (data && data.length > 0) {
        await resolveConflict(c.id, 'auto_resolved:attendance_exists');
        resolved++;
      }
      continue;
    }
  }

  const { count } = await supabase
    .from('import_conflicts')
    .select('*', { head: true, count: 'exact' })
    .is('resolved_at', null);

  console.log(`Checked: ${checked}`);
  console.log(`Auto-resolved: ${resolved}`);
  console.log(`Remaining unresolved: ${count}`);
}

run();
