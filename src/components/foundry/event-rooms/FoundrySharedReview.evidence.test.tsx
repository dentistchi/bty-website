/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import FoundrySharedReview from "./FoundrySharedReview";

/**
 * SLICE 3.2R-R1 — "Evidence so far" on the Host participant-review surface.
 *
 * The Host question this answers is HOW FAR EVIDENCE HAS PROGRESSED. The question it must not
 * answer, or appear to answer, is how good the person is. So alongside the rendering checks this
 * suite asserts the two things that would turn one into the other: a self-report labelled as a
 * fact, and any score/count/comparison. Private reflection has no field here and never arrives.
 */
function view(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    eventId: "ev-1",
    sharedQuestion: "Explain the standard in your own words.",
    responses: [
      {
        participantId: "p1",
        progressId: "prog-1",
        displayName: "Hanbit",
        completed: true,
        sharedResponse: "Confirm the owner before we leave the huddle.",
        submittedAt: "2026-08-01T02:00:00Z",
        decisionResponse: null,
        decisionSubmittedAt: null,
        practice: "not_practised",
        evidence: { established: ["exposed", "reflected"], highestEstablished: "reflected" },
        reviewStatus: "NOT_REVIEWED",
        reviewNote: null,
        reviewedAt: null,
        ...over,
      },
    ],
  };
}

function mockFetch(v: unknown) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => v }));
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("FoundrySharedReview — evidence so far", () => {
  it("renders the established rungs in ladder order, and only those", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(view());
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    const block = await screen.findByTestId("host-evidence");
    const rendered = within(block).getAllByTestId(/^host-evidence-rung-/).map((el) => el.getAttribute("data-testid"));
    expect(rendered).toEqual(["host-evidence-rung-exposed", "host-evidence-rung-reflected"]);
  });

  it("UNREACHED rungs are ABSENT, not dimmed — 3.2N's rule, applied to the ladder", async () => {
    /*
      A training with no grounded observable_standard has no observation path at all. 3.2N already
      established that showing that as a negative "reads as though a colleague let it slip, when
      in fact the product never gave anyone the standing to look". A greyed OBSERVED chip would
      say exactly that, to the one reader who acts on it.
    */
    // @ts-expect-error test shim
    global.fetch = mockFetch(view());
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    const block = await screen.findByTestId("host-evidence");
    for (const rung of ["decided", "practiced", "applied", "observed", "sustained"]) {
      expect(within(block).queryByTestId(`host-evidence-rung-${rung}`), rung).toBeNull();
    }
    expect(block.textContent).not.toMatch(/not observed|no evidence|missing|failed/i);
  });

  it("APPLIED is labelled as a SELF-REPORT — the Host never reads a bare 'Applied'", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(view({ evidence: { established: ["exposed", "applied"], highestEstablished: "applied" } }));
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    const block = await screen.findByTestId("host-evidence");
    const applied = within(block).getByTestId("host-evidence-rung-applied");
    expect(applied.textContent).toBe("Self-reported applying");
    // ...and it must not have dragged OBSERVED along with it.
    expect(within(block).queryByTestId("host-evidence-rung-observed")).toBeNull();
  });

  it("the framing says progression, not quality, and promises no private reflection", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(view());
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    const framing = await screen.findByTestId("host-evidence-framing");
    expect(framing.textContent).toMatch(/not a rating of this person/i);
    expect(framing.textContent).toMatch(/private reflections are never shown/i);
  });

  it("shows NO score, count, percentage or cross-learner comparison", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(view());
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    const block = await screen.findByTestId("host-evidence");
    /*
      Scoped to the RUNG LABELS. The framing sentence beneath them legitimately contains "rating"
      — it is the disclaimer, the same shape the pre-existing review framing already uses ("not an
      employee performance score"). Denying a score in words is fine; rendering one is not.
    */
    const labels = within(block).getAllByTestId(/^host-evidence-rung-/).map((el) => el.textContent ?? "").join(" ");
    expect(labels).not.toMatch(/\d\s*\/\s*\d/);
    expect(labels).not.toMatch(/%|score|rating\b|rank|points|top \d/i);
    // No aggregate anywhere in the block either — no "3 of 7", no bar, no total.
    expect(block.textContent).not.toMatch(/\d\s*(\/|of)\s*\d/i);
    expect(block.textContent).not.toMatch(/%/);
  });

  it("renders no private learner text, even when the payload tries to smuggle some", async () => {
    const LEAK = "SECRET PRIVATE REFLECTION BODY";
    // @ts-expect-error test shim
    global.fetch = mockFetch(
      view({ response_text: LEAK, learner_reflection_text: LEAK, learnerReflection: LEAK }),
    );
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    await screen.findByTestId("host-evidence");
    // The component has no field for any of these, so none can reach the DOM.
    expect(document.body.textContent).not.toContain(LEAK);
  });

  it("KO renders the Korean rung labels and the self-report distinction", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(
      view({ evidence: { established: ["exposed", "applied", "observed"], highestEstablished: "observed" } }),
    );
    render(<FoundrySharedReview eventId="ev-1" locale="ko" />);
    const block = await screen.findByTestId("host-evidence");
    expect(within(block).getByTestId("host-evidence-rung-applied").textContent).toBe("본인이 적용했다고 보고함");
    expect(within(block).getByTestId("host-evidence-rung-exposed").textContent).toBe("자료를 끝까지 봄");
    expect(within(block).getByTestId("host-evidence-rung-observed").textContent).toBe("제3자가 관찰함");
  });

  it("a row with no evidence field renders the rest of the review unchanged", async () => {
    /*
      Backward compatibility, and the fail-soft contract: an older/failed payload simply has no
      evidence block. The Host review surface must not depend on it.
    */
    const v = view();
    delete (v.responses[0] as Record<string, unknown>).evidence;
    // @ts-expect-error test shim
    global.fetch = mockFetch(v);
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    await screen.findByTestId("shared-review-row");
    await waitFor(() => expect(screen.queryByTestId("host-evidence")).toBeNull());
    expect(screen.getByTestId("review-framing")).toBeTruthy();
  });
});

describe("FoundrySharedReview — an all-empty evidence projection", () => {
  it("renders no evidence block rather than an empty scoreboard", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(view({ evidence: { established: [], highestEstablished: null } }));
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    await screen.findByTestId("shared-review-row");
    await waitFor(() => expect(screen.queryByTestId("host-evidence")).toBeNull());
    expect(screen.getByTestId("review-framing")).toBeTruthy();
  });
});
