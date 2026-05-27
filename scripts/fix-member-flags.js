import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const file = fs.existsSync('.env.local') ? '.env.local' : '.env';
  const raw = fs.readFileSync(file, 'utf8');
  return Object.fromEntries(
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        let key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return [key, val];
      })
  );
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Get all visitors to compile a list of shadow member IDs
  const { data: visitors, error: vErr } = await supabase
    .from('visitors')
    .select('member_id')
    .not('member_id', 'is', null);

  if (vErr) throw vErr;

  const shadowMemberIds = visitors.map(v => v.member_id).filter(Boolean);
  console.log(`Found ${shadowMemberIds.length} shadow member IDs from visitors table.`);

  // 2. Fetch all members who have is_regular_member = false or null
  const { data: falseMembers, error: fErr } = await supabase
    .from('members')
    .select('id, surname, first_name')
    .or('is_regular_member.eq.false,is_regular_member.is.null');

  if (fErr) throw fErr;

  const shadowSet = new Set(shadowMemberIds);
  let count = 0;
  for (const m of falseMembers) {
    if (!shadowSet.has(m.id)) {
      const { error } = await supabase
        .from('members')
        .update({ is_regular_member: true })
        .eq('id', m.id);
      if (error) {
        console.error(`Failed to update ${m.surname}, ${m.first_name}:`, error.message);
      } else {
        console.log(`Updated ${m.surname}, ${m.first_name} to be a regular member.`);
        count++;
      }
    }
  }
  console.log(`Successfully updated ${count} members to be regular members.`);
}

main().catch(console.error);
