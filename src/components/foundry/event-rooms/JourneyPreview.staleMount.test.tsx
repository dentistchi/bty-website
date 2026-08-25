/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { JourneyPreview } from "./JourneyPreview";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";

/**
 * SLICE R4-R2D — THE PREVIEW MUST NOT WRITE A JOURNEY THAT NO LONGER EXISTS.
 *
 * Measured defect at `b82e5bcb`: `JourneyPreview` captured its journey once, in a
 * `useMemo(…, [])`, and never read `answers` again. It is rendered as a SIBLING of
 * `ProgramAuthorship` in the same Review view, so adopting a program replaced the journey in
 * the parent's `answers` while the preview kept the pre-adoption copy. The next edit persisted
 * that stale copy over the adopted one — silently, with no error and no refusal.
 *
 * It is not a cosmetic loss. `realityGroundedJourneyV1` is in `SNAPSHOT_ANSWER_KEYS`, is frozen
 * into the published module snapshot, and is the sole source of `journeyObservableStandard` —
 * the sentence a colleague is later asked to attest they saw.
 *
 * THE HARNESS IS THE REAL SEAM. `Host` below is the parent's actual contract, measured, not
 * imagined: `patchAnswers` merges the partial into client-owned state, and the autosave
 * "NEVER applies the server response back onto local state" (its own header). So the only way
 * `answers.realityGroundedJourneyV1` can change is a LOCAL parent write — this component's own
 * `onPatch`, or an external authority such as `applyProgram`'s adoption or its rollback.
 */
const FIXTURE: BuilderAnswers = {
  problem: "During huddles people leave without naming who will act or when.",
  recurringMoment: "at each handoff point",
  observableBehavior: "The owner repeats the action and deadline aloud before the huddle ends.",
  successEvidence: "The huddle note records one owner and one deadline per action.",
  completionPrompt: "After your next huddle, what action had a named owner and deadline?",
};

const el = (kind: string, content: string) => ({
  id: `el_${kind}`,
  kind,
  content,
  grounding: [{ sourceType: "host_statement" as const, field: "problem" }],
  confirmationStatus: "grounded" as const,
});

/** Journey A — what the draft already had when the preview mounted. */
const JOURNEY_A = {
  version: 1,
  displayTitle: "Before adoption",
  displayTitleStatus: "grounded",
  elements: [
    el("why_it_matters", "A: people leave huddles without an owner."),
    el("observable_standard", "A: the huddle leader names one owner and one deadline."),
    el("completion_check", "A: what will you say at the next huddle?"),
  ],
} as unknown as RealityGroundedJourneyV1;

/** Journey B — the adopted program. Different in every field that matters. */
const JOURNEY_B = {
  version: 1,
  displayTitle: "After adoption",
  displayTitleStatus: "grounded",
  elements: [
    el("why_it_matters", "B: handoffs end without a named receiver."),
    el("observable_standard", "B: ask the receiver to state the next action in their own words."),
    el("completion_check", "B: what exact words will you use?"),
  ],
} as unknown as RealityGroundedJourneyV1;

/** Journey C — a second, later external replacement. */
const JOURNEY_C = {
  ...JOURNEY_B,
  displayTitle: "Second adoption",
  elements: [
    el("why_it_matters", "C: the receiver never repeats the commitment back."),
    el("observable_standard", "C: the receiver restates the deadline before the handoff ends."),
    el("completion_check", "C: what will you ask for?"),
  ],
} as unknown as RealityGroundedJourneyV1;

/**
 * The parent, reduced to the two behaviours that matter: it owns `answers`, and it merges
 * partials from `onPatch`. `replace` stands in for any external authority that swaps the
 * journey underneath the preview — `applyProgram` adopting, or rolling back.
 */
function Host({
  initialJourney,
  onPatchSpy,
  controls,
}: {
  initialJourney?: RealityGroundedJourneyV1;
  onPatchSpy: (partial: BuilderAnswers) => void;
  controls: { replace?: (j: RealityGroundedJourneyV1) => void };
}) {
  const [answers, setAnswers] = useState<BuilderAnswers>(
    initialJourney ? { ...FIXTURE, realityGroundedJourneyV1: initialJourney } : { ...FIXTURE },
  );
  controls.replace = (j) => setAnswers((prev) => ({ ...prev, realityGroundedJourneyV1: j }));
  return (
    <JourneyPreview
      locale="en"
      answers={answers}
      onPatch={(partial) => {
        onPatchSpy(partial);
        setAnswers((prev) => ({ ...prev, ...partial }));
      }}
      onApprovableChange={() => {}}
    />
  );
}

/** The journey in the most recent onPatch call — what would actually be written. */
function lastPersisted(spy: { mock: { calls: unknown[][] } }): RealityGroundedJourneyV1 | undefined {
  const calls = spy.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const partial = calls[i]![0] as BuilderAnswers;
    if (partial.realityGroundedJourneyV1) return partial.realityGroundedJourneyV1;
  }
  return undefined;
}

const standardOf = (j: RealityGroundedJourneyV1 | undefined): string =>
  j?.elements.find((e) => e.kind === "observable_standard")?.content ?? "";

afterEach(() => cleanup());

describe("[R4-R2D] the preview follows the journey the draft actually has", () => {
  it("A — mount A, adopt B, edit one element → persists B + the edit, never A", () => {
    const spy = vi.fn();
    const controls: { replace?: (j: RealityGroundedJourneyV1) => void } = {};
    render(<Host initialJourney={JOURNEY_A} onPatchSpy={spy} controls={controls} />);

    // The measured sequence: the program is adopted while the preview is mounted.
    act(() => controls.replace!(JOURNEY_B));

    spy.mockClear();
    fireEvent.change(screen.getByTestId("journey-edit-why_it_matters"), {
      target: { value: "B: edited by the host." },
    });

    const written = lastPersisted(spy);
    expect(written, "nothing was persisted").toBeTruthy();
    // The edit landed…
    expect(written!.elements.find((e) => e.kind === "why_it_matters")!.content).toBe("B: edited by the host.");
    // …and it landed on the ADOPTED journey, not the pre-adoption one.
    expect(standardOf(written)).toBe(standardOf(JOURNEY_B));
    expect(standardOf(written)).not.toBe(standardOf(JOURNEY_A));
    expect(written!.displayTitle).toBe("After adoption");
  });

  it("B — mount A, adopt B, confirm the title → persists B, never A", () => {
    /*
      The title path is separate local state and had the same defect with a sharper edge: a
      Confirm after an adoption would have stamped the OLD journey, with `displayTitleStatus`
      grounded, i.e. an approval of content nobody adopted.
    */
    const spy = vi.fn();
    const controls: { replace?: (j: RealityGroundedJourneyV1) => void } = {};
    render(<Host initialJourney={JOURNEY_A} onPatchSpy={spy} controls={controls} />);

    act(() => controls.replace!(JOURNEY_B));

    spy.mockClear();
    fireEvent.change(screen.getByTestId("journey-title-input"), { target: { value: "Host chosen title" } });
    fireEvent.click(screen.getByTestId("journey-title-confirm"));

    const written = lastPersisted(spy);
    expect(written, "nothing was persisted").toBeTruthy();
    expect(written!.displayTitle).toBe("Host chosen title");
    expect(standardOf(written)).toBe(standardOf(JOURNEY_B));
    expect(standardOf(written)).not.toBe(standardOf(JOURNEY_A));
  });

  it("C — the component's own write, echoed back through the parent, does not revert it", () => {
    /*
      The anti-fix regression. A naive "sync props to state" would take the parent's merged
      answers on every render and could undo the host's own typing. Here the value coming back
      IS this component's write, so there is nothing to adopt and nothing may move.
    */
    const spy = vi.fn();
    const controls: { replace?: (j: RealityGroundedJourneyV1) => void } = {};
    render(<Host initialJourney={JOURNEY_B} onPatchSpy={spy} controls={controls} />);

    const box = screen.getByTestId("journey-edit-why_it_matters") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "B1" } });
    expect(box.value).toBe("B1");
    fireEvent.change(box, { target: { value: "B2" } });
    expect(box.value).toBe("B2");
    fireEvent.change(box, { target: { value: "B2 continued" } });

    expect((screen.getByTestId("journey-edit-why_it_matters") as HTMLTextAreaElement).value).toBe("B2 continued");
    expect(lastPersisted(spy)!.elements.find((e) => e.kind === "why_it_matters")!.content).toBe("B2 continued");
  });

  it("D — an EARLIER journey re-asserted upstream is a rollback, and is accepted", () => {
    /*
      MEASURED DEVIATION FROM THE SLICE BRIEF, recorded rather than papered over.

      The brief asked for a third case: a stale server echo of an own-write, arriving after the
      host has moved on, must not win. That case cannot occur in this architecture. The autosave
      states it in its own header — "It NEVER applies the server response back onto local state"
      — and `setAnswers` has exactly four call sites: initial load, the patch seam, `applyProgram`
      adopting, and `applyProgram` rolling back. There is no channel by which a superseded value
      returns from the server.

      What DOES re-assert an earlier journey is the rollback: `applyProgram` writes the adopted
      journey optimistically, the save fails, and it restores `previous`. Accepting that is the
      requirement, not a regression — 3.2R-R2.4 exists precisely because the Builder must never
      hold a journey the database does not have.

      An older value and an authoritative revert are byte-identical here, so no rule could tell
      them apart without a version field this slice is forbidden to add — and inventing one to
      satisfy the unreachable case would break the reachable one.
    */
    const spy = vi.fn();
    const controls: { replace?: (j: RealityGroundedJourneyV1) => void } = {};
    render(<Host initialJourney={JOURNEY_A} onPatchSpy={spy} controls={controls} />);

    // Optimistic adoption of B, then a failed save that restores what the draft actually has.
    act(() => controls.replace!(JOURNEY_B));
    expect((screen.getByTestId("journey-edit-observable_standard") as HTMLTextAreaElement).value).toBe(
      standardOf(JOURNEY_B),
    );

    act(() => controls.replace!(JOURNEY_A));

    expect((screen.getByTestId("journey-edit-observable_standard") as HTMLTextAreaElement).value).toBe(
      standardOf(JOURNEY_A),
    );
    spy.mockClear();
    fireEvent.change(screen.getByTestId("journey-edit-completion_check"), { target: { value: "edited after rollback" } });
    expect(standardOf(lastPersisted(spy))).toBe(standardOf(JOURNEY_A));
  });

  it("D2 — a parent that does not merge the patch never has the host's typing reverted", () => {
    /*
      THE ANTI-FIX REGRESSION, in its sharpest form. A naive "sync props to state" would compare
      upstream to local on every render and, against a parent whose `answers` never moves, would
      undo each keystroke as it was typed. That bug fires constantly, where the one being repaired
      fires only after an adoption — so it must be pinned, not assumed.
    */
    const box = () => screen.getByTestId("journey-edit-why_it_matters") as HTMLTextAreaElement;
    render(
      <JourneyPreview locale="en" answers={{ ...FIXTURE, realityGroundedJourneyV1: JOURNEY_B }} onPatch={() => {}} onApprovableChange={() => {}} />,
    );

    fireEvent.change(box(), { target: { value: "typed once" } });
    expect(box().value).toBe("typed once");
    fireEvent.change(box(), { target: { value: "typed twice" } });
    expect(box().value).toBe("typed twice");
  });

  it("E — a genuinely new external journey is accepted, not indefinitely refused", () => {
    const spy = vi.fn();
    const controls: { replace?: (j: RealityGroundedJourneyV1) => void } = {};
    render(<Host initialJourney={JOURNEY_A} onPatchSpy={spy} controls={controls} />);

    act(() => controls.replace!(JOURNEY_B));
    expect((screen.getByTestId("journey-edit-observable_standard") as HTMLTextAreaElement).value).toBe(
      standardOf(JOURNEY_B),
    );

    // A second adoption, after the host has already edited the first one.
    fireEvent.change(screen.getByTestId("journey-edit-why_it_matters"), { target: { value: "B edited" } });
    act(() => controls.replace!(JOURNEY_C));

    expect((screen.getByTestId("journey-edit-observable_standard") as HTMLTextAreaElement).value).toBe(
      standardOf(JOURNEY_C),
    );
    spy.mockClear();
    fireEvent.change(screen.getByTestId("journey-edit-completion_check"), { target: { value: "C edited" } });
    expect(standardOf(lastPersisted(spy))).toBe(standardOf(JOURNEY_C));
  });

  it("F — a draft with no journey still seeds exactly one derived journey, unchanged", () => {
    const spy = vi.fn();
    const controls: { replace?: (j: RealityGroundedJourneyV1) => void } = {};
    render(<Host onPatchSpy={spy} controls={controls} />);

    const seeds = spy.mock.calls.filter((c) => (c[0] as BuilderAnswers).realityGroundedJourneyV1);
    expect(seeds).toHaveLength(1);
    expect(screen.getByTestId("journey-preview-el-why_it_matters")).toBeTruthy();
  });
});
