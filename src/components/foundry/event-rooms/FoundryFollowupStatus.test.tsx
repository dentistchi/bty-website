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

/**
 * SLICE 3.2M-4 — the Host must be able to tell "the learner said it" from "someone saw it".
 */
describe("FoundryFollowupStatus — independent observation", () => {
  const base = {
    followupId: "f-1", displayName: "Ann", followUpDays: 7,
    dueAt: "2026-08-01T00:00:00Z", state: "responded" as const,
    outcome: "APPLIED" as const, respondedAt: "2026-08-02T00:00:00Z",
    subject: "State each open item aloud.",
  };

  const renderRows = (rows: unknown[]) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, eventId: "ev-1", rows }) })));
    return render(<FoundryFollowupStatus eventId="ev-1" locale="en" />);
  };

  it("a positive observation reads as a colleague, never as the learner's own word", async () => {
    renderRows([{ ...base, observation: { observed: true, observerCount: 1, latestAt: "2026-08-03T00:00:00Z", observerHistory: [{ outcome: "OBSERVED", at: "2026-08-03T00:00:00Z" }] } }]);
    const el = await screen.findByTestId("host-observed");
    expect(el.textContent).toMatch(/Independent observation/);
    expect(el.textContent).toMatch(/One colleague saw or heard this/);
    // The learner's own report stays a separate line.
    expect((await screen.findByTestId("followup-status-outcome")).textContent).toMatch(/Learner reported/);
  });

  it("a colleague who did NOT see it never reads as confirmation", async () => {
    renderRows([{ ...base, observation: { observed: false, observerCount: 0, latestAt: "2026-08-03T00:00:00Z", observerHistory: [{ outcome: "NOT_OBSERVED", at: "2026-08-03T00:00:00Z" }] } }]);
    const el = await screen.findByTestId("host-not-observed");
    expect(el.textContent).toMatch(/did not see it/);
    expect(el.textContent).not.toMatch(/saw or heard/);
  });

  it("no observation yet says so plainly", async () => {
    renderRows([{ ...base, observation: { observed: false, observerCount: 0, latestAt: null, observerHistory: [] } }]);
    expect((await screen.findByTestId("host-not-observed")).textContent).toMatch(/No independent observation yet/);
  });

  it("never shows implementation vocabulary", async () => {
    const { container } = renderRows([{ ...base, observation: { observed: true, observerCount: 2, latestAt: "2026-08-03T00:00:00Z", observerHistory: [{ outcome: "OBSERVED", at: "2026-08-03T00:00:00Z" }] } }]);
    await screen.findByTestId("host-observed");
    const text = container.textContent ?? "";
    for (const forbidden of ["OBSERVED", "NOT_OBSERVED", "observer_user_id", "authority_edge_id", "foundry_behavior_observations"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});

/**
 * SLICE 3.2M-5 — "seen once" and "seen across three weeks" are different claims, and the Host
 * must be able to tell them apart without reading an audit log.
 */
describe("FoundryFollowupStatus — repetition over time", () => {
  const base = {
    followupId: "f1", displayName: "Ann", followUpDays: 7,
    dueAt: "2026-08-08T05:00:00Z", state: "responded", outcome: "APPLIED", respondedAt: "2026-08-08T06:00:00Z",
  };
  const obs = (over: Record<string, unknown>) => ({
    observed: true, observerCount: 1, latestAt: "2026-08-08T00:00:00Z",
    observerHistory: [{ outcome: "OBSERVED", at: "2026-08-08T00:00:00Z" }], ...over,
  });
  const renderRows = (rows: unknown[]) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, eventId: "ev-1", rows }) })));
    return render(<FoundryFollowupStatus eventId="ev-1" locale="en" />);
  };

  it("one sighting shows NO longitudinal line — there is no span to report", async () => {
    renderRows([{ ...base, observation: obs({ sustained: false, firstObservedOn: "2026-08-01", lastObservedOn: "2026-08-01", distinctPositiveDates: 1 }) }]);
    await screen.findByTestId("host-observed");
    expect(screen.queryByTestId("host-seen-more-than-once")).toBeNull();
    expect(screen.queryByTestId("host-sustained")).toBeNull();
  });

  it("two sightings inside the window read as repetition, NOT as sustained", async () => {
    renderRows([{ ...base, observation: obs({ sustained: false, firstObservedOn: "2026-08-01", lastObservedOn: "2026-08-05", distinctPositiveDates: 2 }) }]);
    const el = await screen.findByTestId("host-seen-more-than-once");
    expect(el.textContent).toMatch(/Seen more than once/);
    expect(el.textContent).toMatch(/Aug 1/);
    expect(el.textContent).toMatch(/Aug 5/);
    expect(screen.queryByTestId("host-sustained")).toBeNull();
  });

  it("a qualifying span reads as a PAST span with its dates", async () => {
    renderRows([{ ...base, observation: obs({ sustained: true, firstObservedOn: "2026-08-10", lastObservedOn: "2026-08-24", distinctPositiveDates: 2 }) }]);
    const el = await screen.findByTestId("host-sustained");
    expect(el.textContent).toMatch(/Sustained across/);
    expect(el.textContent).toMatch(/Aug 10/);
    expect(el.textContent).toMatch(/Aug 24/);
  });

  it("never claims permanence, currency or mastery", async () => {
    const { container } = renderRows([{ ...base, observation: obs({ sustained: true, firstObservedOn: "2026-08-10", lastObservedOn: "2026-08-24", distinctPositiveDates: 2 }) }]);
    await screen.findByTestId("host-sustained");
    const text = container.textContent ?? "";
    for (const forbidden of ["Habit formed", "Permanently", "Still sustained", "mastery", "Verified"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    // Past tense, not a present-state badge.
    expect(text).not.toMatch(/\bis sustained\b/i);
  });

  it("the observation line and the span line stay SEPARATE — one never absorbs the other", async () => {
    renderRows([{ ...base, observation: obs({ observerCount: 2, sustained: true, firstObservedOn: "2026-08-10", lastObservedOn: "2026-08-24", distinctPositiveDates: 2 }) }]);
    const seen = await screen.findByTestId("host-observed");
    const span = await screen.findByTestId("host-sustained");
    expect(seen).not.toBe(span);
    expect(seen.textContent).toMatch(/colleagues saw or heard this/);
    expect(span.textContent).not.toMatch(/colleagues/);
  });

  it("a 3.2M-4 payload with no temporal fields renders exactly as before", async () => {
    // Forward-only: a row from before this slice must not invent a span.
    renderRows([{ ...base, observation: obs({}) }]);
    await screen.findByTestId("host-observed");
    expect(screen.queryByTestId("host-seen-more-than-once")).toBeNull();
    expect(screen.queryByTestId("host-sustained")).toBeNull();
  });
});
