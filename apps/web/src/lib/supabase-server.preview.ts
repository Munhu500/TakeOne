// Static preview: there is no server. "Server" queries run in the browser with the signed-in user's session (RLS applies).
import { supabaseBrowser } from './supabase-browser';

export async function supabaseServer() {
  return supabaseBrowser();
}
