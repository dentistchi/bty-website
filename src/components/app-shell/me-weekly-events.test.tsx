/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import MeThisWeek from "./MeThisWeek";
import MeWeeklyTrace from "./MeWeeklyTrace";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

function stubSummary(summary: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, summary }), { status: 200 })));
}
function stubDetail(detail: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, ...detail }), { status: 200 })));
}

describe("Me This Week summary — Events chip (3.2F)", () => {
  it("shows the canonical event-participation count as a chip", async () => {
    stubSummary({ weeklyPoints: 5, eventsParticipated: 2 });
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    const counts = await screen.findByTestId("me-week-counts");
    expect(counts.textContent).toContain("2 events");
    expect(counts.textContent).not.toMatch(/XP|Core/i); // never raw XP
  });

  it("uses the singular form for exactly one event", async () => {
    stubSummary({ eventsParticipated: 1 });
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    expect((await screen.findByTestId("me-week-counts")).textContent).toContain("1 event");
  });

  it("omits the chip when the events category is unavailable (undefined)", async () => {
    stubSummary({ weeklyPoints: 3 }); // no eventsParticipated → omit-when-undefined
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("3 points"));
    expect(screen.getByTestId("me-week-counts").textContent).not.toContain("event");
  });
});

describe("This Week popup — Events section (3.2F)", () => {
  const attendance = Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-2${1 + i}T05:00:00.000Z`, active: i % 2 === 0 }));

  it("lists the participant's own events (title + date), newest-first, no raw ids/XP", async () => {
    stubDetail({
      summary: { eventsParticipated: 2 },
      window: { startIso: "", endIso: "" },
      attendance,
      eventsParticipated: [
        { title: "Kickoff", date: "2026-07-27T09:00:00.000Z" },
        { title: "Morning huddle", date: "2026-07-24T08:00:00.000Z" },
      ],
    });
    render(<MeWeeklyTrace locale="en" weeklyRhythm={[1, 0, 1]} refreshKey={1} open={true} onOpenChange={() => {}} />);
    const section = await screen.findByTestId("me-week-events");
    const items = await screen.findAllByTestId("me-week-event-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Kickoff"); // newest first (as returned)
    expect(items[1].textContent).toContain("Morning huddle");
    expect(section.textContent ?? "").not.toMatch(/event_id|user_id|token|XP/i);
  });

  it("omits the Events section entirely when there are no events (empty array)", async () => {
    stubDetail({ summary: {}, window: { startIso: "", endIso: "" }, attendance, eventsParticipated: [] });
    render(<MeWeeklyTrace locale="en" weeklyRhythm={[1, 0, 1]} refreshKey={1} open={true} onOpenChange={() => {}} />);
    await screen.findByTestId("me-week-popup");
    expect(screen.queryByTestId("me-week-events")).toBeNull();
  });
});
