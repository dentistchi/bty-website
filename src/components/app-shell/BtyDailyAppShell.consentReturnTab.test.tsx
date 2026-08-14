/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";

/**
 * SLICE 3.2R-R9A-R2 — THE LAST HOP: DOES `?tab=me` ACTUALLY OPEN "Me"?
 *
 * A real re-consent returned to `/en/app?tab=me` and the address bar finished at `/en/app`. Every
 * hop that PRODUCES that URL is now proven to preserve the query, and the shell is known to erase
 * `?tab=` with `history.replaceState` once it has consumed it — so a bare `/en/app` is what a
 * SUCCESSFUL deep link is supposed to look like.
 *
 * That reasoning is only worth anything if the consumption genuinely happens. Nothing in the suite
 * mounted the shell with `?tab=` actually in the URL: `initialTab.test.ts` covers the pure
 * resolver, and the in-shell tests navigate without URL transport. The gap sits exactly between
 * "we assigned the right URL" and "the learner sees the right screen", which is the only thing the
 * device observation could not distinguish.
 *
 * So this mounts the real shell with the real search string and asserts the visible outcome.
 */

const fetchStub = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
    if (url.includes("/api/me/today/brief")) return json({ ok: true, consent: false, brief: null, reminders: [] });
    if (url.includes("/api/bty/action-contract/mine")) return json({ ok: true, contracts: [] });
    return json({ ok: true });
  });

function setSearch(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...window.location,
      pathname: "/en/app",
      search,
      href: `http://localhost/en/app${search}`,
      assign: vi.fn(),
    },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchStub());
  vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The bar marks the active tab with aria-current="page". */
async function activeTabLabel(): Promise<string | null> {
  const nav = await screen.findByLabelText("App navigation");
  const current = nav.querySelector('[aria-current="page"]');
  return current?.textContent?.trim() ?? null;
}

describe("[3.2R-R9A-R2] the consent return destination actually opens", () => {
  it("mounting at /en/app?tab=me opens the Me tab — the real device outcome", async () => {
    setSearch("?tab=me");
    render(<BtyDailyAppShell locale="en" />);

    await waitFor(async () => expect(await activeTabLabel()).toBe("Me"));
  });

  it("…and THEN erases the param, which is why the address bar reads /en/app", async () => {
    setSearch("?tab=me");
    render(<BtyDailyAppShell locale="en" />);

    await waitFor(async () => expect(await activeTabLabel()).toBe("Me"));
    // The bare URL is the shell's cleanup of a CONSUMED deep link, not a lost destination.
    await waitFor(() => expect(window.history.replaceState).toHaveBeenCalled());
  });

  it("without the param the shell stays on Today — so the assertion above is not vacuous", async () => {
    setSearch("");
    render(<BtyDailyAppShell locale="en" />);

    await waitFor(async () => expect(await activeTabLabel()).toBe("Today"));
  });

  it("a genuinely lost query would land on Today — the failure this test would catch", async () => {
    // If any hop reduced `/en/app?tab=me` to `/en/app`, this is what the learner would get.
    setSearch("");
    render(<BtyDailyAppShell locale="en" />);
    await waitFor(async () => expect(await activeTabLabel()).not.toBe("Me"));
  });

  it("the same mechanism carries other safe tabs, so nothing is special-cased to `me`", async () => {
    setSearch("?tab=practice");
    render(<BtyDailyAppShell locale="en" />);
    await waitFor(async () => expect(await activeTabLabel()).toBe("Practice"));
  });
});
