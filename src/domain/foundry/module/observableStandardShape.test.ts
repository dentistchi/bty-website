import { describe, it, expect } from "vitest";
import { isObservableStandardShape, isInterrogativeAction } from "./observableStandardShape";
import { isInterrogativeAction as reExported } from "./program-coherence";
import { journeyObservableStandard, type RealityGroundedJourneyV1 } from "./journey";
import { stepBlockers, type BuilderAnswers } from "./module-builder";
import { observableBehaviorWarning } from "./module-draft";

/**
 * SLICE R4-R1A — "DID YOU SEE THIS?" MUST POINT AT SOMETHING SEEABLE.
 *
 * Measured on live production, not hypothesised. Two published trainings reached the observation
 * surface. One asks a colleague to confirm a QUESTION the Host typed into `observableBehavior`;
 * the other describes a real behaviour. Both were grounded, both published, and nothing on the
 * Host authoring path had ever looked at the difference — `stepBlocker` checks presence and
 * `observableBehaviorWarning` is advisory by design and did not even fire.
 *
 * The floor itself is Slice 3.2P-R2.1's, which was written for the MODEL's proposed action using
 * this same live string as its fixture. R4-R1A did not invent a second rule; it moved the one
 * that existed somewhere both roads can reach.
 *
 * The two live strings below are FIXTURES, never the algorithm — nothing in production logic
 * matches on them.
 */
const LIVE_BAD = "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?";
const LIVE_GOOD_AUTHORED = "Before the huddle ends, name one owner and one deadline for each open action item.";
const LIVE_GOOD_PUBLISHED =
  "At the end of a team huddle when there are open action items that need follow-through, you must name one " +
  "owner and one deadline for each open action item before the huddle ends. Completion evidence: The huddle " +
  "notes or action tracker show a named owner and deadline for the next action before the meeting ends.";

const journey = (content: string, status = "grounded"): RealityGroundedJourneyV1 =>
  ({
    version: 1,
    displayTitle: "T",
    displayTitleStatus: "grounded",
    elements: [
      {
        id: "el_observable_standard",
        kind: "observable_standard",
        content,
        confirmationStatus: status,
        grounding: [{ sourceType: "host_statement", field: "observableBehavior" }],
      },
    ],
  }) as RealityGroundedJourneyV1;

describe("[R4-R1A] the required regression pair — the two live standards", () => {
  it("BAD: the live question is not observable-standard authority", () => {
    expect(isObservableStandardShape(LIVE_BAD)).toBe(false);
    expect(journeyObservableStandard(journey(LIVE_BAD))).toBeNull();
  });

  it("GOOD: the live behaviour is, in both its authored and its published form", () => {
    expect(isObservableStandardShape(LIVE_GOOD_AUTHORED)).toBe(true);
    expect(isObservableStandardShape(LIVE_GOOD_PUBLISHED)).toBe(true);
    expect(journeyObservableStandard(journey(LIVE_GOOD_PUBLISHED))).toBe(LIVE_GOOD_PUBLISHED);
  });

  it("the gate is SHAPE, not strictness — it accepts real behaviour standards", () => {
    for (const s of [
      "At every handoff, state each unfinished item and its next owner before signing off.",
      "Before ending the consultation, ask the patient to explain the treatment plan in their own words.",
      "The huddle note records one owner and one deadline for every agreed action.",
      "write owner and deadline in the note",
      // Interrogative VOCABULARY, declarative shape — the behaviour this very training teaches.
      "Confirm who owns the action before the meeting ends.",
      "Check whether the owner is named.",
      // A wh-head opening an adverbial clause is not a question.
      "when in doubt, name the owner out loud",
    ]) {
      expect(isObservableStandardShape(s), s).toBe(true);
    }
  });

  it("and it refuses the shapes nobody can have witnessed", () => {
    for (const s of [
      LIVE_BAD,
      "What will you do differently next time?",
      "How will you respond when the patient pushes back?",
      "Do you intend to follow the checklist?",
      // Korean questions carry their own mark — the rule is not English-only by accident.
      "다음 허들에서 어떤 말을 쓰시겠습니까?",
      // Inverted under a wh-head, with no punctuation at all.
      "Why does this matter to you",
    ]) {
      expect(isObservableStandardShape(s), s).toBe(false);
    }
  });
});

describe("[R4-R1A] one rule, not two", () => {
  it("program-coherence re-exports the SAME function 3.2P has always used", () => {
    expect(reExported).toBe(isInterrogativeAction);
  });
  it("emptiness is still 'no standard', never a grammar fault", () => {
    expect(journeyObservableStandard(journey("   "))).toBeNull();
    expect(isInterrogativeAction("")).toBe(false);
  });
  it("an UNGROUNDED standard is still refused, for its own separate reason", () => {
    expect(journeyObservableStandard(journey(LIVE_GOOD_PUBLISHED, "needs_confirmation"))).toBeNull();
  });
});

describe("[R4-R1A] the authoring boundary — a question cannot be published", () => {
  const answers = (observableBehavior: string) => ({ observableBehavior }) as BuilderAnswers;

  it("step 4 REFUSES the live question", () => {
    expect(stepBlockers(4, answers(LIVE_BAD))).toEqual(["behavior_is_a_question"]);
  });

  it("step 4 ACCEPTS the good control", () => {
    expect(stepBlockers(4, answers(LIVE_GOOD_AUTHORED))).toEqual([]);
  });

  it("an EMPTY behaviour is still 'required', not 'a question' — the two never merge", () => {
    expect(stepBlockers(4, answers("  "))).toEqual(["behavior_required"]);
  });

  it("vagueness stays ADVISORY — a loosely written standard is still a real one", () => {
    const vague = "Take ownership of the huddle";
    expect(observableBehaviorWarning(vague)).toBe("observable_behavior_vague");
    expect(stepBlockers(4, answers(vague)), "a warning must never become a block").toEqual([]);
  });

  it("no OTHER step is affected by what step 4 now checks", () => {
    const a = { ...answers(LIVE_BAD), successEvidence: "The note records an owner." } as BuilderAnswers;
    expect(stepBlockers(5, a)).toEqual([]);
  });
});
