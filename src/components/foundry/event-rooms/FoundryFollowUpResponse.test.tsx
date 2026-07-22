/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryFollowUpResponse from "./FoundryFollowUpResponse";

/**
 * Slice 3.1B-3K — the focused learner follow-up response surface. Reads the caller's OWN obligation,
 * lets them submit ONE self-reported outcome, shows the Host-visibility disclosure, and marks the
 * result self-reported (not verified). A not-owned/invalid id fails safe; already-responded shows the
 * settled read-only result; submitting never reopens the training.
 */

function mockFetch(getPayload: unknown, respondImpl?: (body: unknown) => { ok: boolean; status: number; json: unknown }) {
  return vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const u = String(url);
    if (u.includes("/respond") && init?.method === "POST") {
      const r = respondImpl?.(JSON.parse(init.body ?? "{}")) ?? { ok: true, status: 200, json: { ok: true, result: "responded", outcome: JSON.parse(init.body ?? "{}").outcome } };
      return { ok: r.ok, status: r.status, json: async () => r.json };
    }
    if (u.includes("/api/bty/foundry/followups/")) return { ok: true, status: 200, json: async () => getPayload };
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const PENDING = {
  ok: true,
  followup: {
    id: "f1",
    sourceTrainingTitle: "Confirm Patient Understanding",
    followUpDays: 7,
    dueAt: "2026-07-29T05:00:00Z",
    dueState: "due_today",
    status: "PENDING",
    outcome: null,
    respondedAt: null,
    expectedBehavior: "Greet every patient by name",
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryFollowUpResponse", () => {
  it("test 33 — renders the checkpoint, expected behavior, four choices, and the Host disclosure", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(PENDING);
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("foundry-followup-response")).toBeTruthy());
    expect(screen.getByTestId("followup-checkpoint").textContent).toContain("7-day follow-up");
    expect(screen.getByText("Confirm Patient Understanding")).toBeTruthy();
    expect(screen.getByTestId("followup-expected").textContent).toContain("Greet every patient by name");
    for (const o of ["APPLIED", "PARTLY_APPLIED", "NOT_YET", "BLOCKED"]) {
      expect(screen.getByTestId(`followup-choice-${o}`)).toBeTruthy();
    }
    expect(screen.getByTestId("followup-disclosure").textContent).toContain("shared with the training host");
  });

  it("test 35/39/42 — submitting an outcome transitions to the settled RESPONDED read-only view", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(PENDING);
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-choice-APPLIED")).toBeTruthy());
    fireEvent.click(screen.getByTestId("followup-choice-APPLIED"));
    await waitFor(() => expect(screen.getByTestId("followup-settled")).toBeTruthy());
    expect(screen.getByTestId("followup-settled").textContent).toContain("I applied it");
    // self-reported, never "verified"
    expect(screen.getByTestId("followup-settled").textContent).toContain("not verified behavior");
    // the choices are gone (cannot re-answer)
    expect(screen.queryByTestId("followup-choice-BLOCKED")).toBeNull();
  });

  it("shows the already-responded settled result (409) without overwriting the first outcome", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(PENDING, () => ({ ok: false, status: 409, json: { ok: false, error: "already_responded", outcome: "PARTLY_APPLIED" } }));
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-choice-BLOCKED")).toBeTruthy());
    fireEvent.click(screen.getByTestId("followup-choice-BLOCKED"));
    await waitFor(() => expect(screen.getByTestId("followup-settled")).toBeTruthy());
    expect(screen.getByTestId("followup-settled").textContent).toContain("I partly applied it"); // the FIRST outcome stands
  });

  it("an already-responded obligation loads directly into the settled read-only view", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ ok: true, followup: { ...PENDING.followup, status: "RESPONDED", dueState: "responded", outcome: "BLOCKED" } });
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-settled")).toBeTruthy());
    expect(screen.getByTestId("followup-settled").textContent).toContain("Something blocked me");
    expect(screen.queryByTestId("followup-choice-APPLIED")).toBeNull();
  });

  it("a not-owned / invalid id fails safe (error view + Back)", async () => {
    // @ts-expect-error test shim
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: "not_found" }) }));
    render(<FoundryFollowUpResponse followupId="nope" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-error")).toBeTruthy());
    expect(screen.getByTestId("followup-back")).toBeTruthy();
  });
});
