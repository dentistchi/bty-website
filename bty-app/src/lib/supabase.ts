// Browser-only Supabase client. NEXT_PUBLIC_* must be inlined at build time (next.config.js env).
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _client: SupabaseClient | null | undefined = undefined;

function getClient(): SupabaseClient | null {
  // 절대 서버/워커에서 만들지 않음
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (_client !== undefined) return _client;

  try {
    // 브라우저에서만 로드
    const { createBrowserClient } = require("@supabase/ssr") as typeof import("@supabase/ssr");

    _client = url && key
      ? createBrowserClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null;
  } catch {
    _client = null;
  }

  return _client;
}

export const supabase: SupabaseClient | null = getClient();

export function getSupabase(): SupabaseClient {
  const c = getClient();
  if (!c) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  return c;
}
