import { describe, it, expect } from "vitest";
import {
  supabaseClientMode,
  TEAMS_TAB_AUTH_OPTIONS,
  WEB_AUTH_OPTIONS,
} from "@/lib/supabase";

/**
 * The browser Supabase client, per surface (Slice A0).
 *
 * WHY THIS MATTERS. Getting it wrong is silent in both directions. A PERSISTING client in the
 * framed tab writes a refresh token into a third-party storage context that iOS partitions or
 * blocks — it appears to work in development and cannot be relied on. A MEMORY-ONLY client in the
 * sign-in popup would drop the PKCE verifier over the round trip to Microsoft, breaking
 * first-ever sign-in for everyone while presenting as an unrelated OAuth error.
 *
 * WHY IT IS ASSERTED THIS WAY. `src/lib/supabase.ts` loads its constructors through `require()`
 * so they never reach a server bundle, which also means the module cannot be exercised through a
 * mocked constructor under the unit runner — such a test would pass without executing anything.
 * So the two things that actually decide behaviour, the SELECTION and the OPTIONS, are exported
 * and asserted directly; the factory then does nothing but spread them.
 */

describe("supabaseClientMode — the tab, and only the tab, is memory-only", () => {
  it("selects memory for the framed tab", () => {
    expect(supabaseClientMode("/teams")).toBe("teams_tab_memory");
    expect(supabaseClientMode("/teams/")).toBe("teams_tab_memory");
  });

  it("selects PERSISTENT for the sign-in popup — PKCE must survive the Microsoft round trip", () => {
    expect(supabaseClientMode("/teams/link")).toBe("web_persistent");
    expect(supabaseClientMode("/teams/link/done")).toBe("web_persistent");
  });

  it("leaves every web and native route persistent", () => {
    for (const p of ["/", "/en/app", "/ko/app", "/en/bty/login", "/start", "/en/auth/callback"]) {
      expect(supabaseClientMode(p), `route ${p}`).toBe("web_persistent");
    }
  });
});

describe("the options each surface receives", () => {
  it("the tab persists NOTHING, and still refreshes", () => {
    expect(TEAMS_TAB_AUTH_OPTIONS.persistSession).toBe(false);
    // Refresh keeps a long-lived tab alive on the /token budget instead of re-spending the far
    // smaller, non-configurable /verify budget with a second bootstrap.
    expect(TEAMS_TAB_AUTH_OPTIONS.autoRefreshToken).toBe(true);
    expect(TEAMS_TAB_AUTH_OPTIONS.detectSessionInUrl).toBe(false);
  });

  it("web and native keep the exact behaviour they had before A0", () => {
    expect(WEB_AUTH_OPTIONS).toEqual({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    });
  });
});
