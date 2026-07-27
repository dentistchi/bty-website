/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";
import MeThisWeek from "./MeThisWeek";
import { clearWeeklyActivityCache, setCachedSummary } from "@/lib/bty/daily/weeklyActivityCache";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearWeeklyActivityCache();
});

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
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
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  fireEvent.click(within(nav).getByText("Me"));
}

describe("Me weekly Orb visual contract (B3A.2D-R3.1)", () => {
  it("mounts the living WeeklyOrb (not the entry Orb) with no hold-to-enter", async () => {
    stub();
    await gotoMe();
    expect(await screen.findByTestId("weekly-orb")).toBeTruthy();
    expect(screen.queryByTestId("me-orb-door")).toBeNull();
    expect(screen.queryByText(/Hold to enter/i)).toBeNull();
  });
});

describe("Compact inline popup — no root duplication (B3A.2D-R3)", () => {
  it("shows date range + seven day indicators, and does NOT repeat the root counts", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-weekly-orb-toggle"));
    const popup = await screen.findByTestId("me-week-popup");
    expect(within(popup).getByTestId("me-week-range")).toBeTruthy();
    expect(within(popup).getAllByRole("button")).toHaveLength(7); // seven dated indicators
    // The popup must not duplicate the root THIS WEEK count rows.
    expect(popup.textContent).not.toMatch(/Weekly points|Active days|Learning completed|Training created/i);
    // Selecting a day discloses only proven activity state; popup stays open.
    fireEvent.click(within(popup).getAllByRole("button")[0]);
    expect((await screen.findByTestId("me-week-day-detail")).textContent).toMatch(/Activity recorded|No activity recorded/);
    expect(screen.getByTestId("me-week-popup")).toBeTruthy();
  });
});

describe("Stale-while-refresh Me data (B3A.2D-R3)", () => {
  it("keeps the last successful Forge Stage + weekly values on a remount while refreshing", async () => {
    // Seed the session cache as if a prior successful load happened.
    setCachedSummary({ forgeStage: 2, weeklyPoints: 9, activeDays: 4 });
    // Refresh is in-flight (fetch never resolves) → cached values must remain, no quiet/loading.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={1} />);
    expect(screen.getByTestId("me-forge-stage").textContent).toContain("Forge stage 2");
    expect(screen.getByTestId("me-week-counts").textContent).toContain("9 points");
    expect(screen.queryByTestId("me-week-loading")).toBeNull();
    expect(screen.queryByText(/A quiet week so far/i)).toBeNull();
  });

  it("retains the last successful values when a refresh fails", async () => {
    setCachedSummary({ forgeStage: 3, weeklyPoints: 15 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    render(<MeThisWeek locale="en" weeklyRhythm={[]} refreshKey={2} />);
    await waitFor(() => expect(screen.getByTestId("me-forge-stage")).toBeTruthy());
    expect(screen.getByTestId("me-forge-stage").textContent).toContain("Forge stage 3");
    expect(screen.getByTestId("me-week-counts").textContent).toContain("15 points");
    expect(screen.queryByText(/A quiet week so far/i)).toBeNull();
  });
});

describe("Me-origin return labels = '← Me' (B3A.2D-R3)", () => {
  it("Center opened from Me shows '← Me', not 'Back'", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-center"));
    const back = await screen.findByTestId("me-center-back");
    expect(back.textContent).toMatch(/←\s*Me/);
    expect(back.textContent).not.toMatch(/Back/);
  });

  it("Account opened from Me shows '← Me', not 'Back'", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-account-row"));
    const back = await screen.findByTestId("me-account-back");
    expect(back.textContent).toMatch(/←\s*Me/);
    expect(back.textContent).not.toMatch(/Back/);
  });
});
