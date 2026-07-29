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
  it("This week renders ABOVE the weekly Orb; Account is the final nav row; no My Experiences card", async () => {
    stub();
    await gotoMe();
    const week = await screen.findByTestId("me-this-week");
    const orb = await screen.findByTestId("me-weekly-trace");
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

  it("Me 7-Orb is NON-interactive presence (role=img, not a button, not focusable); no 'Hold to enter'", async () => {
    stub();
    await gotoMe();
    const orb = await screen.findByTestId("me-weekly-orb");
    // R3: the Orb is the week's presence, NOT a control — it must not be a button/toggle and must
    // not duplicate the This Week card's popup disclosure.
    expect(orb.tagName).not.toBe("BUTTON");
    expect(orb.getAttribute("role")).toBe("img");
    expect(orb.hasAttribute("tabindex")).toBe(false); // not keyboard-focusable
    expect(orb.getAttribute("aria-expanded")).toBeNull();
    expect(orb.getAttribute("aria-controls")).toBeNull();
    expect(screen.queryByText(/Hold to enter/i)).toBeNull();
    expect(orb.className).toMatch(/select-none/);
  });
});
