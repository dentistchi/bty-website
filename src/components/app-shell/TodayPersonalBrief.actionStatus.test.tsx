/** @vitest-environment jsdom */
/**
 * TodayPersonalBrief — Action Hygiene section (Slice 3.1B-3M, tests 22–34).
 * DON'T MISS TODAY excludes submitted/escalated (they live in the calm verification section, never
 * red); first-3 + Show all N; no dismissal; original deadline labeled honestly (no fabricated
 * submission date); in-shell navigation.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import TodayPersonalBrief from "./TodayPersonalBrief";

function mockBrief(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }));
}

function actionItem(n: number, status = "verification_pending") {
  return {
    stableId: `actionstatus:s${n}`, contractId: `s${n}`, status, title: `Submitted action ${n}`,
    patternFamily: "future_deferral", sourceTitle: null, originalDeadline: `2026-05-0${(n % 9) + 1}T04:00:00Z`,
    deepLink: "/en/app?tab=arena",
  };
}
const revisionReminder = { stableId: "action:r1", category: "ACTION_REVISION", title: "fix this", state: "needs_revision", canonicalDeepLink: "/en/app?tab=arena" };

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

describe("TodayPersonalBrief — Action Hygiene", () => {
  it("(23) verification section is absent when empty", async () => {
    mockBrief({ ok: true, brief: null, reminders: [revisionReminder], hostAttention: [], actionStatus: [] });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-reminders");
    expect(screen.queryByTestId("brief-action-status")).toBeNull();
  });

  it("(22/32) submitted/escalated render in the calm action-status section, NOT the red DON'T MISS list", async () => {
    mockBrief({ ok: true, brief: null, reminders: [], hostAttention: [], actionStatus: [actionItem(1, "verification_pending"), actionItem(2, "awaiting_resolution")] });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-action-status");
    expect(screen.queryByTestId("brief-reminders")).toBeNull(); // none in DON'T MISS
    const rows = screen.getAllByTestId("action-status-row");
    expect(rows).toHaveLength(2);
    // No red styling on a verification_pending badge.
    const badge = within(rows[0]).getByText("Verification pending");
    expect(badge.className).not.toMatch(/red/);
  });

  it("(24/25/26/27) first 3 shown; Show all reveals 10; Show less collapses; no dismissal control", async () => {
    const items = Array.from({ length: 10 }, (_, i) => actionItem(i + 1));
    mockBrief({ ok: true, brief: null, reminders: [], hostAttention: [], actionStatus: items });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-action-status");
    expect(screen.getAllByTestId("action-status-row")).toHaveLength(3);
    fireEvent.click(screen.getByTestId("action-status-toggle"));
    expect(screen.getAllByTestId("action-status-row")).toHaveLength(10);
    expect(screen.getByTestId("action-status-toggle").textContent).toContain("Show less");
    // Rows expose only the navigation anchor — no remove/dismiss button.
    for (const row of screen.getAllByTestId("action-status-row")) {
      expect(row.querySelectorAll("button")).toHaveLength(0);
      expect(row.textContent?.toLowerCase()).not.toContain("dismiss");
    }
  });

  it("(28/29/30/31/33/34) full title + honest original-deadline label; no fabricated submitted date; source omitted when null; in-shell link", async () => {
    mockBrief({ ok: true, brief: null, reminders: [], hostAttention: [], actionStatus: [actionItem(1)] });
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("action-status-row");
    expect(row.textContent).toContain("Submitted action 1"); // full title
    expect(row.textContent).toContain("Original deadline"); // honest label
    expect(row.textContent).not.toMatch(/Submitted (Jan|Feb|Mar|Apr|May|Jun|Jul)/); // no fabricated submission DATE
    expect(row.textContent).not.toContain("future_deferral"); // no settled label → raw family omitted
    const anchor = row.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/en/app?tab=arena");
    expect(anchor?.getAttribute("href")).not.toContain("/bty-arena");
  });

  it("REJECTED reminder renders as 'Needs revision' (amber, not red)", async () => {
    mockBrief({ ok: true, brief: null, reminders: [revisionReminder], hostAttention: [], actionStatus: [] });
    render(<TodayPersonalBrief locale="en" />);
    const list = await screen.findByTestId("brief-reminders");
    const badge = within(list).getByText("Needs revision");
    expect(badge.className).not.toMatch(/red/);
  });
});
