import { describe, it, expect } from "vitest";
import { mapAnswersToJourney, sameJourney, type RealityGroundedJourneyV1 } from "./journey";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE R4-R2D — the comparison a working copy uses to tell "the draft moved underneath me"
 * from "that is my own edit coming back".
 *
 * It has to be exact in both directions. Too loose and an adopted program is mistaken for the
 * host's own text and silently discarded; too strict and a host is reset mid-sentence by a
 * value that never changed.
 */
const FIXTURE: BuilderAnswers = {
  problem: "During huddles people leave without naming who will act or when.",
  recurringMoment: "at each handoff point",
  observableBehavior: "The owner repeats the action and deadline aloud before the huddle ends.",
  successEvidence: "The huddle note records one owner and one deadline per action.",
  completionPrompt: "After your next huddle, what action had a named owner and deadline?",
};

const base = (): RealityGroundedJourneyV1 => mapAnswersToJourney(FIXTURE);
/** A structurally identical but separately constructed value — the reference-identity trap. */
const clone = (j: RealityGroundedJourneyV1): RealityGroundedJourneyV1 =>
  JSON.parse(JSON.stringify(j)) as RealityGroundedJourneyV1;

describe("[R4-R2D] sameJourney", () => {
  it("a value equals itself, and equals an independently built copy", () => {
    const j = base();
    expect(sameJourney(j, j)).toBe(true);
    expect(sameJourney(j, clone(j))).toBe(true);
    // Reference identity is a fast path, never the rule: a rebuilt equivalent must not read as
    // a replacement, or a host gets reset by a value that did not change.
    expect(sameJourney(base(), base())).toBe(true);
  });

  it("undefined is not a journey, and is not equal to one", () => {
    expect(sameJourney(undefined, undefined)).toBe(true);
    expect(sameJourney(base(), undefined)).toBe(false);
    expect(sameJourney(undefined, base())).toBe(false);
  });

  it("any change to what the learner reads is a different journey", () => {
    const j = base();
    expect(sameJourney(j, { ...clone(j), displayTitle: "Something else" })).toBe(false);

    const edited = clone(j);
    edited.elements[0]!.content = "rewritten";
    expect(sameJourney(j, edited)).toBe(false);
  });

  it("PROVENANCE counts, even when every word is identical", () => {
    /*
      R4-R2A-R1 was exactly this: text unchanged while provenance was rewritten to `ai_proposed`.
      A comparison that only read `content` would call that the same journey and let the working
      copy overwrite it back.
    */
    const j = base();
    const restatused = clone(j);
    restatused.elements[0]!.confirmationStatus = "needs_confirmation";
    expect(sameJourney(j, restatused)).toBe(false);

    const reattributed = clone(j);
    reattributed.elements[0]!.grounding = [{ sourceType: "ai_proposed", field: "problem" }];
    expect(sameJourney(j, reattributed)).toBe(false);

    // `mapAnswersToJourney` emits an UNCONFIRMED title, so the meaningful flip is to grounded —
    // the difference between a title a host approved and one they have not seen.
    expect(j.displayTitleStatus).toBe("needs_confirmation");
    const titleStatus = { ...clone(j), displayTitleStatus: "grounded" as const };
    expect(sameJourney(j, titleStatus)).toBe(false);
  });

  it("structure counts — element identity, order and count", () => {
    const j = base();

    const dropped = clone(j);
    dropped.elements = dropped.elements.slice(0, -1);
    expect(sameJourney(j, dropped)).toBe(false);

    const reordered = clone(j);
    reordered.elements = [reordered.elements[1]!, reordered.elements[0]!, ...reordered.elements.slice(2)];
    expect(sameJourney(j, reordered)).toBe(false);

    const renamed = clone(j);
    renamed.elements[0]!.id = "el_something_else";
    expect(sameJourney(j, renamed)).toBe(false);

    const groundingDropped = clone(j);
    groundingDropped.elements[0]!.grounding = [];
    expect(sameJourney(j, groundingDropped)).toBe(false);
  });

  it("is symmetric and pure", () => {
    const a = base();
    const b = { ...clone(a), displayTitle: "Different" };
    expect(sameJourney(a, b)).toBe(sameJourney(b, a));
    expect(sameJourney(a, clone(a))).toBe(sameJourney(clone(a), a));
    expect(sameJourney(a, a)).toBe(sameJourney(a, a));
  });
});
