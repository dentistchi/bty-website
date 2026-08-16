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

const hrefs = (el: HTMLElement) =>
  Array.from(el.querySelectorAll("a")).map((a) => a.getAttribute("href"));

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
