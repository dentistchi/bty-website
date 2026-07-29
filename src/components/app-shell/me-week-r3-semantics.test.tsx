/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

/**
 * 3.2F-EVENT-PARTICIPANT-R3 — participant MEANING + disclosure separation, proven through the shell.
 *
 * Two product-meaning fixes: (1) the copy must read as the user's OWN participation ("events joined"
 * / "Events you joined" / "Joined Jul 28"), not a bare Event count/date; (2) the This Week card is
 * the SOLE trigger for the weekly popup — the Me 7-Orb is non-interactive presence, not a duplicate
 * button. Copy uses the repo's existing chip/section pattern; no server/query/schema change.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

const ATTENDANCE = Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-2${2 + i}T05:00:00.000Z`, active: i % 2 === 0 }));

function stubShell(opts: { eventsCount?: number; events?: Array<{ title: string; date: string }> }) {
  const summary = { weeklyPoints: 12, forgeStage: 2, activeDays: 3, eventsParticipated: opts.eventsCount };
  const events = opts.events ?? [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      let body: unknown = {};
      if (u.includes("/api/auth/session")) body = { ok: true, user: { email: "ddshanbit@gmail.com" } };
      else if (u.includes("/api/me/today/weekly-activity") && u.includes("detail=1")) body = { ok: true, summary, window: { startIso: "", endIso: "" }, attendance: ATTENDANCE, eventsParticipated: events };
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

describe("R3 — participation MEANING copy (through the shell)", () => {
  it("summary chip reads '1 event joined' (singular)", async () => {
    stubShell({ eventsCount: 1 });
    await gotoMe();
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("1 event joined"));
  });

  it("summary chip reads 'N events joined' (plural)", async () => {
    stubShell({ eventsCount: 3 });
    await gotoMe();
    await waitFor(() => expect(screen.getByTestId("me-week-counts").textContent).toContain("3 events joined"));
  });

  it("detail popup reads 'Events you joined' with the canonical title and 'Joined <date>'", async () => {
    stubShell({ eventsCount: 1, events: [{ title: "Test", date: "2026-07-28T09:00:00.000Z" }] });
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const section = await screen.findByTestId("me-week-events");
    expect(section.textContent).toContain("Events you joined"); // section meaning
    const item = await screen.findByTestId("me-week-event-item");
    expect(item.textContent).toContain("Test"); // canonical title preserved
    expect(item.textContent).toMatch(/Joined\s+Jul 28/); // action-labelled date
  });

  it("multiple joined events render newest-first, each as 'Joined <date>', no ids/XP", async () => {
    stubShell({
      eventsCount: 2,
      events: [
        { title: "Kickoff", date: "2026-07-28T09:00:00.000Z" },
        { title: "Huddle", date: "2026-07-24T08:00:00.000Z" },
      ],
    });
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const items = await screen.findAllByTestId("me-week-event-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toMatch(/Kickoff.*Joined\s+Jul 28/);
    expect(items[1].textContent).toContain("Huddle");
    const popup = screen.getByTestId("me-week-popup");
    expect(popup.textContent ?? "").not.toMatch(/event_id|user_id|token|XP|Core/i);
  });

  it("does not overstate: no mastery/completed/verified/ownership/ranking language", async () => {
    stubShell({ eventsCount: 1, events: [{ title: "Test", date: "2026-07-28T09:00:00.000Z" }] });
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-week-open"));
    const popup = await screen.findByTestId("me-week-popup");
    expect(popup.textContent ?? "").not.toMatch(/master|completed|verified|owner|rank|#\d/i);
  });
});

describe("R3 — disclosure separation (through the shell)", () => {
  it("the This Week card opens the popup; the 7-Orb does not; the Orb stays a living non-interactive image", async () => {
    stubShell({ eventsCount: 1, events: [{ title: "Test", date: "2026-07-28T09:00:00.000Z" }] });
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    expect(orb.tagName).not.toBe("BUTTON");
    expect(orb.getAttribute("role")).toBe("img");
    expect(orb.hasAttribute("tabindex")).toBe(false);
    expect(orb.querySelector("canvas")).toBeTruthy(); // animation/presence retained
    fireEvent.click(orb);
    expect(screen.queryByTestId("me-week-popup")).toBeNull(); // no duplicate disclosure
    fireEvent.click(await screen.findByTestId("me-week-open"));
    expect(await screen.findByTestId("me-week-popup")).toBeTruthy();
    // attendance evidence remains in the same unified popup
    expect(screen.getByTestId("me-week-days")).toBeTruthy();
  });

  it("close control dismisses; reopening via the card retains the joined Event", async () => {
    stubShell({ eventsCount: 1, events: [{ title: "Test", date: "2026-07-28T09:00:00.000Z" }] });
    await gotoMe();
    const card = await screen.findByTestId("me-week-open");
    fireEvent.click(card);
    expect(await screen.findByTestId("me-week-event-item")).toBeTruthy();
    fireEvent.click(screen.getByTestId("me-week-close"));
    await waitFor(() => expect(screen.queryByTestId("me-week-popup")).toBeNull());
    fireEvent.click(card);
    expect((await screen.findByTestId("me-week-event-item")).textContent).toContain("Test");
  });
});
