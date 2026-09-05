/** @vitest-environment jsdom */
/**
 * TEAMS DISPLAY DIAGNOSTICS — the in-tab entry. Slice TQ-2. TEMPORARY, and these tests say so.
 *
 * ★ THE DEFECT THIS SLICE REPAIRS IS A TEST-METHOD DEFECT, NOT A CODE ONE.
 *
 * TQ-1 shipped the runtime probe behind `/teams?diag=1` and called that the device entry. MEASURED
 * on the Founder's iPhone, 2026-09-05: that URL opened in Safari — browser chrome visible, no Teams
 * host, the bootstrap failed, and the screen read "BTY couldn't open yet." / "Open BTY". Zero
 * numbers were produced, and the ones it would have produced would have described Safari.
 *
 * A URL cannot summon a host. The Teams Personal Tab runtime exists only inside a tab that has
 * already bootstrapped, so the diagnostic has to be entered from inside one.
 *
 * What these tests hold: the entry is reachable by exactly one kind of person in exactly one kind
 * of host, it opens WITHOUT leaving the frame being measured, closing gives back the identical
 * screen, and the overlay writes nothing anywhere.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import BtyDailyAppShell from "./BtyDailyAppShell";

const ORIGIN = "https://arena.btydaily.com";
const ADMIN_ROUTE = "/api/bty/authority/platform-admin";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function at(pathname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(`${ORIGIN}${pathname}`),
  });
}

/** Every shell fetch answered; the admin answer is the only variable. */
function stubFetch(isPlatformAdmin: boolean | "unauthenticated") {
  const spy = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes(ADMIN_ROUTE)) {
      if (isPlatformAdmin === "unauthenticated") {
        return { ok: false, status: 401, json: async () => ({ error: "UNAUTHENTICATED" }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, isPlatformAdmin }) } as Response;
    }
    const body =
      u.includes("/api/bty/foundry/history") ? { history: [], thread: null, threadStatus: "none" }
      : u.includes("/api/bty/foundry/evidence/mine") ? { items: [] }
      : u.includes("/api/bty/action-contract/reviewed-plans") ? { items: [] }
      : { ok: true };
    void init;
    return { ok: true, status: 200, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  fireEvent.click(within(nav).getByText("Me"));
  return screen.findByTestId("me-home");
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("★ WHO SEES THE ENTRY — both conditions, each necessary", () => {
  it("1 — Teams-hosted platform admin SEES it", async () => {
    at("/teams");
    stubFetch(true);
    await gotoMe();
    const row = await screen.findByTestId("me-row-teams-diagnostics");
    expect(row.textContent).toContain("Teams display diagnostics");
  });

  it("2 — Teams-hosted ORDINARY participant does NOT", async () => {
    at("/teams");
    stubFetch(false);
    const home = await gotoMe();
    // The server answered; absence here is a decision, not a pending state.
    await waitFor(() => expect(screen.getByTestId("me-account-row")).toBeTruthy());
    expect(screen.queryByTestId("me-row-teams-diagnostics")).toBeNull();
    expect(home.textContent).not.toContain("Teams display diagnostics");
  });

  it("3 — standalone WEB platform admin does NOT (and is never even asked about)", async () => {
    at("/en/app");
    const spy = stubFetch(true);
    await gotoMe();
    await waitFor(() => expect(screen.getByTestId("me-account-row")).toBeTruthy());
    expect(screen.queryByTestId("me-row-teams-diagnostics")).toBeNull();
    /*
      Outside the Teams tab the authority is not consulted at all. Web and native therefore pay
      nothing for a diagnostic that could never apply to them — no request, no waiting state.
    */
    const asked = spy.mock.calls.filter((c) => String(c[0]).includes(ADMIN_ROUTE));
    expect(asked, "web must not even ask about platform-admin authority").toHaveLength(0);
  });

  it("3b — an authority that cannot be established is a NO (401 → no row)", async () => {
    at("/teams");
    stubFetch("unauthenticated");
    await gotoMe();
    await waitFor(() => expect(screen.getByTestId("me-account-row")).toBeTruthy());
    expect(screen.queryByTestId("me-row-teams-diagnostics")).toBeNull();
  });
});

describe("★ OPENING IT DOES NOT LEAVE THE FRAME BEING MEASURED", () => {
  it("4 — opening does not navigate: same pathname, no history entry", async () => {
    at("/teams");
    stubFetch(true);
    await gotoMe();
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");

    fireEvent.click(await screen.findByTestId("me-row-teams-diagnostics"));
    await screen.findByTestId("teams-runtime-probe");

    expect(window.location.pathname).toBe("/teams");
    expect(window.location.search).toBe("");
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("5 — the current page stays MOUNTED underneath (same DOM node, not a re-render)", async () => {
    at("/teams");
    stubFetch(true);
    const home = await gotoMe();

    fireEvent.click(await screen.findByTestId("me-row-teams-diagnostics"));
    await screen.findByTestId("teams-runtime-probe");

    // Identity, not equality: the Me root was never unmounted and remounted.
    expect(screen.getByTestId("me-home")).toBe(home);
    expect(screen.getByTestId("me-account-row")).toBeTruthy();
  });

  it("6 — closing restores the EXACT prior screen and removes the overlay", async () => {
    at("/teams");
    stubFetch(true);
    const home = await gotoMe();
    const before = home.innerHTML;

    fireEvent.click(await screen.findByTestId("me-row-teams-diagnostics"));
    await screen.findByTestId("teams-runtime-probe");
    fireEvent.click(screen.getByTestId("teams-runtime-probe-close"));

    await waitFor(() => expect(screen.queryByTestId("teams-runtime-probe")).toBeNull());
    expect(screen.getByTestId("me-home")).toBe(home);
    expect(screen.getByTestId("me-home").innerHTML).toBe(before);
    expect(window.location.pathname).toBe("/teams");
  });
});

describe("★ IT MEASURES AND CHANGES NOTHING", () => {
  it("7a — opening and closing issues no request of any kind", async () => {
    at("/teams");
    const spy = stubFetch(true);
    await gotoMe();
    await screen.findByTestId("me-row-teams-diagnostics");
    // Let the shell settle so the count below is about the overlay, not about arriving on Me.
    await waitFor(() => expect(screen.getByTestId("me-account-row")).toBeTruthy());
    const before = spy.mock.calls.length;

    fireEvent.click(screen.getByTestId("me-row-teams-diagnostics"));
    await screen.findByTestId("teams-runtime-probe");
    fireEvent.click(screen.getByTestId("teams-runtime-probe-close"));
    await waitFor(() => expect(screen.queryByTestId("teams-runtime-probe")).toBeNull());

    expect(spy.mock.calls.length, "the overlay must send nothing").toBe(before);
  });

  it("7b — the authority request is a plain GET read, never a write", async () => {
    /*
      Scoped to THIS slice's request on purpose. The shell makes its own arrival write
      (`POST /api/me/day/open`) on every Me visit; that predates this work and is unchanged by it,
      and asserting "the shell sends no POST" would be asserting something that was never true.
    */
    at("/teams");
    const spy = stubFetch(true);
    await gotoMe();
    await screen.findByTestId("me-row-teams-diagnostics");
    const asked = spy.mock.calls.filter((c) => String(c[0]).includes(ADMIN_ROUTE));
    expect(asked.length, "the authority is asked exactly once per tab visit").toBe(1);
    for (const call of asked) {
      const method = ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      expect(method).toBe("GET");
      expect((call[1] as RequestInit | undefined)?.body, "an authority question carries no body").toBeUndefined();
    }
  });

  it("7c — the overlay persists nothing locally, in source", () => {
    const src = code("src/components/teams/TeamsRuntimeProbe.tsx");
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "document.cookie", "fetch(", "sendBeacon", "XMLHttpRequest"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
  });

  it("7d — the server authority route reads and never writes", () => {
    const src = code("src/app/api/bty/authority/platform-admin/route.ts");
    expect(src).toContain("export async function GET");
    for (const forbidden of ["export async function POST", "export async function PATCH", "export async function PUT", "export async function DELETE", ".insert(", ".update(", ".upsert(", ".delete("]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
    // Authority is asked of the canonical grant resolver, never derived from the request.
    expect(src).toContain("isActivePlatformAdmin");
    expect(src).not.toContain("BTY_ADMIN_EMAILS");
  });

  it("7e — the route cannot be pointed at anyone but the caller (no id/email parameter)", () => {
    const src = code("src/app/api/bty/authority/platform-admin/route.ts");
    expect(src).not.toContain("searchParams");
    expect(src).not.toContain("req.json()");
    expect(src).toContain("user.id");
  });
});

describe("★ NOTHING ELSE MOVED", () => {
  it("8a — the Teams tab bootstrap and its ?diag=1 path are unchanged", () => {
    const shell = code("src/components/teams/TeamsTabShell.tsx");
    expect(shell).toContain('get("diag") === "1"');
    expect(shell).toMatch(/diag \? <TeamsRuntimeProbe \/> : null/);
    expect(shell).toMatch(/<BtyDailyAppShell locale=\{phase\.locale\} \/>/);
    expect(shell).toContain("/api/auth/teams-bootstrap");
  });

  it("8b — the probe still renders as a fixed overlay, so it is never part of what it measures", () => {
    expect(code("src/components/teams/TeamsRuntimeProbe.tsx")).toContain("fixed inset-x-0 bottom-0");
  });

  it("8c — NO visual repair shipped in this slice: the shell root and Teams floor are untouched", () => {
    const shell = read("src/components/app-shell/BtyDailyAppShell.tsx");
    expect(shell).toContain("h-[100dvh]");
    expect(shell).toContain('style={{ height: "env(safe-area-inset-top)" }}');
    expect(shell).toContain('<main ref={mainScrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 pt-8"');
    expect(code("src/app/teams/layout.tsx")).toContain('minHeight: "100dvh"');
  });

  it("8d — the ordinary Me rows keep their order and destinations", async () => {
    at("/teams");
    stubFetch(true);
    const home = await gotoMe();
    const rows = Array.from(home.querySelectorAll("nav button")).map((r) => r.getAttribute("data-testid"));
    expect(rows.slice(0, 3)).toEqual(["me-row-learned", "me-row-center", "me-account-row"]);
    // The temporary row is LAST, so no existing row moved for it.
    expect(rows[rows.length - 1]).toBe("me-row-teams-diagnostics");
  });
});

describe("★ IT REPORTS WHAT THE SCREENSHOT COULD HAVE BEEN", () => {
  const src = code("src/components/teams/TeamsRuntimeProbe.tsx");
  const required: [string, string][] = [
    ["location pathname", "location pathname"],
    ["Teams host detected", "Teams host detected"],
    ["visualViewport offsetLeft", "visualViewport offsetLeft"],
    ["documentElement clientW/clientH", "documentElement clientW × clientH"],
    ["devicePixelRatio", "devicePixelRatio"],
    ["all four safe-area insets", "env(safe-area-inset-left)"],
    ["html rect", "html rect"],
    ["body rect", "body rect"],
    ["app root rect", "app root rect"],
    ["BTY header rect", "BTY header rect"],
    ["first heading rect", "first heading rect"],
    ["bottom nav rect", "bottom nav rect"],
    ["scrollHeight", "scrollHeight"],
    ["horizontal overflow amount", "horizontal overflow"],
    ["computed position/height/padding/margin", "function box("],
    ["ancestor transform chain", "transformChain"],
    ["ancestor filter/backdrop-filter chain", "filterChain"],
    ["zoom", "zoom"],
    ["font smoothing", "-webkit-font-smoothing"],
  ];
  for (const [label, needle] of required) {
    it(`reports ${label}`, () => expect(src).toContain(needle));
  }

  it("offers Copy, Re-measure and Close", async () => {
    at("/teams");
    stubFetch(true);
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-teams-diagnostics"));
    const panel = await screen.findByTestId("teams-runtime-probe");
    expect(within(panel).getByText("Copy")).toBeTruthy();
    expect(within(panel).getByText("Re-measure")).toBeTruthy();
    expect(within(panel).getByText("Close")).toBeTruthy();
  });
});

describe("★ IT IS MARKED TEMPORARY", () => {
  it("the entry, the hook and the row all say they are removed with the repair", () => {
    expect(read("src/components/app-shell/BtyDailyAppShell.tsx")).toMatch(/TEMPORARY[\s\S]{0,400}TQ-2/);
    expect(read("src/lib/bty/teams/useTeamsDiagnosticsEntry.ts")).toContain("TQ-2");
  });
});
