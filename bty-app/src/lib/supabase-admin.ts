import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let loggedMissingAdminEnv = false;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (!loggedMissingAdminEnv) {
      loggedMissingAdminEnv = true;
      console.error(
        "[getSupabaseAdmin] MISSING ENV: " +
          `url=${Boolean(url)} key=${Boolean(key)}. ` +
          "Contract creation and other service-role paths will fail.",
      );
    }
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { DayEntry, JourneyProfile } from "./supabase-admin-types";
