/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R1 — "Since this training", on the learner's own history.
 *
 * The UX gate for this slice is that a learner reading their own record does not experience a
 * compliance dashboard. That is mostly a judgement call, but four parts of it are testable and
 * are tested here: unestablished rungs carry no status word, there is no count or percentage
 * anywhere, the completion line survives untouched, and the strip disappears rather than
 * erroring when evidence cannot be loaded.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import FoundryMyLearning from "./FoundryMyLearning";

const ENTRY = "prog-1";

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

/** `evidence: null` simulates the evidence endpoint failing while history succeeds. */
function stub(opts: { history?: unknown[]; evidence?: unknown[] | null }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const u = String(url);
      if (u.includes("/api/bty/foundry/evidence/mine")) {
        if (opts.evidence === null) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
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

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => vi.restoreAllMocks());

describe("FoundryMyLearning — evidence strip", () => {
  it("renders the established rungs, in ladder order", async () => {
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["decided", "exposed", "reflected"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const strip = await screen.findByTestId("my-learning-evidence");
    for (const rung of ["exposed", "reflected", "decided"]) {
      expect(within(strip).getByTestId(`evidence-rung-${rung}`), rung).toBeTruthy();
    }
    // Order is the canonical ladder, never the order the wire happened to send.
    const rendered = within(strip).getAllByTestId(/^evidence-rung-/).map((el) => el.getAttribute("data-testid"));
    expect(rendered).toEqual(["evidence-rung-exposed", "evidence-rung-reflected", "evidence-rung-decided"]);
  });

  it("UNREACHED rungs are ABSENT, not dimmed — the surface never implies a rung was available", async () => {
    /*
      The 3.2N rule, applied here: a training that published no observable standard can never
      reach OBSERVED. Rendering it greyed would tell the learner they failed to be seen, when
      nobody was ever given the standing to look. So it simply is not shown.
    */
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const strip = await screen.findByTestId("my-learning-evidence");
    for (const rung of ["reflected", "decided", "practiced", "applied", "observed", "sustained"]) {
      expect(within(strip).queryByTestId(`evidence-rung-${rung}`), rung).toBeNull();
    }
    expect(strip.textContent).not.toMatch(/missing|incomplete|failed|overdue|not yet|required/i);
  });

  it("carries NO count, fraction, percentage or score anywhere", async () => {
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed", "reflected"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const strip = await screen.findByTestId("my-learning-evidence");
    expect(strip.textContent).not.toMatch(/\d\s*\/\s*\d/);
    expect(strip.textContent).not.toMatch(/%|score|rating|rank|level \d/i);
  });

  it("EXPOSED reads as 'Learned' — the clinical word never reaches the learner", async () => {
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const strip = await screen.findByTestId("my-learning-evidence");
    expect(within(strip).getByTestId("evidence-rung-exposed").textContent?.trim()).toBe("Learned");
    expect(strip.textContent).not.toMatch(/exposed/i);
  });

  it("the training completion line is untouched and still primary", async () => {
    /*
      The R1 product correction, at the pixel: a record establishing one rung is still a COMPLETED
      training, and the evidence strip must not have replaced or contradicted that.
    */
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    expect(item.textContent).toContain("Completed");
    expect(within(item).getByTestId("my-learning-shared")).toBeTruthy();
    expect(item.textContent).not.toMatch(/not complete|incomplete/i);
  });

  it("KO renders the Korean rung labels and hint", async () => {
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed", "reflected", "sustained"] }] });
    render(<FoundryMyLearning locale="ko" onBack={() => {}} />);
    const strip = await screen.findByTestId("my-learning-evidence");
    expect(within(strip).getByTestId("evidence-rung-exposed").textContent?.trim()).toBe("학습함");
    expect(within(strip).getByTestId("evidence-rung-sustained").textContent?.trim()).toBe("지속됨");
    expect(strip.textContent).toContain("이 교육 이후");
    expect(strip.textContent).toContain("시간이 지나면서");
    // The KO hint must not name the anxiety either (밀린 = "overdue/backlogged").
    expect(strip.textContent).not.toMatch(/밀린|미완|실패|지연/);
  });

  it("an EMPTY established list renders no strip at all — never an empty scoreboard", async () => {
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: [] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await screen.findByTestId("my-learning-item");
    await waitFor(() => expect(screen.queryByTestId("my-learning-evidence")).toBeNull());
    expect(screen.getByTestId("my-learning-shared")).toBeTruthy();
  });

  it("a failed evidence load hides the strip and never breaks the completion list", async () => {
    stub({ history: [historyItem()], evidence: null });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await screen.findByTestId("my-learning-item");
    await waitFor(() => expect(screen.queryByTestId("my-learning-evidence")).toBeNull());
    expect(screen.getByTestId("my-learning-shared")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/error|failed|unavailable/i);
  });

  it("an unknown rung value from the wire is never rendered as a rung", async () => {
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed", "mastered", "certified"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const strip = await screen.findByTestId("my-learning-evidence");
    expect(strip.textContent).not.toMatch(/mastered|certified/i);
    expect(within(strip).getByTestId("evidence-rung-exposed")).toBeTruthy();
  });
});
