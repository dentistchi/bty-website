/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";
import MeThisWeek from "./MeThisWeek";
import MeWeeklyTrace from "./MeWeeklyTrace";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

/**
 * 3.2F-EVENT-PARTICIPANT-R1 — Me "This Week" detail entry reliability.
 *
 * Device-proven defect: tapping the labeled "This week" summary card did NOT open the weekly
 * popup — the card was display-only and the only trigger was the unlabeled Orb. These tests prove
 * the labeled card is now a semantic disclosure button that reliably opens the SHARED popup on the
 * first tap, renders the existing weekly content (incl. Events when present), closes/reopens, and
 * leaves the rest of Me usable — without a long press and with no duplicate dialogs.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

const SUMMARY = { weeklyPoints: 12, forgeStage: 1, activeDays: 3, trainingsCompleted: 1, trainingsCreated: 2, centerReflections: 0, actionPlansCompleted: 1, eventsParticipated: 2 };
const ATTENDANCE = Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-2${2 + i}T05:00:00.000Z`, active: i % 2 === 0 }));

function stubShell(opts: { events?: Array<{ title: string; date: string }> } = {}) {
  const events = opts.events ?? [
    { title: "Kickoff", date: "2026-07-28T09:00:00.000Z" },
    { title: "Morning huddle", date: "2026-07-24T08:00:00.000Z" },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      let body: unknown = {};
      if (u.includes("/api/auth/session")) body = { ok: true, user: { email: "ywamer2022@gmail.com" } };
      else if (u.includes("/api/me/today/weekly-activity") && u.includes("detail=1")) body = { ok: true, summary: SUMMARY, window: { startIso: "", endIso: "" }, attendance: ATTENDANCE, eventsParticipated: events };
      else if (u.includes("/api/me/today/weekly-activity")) body = { ok: true, summary: SUMMARY };
      else if (u.includes("/api/me/daily-trace")) body = { dailyTrace: [{ date: "d1", intensity: 1 }, { date: "d2", intensity: 0 }] };
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

describe("Me This Week — labeled card opens the shared popup (R1)", () => {
  it("the This Week card is a semantic button (not an inert div) with an adequate full-card hit target", async () => {
    stubShell();
    await gotoMe();
    const trigger = await screen.findByTestId("me-week-open");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // The whole labeled card (with its counts) is the tap target — a large mobile hit area.
    expect(within(trigger).getByTestId("me-week-counts")).toBeTruthy();
    // No nested interactive control inside the trigger button (no button-in-button).
    expect(within(trigger).queryByRole("button")).toBeNull();
  });

  it("a single normal tap (no long-press) opens the popup on the FIRST activation", async () => {
    stubShell();
    await gotoMe();
    expect(screen.queryByTestId("me-week-popup")).toBeNull();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    expect(screen.getByTestId("me-week-open").getAttribute("aria-expanded")).toBe("true");
  });

  it("the popup shows existing weekly content (date range + day indicators)", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    await screen.findByTestId("me-week-popup");
    expect(await screen.findByTestId("me-week-range")).toBeTruthy();
    expect(await screen.findByTestId("me-week-days")).toBeTruthy();
  });

  it("the popup shows the Events section (title + date, newest-first) when canonical Event items exist", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const items = await screen.findAllByTestId("me-week-event-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Kickoff");
    expect(items[1].textContent).toContain("Morning huddle");
  });

  it("empty Events does not block opening (popup still opens; no Events section)", async () => {
    stubShell({ events: [] });
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    await screen.findByTestId("me-week-popup");
    await waitFor(() => expect(screen.getByTestId("me-week-days")).toBeTruthy());
    expect(screen.queryByTestId("me-week-events")).toBeNull();
  });

  it("close returns to Me (popup removed), and reopening works", async () => {
    stubShell();
    await gotoMe();
    const trigger = await screen.findByTestId("me-week-open");
    fireEvent.click(trigger);
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    fireEvent.click(trigger); // close
    await waitFor(() => expect(screen.queryByTestId("me-week-popup")).toBeNull());
    fireEvent.click(trigger); // reopen
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
  });

  it("the This Week card is the SOLE popup trigger — the Orb does not open it; rapid taps never duplicate (R3)", async () => {
    stubShell();
    await gotoMe();
    const card = await screen.findByTestId("me-week-open");
    const orb = await screen.findByTestId("me-weekly-orb");
    fireEvent.click(orb); // the Orb is presence, not a control → no popup
    expect(screen.queryByTestId("me-week-popup")).toBeNull();
    fireEvent.click(card); // the card opens it
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    fireEvent.click(card);
    fireEvent.click(card);
    fireEvent.click(card);
    // Single card-owned disclosure — at most one popup instance regardless of tap count.
    expect(screen.queryAllByTestId("me-week-popup").length).toBeLessThanOrEqual(1);
  });

  it("other Me controls remain usable after the weekly interaction", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    await screen.findByTestId("me-week-popup");
    // A different Me row still works (navigates to its subview).
    fireEvent.click(screen.getByTestId("me-row-center"));
    expect(await screen.findByTestId("me-center-back")).toBeTruthy();
  });
});

describe("MeThisWeek trigger semantics (R1, component-level)", () => {
  function stubSummary(summary: Record<string, unknown>) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, summary }), { status: 200 })));
  }

  it("controlled: renders a disclosure button, reflects weekOpen, and calls onToggleWeek on tap", async () => {
    stubSummary({ weeklyPoints: 5 });
    const onToggle = vi.fn();
    const { rerender } = render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} weekOpen={false} onToggleWeek={onToggle} />);
    const btn = await screen.findByTestId("me-week-open");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} weekOpen={true} onToggleWeek={onToggle} />);
    expect(screen.getByTestId("me-week-open").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("me-week-open").getAttribute("aria-controls")).toBe("me-week-popup");
  });

  it("uncontrolled (no onToggleWeek): stays a display-only card — no trigger button (regression preserved)", async () => {
    stubSummary({ weeklyPoints: 7 });
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("7 points"));
    expect(screen.queryByTestId("me-week-open")).toBeNull();
  });
});

describe("MeWeeklyTrace controlled disclosure (R1)", () => {
  function stubDetail() {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, summary: { weeklyPoints: 1 }, window: { startIso: "", endIso: "" }, attendance: ATTENDANCE, eventsParticipated: [] }), { status: 200 })));
  }

  it("controlled open renders the popup; the close control fires onOpenChange(false); the Orb is non-interactive (R3)", async () => {
    stubDetail();
    const onOpenChange = vi.fn();
    render(<MeWeeklyTrace locale="en" weeklyRhythm={[1, 0, 1]} refreshKey={1} open={true} onOpenChange={onOpenChange} />);
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    const orb = screen.getByTestId("me-weekly-orb");
    expect(orb.tagName).not.toBe("BUTTON");
    fireEvent.click(orb); // presence only — no disclosure change
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("me-week-close")); // the reachable close control
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
