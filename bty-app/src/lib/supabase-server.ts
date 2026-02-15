import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Server Supabase client (anon key). Returns null when env is missing. */
export function createServerSupabaseClient(): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key);
}

/** SSR Supabase client using session cookies (read-only for API auth). */
export function getSupabaseServer(request: NextRequest): SupabaseClient | null {
  if (!url || !key) return null;
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Read-only in API routes; login routes handle set.
      },
    },
  });
}
