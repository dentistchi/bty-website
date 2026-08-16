/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R3-R1 — the return route to a follow-up already answered.
 *
 * Today drops RESPONDED rows by design, and D2 is explicit that a non-terminal answer must not
 * drag the card back into Today. So My Learning is the ONLY way back, and this suite proves the
 * three things that make it a way back rather than a guess: the CTA appears exactly when the
 * SERVER says the obligation can still take a report, it opens that EXACT obligation by its
 * durable id, and reading the surface writes nothing.
 *
 * It also holds the "not a task list" line: no count, no badge, no due date, no red.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import FoundryMyLearning from "./FoundryMyLearning";

const ENTRY = "prog-1";
const FOLLOWUP = "fu-7ab1";

function historyItem(over: Record<string, unknown> = {}) {
  return {
    entryId: ENTRY,
    eventId: "ev-1",
    eventTitle: "Huddle ownership",
    contentType: "youtube",
    completedAt: "2026-08-01T02:00:00Z",
    sharedUnderstanding: "Always confirm the owner before we leave.",
    ...over,
  };
}

/** Records every request so a read-only claim can be asserted rather than described. */
const calls: Array<{ url: string; method?: string }> = [];

function stub(opts: { history?: unknown[]; evidence?: unknown[] }) {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: { method?: string }) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method });
      if (u.includes("/api/bty/foundry/evidence/mine")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: opts.evidence ?? [] }) } as Response);
      }
      if (u.includes("/api/bty/action-contract/reviewed-plans")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ history: opts.history ?? [], thread: null, threadStatus: "none" }),
      } as Response);
    }),
  );
}

const withTarget = (targets: unknown[]) => [
  { entryId: ENTRY, established: ["exposed", "reflected", "decided"], checkInAgain: targets },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => vi.restoreAllMocks());

describe("FoundryMyLearning — Check in again (3.2R-R3-R1)", () => {
  it("offers the way back when the server names a reachable follow-up", async () => {
    stub({
      history: [historyItem()],
      evidence: withTarget([{ followupId: FOLLOWUP, followUpDays: 7, outcome: "NOT_YET" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    const cta = await screen.findByTestId("my-learning-check-in-again");
    expect(cta.textContent).toContain("Check in again");
  });

  it("opens THAT obligation — the durable id, never the event, title or checkpoint", async () => {
    const opened: string[] = [];
    stub({
      history: [historyItem()],
      evidence: withTarget([{ followupId: FOLLOWUP, followUpDays: 7, outcome: "BLOCKED" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={(id) => opened.push(id)} />);
    const cta = await screen.findByTestId("my-learning-check-in-again");
    expect(cta.getAttribute("data-followup-id")).toBe(FOLLOWUP);
    cta.click();
    expect(opened).toEqual([FOLLOWUP]);
  });

  it("is an app-shell command, not a link — a raw href is what 3.2G-R2 had to remove", async () => {
    stub({
      history: [historyItem()],
      evidence: withTarget([{ followupId: FOLLOWUP, followUpDays: 7, outcome: "NOT_YET" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    const cta = await screen.findByTestId("my-learning-check-in-again");
    expect(cta.tagName).toBe("BUTTON");
    expect(cta.getAttribute("href")).toBeNull();
  });

  it("shows NOTHING when the server names no reachable follow-up (terminal or pending alike)", async () => {
    stub({ history: [historyItem()], evidence: withTarget([]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-check-in-again")).toBeNull();
  });

  it("a target with no durable id is dropped, never reconstructed from the row", async () => {
    stub({ history: [historyItem()], evidence: withTarget([{ followUpDays: 7, outcome: "NOT_YET" }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-check-in-again")).toBeNull();
  });

  it("without a handler no control renders — never a dead button", async () => {
    stub({
      history: [historyItem()],
      evidence: withTarget([{ followupId: FOLLOWUP, followUpDays: 7, outcome: "NOT_YET" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-check-in-again")).toBeNull();
  });

  it("two checkpoints stay two distinct controls, each naming its own", async () => {
    const opened: string[] = [];
    stub({
      history: [historyItem()],
      evidence: withTarget([
        { followupId: "fu-7", followUpDays: 7, outcome: "NOT_YET" },
        { followupId: "fu-30", followUpDays: 30, outcome: "BLOCKED" },
      ]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={(id) => opened.push(id)} />);
    await waitFor(() => expect(screen.getAllByTestId("my-learning-check-in-again")).toHaveLength(2));
    const ctas = screen.getAllByTestId("my-learning-check-in-again");
    expect(ctas[0]!.textContent).toContain("7-day follow-up");
    expect(ctas[1]!.textContent).toContain("30-day follow-up");
    ctas[1]!.click();
    expect(opened).toEqual(["fu-30"]); // the one that was pressed, not the first on the row
  });

  it("OPENING My Learning writes nothing — every request is a read", async () => {
    stub({
      history: [historyItem()],
      evidence: withTarget([{ followupId: FOLLOWUP, followUpDays: 7, outcome: "NOT_YET" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-check-in-again");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.method === undefined || c.method === "GET")).toBe(true);
  });

  it("is not a task list — no count, no badge, no due date, no overdue word", async () => {
    stub({
      history: [historyItem()],
      evidence: withTarget([{ followupId: FOLLOWUP, followUpDays: 7, outcome: "NOT_YET" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-check-in-again");
    // Scoped to the record, deliberately: the surrounding chrome carries a "← Required learning"
    // back label that predates this slice, and asserting over the whole section would fail on it.
    const text = screen.getByTestId("my-learning-item").textContent ?? "";
    for (const forbidden of ["Overdue", "Due", "1 follow-up", "outstanding", "incomplete", "Required"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it("does NOT surface the settled outcome word on this surface — the record is not a status board", async () => {
    /*
      The outcome travels so the surface can pass identity back and so a future slice has it, but
      My Learning states what happened through the evidence strip. Printing "NOT_YET" beside a
      completion would turn a personal history into a scorecard.
    */
    stub({
      history: [historyItem()],
      evidence: withTarget([{ followupId: FOLLOWUP, followUpDays: 7, outcome: "NOT_YET" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-check-in-again");
    expect(screen.getByTestId("foundry-my-learning").textContent).not.toContain("NOT_YET");
  });
});
