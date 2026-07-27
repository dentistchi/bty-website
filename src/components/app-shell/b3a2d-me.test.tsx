/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import BtyDailyAppShell from "./BtyDailyAppShell";
import WeeklyOrb from "./WeeklyOrb";

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

describe("Me root — B3A.2D hierarchy", () => {
  it("This week renders ABOVE the Orb; Account is the final nav row; no My Experiences card", async () => {
    stub();
    await gotoMe();
    const week = await screen.findByTestId("me-this-week");
    const orb = await screen.findByTestId("weekly-orb");
    // This week precedes the Orb in DOM order.
    expect(week.compareDocumentPosition(orb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Account is present and comes AFTER the Center row (final compact row).
    const center = screen.getByTestId("me-row-center");
    const account = screen.getByTestId("me-account-row");
    expect(center.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No "My Experiences / Coming next" on the Me root; no large account card.
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
    expect(counts.textContent).toContain("0 Center"); // a proven canonical zero is shown
    expect(screen.getByTestId("me-forge-stage").textContent).toContain("Forge stage 1");
  });
});

describe("WeeklyOrb — touch hygiene (B3A.2D)", () => {
  it("renders a non-draggable, selection-suppressed Orb subtree (DOM)", () => {
    render(<WeeklyOrb intensities={[1, 0, 1]} locale="en" />);
    const orb = screen.getByTestId("weekly-orb");
    // jsdom keeps standard user-select; the canvas asset must be non-draggable.
    expect((orb.getAttribute("style") ?? "")).toMatch(/user-select:\s*none/i);
    const canvas = orb.querySelector("canvas");
    expect(canvas?.getAttribute("draggable")).toBe("false");
  });

  it("applies the WebView callout/drag suppressions in source (jsdom strips vendor props)", () => {
    // These vendor CSS props are dropped by jsdom's CSSOM, so assert them at the source
    // level: the Orb container preventDefaults dragstart/contextmenu and sets the
    // -webkit-touch-callout / -webkit-user-drag suppressions the real WebView honors.
    const src = readFileSync(join(__dirname, "WeeklyOrb.tsx"), "utf8");
    expect(src).toMatch(/onDragStart=\{\(e\) => e\.preventDefault\(\)\}/);
    expect(src).toMatch(/onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/);
    expect(src).toMatch(/WebkitTouchCallout:\s*"none"/);
    expect(src).toMatch(/WebkitUserDrag:\s*"none"/);
    expect(src).toMatch(/WebkitUserSelect:\s*"none"/);
  });
});
