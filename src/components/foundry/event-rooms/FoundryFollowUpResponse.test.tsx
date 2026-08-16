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

  it("a TERMINAL (APPLIED) obligation loads directly into the settled read-only view", async () => {
    /*
      Slice 3.2R-R3-R1 — this test used to seed BLOCKED and assert the same read-only outcome,
      which is precisely the defect R3-R0 measured: it PINNED the dead end. BLOCKED is a check-in
      someone may move on from, so the read-only case is now the one that is genuinely terminal.
    */
    // @ts-expect-error test shim
    global.fetch = mockFetch({ ok: true, followup: { ...PENDING.followup, status: "RESPONDED", dueState: "responded", outcome: "APPLIED", canCheckInAgain: false } });
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-settled")).toBeTruthy());
    expect(screen.getByTestId("followup-settled").textContent).toContain("I applied it");
    expect(screen.queryByTestId("followup-check-in-again")).toBeNull();
    expect(screen.queryByTestId("followup-choice-NOT_YET")).toBeNull();
  });

  it("a not-owned / invalid id fails safe (error view + Back)", async () => {
    // @ts-expect-error test shim
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: "not_found" }) }));
    render(<FoundryFollowUpResponse followupId="nope" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-error")).toBeTruthy());
    expect(screen.getByTestId("followup-back")).toBeTruthy();
  });
});

/**
 * SLICE 3.2R-R3-R1 — a later honest answer has somewhere to go.
 *
 * The service has accepted a later check-in since 3.2M-3; this surface refused to offer one, so
 * a learner who truthfully answered "not yet" was locked out of ever reporting that they later
 * did it. What is proven here is the repair AND its limits: the way back appears on exactly the
 * non-terminal answers, the SERVER decides that, the earlier answer is never presented as a
 * mistake, and no new field is introduced.
 */
const settledPayload = (outcome: string, canCheckInAgain: boolean) => ({
  ok: true,
  followup: { ...PENDING.followup, status: "RESPONDED", dueState: "responded", outcome, canCheckInAgain },
});

describe("FoundryFollowUpResponse — later check-in (3.2R-R3-R1)", () => {
  for (const outcome of ["PARTLY_APPLIED", "NOT_YET", "BLOCKED"]) {
    it(`RESPONDED + ${outcome} — the prior answer stands AND a later check-in is offered`, async () => {
      // @ts-expect-error test shim
      global.fetch = mockFetch(settledPayload(outcome, true));
      render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
      await waitFor(() => expect(screen.getByTestId("followup-check-in-again")).toBeTruthy());
      // the earlier report is still on screen, as a fact — not struck through, not an error
      expect(screen.getByTestId("followup-settled")).toBeTruthy();
      expect(screen.getByTestId("followup-settled").textContent).toContain("You reported earlier");
      for (const o of ["APPLIED", "PARTLY_APPLIED", "NOT_YET", "BLOCKED"]) {
        expect(screen.getByTestId(`followup-choice-${o}`)).toBeTruthy();
      }
    });
  }

  it("the copy calls it a later check-in — never edit, correct or replace", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(settledPayload("NOT_YET", true));
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-check-in-again")).toBeTruthy());
    const text = screen.getByTestId("foundry-followup-response").textContent ?? "";
    expect(text).toContain("Check in again");
    expect(text).toContain("your earlier answer stays as it was");
    for (const forbidden of ["Edit answer", "Correct answer", "Replace answer", "Change your answer"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it("SERVER authority decides — a non-terminal outcome with canCheckInAgain false offers nothing", async () => {
    /*
      The surface must not infer eligibility from the outcome it can see. If the server says no,
      the answer is no, whatever the outcome happens to be.
    */
    // @ts-expect-error test shim
    global.fetch = mockFetch(settledPayload("NOT_YET", false));
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-settled")).toBeTruthy());
    expect(screen.queryByTestId("followup-check-in-again")).toBeNull();
  });

  it("a payload with NO canCheckInAgain field is read as false — the conservative direction", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ ok: true, followup: { ...PENDING.followup, status: "RESPONDED", dueState: "responded", outcome: "NOT_YET" } });
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-settled")).toBeTruthy());
    expect(screen.queryByTestId("followup-check-in-again")).toBeNull();
  });

  it("NOT_YET → APPLIED goes through the EXISTING respond endpoint, and then reads terminal", async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      calls.push({ url: String(url), method: init?.method, body: init?.body });
      if (String(url).includes("/respond")) {
        // the server's answer, including the authority field — the client never derives it
        return { ok: true, status: 200, json: async () => ({ ok: true, result: "responded", outcome: "APPLIED", canCheckInAgain: false }) };
      }
      return { ok: true, status: 200, json: async () => settledPayload("NOT_YET", true) };
    });
    // @ts-expect-error test shim
    global.fetch = fetchMock;
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-choice-APPLIED")).toBeTruthy());
    fireEvent.click(screen.getByTestId("followup-choice-APPLIED"));

    await waitFor(() => expect(screen.queryByTestId("followup-check-in-again")).toBeNull());
    // exactly one write, to the endpoint that already existed — no new route was invented
    const writes = calls.filter((c) => c.method === "POST");
    expect(writes).toHaveLength(1);
    expect(writes[0]!.url).toBe("/api/bty/foundry/followups/f1/respond");
    expect(JSON.parse(writes[0]!.body ?? "{}")).toEqual({ outcome: "APPLIED" });
    // APPLIED is now terminal: the settled answer stands alone
    expect(screen.getByTestId("followup-settled").textContent).toContain("I applied it");
  });

  it("RENDERING the later check-in writes NOTHING — every request is a read", async () => {
    const calls: Array<{ method?: string }> = [];
    const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) => {
      calls.push({ method: init?.method });
      return { ok: true, status: 200, json: async () => settledPayload("BLOCKED", true) };
    });
    // @ts-expect-error test shim
    global.fetch = fetchMock;
    render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-check-in-again")).toBeTruthy());
    expect(calls.every((c) => c.method === undefined || c.method === "GET")).toBe(true);
  });

  it("introduces NO free-text field — the model has no response, blocker or evidence column", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(settledPayload("NOT_YET", true));
    const { container } = render(<FoundryFollowUpResponse followupId="f1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("followup-check-in-again")).toBeTruthy());
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});
