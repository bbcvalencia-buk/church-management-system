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

  console.log("Updating database trigger set_member_number()...");
  
  // We can execute raw SQL to update the function on Supabase via a RPC if one exists, or by running SQL directly.
  // Wait, let's check if we can run it using the postgres client or by executing a SQL command.
  // Since we have the PG pooler connection string, let's use the PG client to run the DDL update!
  // It is 100% reliable for updating functions and triggers!
  const pkg = await import('pg');
  const { Client } = pkg.default;
  const client = new Client({
    user: 'postgres.ljblxpbssopkugmadnqj',
    password: 'N4ABybQYzJTx2VQa',
    host: 'aws-1-ap-southeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("Connected to PG database successfully.");

  const updateFunctionSql = `
CREATE OR REPLACE FUNCTION public.set_member_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_year INTEGER;
    v_seq INTEGER;
BEGIN
    -- Only assign sequential member numbers to regular members
    IF NEW.member_number IS NULL AND COALESCE(NEW.is_regular_member, FALSE) = TRUE THEN
        v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
        
        SELECT COALESCE(MAX(member_number_seq), 0) + 1
        INTO v_seq
        FROM public.members
        WHERE member_number_year = v_year;

        NEW.member_number_year := v_year;
        NEW.member_number_seq := v_seq;
        NEW.member_number := 'BBC-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;
  `;

  await client.query(updateFunctionSql);
  console.log("✅ Trigger function public.set_member_number() updated successfully.");

  // Clear existing member numbers for shadow visitor records
  const clearVisitorNumbersSql = `
UPDATE public.members 
SET member_number = NULL, member_number_year = NULL, member_number_seq = NULL
WHERE is_regular_member = FALSE;
  `;

  const clearRes = await client.query(clearVisitorNumbersSql);
  console.log(`✅ Cleared member numbers for ${clearRes.rowCount} visitor shadow records.`);

  await client.end();
}

main().catch(console.error);
