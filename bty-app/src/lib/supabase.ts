import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Browser Supabase client. null when env is missing (safe for prerender/Edge). */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

/** Use when Supabase must be configured (throws clear error if env missing). */
export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  return supabase;
}
