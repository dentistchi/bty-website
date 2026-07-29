/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import MeThisWeek from "./MeThisWeek";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

/**
 * 3.2F Event participation — the Me summary chip. R4 removed the weekly popup; the participant's
 * joined-Event count now lives ONLY in the static This Week summary as "N event(s) joined".
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

function stubSummary(summary: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, summary }), { status: 200 })));
}

describe("Me This Week summary — Events chip (3.2F · R4 static summary)", () => {
  it("shows the canonical event-participation count as 'N events joined'", async () => {
    stubSummary({ weeklyPoints: 5, eventsParticipated: 2 });
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    const counts = await screen.findByTestId("me-week-counts");
    await waitFor(() => expect(counts.textContent).toContain("2 events joined"));
    expect(counts.textContent).not.toMatch(/XP|Core/i); // never raw XP
  });

  it("uses the singular form '1 event joined'", async () => {
    stubSummary({ eventsParticipated: 1 });
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    expect((await screen.findByTestId("me-week-counts")).textContent).toContain("1 event joined");
  });

  it("omits the chip when the events category is unavailable (undefined)", async () => {
    stubSummary({ weeklyPoints: 3 }); // no eventsParticipated → omit-when-undefined
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("3 points"));
    expect(screen.getByTestId("me-week-counts").textContent).not.toContain("event");
  });
});
