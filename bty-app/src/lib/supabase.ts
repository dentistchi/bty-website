// Type only: avoid any runtime load of @supabase/supabase-js in worker (Collecting page data).
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Lazy singleton; only created in browser. Never load createClient on server to avoid jest-worker crash. */
let _client: SupabaseClient | null | undefined = undefined;

function getClient(): SupabaseClient | null {
  // Guard: worker (Collecting page data) must never load @supabase/supabase-js — no window/document.
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (_client !== undefined) return _client;
  try {
    const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    _client = url && key ? createClient(url, key) : null;
  } catch {
    _client = null;
  }
  return _client;
}

/** Browser Supabase client. null when env missing or when run on server (safe for prerender/build). */
export const supabase: SupabaseClient | null = getClient();

/** Use when Supabase must be configured (throws clear error if env missing). */
export function getSupabase(): SupabaseClient {
  const c = getClient();
  if (!c) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  return c;
}
