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

const splitVisitorName = (fullName) => {
  const name = fullName.trim();
  const spaceIdx = name.lastIndexOf(' ');
  if (spaceIdx === -1) {
    return { firstName: name, surname: '' };
  }
  return {
    firstName: name.slice(0, spaceIdx).trim(),
    surname: name.slice(spaceIdx + 1).trim(),
  };
};

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch visitors where member_id is null
  const { data: visitors, error: fetchErr } = await supabase
    .from('visitors')
    .select('*')
    .is('member_id', null);

  if (fetchErr) {
    throw new Error(`Failed to fetch visitors: ${fetchErr.message}`);
  }

  console.log(`Found ${visitors.length} visitors missing a member_id.`);

  if (visitors.length === 0) {
    console.log("No repair needed.");
    return;
  }

  let repairedCount = 0;
  for (const visitor of visitors) {
    const parsedName = splitVisitorName(visitor.name);
    
    // Create shadow member record
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .insert({
        first_name: parsedName.firstName || 'Visitor',
        surname: parsedName.surname || '',
        is_regular_member: false,
        membership_status: 'active',
        home_address: visitor.address || 'Unknown',
        phone_number: visitor.contact_number || 'N/A',
        gender: visitor.gender,
        civil_status: visitor.marital_status || 'Single',
        date_of_birth: visitor.date_of_birth || new Date().toISOString().split('T')[0]
      })
      .select('id')
      .single();

    if (memberErr) {
      console.error(`Failed to create member for visitor ${visitor.name}:`, memberErr.message);
      continue;
    }

    // Link visitor to the newly created member
    const { error: updateErr } = await supabase
      .from('visitors')
      .update({ member_id: member.id })
      .eq('id', visitor.id);

    if (updateErr) {
      console.error(`Failed to link visitor ${visitor.name} to member ${member.id}:`, updateErr.message);
    } else {
      repairedCount++;
      console.log(`Successfully repaired visitor "${visitor.name}" with member ID: ${member.id}`);
    }
  }

  console.log(`Repaired ${repairedCount} out of ${visitors.length} visitors.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
