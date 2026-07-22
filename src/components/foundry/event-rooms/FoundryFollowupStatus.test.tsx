/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryFollowupStatus from "./FoundryFollowupStatus";

/**
 * Slice 3.1B-3K — Host Follow-up Status section. Per-participant, owner-scoped, INDEPENDENT of the
 * shared-question gate. Shows identity + checkpoint + due date + state + LEARNER-REPORTED outcome.
 * Self-gates to nothing when there are no obligations. Never shows private reflection / verified labels.
 */

function mockRows(payload: unknown) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/followups")) return { ok: true, status: 200, json: async () => payload };
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryFollowupStatus", () => {
  it("test 46/49 — renders per-participant rows with the LEARNER-REPORTED outcome label", async () => {
    // @ts-expect-error test shim
    global.fetch = mockRows({
      ok: true,
      eventId: "e1",
      rows: [
        { followupId: "f1", displayName: "Ann", followUpDays: 7, dueAt: "2026-07-29T05:00:00Z", state: "responded", outcome: "APPLIED", respondedAt: "2026-07-29T05:30:00Z" },
        { followupId: "f2", displayName: "Ben", followUpDays: 30, dueAt: "2026-07-25T05:00:00Z", state: "overdue", outcome: null, respondedAt: null },
      ],
    });
    render(<FoundryFollowupStatus eventId="e1" locale="en" />);
    await waitFor(() => expect(screen.getByTestId("foundry-followup-status")).toBeTruthy());
    const rows = screen.getAllByTestId("followup-status-row");
    expect(rows.length).toBe(2);
    expect(screen.getByTestId("followup-status-outcome").textContent).toContain("Learner reported");
    expect(screen.getByTestId("followup-status-outcome").textContent).toContain("Applied");
    // never a "verified/passed/sustained" framing
    const text = screen.getByTestId("foundry-followup-status").textContent ?? "";
    expect(text).not.toMatch(/verified|passed|sustained/i);
    expect(screen.getByText("Ann")).toBeTruthy();
  });

  it("test 48 — self-gates to NOTHING when the event has no follow-up obligations", async () => {
    // @ts-expect-error test shim
    global.fetch = mockRows({ ok: true, eventId: "e1", rows: [] });
    const { container } = render(<FoundryFollowupStatus eventId="e1" locale="en" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("foundry-followup-status")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
