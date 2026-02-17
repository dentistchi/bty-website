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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll() {
        // no-op: API route에서 세션 갱신 쿠키를 굳이 쓰지 않음(필요해지면 Response로 set 가능)
      },
    },
  });
}
