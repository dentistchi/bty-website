/**
 * C6 SPRINT 237 — my-page/progress · team · leader stub smoke.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

// Team page now server-fetches membership + auth-guards; mock the client so it renders
// the submission form (no row → form). Progress/Leader are static stubs (mock is inert).
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }),
}));

import ProgressPage from "./progress/page";
import TeamPage from "./team/page";
import LeaderPage from "./leader/page";

describe("my-page subroutes smoke (237)", () => {
  it("/my-page/progress", async () => {
    const el = (await ProgressPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html).toContain("Progress");
    // P2 #2: raw XP labels suppressed; the page still renders safe non-raw residue.
    expect(html).not.toMatch(/Core XP|Weekly XP/);
    expect(html).toMatch(/Last 7 days|Leadership stage|Recent reflections/);
  });

  it("/my-page/team", async () => {
    const el = (await TeamPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html).toContain("Team");
    expect(html).toMatch(/membership|Submit request|Role/i);
  });

  it("/my-page/leader", async () => {
    const el = (await LeaderPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html).toContain("Leader Track");
    expect(html).toMatch(/readiness|certif|Near threshold/i);
  });
});
