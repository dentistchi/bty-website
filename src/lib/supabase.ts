// Browser-only Supabase client. NEXT_PUBLIC_* must be inlined at build time (next.config.js env).
import type { SupabaseClient } from "@supabase/supabase-js";
import { isTeamsTabPath } from "@/domain/teams/tabRuntime";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * The auth options for each surface, exported so they can be asserted (Slice A0).
 *
 * They live here as named constants rather than inline literals because this module is loaded
 * through `require()` for browser-only bundling and is therefore not importable under the unit
 * test runner. A test that mocked the constructors would silently exercise nothing; these values
 * and {@link supabaseClientMode} are the whole decision, and both are provable.
 */
export const TEAMS_TAB_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: true,
  detectSessionInUrl: false,
} as const;

export const WEB_AUTH_OPTIONS = {
  persistSession: true,
  autoRefreshToken: true,
  /** PKCE OAuth return is handled explicitly on `/{locale}/auth/callback` (`exchangeCodeForSession`). */
  detectSessionInUrl: false,
} as const;

export type SupabaseClientMode = "teams_tab_memory" | "web_persistent";

/** Which client this document gets. The tab is memory-only; everything else, including the Teams sign-in popup, persists. */
export function supabaseClientMode(pathname: string | null | undefined): SupabaseClientMode {
  return isTeamsTabPath(pathname) ? "teams_tab_memory" : "web_persistent";
}

let _client: SupabaseClient | null | undefined = undefined;

function getClient(): SupabaseClient | null {
  // 절대 서버/워커에서 만들지 않음
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (_client !== undefined) return _client;

  /*
    TEAMS TAB MODE — MEMORY ONLY (Slice A0).

    Inside `/teams` the document is framed by Teams, which makes it a third-party browsing
    context: cookies do not travel on iOS at all, and storage partitioning makes localStorage
    unreliable in exactly the environment the Founder uses first. So the tab gets a plain
    supabase-js client with `persistSession: false` — the session lives in memory for the life of
    the tab and is re-derived from Teams' own cached Entra token on the next load. NOTHING durable
    is written: no cookie, no localStorage, no IndexedDB.

    `autoRefreshToken` stays ON. Refresh is what keeps a long-lived tab working without a second
    bootstrap, and `/auth/v1/token` has its own, far larger rate budget than `/auth/v1/verify`.

    This branch is keyed on the PATH, not on a flag some earlier module has to remember to set —
    the module-level singleton is built on first import, so an ordering-dependent flag would be a
    race. `/teams/link` is deliberately excluded (see `isTeamsTabPath`): the popup is top-level,
    first-party, and needs ordinary persistence for the OAuth round trip.
  */
  if (supabaseClientMode(window.location.pathname) === "teams_tab_memory") {
    try {
      const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
      _client = url && key ? createClient(url, key, { auth: { ...TEAMS_TAB_AUTH_OPTIONS } }) : null;
    } catch {
      _client = null;
    }
    return _client;
  }

  try {
    // 브라우저에서만 로드
    const { createBrowserClient } = require("@supabase/ssr") as typeof import("@supabase/ssr");

    _client = url && key
      ? createBrowserClient(url, key, {
          auth: { ...WEB_AUTH_OPTIONS },
          cookieOptions: { path: "/" },
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
