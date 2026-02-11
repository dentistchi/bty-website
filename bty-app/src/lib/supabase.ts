import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Client-side (anon key) */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/** Server-side (service role) for API routes */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// DB types (matches supabase/migrations schema)
export type JourneyProfile = {
  user_id: string;
  current_day: number;
  started_at: string;
  updated_at: string;
};

export type DayEntry = {
  id?: string;
  user_id: string;
  day: number;
  completed: boolean;
  mission_checks: number[]; // indices of completed missions (0-based)
  reflection_text: string | null;
  created_at?: string;
  updated_at?: string;
};
