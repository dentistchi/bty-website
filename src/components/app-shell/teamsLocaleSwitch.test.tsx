/** @vitest-environment jsdom */
/**
 * CHANGING LANGUAGE MUST NEVER LEAVE THE TEAMS SHELL.
 *
 * ★ THE REAL DEVICE FAILURE, TRACED AND REPRODUCED AGAINST THE LIVE ORIGIN.
 *
 * Inside the Teams Personal Tab the pathname is `/teams` — top-level, deliberately outside
 * `[locale]`. `LangSwitch` prefixed it anyway and produced `/ko/teams`, which is not a route:
 *
 *     /api/locale/set?to=ko&next=/ko/teams?tab=me   303 ->  /ko/teams?tab=me
 *     /ko/teams                                     307 ->  /ko/bty/login?next=/ko/teams
 *
 * So a signed-in person changed their language and was handed a login screen wearing the retired
 * five-tab navigation, because `[locale]/bty/layout.tsx` wraps every `/bty/*` route in
 * `ArenaLayoutShell`.
 *
 * These tests hold both halves: the switch keeps a host route, and no auth surface wears the app.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LangSwitch } from "@/components/LangSwitch";
import { isAuthSurfacePath } from "@/components/bty/navigation/BottomNav";

let mockPath = "/teams";
let mockQuery = "";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(mockQuery),
}));

const hrefs = () =>
  [screen.getByTestId("lang-switch-en"), screen.getByTestId("lang-switch-ko")].map(
    (a) => a.getAttribute("href") ?? "",
  );
/** What the browser is actually sent to after the writer redirects. */
const target = (href: string) => decodeURIComponent(new URL(href, "https://x").searchParams.get("next") ?? "");

beforeEach(() => { mockPath = "/teams"; mockQuery = ""; });
afterEach(() => cleanup());

describe("★ 1-3 — inside Teams, EN ↔ KO stays on /teams and never reaches login", () => {
  it("★ EN → KO keeps the host route", () => {
    render(<LangSwitch ensureParams={{ tab: "me" }} current="en" />);
    const [, ko] = hrefs();
    expect(target(ko)).toBe("/teams?tab=me");
    expect(target(ko)).not.toContain("/ko/teams");
  });

  it("★ KO → EN keeps the host route", () => {
    render(<LangSwitch ensureParams={{ tab: "me" }} current="ko" />);
    const [en] = hrefs();
    expect(target(en)).toBe("/teams?tab=me");
    expect(target(en)).not.toContain("/en/teams");
  });

  it("★ 3 — neither target is a login, an OAuth start, or a locale-prefixed app route", () => {
    render(<LangSwitch ensureParams={{ tab: "me" }} current="en" />);
    for (const h of hrefs()) {
      const t = target(h);
      for (const forbidden of ["/bty/login", "/auth", "/en/app", "/ko/app", "/en/teams", "/ko/teams"]) {
        expect(t, `${t} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("★ the preference is still written by the ONE canonical server writer", () => {
    render(<LangSwitch ensureParams={{ tab: "me" }} current="en" />);
    const [en, ko] = hrefs();
    expect(en.startsWith("/api/locale/set?to=en&next=")).toBe(true);
    expect(ko.startsWith("/api/locale/set?to=ko&next=")).toBe(true);
  });

  it("★ 6 — the tab is preserved, so the person returns to Me and not to Today", () => {
    render(<LangSwitch ensureParams={{ tab: "me" }} current="en" />);
    expect(target(hrefs()[1])).toContain("tab=me");
  });

  it("★ the active mark comes from the RESOLVED locale, since a host path cannot carry one", () => {
    render(<LangSwitch ensureParams={{ tab: "me" }} current="ko" />);
    expect(screen.getByTestId("lang-switch-ko").className).toContain("underline");
    expect(screen.getByTestId("lang-switch-en").className).not.toContain("underline");
  });

  it("/start is a host route too — the native launch path is locale-neutral by design", () => {
    mockPath = "/start";
    render(<LangSwitch current="en" />);
    expect(target(hrefs()[1])).toBe("/start");
  });
});

describe("★ 8 — standalone web locale switching is UNCHANGED", () => {
  it("a locale-prefixed app route still swaps its prefix", () => {
    mockPath = "/en/app";
    render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(hrefs().map(target)).toEqual(["/en/app?tab=me", "/ko/app?tab=me"]);
  });

  it("an ordinary deep route still swaps its prefix and keeps its query", () => {
    mockPath = "/ko/my-page";
    mockQuery = "a=1";
    render(<LangSwitch />);
    expect(hrefs().map(target)).toEqual(["/en/my-page?a=1", "/ko/my-page?a=1"]);
  });

  it("★ a path that merely BEGINS with the host word is not a host route", () => {
    mockPath = "/teamsomething";
    render(<LangSwitch />);
    expect(hrefs().map(target)).toEqual(["/en/teamsomething", "/ko/teamsomething"]);
  });
});

describe("★ 7 — the retired five-tab shell never dresses up an auth surface", () => {
  it("every auth path is recognised, in both locales", () => {
    for (const p of [
      "/en/bty/login", "/ko/bty/login", "/en/bty/login?next=%2Fko%2Fteams",
      "/ko/bty/forgot-password", "/en/bty/auth/callback",
    ]) {
      expect(isAuthSurfacePath(p.split("?")[0]), p).toBe(true);
    }
  });

  it("★ and a real signed-in surface still keeps its navigation", () => {
    for (const p of ["/en/bty/leaderboard", "/ko/bty", "/en/app", "/en/bty-arena", "/teams"]) {
      expect(isAuthSurfacePath(p), p).toBe(false);
    }
  });

  it("★ CONTAINMENT, NOT DELETION — the legacy items are untouched", async () => {
    const { getBtyNavItems } = await import("@/components/bty/navigation/nav-items");
    const items = getBtyNavItems("en", { home: "Today", arena: "Arena", foundry: "Foundry", center: "Center", profile: "Me" } as never);
    expect(items.length, "the five legacy tabs still exist for the surfaces that still use them").toBe(5);
  });
});
