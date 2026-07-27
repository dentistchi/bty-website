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

describe("PracticeLanding navigation lock (App Shell V1)", () => {
  const src = read("./PracticeLanding.tsx");
  it("has NO router / navigation for its own controls (Arena runtime stays in-shell)", () => {
    expect(src).not.toMatch(/useRouter|router\.(push|replace)/);
    expect(src).not.toMatch(/next\/navigation/);
    expect(src).not.toMatch(/next\/link/i);
  });
  it("opens the unchanged in-shell ArenaRoom in place", () => {
    expect(src).toMatch(/ArenaRoom/);
  });
});

describe("BtyDailyAppShell — four visible tabs (App Shell + Today Simplification V1)", () => {
  const src = read("./BtyDailyAppShell.tsx");

  it("renders exactly the four visible tab branches: today / learn / practice / me", () => {
    expect(src).toMatch(/tab === "today"/);
    expect(src).toMatch(/tab === "learn" &&/);
    expect(src).toMatch(/tab === "practice" &&/);
    expect(src).toMatch(/tab === "me" &&/);
    // The old five-domain visible tabs no longer exist as shell branches.
    expect(src).not.toMatch(/tab === "arena"/);
    expect(src).not.toMatch(/tab === "foundry"/);
    expect(src).not.toMatch(/tab === "center" &&/);
  });

  it("Practice renders PracticeLanding (Arena runtime moved beneath it, unchanged)", () => {
    expect(src).toMatch(/tab === "practice" && \(?\s*<PracticeLanding/);
  });

  it("Learn renders the unchanged Foundry surface + all its sub-views", () => {
    expect(src).toMatch(/tab === "learn" &&/);
    expect(src).toMatch(/<FoundryEventRooms[\s\S]*?onOpenReview={setReviewId}/);
    expect(src).toMatch(/onOpenMyLearning={\(\) => setFoundryView\("my-learning"\)}/);
    expect(src).toMatch(/<FoundryMyLearning locale={locale}/);
    expect(src).toMatch(/<FoundryCompletionReview/);
    // Learn identity header sits above the default Foundry surface.
    expect(src).toMatch(/<LearnHeader/);
  });

  it("Me root = This week first, then compact nav rows (Center + My Learning routing untouched)", () => {
    expect(src).toMatch(/meView === "center"/);
    expect(src).toMatch(/<CenterRealityFeed locale={locale} focusEntryId={centerFocusEntry}/);
    expect(src).toMatch(/meView === "my-learning"/);
    // B3A.2D: This-week summary leads; the large MeEntries cards are replaced by compact rows.
    expect(src).toMatch(/<MeThisWeek/);
    expect(src).toMatch(/me-row-center/);
    expect(src).toMatch(/me-account-row/);
  });

  it("Me Orb = living WeeklyOrb via MeWeeklyTrace (no entry-door / OrbLiving in the shell)", () => {
    // B3A.2D-R2: the Me Orb is the living seven-light WeeklyOrb wrapped by MeWeeklyTrace (tap →
    // inline popup). The startup entry Orb (OrbLiving / MeOrbDoor) is NOT used on the Me root.
    expect(src).toMatch(/<MeWeeklyTrace/);
    expect(src).not.toMatch(/<MeOrbDoor/);
    expect(src).not.toMatch(/OrbLiving/);
  });

  it("AppTabBar tab owner routes through handleTabSelect (root reselect wrapper over setTab)", () => {
    // B3A.2D-R1: onSelect now goes through handleTabSelect, which resets nested Me state, refreshes
    // the weekly projection, scrolls to top, and still calls setTab — the in-component tab owner.
    expect(src).toMatch(/<AppTabBar active={tab} onSelect={handleTabSelect}/);
    expect(src).toMatch(/const handleTabSelect = useCallback/);
    expect(src).toMatch(/setTab\(key\)/);
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

describe("Field Actions Focused Surface V1 — wiring guards", () => {
  const shell = read("./BtyDailyAppShell.tsx");
  const landing = read("./PracticeLanding.tsx");
  const reminders = read("../../lib/bty/daily/todayReminders.server.ts");

  it("Practice → Field Actions opens the focused surface in-shell, NOT generic Today", () => {
    // The landing no longer routes Field Actions to Today; it opens the focused subview.
    expect(landing).toMatch(/setView\("fieldActions"\)/);
    expect(landing).toMatch(/<FieldActionsFocus/);
    expect(shell).not.toMatch(/onGoFieldActions/);
  });

  it("the Today field-action deep link targets the focused Practice surface (test 9 wiring)", () => {
    // Reminder builder emits ?tab=practice&fieldAction= for field_action (so the Today primary CTA
    // opens the specific focused action), and the shell routes that param into Practice.
    expect(reminders).toMatch(/tab=practice&fieldAction=/);
    expect(shell).toMatch(/getBy?.*fieldAction|sp\.get\("fieldAction"\)|get\("fieldAction"\)/);
    expect(shell).toMatch(/setTab\("practice"\)[\s\S]*setPracticeFieldActionId/);
    expect(shell).toMatch(/initialFieldActionId={practiceFieldActionId}/);
  });
});

describe("AppTabBar remains in-component (no route navigation introduced)", () => {
  const src = read("./AppTabBar.tsx");
  it("uses an onSelect callback, no router / Link", () => {
    expect(src).toMatch(/onSelect/);
    expect(src).not.toMatch(/useRouter|next\/navigation|next\/link|<Link\b/i);
  });
});
