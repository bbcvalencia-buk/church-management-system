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

  // 1. Get all members who are visitors (is_regular_member = false)
  const { data: visitorMembers, error: mErr } = await supabase
    .from('members')
    .select('id, surname, first_name, member_number')
    .eq('is_regular_member', false);

  if (mErr) throw mErr;

  console.log(`Found ${visitorMembers.length} visitor shadow members.`);

  let clearedCount = 0;
  for (const m of visitorMembers) {
    if (m.member_number) {
      const { error } = await supabase
        .from('members')
        .update({
          member_number: null,
          member_number_year: null,
          member_number_seq: null
        })
        .eq('id', m.id);

      if (error) {
        console.error(`Failed to clear number for ${m.surname}, ${m.first_name}:`, error.message);
      } else {
        console.log(`Cleared member number for visitor: ${m.surname}, ${m.first_name}`);
        clearedCount++;
      }
    }
  }

  console.log(`Successfully cleared ${clearedCount} visitor member numbers in the database.`);
}

main().catch(console.error);
