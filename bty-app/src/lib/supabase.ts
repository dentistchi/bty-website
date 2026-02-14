import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Browser Supabase client. Only created when env is set (avoids build-time throw during prerender). */
export const supabase: SupabaseClient =
  url && key ? createClient(url, key) : (null as unknown as SupabaseClient);
