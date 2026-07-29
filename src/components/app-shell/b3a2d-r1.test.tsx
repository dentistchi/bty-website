/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import BtyDailyAppShell from "./BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Shell semantics — return labels, root reselect, weekly refresh (carried from R1). ──────────
function stub() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      calls.push(u);
      const attendance = Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-2${1 + i}T05:00:00.000Z`, active: i % 2 === 0 }));
      const body = u.includes("/api/auth/session")
        ? { ok: true, user: { email: "ywamer2022@gmail.com" } }
        : u.includes("/api/me/today/weekly-activity")
          ? { ok: true, summary: { weeklyPoints: 12, forgeStage: 1, activeDays: 3, trainingsCompleted: 1 }, window: { startIso: "", endIso: "" }, attendance }
          : u.includes("/api/me/daily-trace")
            ? { dailyTrace: [] }
            : u.includes("/api/me/today/brief")
              ? { ok: true, reminders: [] }
              : { ok: true, items: [], reviewedPlans: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return calls;
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  const tapMe = () => fireEvent.click(within(nav).getByText("Me"));
  tapMe();
  return { nav, tapMe };
}

describe("Me → What I learned return semantics (carried)", () => {
  it("shows back label 'Me', never 'Required learning', and returns to root", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-learned"));
    const back = await screen.findByTestId("my-learning-back");
    expect(back.textContent).toContain("Me");
    expect(back.textContent).not.toMatch(/Required learning/i);
    fireEvent.click(back);
    expect(await screen.findByTestId("me-home")).toBeTruthy();
  });
});

describe("Bottom Me tab = root reselect (carried)", () => {
  it("clears a nested Account view and returns to the Me root", async () => {
    stub();
    const { tapMe } = await gotoMe();
    fireEvent.click(await screen.findByTestId("me-account-row"));
    expect(await screen.findByTestId("me-account")).toBeTruthy();
    tapMe();
    expect(await screen.findByTestId("me-home")).toBeTruthy();
    expect(screen.queryByTestId("me-account")).toBeNull();
  });

  it("re-fetches the weekly projection on Me reselect", async () => {
    const calls = stub();
    const { tapMe } = await gotoMe();
    await screen.findByTestId("me-home");
    const before = calls.filter((c) => c.includes("/api/me/today/weekly-activity")).length;
    tapMe();
    await screen.findByTestId("me-home");
    const after = calls.filter((c) => c.includes("/api/me/today/weekly-activity")).length;
    expect(after).toBeGreaterThan(before);
  });
});

// ── R4: no weekly popup; This Week is a static summary; the Orb is non-interactive presence. ─────
describe("Me weekly — static summary + non-interactive Orb, no popup (R4)", () => {
  it("renders the living Orb as NON-interactive presence; no entry door / hold-to-enter", async () => {
    stub();
    await gotoMe();
    expect(await screen.findByTestId("me-weekly-trace")).toBeTruthy();
    const orb = screen.getByTestId("me-weekly-orb");
    expect(orb.tagName).not.toBe("BUTTON");
    expect(orb.getAttribute("role")).toBe("img");
    expect(orb.hasAttribute("tabindex")).toBe(false); // not keyboard-focusable
    expect(orb.getAttribute("aria-expanded")).toBeNull();
    expect(screen.queryByTestId("me-orb-door")).toBeNull();
    expect(screen.queryByText(/Hold to enter/i)).toBeNull();
  });

  it("This Week is a static summary (not a button); tapping it or the Orb opens NO popup", async () => {
    stub();
    await gotoMe();
    const summary = await screen.findByTestId("me-week-summary");
    expect(summary.tagName).not.toBe("BUTTON");
    expect(summary.getAttribute("aria-expanded")).toBeNull();
    fireEvent.click(summary);
    fireEvent.click(screen.getByTestId("me-weekly-orb"));
    expect(screen.queryByTestId("me-week-popup")).toBeNull();
    expect(screen.getByTestId("me-home")).toBeTruthy(); // still the Me root, no nested/dialog view
  });

  it("no weekly popup / close control / day-grid / disclosure trigger remains in the Me DOM", async () => {
    stub();
    await gotoMe();
    for (const id of ["me-week-popup", "me-week-close", "me-week-days", "me-week-open"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });
});

// ── Source contracts — living Orb reuse, no entry-door semantics in Me. ─────────────────────────
describe("Me Orb source contract (B3A.2D-R2)", () => {
  const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

  it("MeWeeklyTrace reuses WeeklyOrb and has no hold/commit/entry semantics", () => {
    const src = read("./MeWeeklyTrace.tsx");
    expect(src).toMatch(/import WeeklyOrb from "@\/components\/app-shell\/WeeklyOrb"/);
    expect(src).not.toMatch(/OrbLiving/);
    expect(src).not.toMatch(/holdMs|onCommit|Hold to enter|orbEntryContract/);
    // No second animation runtime is defined here (WeeklyOrb owns the canvas/rAF).
    expect(src).not.toMatch(/getContext\(|requestAnimationFrame/);
  });

  it("the shell mounts MeWeeklyTrace on the Me root, not the entry door", () => {
    const src = read("./BtyDailyAppShell.tsx");
    expect(src).toMatch(/<MeWeeklyTrace/);
    expect(src).not.toMatch(/MeOrbDoor|MeThisWeekDetail|meView === "this-week"/);
  });
});
