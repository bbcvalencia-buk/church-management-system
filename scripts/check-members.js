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

  // Get all members
  const { data: members, error: mErr } = await supabase.from('members').select('*');
  if (mErr) throw mErr;

  // Get all visitors
  const { data: visitors, error: vErr } = await supabase.from('visitors').select('member_id');
  if (vErr) throw vErr;

  const visitorMemberIdSet = new Set(visitors.map(v => v.member_id).filter(Boolean));

  console.log(`Total members in DB: ${members.length}`);
  console.log(`Total visitors in DB: ${visitors.length}`);

  const falseRegularMembers = members.filter(m => m.is_regular_member === false || m.is_regular_member === null);
  console.log(`Members with is_regular_member = false or null: ${falseRegularMembers.length}`);

  console.log("\nDetails of false/null is_regular_member members:");
  for (const m of falseRegularMembers) {
    const isLinkedToVisitor = visitorMemberIdSet.has(m.id);
    console.log(`- ${m.surname}, ${m.first_name} | ID: ${m.id} | Linked to visitor: ${isLinkedToVisitor} | member_number: ${m.member_number}`);
  }
}

main().catch(console.error);
