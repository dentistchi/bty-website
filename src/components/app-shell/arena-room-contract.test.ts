import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source-contract guard (Slice 3.0C-1): the in-shell Arena Practice player must
 * NEVER navigate — every transition is local React state. This asserts the
 * navigation lock at the source level and that BtyDailyAppShell only swapped the
 * arena branch (other tabs + AppTabBar untouched).
 */
/** Read a source file with COMMENTS STRIPPED — the assertions target real code, not
 *  the doc comments (which legitimately name the forbidden patterns as guidance). */
const read = (rel: string) =>
  readFileSync(join(__dirname, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line comments (keep http:// etc.)

describe("ArenaRoom navigation lock", () => {
  const src = read("./ArenaRoom.tsx");

  it("has NO router / navigation / window.location / Link", () => {
    expect(src).not.toMatch(/useRouter|router\.(push|replace)/);
    expect(src).not.toMatch(/next\/navigation/);
    expect(src).not.toMatch(/window\.location/);
    expect(src).not.toMatch(/next\/link/i);
    expect(src).not.toMatch(/<Link\b/);
  });

  it("navigates via no anchor/href (buttons only)", () => {
    expect(src).not.toMatch(/href=/); // no <a>/<Link> navigation; only <button onClick>
  });

  it("reuses ArenaPracticePlayer (does not reuse the route-dependent play client)", () => {
    expect(src).toMatch(/ArenaPracticePlayer/);
    expect(src).not.toMatch(/ArenaPracticePlayClient/);
  });
});

describe("arenaRoomActions endpoint discipline", () => {
  const src = read("./arenaRoomActions.ts");

  it("only calls published-practice endpoints (no canonical Arena run / XP)", () => {
    expect(src).toMatch(/\/api\/arena\/practice/);
    expect(src).not.toMatch(/\/api\/arena\/run/);
    expect(src).not.toMatch(/increment_arena_xp|weekly_xp|core_xp|user_scenario_history/);
  });

  it("has no router/navigation", () => {
    expect(src).not.toMatch(/useRouter|next\/navigation|window\.location/);
  });
});

describe("BtyDailyAppShell — only the arena branch changed", () => {
  const src = read("./BtyDailyAppShell.tsx");

  it("arena tab renders ArenaRoom (not the old LockedRoom stub, not ArenaTabRoom)", () => {
    expect(src).toMatch(/tab === "arena" && <ArenaRoom/);
    expect(src).not.toMatch(/tab === "arena" && <LockedRoom/);
    expect(src).not.toMatch(/ArenaTabRoom/);
  });

  it("Today / Center / Foundry / Me tab branches render their rooms", () => {
    expect(src).toMatch(/tab === "today"/);
    // Center is ONE canonical Personal Reality Feed — no subview (Slice 3.1B-3J).
    expect(src).toMatch(/tab === "center" && <CenterRealityFeed locale={locale} focusEntryId={centerFocusEntry}/);
    // Foundry tab renders the rooms surface, OR the in-shell completion review when a
    // ?review deep-link / Review-learning tap is active (Slice 3.1B-3E.1).
    expect(src).toMatch(/tab === "foundry" &&/);
    // FoundryEventRooms renders with onOpenReview (+ onOpenMyLearning wiring, Slice 3.1B-3H).
    expect(src).toMatch(/<FoundryEventRooms[\s\S]*?onOpenReview={setReviewId}/);
    expect(src).toMatch(/onOpenMyLearning={\(\) => setFoundryView\("my-learning"\)}/);
    expect(src).toMatch(/<FoundryMyLearning locale={locale}/);
    expect(src).toMatch(/<FoundryCompletionReview/);
    expect(src).toMatch(/tab === "me"/);
  });

  it("AppTabBar remains the in-component tab owner (onSelect={setTab})", () => {
    expect(src).toMatch(/<AppTabBar active={tab} onSelect={setTab}/);
  });
});

describe("Foundry publish-link safety — no eject-out-of-shell navigation", () => {
  const src = read("../foundry/arena-practice/ArenaPracticeFlow.tsx");
  it("no longer router.push-es to the standalone /bty-arena/practice route", () => {
    expect(src).not.toMatch(/router\.push\([^)]*bty-arena\/practice/);
    expect(src).not.toMatch(/useRouter/);
  });
  it("guides the host to the Arena tab with non-navigating copy", () => {
    expect(src).toMatch(/openArenaTabHint/);
  });
});

describe("AppTabBar remains in-component (no route navigation introduced)", () => {
  const src = read("./AppTabBar.tsx");
  it("uses an onSelect callback, no router / Link", () => {
    expect(src).toMatch(/onSelect/);
    expect(src).not.toMatch(/useRouter|next\/navigation|next\/link|<Link\b/i);
  });
});
