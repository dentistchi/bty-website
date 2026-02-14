import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Server Supabase client (anon key). Returns null when env is missing. */
export function createServerSupabaseClient(): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key);
}
