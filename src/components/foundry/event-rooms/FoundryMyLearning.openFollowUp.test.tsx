/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R3-R2 — the door Today expiry must not close.
 *
 * R3-R2 stops Today asking about an unanswered follow-up 7 BTY days after its checkpoint. On its
 * own that would strand three live obligations that are already past the window: the card would
 * vanish and the only `?followup=` link in the product would vanish with it. So My Learning carries
 * the durable obligation onward, with no expiry.
 *
 * WHAT THIS SUITE HAS TO PROVE, AND WHY EACH ONE MATTERS:
 *   * The stale obligation is reachable at all — the whole justification for the bound.
 *   * It opens THAT obligation by its durable id, so a record holding both a 7- and a 30-day
 *     checkpoint cannot open the wrong question.
 *   * It never borrows the R3-R1 words. "Check in again" and "You reported earlier" are lies about
 *     a question nobody has answered, and the R3-R1 control must still say them where it belongs.
 *   * Reading the surface writes nothing.
 *
 * The stub mirrors `FoundryMyLearning.checkInAgain.test.tsx` so the two routes are held to the
 * same standard, and so a change that merges them breaks both files rather than one.
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

/** Records every request so the read-only claim is asserted rather than described. */
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

/** The server's answer for this record: which obligations are open, and which can be revisited. */
const evidenceRow = (open: unknown[], again: unknown[] = []) => [
  { entryId: ENTRY, established: ["exposed", "reflected", "decided"], openFollowUp: open, checkInAgain: again },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => vi.restoreAllMocks());

describe("FoundryMyLearning — Follow up, for a question with no answer yet (3.2R-R3-R2)", () => {
  it("a stale obligation is still reachable — Today expiry does not strand it", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    const cta = await screen.findByTestId("my-learning-open-follow-up");
    expect(cta.textContent).toContain("Follow up");
  });

  it("opens THAT obligation — the durable id, never the event, title or checkpoint", async () => {
    const opened: string[] = [];
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={(id) => opened.push(id)} />);
    const cta = await screen.findByTestId("my-learning-open-follow-up");
    expect(cta.getAttribute("data-followup-id")).toBe(FOLLOWUP);
    cta.click();
    expect(opened).toEqual([FOLLOWUP]);
  });

  it("is an app-shell command, not a link — the 3.2G-R2 rule holds for this route too", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    const cta = await screen.findByTestId("my-learning-open-follow-up");
    expect(cta.tagName).toBe("BUTTON");
    expect(cta.getAttribute("href")).toBeNull();
  });

  it("NEVER says 'again' or 'reported earlier' — there is no earlier answer", async () => {
    /*
      THE SEMANTIC LINE, PINNED. This is the failure the Founder decision calls out by name: the
      cheap implementation reuses the R3-R1 control and tells someone who has never answered that
      they are checking in "again" against a report they never made.
    */
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-open-follow-up");
    const text = screen.getByTestId("my-learning-item").textContent ?? "";
    for (const forbidden of ["again", "Again", "reported earlier", "You reported"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    // ...and the R3-R1 control is genuinely absent, not merely relabelled.
    expect(screen.queryByTestId("my-learning-check-in-again")).toBeNull();
  });

  it("the Korean control drops 다시 too — the same rule, not a translation accident", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="ko" onBack={() => {}} onOpenFollowUp={() => {}} />);
    const cta = await screen.findByTestId("my-learning-open-follow-up");
    expect(cta.textContent).toContain("확인하기");
    expect(cta.textContent).not.toContain("다시"); // "again"
  });

  it("the R3-R1 route is untouched — a settled non-terminal row still says Check in again", async () => {
    stub({
      history: [historyItem()],
      evidence: evidenceRow([], [{ followupId: "fu-settled", followUpDays: 7, outcome: "NOT_YET" }]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    const cta = await screen.findByTestId("my-learning-check-in-again");
    expect(cta.textContent).toContain("Check in again");
    expect(screen.queryByTestId("my-learning-open-follow-up")).toBeNull();
  });

  it("an APPLIED record offers neither route — terminal stays terminal", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([], []) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-open-follow-up")).toBeNull();
    expect(screen.queryByTestId("my-learning-check-in-again")).toBeNull();
  });

  it("one record can carry both routes at once, each opening its own obligation", async () => {
    /*
      A 7-day checkpoint answered "not yet" and a 30-day checkpoint never answered is a real shape,
      and it is the one where conflation would be invisible: two controls, two sentences, two ids.
    */
    const opened: string[] = [];
    stub({
      history: [historyItem()],
      evidence: evidenceRow(
        [{ followupId: "fu-30", followUpDays: 30 }],
        [{ followupId: "fu-7", followUpDays: 7, outcome: "NOT_YET" }],
      ),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={(id) => opened.push(id)} />);
    const open = await screen.findByTestId("my-learning-open-follow-up");
    const again = screen.getByTestId("my-learning-check-in-again");
    expect(open.textContent).toContain("Follow up");
    expect(again.textContent).toContain("Check in again");
    open.click();
    again.click();
    expect(opened).toEqual(["fu-30", "fu-7"]); // each control opened exactly its own
  });

  it("two unanswered checkpoints stay two distinct controls, each naming its own", async () => {
    const opened: string[] = [];
    stub({
      history: [historyItem()],
      evidence: evidenceRow([
        { followupId: "fu-7", followUpDays: 7 },
        { followupId: "fu-30", followUpDays: 30 },
      ]),
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={(id) => opened.push(id)} />);
    await waitFor(() => expect(screen.getAllByTestId("my-learning-open-follow-up")).toHaveLength(2));
    const ctas = screen.getAllByTestId("my-learning-open-follow-up");
    expect(ctas[0]!.textContent).toContain("7-day follow-up");
    expect(ctas[1]!.textContent).toContain("30-day follow-up");
    ctas[1]!.click();
    expect(opened).toEqual(["fu-30"]); // the one pressed, not the first on the row
  });

  it("shows nothing when the server names no open obligation", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-open-follow-up")).toBeNull();
  });

  it("a target with no durable id is dropped, never reconstructed from the row", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([{ followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-open-follow-up")).toBeNull();
  });

  it("an older payload with no openFollowUp field renders no control and no error", async () => {
    // Forward/backward safety: a client ahead of the server hides the door rather than inventing it.
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-open-follow-up")).toBeNull();
  });

  it("without a handler no control renders — never a dead button", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-open-follow-up")).toBeNull();
  });

  it("OPENING My Learning writes nothing — every request is a read", async () => {
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-open-follow-up");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.method === undefined || c.method === "GET")).toBe(true);
  });

  it("PRESSING the control writes nothing either — it navigates, it does not report", async () => {
    /*
      The control hands an id to the shell and stops. Any outcome write belongs to the response
      surface on the other side, after the learner actually chooses one.
    */
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    const cta = await screen.findByTestId("my-learning-open-follow-up");
    const before = calls.length;
    cta.click();
    expect(calls.slice(before)).toEqual([]);
    expect(calls.every((c) => c.method === undefined || c.method === "GET")).toBe(true);
  });

  it("carries no date and no urgency — a 19-day-old obligation is not a failure", async () => {
    /*
      The measured stale rows are 13, 13 and 19 BTY days past their checkpoint. Nothing on this
      surface may score that: no count, no badge, no due date, no red, no "overdue".
    */
    stub({ history: [historyItem()], evidence: evidenceRow([{ followupId: FOLLOWUP, followUpDays: 7 }]) });
    render(<FoundryMyLearning locale="en" onBack={() => {}} onOpenFollowUp={() => {}} />);
    await screen.findByTestId("my-learning-open-follow-up");
    const text = screen.getByTestId("my-learning-item").textContent ?? "";
    for (const forbidden of ["Overdue", "overdue", "Due", "days", "outstanding", "incomplete", "missed"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});
