import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * THE LAST DOOR INTO THE OLD PRODUCT GENERATION.
 *
 * `/{locale}/today` is the one call site in the repository that passes `surface="navy"` to
 * `ScreenShell`, so it looks like the current product on arrival — and it wears the fixed 5-tab
 * `BottomNav`, whose four other tabs cross into routes where that same `ScreenShell` takes its
 * beige default. New shell over old content, on four tabs out of five.
 *
 * Measurement found nothing legitimate still depending on it: no canonical `/app` UI navigates
 * here, no auth flow names it as a `next`, no native route reaches it, no email/QR/notification
 * generator has ever emitted it (`git log -S` over every outbound builder is empty), middleware and
 * root routing never choose it, and no test treats it as canonical. It parses no query parameters
 * at all, so there is no deep-link intent a redirect could lose.
 *
 * So the door closes and NOTHING ELSE MOVES. The legacy page body, its components, its engines and
 * its sibling routes all stay exactly where they are — this contains an entry point, it does not
 * migrate a product.
 */

const redirect = vi.fn();
const permanentRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...a: unknown[]) => redirect(...a),
  permanentRedirect: (...a: unknown[]) => permanentRedirect(...a),
}));

import TodayPage from "./page";

beforeEach(() => {
  redirect.mockClear();
  permanentRedirect.mockClear();
});

describe("T1/T2 · the legacy portal entry lands in the current product", () => {
  it("T1 — /en/today → /en/app", async () => {
    await TodayPage({ params: Promise.resolve({ locale: "en" }) });
    expect(redirect).toHaveBeenCalledWith("/en/app");
  });

  it("T2 — /ko/today → /ko/app, the language carried through unchanged", async () => {
    await TodayPage({ params: Promise.resolve({ locale: "ko" }) });
    expect(redirect).toHaveBeenCalledWith("/ko/app");
  });

  it("an unknown locale segment still lands in the current product, in English", async () => {
    await TodayPage({ params: Promise.resolve({ locale: "fr" }) });
    expect(redirect).toHaveBeenCalledWith("/en/app");
  });

  it("it never routes to another legacy sibling", async () => {
    await TodayPage({ params: Promise.resolve({ locale: "en" }) });
    const target = String(redirect.mock.calls[0]?.[0] ?? "");
    for (const legacy of ["/today", "/center", "/bty-arena", "/bty/foundry", "/my-page"]) {
      expect(target, `must not send anyone to ${legacy}`).not.toContain(legacy);
    }
  });
});

describe("T3 · temporary, deliberately", () => {
  it("uses the reversible redirect — a browser-cached permanent one would be hard to undo", async () => {
    await TodayPage({ params: Promise.resolve({ locale: "en" }) });
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it("and the source says so, so a later edit cannot quietly make it permanent", () => {
    // Prose is not code: the route's own comment names `permanentRedirect` to record why it is
    // NOT used, and a file-wide string match failed on that explanation.
    const src = readFileSync("src/app/[locale]/today/page.tsx", "utf8");
    for (const line of src.split("\n")) {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
      expect(line, "the route must not permanently redirect").not.toContain("permanentRedirect");
    }
  });
});

describe("T4/T5 · the canonical entry is unchanged and nothing can loop", () => {
  it("T4 — /start still targets /{locale}/app", () => {
    /*
      The first version of this forbade "/today`" file-wide and failed on the slice's own COMMENTS,
      which name the legacy portal in backticks while explaining why the door no longer opens it.
      Prose is not navigation; only lines that navigate are checked, exactly as T5 does.
    */
    const src = readFileSync("src/app/(shell)/start/page.client.tsx", "utf8");
    expect(src).toContain("const dest = `/${locale}/app`");
    for (const line of src.split("\n")) {
      if (/^\s*(\*|\/\/)/.test(line)) continue;
      if (!/href|router\.(push|replace)|redirect\(|location\.(assign|href)|const dest/.test(line)) continue;
      expect(line, "/start must not navigate to /today").not.toContain("/today");
    }
  });

  it("T5 — /app never routes back to /today, so the redirect has nowhere to bounce", () => {
    for (const f of ["src/app/[locale]/app/page.tsx", "src/components/app-shell/BtyDailyAppShell.tsx"]) {
      const src = readFileSync(f, "utf8");
      for (const line of src.split("\n")) {
        if (/^\s*(\*|\/\/)/.test(line)) continue; // prose, not navigation
        if (!/href|router\.(push|replace)|redirect\(|location\.(assign|href)/.test(line)) continue;
        expect(line, `${f} must not navigate to /today`).not.toContain("/today");
      }
    }
  });

  it("middleware still says nothing about /today, so it cannot re-enter the loop", () => {
    expect(readFileSync("src/middleware.ts", "utf8")).not.toContain("/today");
  });
});

describe("T6/T7 · contained, not migrated", () => {
  /*
    THE CLAIM IS ABOUT A COMMIT, SO IT IS MEASURED AGAINST THAT COMMIT (re-anchored in R4-R5A).

    T6/T6b read `git diff --name-only HEAD` — the UNCOMMITTED working tree. That is not where the
    containment slice's diff lives, and it produced the two failure modes a point-in-time proof
    should never have:

      · On a clean tree it returns ZERO files, so the loops below never execute and the tests pass
        vacuously. Measured at HEAD == ab8177e8 with a clean tree: 0 files iterated, 0 assertions.
        The proof this file is named for was not actually being made.
      · On ANY later branch it returns that branch's work-in-progress, so an unrelated future slice
        legitimately editing `src/components/app-shell/` fails a test about `/{locale}/today`.
        R4-R5A (Today first-paint truth + Practice readability) is the first slice to hit it.

    `ab8177e8` IS the containment commit ("the last door into the old product generation closes").
    Its diff is two files — this test and `src/app/[locale]/today/page.tsx` — so the assertions
    below now iterate a real, non-empty list and genuinely prove what they say: the door was closed
    without touching the current shell or migrating a legacy sibling. The pin is deliberate; a
    statement about one commit cannot be verified against a moving tree.
  */
  const CONTAINMENT_COMMIT = "ab8177e8e001c34b0da4c062b9773f025c7ccab5";
  const changed = () =>
    execFileSync("git", ["show", "--pretty=format:", "--name-only", CONTAINMENT_COMMIT], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

  it("the containment commit's diff is non-empty, so T6/T6b cannot pass vacuously", () => {
    expect(changed().length).toBeGreaterThan(0);
  });

  it("T6 — no current /app route or shell file was touched", () => {
    for (const f of changed()) {
      expect(f.startsWith("src/app/[locale]/app/"), `${f} must not change`).toBe(false);
      expect(f.startsWith("src/components/app-shell/"), `${f} must not change`).toBe(false);
    }
  });

  it("T6b — no legacy sibling route was touched either", () => {
    for (const f of changed()) {
      for (const sibling of [
        "src/app/[locale]/center/",
        "src/app/[locale]/bty-arena/",
        "src/app/[locale]/bty/",
        "src/app/[locale]/my-page/",
        "src/components/bty/navigation/",
      ]) {
        expect(f.startsWith(sibling), `${f} must not change`).toBe(false);
      }
    }
  });

  it("T7 — every preserved legacy file is still present and non-empty", () => {
    for (const f of [
      "src/app/[locale]/today/page.client.tsx",
      "src/components/bty/today/CriticalGateCheckHost.tsx",
      "src/components/bty/today/TodayDoorCards.tsx",
      "src/components/bty/today/TodayRelationshipBrief.tsx",
      "src/components/bty/today/RelationshipPulseSummary.tsx",
      "src/components/bty/today/todayRoutes.ts",
      "src/components/bty/navigation/BottomNav.tsx",
      "src/components/bty/navigation/nav-items.ts",
      "src/app/[locale]/center/page.tsx",
      "src/app/[locale]/bty-arena/page.tsx",
      "src/app/[locale]/my-page/page.tsx",
    ]) {
      expect(existsSync(f), `${f} must still exist`).toBe(true);
      expect(readFileSync(f, "utf8").length).toBeGreaterThan(0);
    }
  });

  it("T7b — the retired three-door surface is preserved, not gutted", () => {
    const host = readFileSync("src/components/bty/today/CriticalGateCheckHost.tsx", "utf8");
    for (const door of ["TodayDoorCards", "TodayRelationshipBrief", "RelationshipPulseSummary"]) {
      expect(host, `${door} must still be rendered by the preserved host`).toContain(door);
    }
  });
});
