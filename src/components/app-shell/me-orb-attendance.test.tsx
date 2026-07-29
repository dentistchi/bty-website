/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";
import MeWeeklyTrace from "./MeWeeklyTrace";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

/**
 * 3.2F-ORB-WEEKLY-ATTENDANCE-R1 — the Me 7-Orb owns ONE interaction: reveal the seven-day
 * ATTENDANCE rhythm (attendance only). This is NOT the removed full weekly popup: no points /
 * learned / created / Center / action plans / events / XP / Stage. Detail is fetched lazily on Orb
 * activation (never on Me mount). "This Week is the summary; the Orb reveals attendance."
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

// 7 BTY days, mixed presence (5 active / 2 rest).
const ATTENDANCE = [
  { date: "2026-07-22T05:00:00.000Z", active: true },
  { date: "2026-07-23T05:00:00.000Z", active: true },
  { date: "2026-07-24T05:00:00.000Z", active: false },
  { date: "2026-07-25T05:00:00.000Z", active: true },
  { date: "2026-07-26T05:00:00.000Z", active: false },
  { date: "2026-07-27T05:00:00.000Z", active: true },
  { date: "2026-07-28T05:00:00.000Z", active: true },
];
const SUMMARY = { weeklyPoints: 30, forgeStage: 2, activeDays: 5, trainingsCompleted: 5, trainingsCreated: 0, centerReflections: 0, actionPlansCompleted: 2, eventsParticipated: 1 };

function stubShell(opts: { attendance?: Array<{ date: string; active: boolean }>; seen?: string[] } = {}) {
  const attendance = opts.attendance ?? ATTENDANCE;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      opts.seen?.push(u);
      let body: unknown = {};
      if (u.includes("/api/auth/session")) body = { ok: true, user: { email: "ddshanbit@gmail.com" } };
      else if (u.includes("/api/me/today/weekly-activity") && u.includes("detail=1")) body = { ok: true, summary: SUMMARY, window: { startIso: "", endIso: "" }, attendance, eventsParticipated: [{ title: "Test", date: "2026-07-28T09:00:00.000Z" }] };
      else if (u.includes("/api/me/today/weekly-activity")) body = { ok: true, summary: SUMMARY };
      else if (u.includes("/api/me/daily-trace")) body = { dailyTrace: [{ intensity: 1 }, { intensity: 0 }] };
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

describe("R1 — role separation: This Week static, Orb owns attendance", () => {
  it("This Week is a static summary (not a button); tapping it opens nothing", async () => {
    stubShell();
    await gotoMe();
    const summary = await screen.findByTestId("me-week-summary");
    expect(summary.tagName).not.toBe("BUTTON");
    expect(summary.getAttribute("aria-expanded")).toBeNull();
    fireEvent.click(summary);
    expect(screen.queryByTestId("me-attendance-popup")).toBeNull();
    expect(screen.queryByTestId("me-week-popup")).toBeNull(); // the removed full popup never returns
  });

  it("the Orb is a semantic button labelled for weekly attendance", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    expect(orb.tagName).toBe("BUTTON");
    expect(orb.getAttribute("aria-label")).toMatch(/weekly attendance/i);
    expect(orb.getAttribute("aria-expanded")).toBe("false");
  });

  it("a first Orb tap opens exactly one attendance popup and sets aria-expanded", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    fireEvent.click(orb);
    expect(await screen.findByTestId("me-attendance-popup")).toBeTruthy();
    expect(screen.queryAllByTestId("me-attendance-popup")).toHaveLength(1);
    expect(orb.getAttribute("aria-expanded")).toBe("true");
    expect(orb.getAttribute("aria-controls")).toBe("me-attendance-popup");
  });
});

describe("R1 — attendance-only content", () => {
  it("shows the week range, seven weekday states, and the active-day count", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    await screen.findByTestId("me-attendance-popup");
    expect(await screen.findByTestId("me-attendance-range")).toBeTruthy();
    const daysWrap = await screen.findByTestId("me-attendance-days");
    const days = within(daysWrap).getAllByTestId("me-attendance-day");
    expect(days).toHaveLength(7);
    expect(screen.getByTestId("me-attendance-count").textContent).toContain("5 active days");
  });

  it("active vs inactive days are distinguishable WITHOUT color (aria-label + data-active)", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    const days = within(await screen.findByTestId("me-attendance-days")).getAllByTestId("me-attendance-day");
    const active = days.filter((d) => d.getAttribute("data-active") === "1");
    const rest = days.filter((d) => d.getAttribute("data-active") === "0");
    expect(active).toHaveLength(5);
    expect(rest).toHaveLength(2);
    expect(active[0].getAttribute("aria-label")).toMatch(/Present/i);
    expect(rest[0].getAttribute("aria-label")).toMatch(/Rest/i);
  });

  it("contains NO summary categories (points/learned/created/Center/action plans/events/XP/Stage)", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    const popup = await screen.findByTestId("me-attendance-popup");
    const txt = popup.textContent ?? "";
    for (const forbidden of ["point", "learned", "created", "Center", "action plan", "event", "joined", "XP", "Core", "Stage", "Test"]) {
      expect(txt.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("R2 — living-light markers (not donuts)", () => {
  it("renders seven attendance lights; active = filled gold core with a soft glow, no hollow ring/glyph", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    const daysWrap = await screen.findByTestId("me-attendance-days");
    const lights = within(daysWrap).getAllByTestId("me-attendance-light");
    expect(lights).toHaveLength(7);
    // No glyph characters (the donut cause) anywhere in the marker row.
    expect(daysWrap.textContent ?? "").not.toMatch(/[●○]/);
    const active = lights.filter((l) => l.getAttribute("data-light") === "active");
    const rest = lights.filter((l) => l.getAttribute("data-light") === "rest");
    expect(active).toHaveLength(5);
    expect(rest).toHaveLength(2);
    for (const l of active) {
      expect(l.className).toContain("bg-[#E5B769]"); // filled warm-gold core (not a cutout)
      expect(l.className).toMatch(/shadow-\[/); // soft amber bloom + outer haze (living light)
      expect(l.className).not.toMatch(/border/); // NOT a ring/donut as its primary shape
      expect(l.querySelector("*")).toBeNull(); // no inner glyph/dark-center element
    }
  });

  it("rest days are quieter: smaller, dim, filled — no glow, no bright hollow ring, no red", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    const rest = within(await screen.findByTestId("me-attendance-days"))
      .getAllByTestId("me-attendance-light")
      .filter((l) => l.getAttribute("data-light") === "rest");
    for (const l of rest) {
      expect(l.className).toMatch(/bg-white\//); // a dim filled point
      expect(l.className).not.toContain("bg-[#E5B769]"); // clearly less luminous than active
      expect(l.className).not.toMatch(/shadow-\[/); // no active glow
      expect(l.className).not.toMatch(/border/); // not a hollow ring
      expect(l.className).not.toMatch(/red|rose|#f?[0-9a-f]*[fF]0000/i); // never punitive
    }
  });
});

describe("R3 — invisible touch hit target (no gray oval)", () => {
  it("the Orb button is a visually transparent hit target — no border/ring/rounded-oval, tap highlight suppressed", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    expect(orb.tagName).toBe("BUTTON");
    // No persistent visible boundary on the large wrapper: no ring, no focus-visible ring, no border,
    // no rounded-full oval shape, and an explicitly transparent/appearance-none surface.
    expect(orb.className).not.toMatch(/ring-2/);
    expect(orb.className).not.toMatch(/focus-visible:ring/);
    expect(orb.className).not.toMatch(/\bborder-white\b|\bborder-2\b/);
    expect(orb.className).not.toMatch(/rounded-full/); // the container is no longer an oval
    expect(orb.className).toMatch(/bg-transparent/);
    expect(orb.className).toMatch(/appearance-none/);
    // (WebKit tap-highlight suppression is set inline in source but jsdom drops the vendor property;
    //  it is verified in the built bundle instead.)
  });

  it("aria-expanded=true does not add any border/ring to the wrapper (className is stable on open)", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    const before = orb.className;
    fireEvent.click(orb);
    await screen.findByTestId("me-attendance-popup");
    expect(orb.getAttribute("aria-expanded")).toBe("true");
    expect(orb.className).toBe(before); // no ring/border toggled by open state
  });

  it("keyboard focus is preserved but LOCALIZED and fine-pointer-only (Orb-local, not the caption, not on touch)", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    const ring = within(orb).getByTestId("me-orb-focus-ring");
    // Focus indicator exists for keyboard use...
    expect(ring.className).toMatch(/group-focus-visible:ring-2/);
    // ...but only for fine pointers (never a coarse-pointer touch ring on iPhone)...
    expect(ring.className).toMatch(/\[@media\(pointer:fine\)\]/);
    // ...and it hugs the Orb circle (200px) rather than the whole hit target / caption.
    expect(ring.className).toMatch(/rounded-full/);
    expect(ring.className).toMatch(/h-\[200px\]/);
    expect(ring.getAttribute("aria-hidden")).toBe("true");
    expect(ring.className).toMatch(/pointer-events-none/);
    expect(ring.textContent).toBe(""); // does not wrap the caption or any content
  });

  it("still opens the attendance popup on the first tap; hit target still wraps the Orb", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    expect(orb.querySelector("canvas")).toBeTruthy(); // large Orb hit target preserved
    fireEvent.click(orb);
    expect(await screen.findByTestId("me-attendance-popup")).toBeTruthy();
  });
});

describe("R1 — interaction reliability", () => {
  it("close works; reopen works repeatedly; only one popup ever", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    fireEvent.click(orb);
    expect(await screen.findByTestId("me-attendance-popup")).toBeTruthy();
    fireEvent.click(screen.getByTestId("me-attendance-close"));
    await waitFor(() => expect(screen.queryByTestId("me-attendance-popup")).toBeNull());
    fireEvent.click(orb); // reopen
    expect(await screen.findByTestId("me-attendance-popup")).toBeTruthy();
    fireEvent.click(orb); // Orb toggles closed too
    await waitFor(() => expect(screen.queryByTestId("me-attendance-popup")).toBeNull());
    expect(screen.queryAllByTestId("me-attendance-popup").length).toBeLessThanOrEqual(1);
  });

  it("the Orb keeps exactly one WeeklyOrb canvas across open/close", async () => {
    stubShell();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    const canvasBefore = orb.querySelector("canvas");
    fireEvent.click(orb);
    fireEvent.click(screen.getByTestId("me-attendance-close"));
    const canvases = orb.querySelectorAll("canvas");
    expect(canvases.length).toBe(1);
    expect(canvases[0]).toBe(canvasBefore);
  });
});

describe("R1 — lazy detail fetch (never on mount)", () => {
  it("does NOT request ?detail=1 on Me mount; DOES request it after Orb activation", async () => {
    const seen: string[] = [];
    stubShell({ seen });
    await gotoMe();
    await waitFor(() => expect(seen.some((u) => u.includes("/api/me/today/weekly-activity"))).toBe(true));
    expect(seen.some((u) => u.includes("detail=1"))).toBe(false); // nothing detail on mount
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    await waitFor(() => expect(seen.some((u) => u.includes("detail=1"))).toBe(true));
  });
});

describe("R1 — account isolation + other Me controls", () => {
  it("account switch (refreshKey) drops the prior account's attendance and closes the popup", async () => {
    // Account A (5 active) → open → then reselect as Account B (1 active).
    let current = ATTENDANCE;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, summary: SUMMARY, window: {}, attendance: current }), { status: 200 })));
    const { rerender } = render(<MeWeeklyTrace locale="en" weeklyRhythm={[1, 0, 1]} refreshKey={1} />);
    fireEvent.click(screen.getByTestId("me-weekly-orb"));
    await waitFor(() => expect(screen.getByTestId("me-attendance-count").textContent).toContain("5 active days"));
    // Switch account: refreshKey bump must close + clear (no stale 5-day flash).
    current = ATTENDANCE.map((d, i) => ({ ...d, active: i === 6 }));
    rerender(<MeWeeklyTrace locale="en" weeklyRhythm={[1]} refreshKey={2} />);
    await waitFor(() => expect(screen.queryByTestId("me-attendance-popup")).toBeNull());
    fireEvent.click(screen.getByTestId("me-weekly-orb")); // reopen loads the NEW account
    await waitFor(() => expect(screen.getByTestId("me-attendance-count").textContent).toContain("1 active day"));
  });

  it("other Me controls remain usable after opening attendance", async () => {
    stubShell();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb"));
    await screen.findByTestId("me-attendance-popup");
    fireEvent.click(screen.getByTestId("me-row-center"));
    expect(await screen.findByTestId("me-center-back")).toBeTruthy();
  });
});
