/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";
import MeWeeklyTrace from "./MeWeeklyTrace";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

/**
 * 3.2F-EVENT-PARTICIPANT-R2 — Me weekly EVENT CONTENT delivery, proven through the REAL shell path.
 *
 * R1 fixed opening; R1-B (Event content) still failed on device: the popup showed only attendance,
 * no Events section. Server delivery is proven correct (the detail endpoint returns
 * eventsParticipated), so these tests follow the integrated app data flow — shell fetch of
 * `?detail=1` → shell state → MeWeeklyTrace → the popup Events section — rather than injecting mock
 * Events straight into the component. They also lock the summary chip, the scroll/visibility
 * contract, account isolation, and the no-PII invariant.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

const SUMMARY = { weeklyPoints: 12, forgeStage: 2, activeDays: 3, eventsParticipated: 1 };
const ATTENDANCE = Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-2${2 + i}T05:00:00.000Z`, active: i % 2 === 0 }));
const EVENTS = [
  { title: "Kickoff", date: "2026-07-28T09:00:00.000Z" },
  { title: "Morning huddle", date: "2026-07-24T08:00:00.000Z" },
];

/** A fetch stub modelling the REAL endpoint: summary path vs `detail=1` path. Records the URLs it saw. */
function stubShell(opts: { events?: Array<{ title: string; date: string }>; seen?: string[] } = {}) {
  const events = opts.events ?? EVENTS;
  const fn = vi.fn(async (url: string) => {
    const u = String(url);
    opts.seen?.push(u);
    let body: unknown = {};
    if (u.includes("/api/auth/session")) body = { ok: true, user: { email: "ddshanbit@gmail.com" } };
    else if (u.includes("/api/me/today/weekly-activity") && u.includes("detail=1")) body = { ok: true, summary: SUMMARY, window: { startIso: "", endIso: "" }, attendance: ATTENDANCE, eventsParticipated: events };
    else if (u.includes("/api/me/today/weekly-activity")) body = { ok: true, summary: SUMMARY };
    else if (u.includes("/api/me/daily-trace")) body = { dailyTrace: [{ date: "d1", intensity: 1 }] };
    else if (u.includes("/api/me/today/brief")) body = { ok: true, reminders: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  fireEvent.click(within(nav).getByText("Me"));
  return await screen.findByTestId("me-home");
}

describe("R2 — Event content delivery through the real shell path", () => {
  it("the shell requests the detail endpoint with ?detail=1 (real wired path)", async () => {
    const seen: string[] = [];
    stubShell({ seen });
    await gotoMe();
    await waitFor(() => expect(seen.some((u) => u.includes("/api/me/today/weekly-activity") && u.includes("detail=1"))).toBe(true));
  });

  it("summary chip: the This Week card shows the canonical '1 event' from summary.eventsParticipated", async () => {
    stubShell();
    await gotoMe();
    const counts = await screen.findByTestId("me-week-counts");
    await waitFor(() => expect(counts.textContent).toContain("1 event"));
    expect(counts.textContent).not.toMatch(/XP|Core/i);
  });

  it("tapping the This Week card opens the popup and the Events section is present with title + date", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    await screen.findByTestId("me-week-popup");
    const items = await screen.findAllByTestId("me-week-event-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Kickoff"); // newest-first
    expect(items[1].textContent).toContain("Morning huddle");
    // participation date is shown (Jul 28 for the newest)
    expect(items[0].textContent).toMatch(/Jul 28|7\/28|Jul\s?28/);
    // attendance remains visible in the same unified popup
    expect(screen.getByTestId("me-week-days")).toBeTruthy();
  });

  it("the Orb opens the SAME popup with identical Event content", async () => {
    stubShell();
    await gotoMe();
    // open via card, read events
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const viaCard = (await screen.findAllByTestId("me-week-event-item")).map((n) => n.textContent);
    // close, open via Orb
    fireEvent.click(screen.getByTestId("me-week-open"));
    await waitFor(() => expect(screen.queryByTestId("me-week-popup")).toBeNull());
    fireEvent.click(screen.getByTestId("me-weekly-orb-toggle"));
    await screen.findByTestId("me-week-popup");
    const viaOrb = (await screen.findAllByTestId("me-week-event-item")).map((n) => n.textContent);
    expect(viaOrb).toEqual(viaCard);
  });

  it("Events surface ABOVE the attendance grid so they are visible without scrolling", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const events = await screen.findByTestId("me-week-events");
    const days = await screen.findByTestId("me-week-days");
    expect(events.compareDocumentPosition(days) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the popup is a scroll container (reachable content, contained scroll) — no clip trap", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const popup = await screen.findByTestId("me-week-popup");
    expect(popup.className).toMatch(/overflow-y-auto/);
    expect(popup.className).toMatch(/overscroll-contain/);
  });

  it("no participant PII / internal ids / XP appear in the popup", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const popup = await screen.findByTestId("me-week-popup");
    expect(popup.textContent ?? "").not.toMatch(/event_id|user_id|token|XP|Core/i);
  });

  it("empty Events keeps the popup functional (attendance shown, no Events section)", async () => {
    stubShell({ events: [] });
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    await screen.findByTestId("me-week-popup");
    await waitFor(() => expect(screen.getByTestId("me-week-days")).toBeTruthy());
    expect(screen.queryByTestId("me-week-events")).toBeNull();
  });
});

describe("R2 — MeWeeklyTrace delivery + isolation (component-level, real fetch path)", () => {
  function stubDetail(events: Array<{ title: string; date: string }> | undefined) {
    return vi.fn(async () => new Response(JSON.stringify({ ok: true, summary: { weeklyPoints: 1 }, window: { startIso: "", endIso: "" }, attendance: ATTENDANCE, eventsParticipated: events }), { status: 200 }));
  }

  it("undefined Events does not block the popup (attendance still renders)", async () => {
    vi.stubGlobal("fetch", stubDetail(undefined));
    render(<MeWeeklyTrace locale="en" weeklyRhythm={[1, 0, 1]} refreshKey={1} open={true} onOpenChange={() => {}} />);
    await screen.findByTestId("me-week-popup");
    await waitFor(() => expect(screen.getByTestId("me-week-days")).toBeTruthy());
    expect(screen.queryByTestId("me-week-events")).toBeNull();
  });

  it("account switch: a new refreshKey reloads canonical data and does NOT keep the prior account's Event", async () => {
    // Account A → event "Alpha".
    vi.stubGlobal("fetch", stubDetail([{ title: "Alpha", date: "2026-07-28T09:00:00.000Z" }]));
    const { rerender } = render(<MeWeeklyTrace locale="en" weeklyRhythm={[1]} refreshKey={1} open={true} onOpenChange={() => {}} />);
    expect((await screen.findByTestId("me-week-event-item")).textContent).toContain("Alpha");
    // Switch to account B (empty) → refetch on new refreshKey; Alpha must not persist.
    vi.stubGlobal("fetch", stubDetail([]));
    rerender(<MeWeeklyTrace locale="en" weeklyRhythm={[1]} refreshKey={2} open={true} onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
  });
});
