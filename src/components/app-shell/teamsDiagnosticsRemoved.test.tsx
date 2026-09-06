/** @vitest-environment jsdom */
/**
 * THE TEMPORARY TEAMS DISPLAY DIAGNOSTIC IS GONE (closes Slice TQ-2).
 *
 * ★ IT WAS ALWAYS SUPPOSED TO BE. TQ-2 shipped a Founder-only row in Me and a caller-only authority
 * endpoint behind it, and both files said in their own comments that they were deleted in the same
 * closure cycle as the display repair they existed to inform. TQ-3 made that repair. This slice
 * makes good on the promise.
 *
 * ★ WHAT IS DELETED, AND WHAT IS DELIBERATELY KEPT.
 *
 *   DELETED   the Me row, the overlay state, the visibility hook, and
 *             GET /api/bty/authority/platform-admin -- whose ONLY consumer was that hook. An
 *             endpoint nobody calls is a surface with no reason to exist.
 *   KEPT      `TeamsRuntimeProbe` behind `/teams?diag=1`, because automated tests still measure
 *             through it (`teamsRuntimeProbe.test.tsx`), and the generic layout data attributes,
 *             which are now deterministic test handles rather than diagnostics.
 *   KEPT      `isActivePlatformAdmin` and every route that uses it as a REAL gate. Removing a
 *             read-only "am I an admin" endpoint is not a change to admin authority.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import BtyDailyAppShell from "./BtyDailyAppShell";

const ORIGIN = "https://arena.btydaily.com";
const ADMIN_ROUTE = "/api/bty/authority/platform-admin";
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function at(pathname: string) {
  Object.defineProperty(window, "location", { configurable: true, value: new URL(`${ORIGIN}${pathname}`) });
}

function stubFetch() {
  const spy = vi.fn(async (url: unknown) => {
    const u = String(url);
    const body = u.includes("/api/bty/foundry/history")
      ? { history: [], thread: null, threadStatus: "none" }
      : u.includes("/api/bty/foundry/evidence/mine")
        ? { items: [] }
        : u.includes("/api/bty/action-contract/reviewed-plans")
          ? { items: [] }
          : { ok: true };
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

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("★ ORDINARY APP UX CONTAINS NO DIAGNOSTIC ENTRY", () => {
  it("★ inside the Teams tab, Me holds exactly the three real rows and nothing else", async () => {
    at("/teams");
    stubFetch();
    const home = await gotoMe();
    const rows = Array.from(home.querySelectorAll("nav button")).map((r) => r.getAttribute("data-testid"));
    expect(rows).toEqual(["me-row-learned", "me-row-center", "me-account-row"]);
    expect(screen.queryByTestId("me-row-teams-diagnostics")).toBeNull();
    expect(home.textContent).not.toContain("Teams display diagnostics");
  });

  it("on the web the rows are identical — no row moved when the temporary one left", async () => {
    at("/en/app");
    stubFetch();
    const home = await gotoMe();
    expect(Array.from(home.querySelectorAll("nav button")).map((r) => r.getAttribute("data-testid"))).toEqual([
      "me-row-learned",
      "me-row-center",
      "me-account-row",
    ]);
  });

  it("★ the shell never asks about platform-admin authority again, in ANY host", async () => {
    for (const path of ["/teams", "/en/app"]) {
      cleanup();
      at(path);
      const spy = stubFetch();
      await gotoMe();
      await waitFor(() => expect(screen.getByTestId("me-account-row")).toBeTruthy());
      expect(spy.mock.calls.filter((c) => String(c[0]).includes(ADMIN_ROUTE)), path).toHaveLength(0);
    }
  });

  it("the shell no longer imports the hook or mounts the probe overlay", () => {
    const shell = read("src/components/app-shell/BtyDailyAppShell.tsx");
    for (const gone of [
      "useTeamsDiagnosticsEntry",
      "TeamsRuntimeProbe",
      "teamsDiagnosticsAvailable",
      "setTeamsDiagnosticsOpen",
      "me-row-teams-diagnostics",
      "Teams display diagnostics",
    ]) {
      expect(shell, gone).not.toContain(gone);
    }
  });
});

describe("★ NO ORPHAN API ROUTE, AND NO ORPHAN HOOK", () => {
  it("★ the caller-only authority endpoint is deleted", () => {
    expect(existsSync(join(process.cwd(), "src/app/api/bty/authority/platform-admin/route.ts"))).toBe(false);
    // And its whole segment, so nothing is left half-present.
    expect(existsSync(join(process.cwd(), "src/app/api/bty/authority"))).toBe(false);
  });

  it("the visibility hook is deleted", () => {
    expect(existsSync(join(process.cwd(), "src/lib/bty/teams/useTeamsDiagnosticsEntry.ts"))).toBe(false);
  });

  it("★ no PRODUCTION file anywhere in src still reaches for either of them", () => {
    /*
      Tests are excluded deliberately and only here: this file and `teamsVisualQuality.test.tsx`
      both NAME the removed route in order to assert that it is gone, and a sweep that counted an
      absence assertion as a reference could never be satisfied. What matters is that no shipping
      code fetches an endpoint that no longer exists, or imports a hook that no longer exists —
      which is what this walks.
    */
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec|testkit)\.(ts|tsx)$/.test(name)) continue;
        const src = readFileSync(p, "utf8");
        if (src.includes("useTeamsDiagnosticsEntry") || src.includes(ADMIN_ROUTE)) hits.push(p);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });

  it("★ and no TEST imports the deleted hook either — an absence assertion is not an import", () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        if (/from ["'][^"']*useTeamsDiagnosticsEntry["']/.test(readFileSync(p, "utf8"))) importers.push(p);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(importers).toEqual([]);
  });
});

describe("★ NO ADMIN AUTHORITY REGRESSION", () => {
  it("★ the canonical resolver survives, and still reads the GRANT table", () => {
    const raw = read("src/lib/bty/authority/platformAdmin.server.ts");
    // Comments stripped: the file NAMES the env allowlist in order to explain what it is not.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src).toContain("bty_platform_admin_grants");
    expect(src).toContain("export async function isActivePlatformAdmin");
    // Authority is a revocable ROW keyed by canonical user id, never an env allowlist.
    expect(src).not.toContain("BTY_ADMIN_EMAILS");
    expect(src).not.toContain("process.env");
  });

  it("★ every route that actually GATES on admin still does", () => {
    const gated: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (name !== "route.ts") continue;
        const src = readFileSync(p, "utf8");
        if (src.includes("requirePlatformAdmin") || src.includes("isActivePlatformAdmin") || src.includes("canTrackWithBty")) {
          gated.push(p);
        }
      }
    };
    walk(join(process.cwd(), "src/app/api"));
    // The removed endpoint was the ONE consumer that gated nothing. Real gates are untouched, and
    // there is still at least one of them — an empty list would mean the sweep found nothing at all.
    expect(gated.length).toBeGreaterThan(0);
    expect(gated.some((p) => p.includes("authority/platform-admin"))).toBe(false);
  });
});

describe("★ TEAMS BOOTSTRAP AND THE VISUAL REPAIR ARE UNCHANGED", () => {
  it("the tab still bootstraps, still renders the app shell, and still honours ?diag=1", () => {
    const shell = read("src/components/teams/TeamsTabShell.tsx");
    expect(shell).toContain("/api/auth/teams-bootstrap");
    expect(shell).toMatch(/<BtyDailyAppShell locale=\{phase\.locale\} \/>/);
    expect(shell).toContain('get("diag") === "1"');
    expect(shell).toMatch(/diag \? <TeamsRuntimeProbe \/> : null/);
  });

  it("★ the runtime probe is KEPT — automated tests still measure through it", () => {
    expect(existsSync(join(process.cwd(), "src/components/teams/TeamsRuntimeProbe.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/components/teams/teamsRuntimeProbe.test.tsx"))).toBe(true);
    expect(read("src/components/teams/TeamsRuntimeProbe.tsx")).toContain("fixed inset-x-0 bottom-0");
  });

  it("★ the TQ-3 display repair is bit-for-bit intact", () => {
    const shell = read("src/components/app-shell/BtyDailyAppShell.tsx");
    expect(shell).toContain("h-[100dvh]");
    // The REAL safe-area inset is still the first term; no invented one replaced it.
    expect(shell).toContain("max(env(safe-area-inset-top), var(--bty-host-top-floor, 0px))");
    expect(shell).toContain('<main ref={mainScrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 pt-8"');
    // Nothing was scaled — the device numbers ruled rasterisation out.
    expect(shell).not.toMatch(/className="[^"]*\bscale-\d/);
    const layout = read("src/app/teams/layout.tsx");
    expect(layout).toContain('minHeight: "100dvh"');
    expect(layout).toContain("#0B1F3A");
  });
});
