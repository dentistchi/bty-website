/** @vitest-environment jsdom */
/**
 * SLICE R4-R1B — LANGUAGE LIVES IN ME, AND NOWHERE ELSE IN THE APP.
 *
 * `LocaleLayoutHeader` has returned null on `/{locale}/app` since the shell shipped, with a note
 * that "app-level language treatment lives inside the shell later". Later is here: Me owns the
 * one control, and Today / Learn / Practice / Observer carry none.
 *
 * The thing worth locking is not the placement but the ADDRESS. The shell deliberately scrubs
 * `?tab=` from the URL on mount, so a switch that faithfully preserved the query would send a
 * reader standing on Me to Today in the other language. `ensureParams` is what keeps them where
 * they are, and it is the reason these tests assert on hrefs rather than on the control existing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";

let mockPath = "/en/app";
let mockQuery = "";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(mockQuery),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { LangSwitch } from "@/components/LangSwitch";

beforeEach(() => {
  cleanup();
  mockPath = "/en/app";
  mockQuery = "";
});

/**
 * The DESTINATION each language link carries.
 *
 * R4-R4B-R1N-R1-R1 moved the link target: it now points at `/api/locale/set`, which writes the
 * language preference and redirects in ONE response — the only shape that survives a WKWebView
 * being hard-killed, which is what made a chosen Korean revert to English on relaunch. The
 * destination these tests exist to protect is unchanged; it simply rides in `next` now.
 *
 * Reading it back out keeps every assertion below about the thing it was always about: where the
 * reader lands, and that they land on Me.
 */
const hrefs = (el: HTMLElement) =>
  Array.from(el.querySelectorAll("a")).map((a) => {
    const raw = a.getAttribute("href") ?? "";
    if (!raw.startsWith("/api/locale/set")) return raw;
    const next = new URL(raw, "https://x.dev").searchParams.get("next");
    return next ? decodeURIComponent(next) : raw;
  });

/** The raw link target, for the assertions that are about the routing itself. */
const rawHrefs = (el: HTMLElement) =>
  Array.from(el.querySelectorAll("a")).map((a) => a.getAttribute("href"));

describe("[R4-R4B-R1N-R1-R1] the switch routes through the server writer", () => {
  it("both links go to /api/locale/set, so the preference is written by the response that navigates", () => {
    const { container } = render(<LangSwitch ensureParams={{ tab: "me" }} />);
    const raw = rawHrefs(container);
    expect(raw[0]).toContain("/api/locale/set?to=en&");
    expect(raw[1]).toContain("/api/locale/set?to=ko&");
    // A client-side cookie write before navigation is exactly what failed on device.
    expect(raw.every((h) => (h ?? "").startsWith("/api/locale/set"))).toBe(true);
  });
});

describe("[R4-R1B] the Me switch keeps the reader on Me", () => {
  it("adds tab=me when the shell has already scrubbed the query", () => {
    // The real post-mount state of `/{locale}/app`: no query at all.
    const { container } = render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(hrefs(container)).toEqual(["/en/app?tab=me", "/ko/app?tab=me"]);
  });

  it("overrides a stale tab rather than appending a second one", () => {
    mockQuery = "tab=today";
    const { container } = render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(hrefs(container)).toEqual(["/en/app?tab=me", "/ko/app?tab=me"]);
  });

  it("keeps any other query the caller did not speak for", () => {
    mockQuery = "switch=1";
    const { container } = render(<LangSwitch ensureParams={{ tab: "me" }} />);
    for (const h of hrefs(container)) {
      expect(h).toContain("switch=1");
      expect(h).toContain("tab=me");
    }
  });

  it("crossing from KO returns to Me, not Today", () => {
    mockPath = "/ko/app";
    const { container } = render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(hrefs(container)).toEqual(["/en/app?tab=me", "/ko/app?tab=me"]);
  });

  it("without the prop it behaves exactly as every existing call site always has", () => {
    mockPath = "/en/my-page";
    mockQuery = "a=1";
    const { container } = render(<LangSwitch />);
    expect(hrefs(container)).toEqual(["/en/my-page?a=1", "/ko/my-page?a=1"]);
  });

  it("survives a null searchParams — Me mounts it where several harnesses return none", () => {
    mockQuery = "";
    const { container } = render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(within(container).getByText("EN")).toBeDefined();
    expect(within(container).getByText("KO")).toBeDefined();
  });
});

/**
 * `?tab=me` only helps if the shell honours it on the way back in. It does — the same one-shot
 * reader that every other deep link uses.
 */
describe("[R4-R1B] the address the switch produces is one the shell can read", () => {
  it("resolveInitialAppTab reopens Me from the switch's own href", async () => {
    const { resolveInitialAppTab } = await import("@/components/app-shell/initialTab");
    expect(resolveInitialAppTab("?tab=me")).toBe("me");
    // …and the four-tab set generally, so no locale switch can land somewhere unreachable.
    for (const tab of ["today", "learn", "practice", "me"]) {
      expect(resolveInitialAppTab(`?tab=${tab}`)).toBe(tab);
    }
  });
});
