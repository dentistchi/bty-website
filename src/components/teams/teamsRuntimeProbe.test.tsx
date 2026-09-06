import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The Teams runtime probe — MEASUREMENT, and the guarantee that it stays measurement.
 *
 * A Founder screenshot showed the tab looking soft with the top slightly clipped. Every candidate
 * cause produces that same screenshot and a different repair, so this slice ships numbers rather
 * than a guess. What these tests hold is that the probe cannot become a second product: it is off
 * unless the URL asks, it sends nothing anywhere, and it changes no layout.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PROBE = "src/components/teams/TeamsRuntimeProbe.tsx";
const SHELL = "src/components/teams/TeamsTabShell.tsx";

describe("★ it is off unless the URL asks", () => {
  it("the tab renders it only for ?diag=1", () => {
    const src = code(SHELL);
    expect(src).toContain('get("diag") === "1"');
    expect(src).toMatch(/diag \? <TeamsRuntimeProbe \/> : null/);
  });

  it("the ordinary tab is unchanged — the shell still renders BtyDailyAppShell on ready", () => {
    expect(code(SHELL)).toMatch(/<BtyDailyAppShell\s+locale=\{phase\.locale\}/);
  });
});

describe("★ it measures, and never reports anywhere", () => {
  it("makes no network call of any kind", () => {
    const src = code(PROBE);
    for (const forbidden of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "/api/"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
  });

  it("stores nothing", () => {
    const src = code(PROBE);
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "document.cookie"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
  });

  it("★ collects no identity — no user, tenant, token, session or message", () => {
    const src = code(PROBE).toLowerCase();
    for (const forbidden of ["userid", "tenant", "token", "session", "email", "aad", "supabase"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
  });
});

describe("★ it changes no layout", () => {
  it("is fixed and overlaid, never inserted into the measured flow", () => {
    const src = code(PROBE);
    expect(src).toContain("fixed inset-x-0 bottom-0");
  });

  it("the safe-area sampler is hidden and non-interactive, so it cannot shift anything", () => {
    const src = code(PROBE);
    expect(src).toContain('visibility: "hidden"');
    expect(src).toContain('pointerEvents: "none"');
    expect(src).toContain('position: "absolute"');
  });

  it("its own controls meet the 44px touch target floor", () => {
    const src = code(PROBE);
    expect(src.match(/min-h-\[44px\]/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("★ it measures the things the screenshot could have been", () => {
  const src = code(PROBE);
  const required: [string, string][] = [
    ["framed", "window.self !== window.top"],
    ["visualViewport", "window.visualViewport"],
    ["devicePixelRatio", "devicePixelRatio"],
    ["safe-area insets", "env(safe-area-inset-top)"],
    ["horizontal overflow", "document.body.scrollWidth"],
    ["ancestor transform/zoom/filter", "transformChain"],
    ["first heading geometry", "first heading rect"],
    ["bottom nav geometry", "bottom nav rect"],
  ];
  for (const [label, needle] of required) {
    it(`reports ${label}`, () => expect(src).toContain(needle));
  }

  it("★ re-measures on viewport change — a one-shot reading would miss the Teams chrome settling", () => {
    expect(src).toContain('window.visualViewport?.addEventListener("resize"');
    expect(src).toContain("requestAnimationFrame");
  });
});

describe("★ no cosmetic change shipped with it", () => {
  it("the app shell root still uses dynamic viewport height and no transform", () => {
    const shell = read("src/components/app-shell/BtyDailyAppShell.tsx");
    expect(shell).toContain("h-[100dvh]");
    expect(shell).not.toMatch(/className="[^"]*\bscale-\d/);
  });

  it("the Teams floor is untouched", () => {
    expect(code("src/app/teams/layout.tsx")).toContain('minHeight: "100dvh"');
  });
});
