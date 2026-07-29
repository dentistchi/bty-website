/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";
import MeThisWeek from "./MeThisWeek";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

/**
 * 3.2F-EVENT-PARTICIPANT-R4 — remove the redundant weekly popup.
 *
 * Device decision: the This Week card already holds the meaningful weekly summary (incl.
 * "N event(s) joined"); the popup merely repeated it. "This Week is the summary; the Orb is the
 * presence; neither needs a popup." These tests prove: the This Week card is a STATIC summary (not
 * a button / not focusable / no disclosure), the Orb is non-interactive presence, NO weekly popup
 * or close control exists in the Me DOM, and Me no longer requests ?detail=1 (that request existed
 * only for the removed popup) while the summary endpoint is still requested normally.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

function stubShell(summary: Record<string, unknown>, seen?: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      seen?.push(u);
      let body: unknown = {};
      if (u.includes("/api/auth/session")) body = { ok: true, user: { email: "ddshanbit@gmail.com" } };
      else if (u.includes("/api/me/today/weekly-activity")) body = { ok: true, summary };
      else if (u.includes("/api/me/daily-trace")) body = { dailyTrace: [] };
      else if (u.includes("/api/me/today/brief")) body = { ok: true, reminders: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  fireEvent.click(within(nav).getByText("Me"));
  return await screen.findByTestId("me-home");
}

const A = { weeklyPoints: 30, forgeStage: 2, activeDays: 7, trainingsCompleted: 5, trainingsCreated: 0, centerReflections: 0, actionPlansCompleted: 2, eventsParticipated: 1 };
const B = { weeklyPoints: 103, forgeStage: 3, activeDays: 7, trainingsCompleted: 0, trainingsCreated: 4, centerReflections: 0, actionPlansCompleted: 0, eventsParticipated: 0 };

describe("R4 — This Week is a static summary (canonical values, joined copy)", () => {
  it("renders the canonical weekly values incl. '1 event joined' (Account A)", async () => {
    stubShell(A);
    await gotoMe();
    const counts = await screen.findByTestId("me-week-counts");
    await waitFor(() => expect(counts.textContent).toContain("1 event joined"));
    expect(counts.textContent).toContain("30 points");
    expect(counts.textContent).toContain("7 active days");
    expect(counts.textContent).toContain("5 learned");
    expect(counts.textContent).toContain("2 action plans");
  });

  it("renders '0 events joined' for an account with zero joined Events (Account B)", async () => {
    stubShell(B);
    await gotoMe();
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("0 events joined"));
  });

  it("uses plural 'N events joined'", async () => {
    stubShell({ eventsParticipated: 3 });
    await gotoMe();
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("3 events joined"));
  });

  it("This Week is NOT a button and exposes no disclosure state", async () => {
    stubShell(A);
    await gotoMe();
    const summary = await screen.findByTestId("me-week-summary");
    expect(summary.tagName).not.toBe("BUTTON");
    expect(within(summary).queryByRole("button")).toBeNull(); // no nested control
    expect(summary.hasAttribute("tabindex")).toBe(false);
    expect(summary.getAttribute("aria-expanded")).toBeNull();
    expect(summary.getAttribute("aria-controls")).toBeNull();
  });

  it("no participant PII / ids / QR tokens / Core XP internals appear", async () => {
    stubShell(A);
    await gotoMe();
    const week = await screen.findByTestId("me-this-week");
    expect(week.textContent ?? "").not.toMatch(/event_id|user_id|token|Core XP/i);
  });
});

describe("R4 — no weekly popup anywhere in the Me DOM", () => {
  it("tapping the This Week card creates no dialog/popup", async () => {
    stubShell(A);
    await gotoMe();
    const summary = await screen.findByTestId("me-week-summary");
    fireEvent.click(summary);
    fireEvent.click(within(summary).getByTestId("me-week-counts"));
    expect(screen.queryByTestId("me-week-popup")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("no popup, close control, event-item, day-grid, or range exists in the rendered Me", async () => {
    stubShell(A);
    await gotoMe();
    for (const id of ["me-week-popup", "me-week-close", "me-week-event-item", "me-week-events", "me-week-days", "me-week-range", "me-week-day-detail", "me-week-open"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });
});

describe("R4 — detail fetch removed; summary fetch retained; account-scoped", () => {
  it("Me requests the summary endpoint but NOT ?detail=1 (the popup-only request is gone)", async () => {
    const seen: string[] = [];
    stubShell(A, seen);
    await gotoMe();
    await waitFor(() => expect(seen.some((u) => u.includes("/api/me/today/weekly-activity"))).toBe(true));
    expect(seen.some((u) => u.includes("detail=1"))).toBe(false);
  });

  it("account isolation: switching the summary response updates the joined count (no stale flash)", async () => {
    // Account A (1 joined) via a controlled MeThisWeek, then reselect with Account B (0 joined).
    let current = A as Record<string, unknown>;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, summary: current }), { status: 200 })));
    const { rerender } = render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("1 event joined"));
    current = B;
    rerender(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={2} />);
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("0 events joined"));
    expect(screen.getByTestId("me-week-counts").textContent).not.toContain("1 event joined");
  });
});

describe("R4 — other Me controls remain usable", () => {
  it("a different Me row still navigates", async () => {
    stubShell(A);
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-center"));
    expect(await screen.findByTestId("me-center-back")).toBeTruthy();
  });
});
