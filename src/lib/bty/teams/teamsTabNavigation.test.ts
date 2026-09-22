/** @vitest-environment jsdom */
/**
 * Re-reading and clearing the Teams host's navigation state.
 * Slice Teams iOS Deep-Link Resume.
 *
 * Two properties matter here: refreshing navigation must not become an auth operation, and
 * clearing the subpage must never be able to fail the learner's exit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  getContext: vi.fn(async () => ({ page: { subPageId: "foundry-training:x" } }) as Record<string, unknown>),
  isSupported: vi.fn(() => true),
  navigateTo: vi.fn(async () => {}),
  navigateToDefaultPage: vi.fn(async () => {}),
  hasCurrentApp: true,
  hasNavigateTo: true,
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: H.getContext },
  get pages() {
    if (!H.hasCurrentApp) return {};
    const currentApp: Record<string, unknown> = { isSupported: H.isSupported, navigateToDefaultPage: H.navigateToDefaultPage };
    if (H.hasNavigateTo) currentApp.navigateTo = H.navigateTo;
    return { currentApp };
  },
}));

import { clearTeamsSubPage, readTeamsSubPageId } from "./teamsTabNavigation";

beforeEach(() => {
  vi.clearAllMocks();
  H.hasCurrentApp = true;
  H.hasNavigateTo = true;
  H.isSupported.mockReturnValue(true);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("reading the subpage refreshes NAVIGATION and nothing else", () => {
  it("returns subPageId", async () => {
    H.getContext.mockResolvedValue({ page: { subPageId: "foundry-training:abc" } });
    expect(await readTeamsSubPageId()).toBe("foundry-training:abc");
  });

  it("falls back to the pre-v2 subEntityId", async () => {
    H.getContext.mockResolvedValue({ page: { subEntityId: "foundry-training:legacy" } });
    expect(await readTeamsSubPageId()).toBe("foundry-training:legacy");
  });

  it("NEVER calls the bootstrap endpoint — navigation must not spend the auth budget", async () => {
    await readTeamsSubPageId();
    await readTeamsSubPageId();
    const urls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("teams-bootstrap"))).toBe(false);
    expect(urls).toHaveLength(0);
  });

  it("a context that cannot be read names no training, rather than throwing", async () => {
    H.getContext.mockRejectedValue(new Error("no host"));
    expect(await readTeamsSubPageId()).toBeNull();
    H.getContext.mockResolvedValue({});
    expect(await readTeamsSubPageId()).toBeNull();
  });
});

describe("clearing the subpage uses stable navigation and fails soft", () => {
  it("navigates the current app to the named page", async () => {
    expect(await clearTeamsSubPage("btyHome")).toBe("cleared");
    expect(H.navigateTo).toHaveBeenCalledWith({ pageId: "btyHome" });
  });

  it("falls back to navigateToDefaultPage when navigateTo is absent", async () => {
    H.hasNavigateTo = false;
    expect(await clearTeamsSubPage("btyHome")).toBe("cleared");
    expect(H.navigateToDefaultPage).toHaveBeenCalledTimes(1);
  });

  it("reports UNSUPPORTED rather than throwing on an older client", async () => {
    H.isSupported.mockReturnValue(false);
    expect(await clearTeamsSubPage("btyHome")).toBe("unsupported");
    expect(H.navigateTo).not.toHaveBeenCalled();

    H.hasCurrentApp = false;
    expect(await clearTeamsSubPage("btyHome")).toBe("unsupported");
  });

  it("reports FAILED when the host refuses — never rethrows at the learner", async () => {
    H.navigateTo.mockRejectedValue(new Error("refused"));
    expect(await clearTeamsSubPage("btyHome")).toBe("failed");
  });

  it("uses no beta lifecycle API", async () => {
    await clearTeamsSubPage("btyHome");
    const sdk = (await import("@microsoft/teams-js")) as unknown as Record<string, unknown>;
    // Only `pages.currentApp` is touched; nothing from a beta/lifecycle namespace is referenced.
    expect(Object.keys(sdk).sort()).toEqual(["app", "pages"]);
  });
});

/*
  The URL transport's own cleanup (Slice Teams iOS webUrl Fallback). The fallback target lives in
  this document's address, so leaving a training must remove it — otherwise the next focus reads it
  again and puts the learner back inside the training they just finished.
*/
describe("clearing the ?training= fallback target", () => {
  const at = (search: string) => window.history.replaceState({}, "", `/teams${search}`);

  it("removes only the target, without navigating and without a history entry", async () => {
    const { clearTrainingQueryParam, currentSearch } = await import("./teamsTabNavigation");
    at("?diag=1&training=foundry-training%3Abtyfr1.a.b&keep=yes");
    const before = window.history.length;

    expect(clearTrainingQueryParam()).toBe(true);

    expect(window.location.pathname).toBe("/teams");
    expect(currentSearch()).not.toContain("training=");
    expect(currentSearch()).toContain("diag=1");
    expect(currentSearch()).toContain("keep=yes");
    expect(window.history.length).toBe(before);
  });

  it("is a no-op when there is nothing to clear", async () => {
    const { clearTrainingQueryParam } = await import("./teamsTabNavigation");
    at("?diag=1");
    expect(clearTrainingQueryParam()).toBe(false);
    expect(window.location.search).toBe("?diag=1");
  });

  it("reports the current search, empty when there is none", async () => {
    const { currentSearch } = await import("./teamsTabNavigation");
    at("");
    expect(currentSearch()).toBe("");
    at("?training=x");
    expect(currentSearch()).toBe("?training=x");
  });
});
