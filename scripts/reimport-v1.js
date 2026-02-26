import fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file = '.env.local') {
  const raw = fs.readFileSync(file, 'utf8');
  return Object.fromEntries(
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

async function tryRpcReset(supabase) {
  const rpcNames = ['messy_hard_reset_all_data', 'reset_all_data'];

  for (const fn of rpcNames) {
    const { error } = await supabase.rpc(fn);
    if (!error) {
      console.log(`[reset] RPC succeeded: ${fn}`);
      return true;
    }
    console.log(`[reset] RPC failed: ${fn} -> ${error.message}`);
  }

  return false;
}

async function fallbackDeleteReset(supabase) {
  // Child-first best effort to satisfy FK constraints.
  const tables = [
    'attendance_log',
    'service_assignments',
    'goodnews_session_members',
    'goodnews_sessions',
    'goodnews_series',
    'church_events',
    'activities',
    'music_practice_sessions',
    'sunday_school_sessions',
    'services',
    'financial_records',
    'faith_promise_commitments',
    'financial_period_locks',
    'financial_audit_log',
    'family_relationships',
    'church_positions',
    'user_roles',
    'visitors',
    'import_conflicts',
    'members',
    'import_export_log'
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null);

    if (error) {
      // Some tables might not exist in all deployments; keep going.
      console.log(`[reset] delete ${table}: ${error.message}`);
    } else {
      console.log(`[reset] delete ${table}: OK`);
    }
  }
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  const env = loadEnv();
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('=== STEP 1: Resetting Supabase data ===');
  const rpcReset = await tryRpcReset(supabase);
  if (!rpcReset) {
    console.log('[reset] Falling back to table-by-table delete...');
    await fallbackDeleteReset(supabase);
  }

  console.log('\n=== STEP 2: Re-importing V1 exports ===');
  run('node scripts/migrate-all.js');

  console.log('\n=== STEP 3: Reconciling import conflicts ===');
  run('node scripts/reconcile-import-conflicts.js');

  console.log('\n=== STEP 4: Verification snapshot ===');
  run('node scripts/verify-system-v2.js');

  console.log('\nDone. Check scripts/logs/verify_system_v2_report.md and migration logs.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
