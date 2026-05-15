/**
 * Q237 /[locale]/bty-arena/hub — alias smoke (Stage 2 step 6 sub-phase 2E).
 *
 * D1-b (Commander 2026-05-14): Lobby owns NEXT_SCENARIO_READY; Hub is not a distinct
 * surface. `hub/page.tsx` is now a deprecated redirect alias to `/bty-arena`. This
 * smoke asserts the redirect target via the mocked `redirect` from `next/navigation`
 * — the prior SSR content assertions (Arena copy / Loading / arena-hub-card) became
 * unreachable post-2E (page never returns a ReactElement). Content migration of
 * `<ArenaHubEntryCard>` / `<ArenaHubSummary>` into Lobby is post-Stage-2 backlog.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { redirect } from "next/navigation";
import ArenaHubPage from "./hub/page";

describe("q237 bty-arena hub alias", () => {
  it("redirects /[locale]/bty-arena/hub → /[locale]/bty-arena (deprecated alias, content migration backlog)", async () => {
    await ArenaHubPage({ params: Promise.resolve({ locale: "en" }) });
    expect(redirect).toHaveBeenCalledWith("/en/bty-arena");
  });
});
