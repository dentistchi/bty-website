/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.includes("/api/auth/session")
        ? { ok: true, user: { email: "ywamer2022@gmail.com" } }
        : u.includes("/api/me/today/weekly-activity")
          ? { ok: true, summary: { weeklyPoints: 12, forgeStage: 1, activeDays: 3, trainingsCompleted: 1, trainingsCreated: 2, centerReflections: 0, actionPlansCompleted: 1 } }
          : u.includes("/api/me/daily-trace")
            ? { dailyTrace: [{ date: "d1", intensity: 1 }, { date: "d2", intensity: 0 }, { date: "d3", intensity: 1 }] }
            : u.includes("/api/me/today/brief")
              ? { ok: true, reminders: [] }
              : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  fireEvent.click(within(nav).getByText("Me"));
}

describe("Me root — hierarchy (B3A.2D / B3A.2D-R1)", () => {
  it("This week renders ABOVE the Orb door; Account is the final nav row; no My Experiences card", async () => {
    stub();
    await gotoMe();
    const week = await screen.findByTestId("me-this-week");
    const orb = await screen.findByTestId("me-orb-door");
    expect(week.compareDocumentPosition(orb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const center = screen.getByTestId("me-row-center");
    const account = screen.getByTestId("me-account-row");
    expect(center.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/My Experiences/i)).toBeNull();
    expect(screen.queryByText(/Coming next/i)).toBeNull();
    expect(screen.queryByTestId("account-block")).toBeNull();
  });

  it("This week shows honest weekly counts (omitting nothing that has a value)", async () => {
    stub();
    await gotoMe();
    const counts = await screen.findByTestId("me-week-counts");
    expect(counts.textContent).toContain("12 points");
    expect(counts.textContent).toContain("3 active days");
    expect(counts.textContent).toContain("1 learned");
    expect(counts.textContent).toContain("2 created");
    expect(counts.textContent).toContain("0 Center"); // proven canonical zero
    expect(screen.getByTestId("me-forge-stage").textContent).toContain("Forge stage 1");
  });

  it("Me Orb shows the two-line dual-interaction caption (not 'This week's trace')", async () => {
    stub();
    await gotoMe();
    const cap = await screen.findByTestId("me-orb-caption");
    expect(cap.textContent).toContain("Tap for this week");
    expect(cap.textContent).toContain("Hold to enter");
    expect(screen.queryByText(/This week's trace/i)).toBeNull();
    // Orb door subtree suppresses selection (jsdom keeps standard user-select).
    const door = screen.getByTestId("me-orb-door");
    expect(door.className).toMatch(/select-none/);
  });
});
