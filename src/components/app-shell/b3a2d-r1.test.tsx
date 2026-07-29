/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
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

// ── R3: This Week card OWNS the weekly popup; the Orb is non-interactive presence. ──────────────
describe("Me weekly popup — card-owned disclosure + non-interactive Orb (B3A.2D-R2 · R3)", () => {
  it("renders the weekly seven-light Orb (not the entry Orb) as NON-interactive presence; no 'Hold to enter'", async () => {
    stub();
    await gotoMe();
    expect(await screen.findByTestId("me-weekly-trace")).toBeTruthy();
    const orb = screen.getByTestId("me-weekly-orb");
    expect(orb.tagName).not.toBe("BUTTON"); // presence, not a control
    expect(orb.getAttribute("role")).toBe("img");
    expect(orb.hasAttribute("tabindex")).toBe(false); // not keyboard-focusable
    expect(orb.getAttribute("aria-expanded")).toBeNull();
    expect(orb.getAttribute("aria-controls")).toBeNull();
    expect(screen.queryByTestId("me-orb-door")).toBeNull(); // the entry door is gone from Me
    expect(screen.queryByText(/Hold to enter/i)).toBeNull();
  });

  it("the This Week CARD opens the popup; the Orb does NOT", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    expect(screen.queryByTestId("me-week-popup")).toBeNull(); // the Orb is not a trigger
    const card = await screen.findByTestId("me-week-open");
    expect(card.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(card);
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    expect(card.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("me-home")).toBeTruthy(); // inline, not a nested view
  });

  it("the popup's close control dismisses it; the card reopens it", async () => {
    stub();
    await gotoMe();
    const card = await screen.findByTestId("me-week-open");
    fireEvent.click(card);
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    fireEvent.click(screen.getByTestId("me-week-close"));
    await waitFor(() => expect(screen.queryByTestId("me-week-popup")).toBeNull());
    fireEvent.click(card);
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
  });

  it("the Orb (canvas) keeps stable identity across open/close — no remount / second canvas", async () => {
    stub();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    const canvasBefore = orb.querySelector("canvas");
    const card = await screen.findByTestId("me-week-open");
    fireEvent.click(card); // open
    fireEvent.click(card); // close
    const canvasesAfter = orb.querySelectorAll("canvas");
    expect(canvasesAfter.length).toBe(1); // exactly one canvas across open/close
    expect(canvasesAfter[0]).toBe(canvasBefore); // same DOM node → React kept the instance
  });

  it("selecting a day discloses only proven activity state and keeps the popup open", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const days = within(await screen.findByTestId("me-week-days")).getAllByRole("button");
    expect(days).toHaveLength(7); // seven dated indicators
    fireEvent.click(days[0]);
    const detail = await screen.findByTestId("me-week-day-detail");
    expect(detail.textContent).toMatch(/Activity recorded|No activity recorded/);
    // Still open after selecting a day.
    expect(screen.getByTestId("me-week-popup")).toBeTruthy();
  });

  it("bottom Me reselect closes an open popup", async () => {
    stub();
    const { tapMe } = await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    tapMe();
    expect(await screen.findByTestId("me-home")).toBeTruthy();
    expect(screen.queryByTestId("me-week-popup")).toBeNull();
  });

  it("opening another Me row closes the popup", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    fireEvent.click(screen.getByTestId("me-row-learned"));
    expect(await screen.findByTestId("foundry-my-learning")).toBeTruthy();
    expect(screen.queryByTestId("me-week-popup")).toBeNull();
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
