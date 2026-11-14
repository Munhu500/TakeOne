// Supabase Edge Function: runs the scheduled jobs (escrow auto-approve after 5 days, ledger cleared → available,
// renewal reminders, guarantee checks, leaderboard refresh). Schedule it with pg_cron / the dashboard's cron UI, e.g. every 10 minutes.
// The video worker also calls the same database function on its own tick, so this is optional when a worker is running.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.rpc('run_scheduled_jobs');
  // Hook: refresh fx_rates here from your FX provider before returning.
  return new Response(JSON.stringify(error ? { error: error.message } : data), { status: error ? 500 : 200, headers: { 'content-type': 'application/json' } });
});
