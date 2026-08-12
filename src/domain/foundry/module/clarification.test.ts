import { describe, it, expect } from "vitest";
import {
  assessClarification,
  readClarificationState,
  withClarificationAnswer,
  clarificationsForContext,
  CLARIFICATION_VERSION,
  MAX_CLARIFICATION_QUESTIONS,
  type ClarificationState,
} from "./clarification";
import { moduleDraftContext } from "./module-draft-copilot";
import type { BuilderAnswers } from "./module-builder";

/**
 * Adaptive Clarification (Slice 2.4C). Deterministic sufficiency contract: a well-described
 * direction asks ZERO questions; an under-specified one asks only a named missing dimension,
 * one at a time; answering reassesses and may end; the ceiling caps at MAX; answered
 * dimensions never re-ask (resume-safe); clarification never touches canonical fields.
 */

// A fully sufficient draft — problem/audience present, behavior specific, evidence concrete.
function sufficientAnswers(): BuilderAnswers {
  return {
    problem: "Front desk staff schedule emergency patients without asking triage questions.",
    audienceType: "specific_role",
    audienceDetail: "Front desk staff",
    recurringMoment: "at each handoff point",
    observableBehavior:
      "The front desk asks about swelling, pain duration, and breathing difficulty before booking an emergency slot.",
    successEvidence: "The triage answers are noted on the appointment record before the slot is confirmed.",
  };
}

function ctxFrom(a: BuilderAnswers) {
  const ctx = moduleDraftContext(a);
  if (!ctx) throw new Error("expected a complete context for the test fixture");
  return ctx;
}

const EMPTY_STATE: ClarificationState = { version: CLARIFICATION_VERSION, answers: [] };

describe("assessClarification — sufficiency (zero-question path)", () => {
  it("a well-described direction needs no clarification", () => {
    const r = assessClarification(ctxFrom(sufficientAnswers()), EMPTY_STATE);
    expect(r.sufficient).toBe(true);
    expect(r.nextQuestion).toBeNull();
    expect(r.missingDimensions).toEqual([]);
  });
});

describe("assessClarification — deficiency (one question at a time)", () => {
  it("a vague observable behavior asks the observable_behavior dimension", () => {
    const a = { ...sufficientAnswers(), observableBehavior: "communicate better" };
    const r = assessClarification(ctxFrom(a), EMPTY_STATE);
    expect(r.sufficient).toBe(false);
    expect(r.nextQuestion?.dimension).toBe("observable_behavior");
    expect(r.missingDimensions).toContain("observable_behavior");
  });

  it("thin success evidence asks the success_evidence dimension (with suggested choices)", () => {
    const a = { ...sufficientAnswers(), successEvidence: "it improves" };
    const r = assessClarification(ctxFrom(a), EMPTY_STATE);
    expect(r.sufficient).toBe(false);
    expect(r.nextQuestion?.dimension).toBe("success_evidence");
    expect(r.nextQuestion?.choiceKeys).toEqual(["ev_seen", "ev_heard", "ev_recorded", "ev_confirmed"]);
    expect(r.nextQuestion?.allowCustom).toBe(true);
  });

  it("asks the highest-impact dimension first (behavior before evidence)", () => {
    const a = { ...sufficientAnswers(), observableBehavior: "be more proactive", successEvidence: "better" };
    const r = assessClarification(ctxFrom(a), EMPTY_STATE);
    expect(r.nextQuestion?.dimension).toBe("observable_behavior");
    // both deficient, in priority order
    expect(r.missingDimensions).toEqual(["observable_behavior", "success_evidence"]);
  });
});

describe("assessClarification — reassessment after an answer", () => {
  it("answering the only missing dimension ends clarification immediately", () => {
    const a = { ...sufficientAnswers(), successEvidence: "better" };
    const ctx = ctxFrom(a);
    const first = assessClarification(ctx, EMPTY_STATE);
    expect(first.sufficient).toBe(false);
    const state = withClarificationAnswer(EMPTY_STATE, {
      dimension: "success_evidence",
      choiceKey: "ev_recorded",
      text: "It'd be recorded",
    });
    const second = assessClarification(ctx, state);
    expect(second.sufficient).toBe(true);
    expect(second.nextQuestion).toBeNull();
  });

  it("with two deficiencies, answering the first advances to the second", () => {
    const a = { ...sufficientAnswers(), observableBehavior: "take ownership", successEvidence: "good" };
    const ctx = ctxFrom(a);
    const state = withClarificationAnswer(EMPTY_STATE, {
      dimension: "observable_behavior",
      choiceKey: null,
      text: "Reads the dosage back at every handoff",
    });
    const r = assessClarification(ctx, state);
    expect(r.sufficient).toBe(false);
    expect(r.nextQuestion?.dimension).toBe("success_evidence");
  });

  it("an answered dimension is never re-asked even though the canonical text is unchanged", () => {
    // Clarification never rewrites canonical fields, so the detector still fires on the raw
    // text — but the answered dimension must be excluded from missing.
    const a = { ...sufficientAnswers(), observableBehavior: "communicate better" };
    const ctx = ctxFrom(a);
    const state = withClarificationAnswer(EMPTY_STATE, {
      dimension: "observable_behavior",
      choiceKey: null,
      text: "States the three triage questions verbatim before booking",
    });
    const r = assessClarification(ctx, state);
    expect(r.missingDimensions).not.toContain("observable_behavior");
    expect(r.sufficient).toBe(true);
  });
});

describe("assessClarification — safety ceiling", () => {
  it("never asks more than MAX questions even if more dimensions look deficient", () => {
    const a = { ...sufficientAnswers(), observableBehavior: "be positive", successEvidence: "good" };
    const ctx = ctxFrom(a);
    // Simulate MAX distinct answered dimensions.
    let state = EMPTY_STATE;
    state = withClarificationAnswer(state, { dimension: "observable_behavior", choiceKey: null, text: "x reads back y" });
    state = withClarificationAnswer(state, { dimension: "success_evidence", choiceKey: null, text: "noted on record" });
    state = withClarificationAnswer(state, { dimension: "target", choiceKey: null, text: "front desk" });
    expect(state.answers).toHaveLength(MAX_CLARIFICATION_QUESTIONS);
    const r = assessClarification(ctx, state);
    expect(r.sufficient).toBe(true);
    expect(r.nextQuestion).toBeNull();
    expect(r.askedCount).toBe(MAX_CLARIFICATION_QUESTIONS);
  });
});

describe("readClarificationState — resume-safe sanitization", () => {
  it("returns an empty, well-formed state for absent/legacy answers", () => {
    expect(readClarificationState(undefined)).toEqual({ version: CLARIFICATION_VERSION, answers: [] });
    expect(readClarificationState({})).toEqual({ version: CLARIFICATION_VERSION, answers: [] });
    expect(readClarificationState({ clarification: { version: "x", answers: "nope" } } as unknown as BuilderAnswers).answers).toEqual([]);
  });

  it("drops malformed entries and keeps the last valid answer per dimension", () => {
    const answers = {
      clarification: {
        version: CLARIFICATION_VERSION,
        answers: [
          { dimension: "observable_behavior", choiceKey: null, text: "first" },
          { dimension: "not_a_dimension", choiceKey: null, text: "junk" },
          { dimension: "observable_behavior", choiceKey: null, text: "second" }, // supersedes first
          { dimension: "success_evidence", choiceKey: "ev_seen", text: "" }, // empty text dropped
        ],
      },
    } as unknown as BuilderAnswers;
    const state = readClarificationState(answers);
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0]).toEqual({ dimension: "observable_behavior", choiceKey: null, text: "second" });
  });
});

describe("clarificationsForContext — generation enrichment", () => {
  it("exposes answered clarifications as dimension+text for the draft prompt", () => {
    const answers = {
      clarification: {
        version: CLARIFICATION_VERSION,
        answers: [{ dimension: "success_evidence", choiceKey: "ev_recorded", text: "Noted on the record" }],
      },
    } as unknown as BuilderAnswers;
    expect(clarificationsForContext(answers)).toEqual([
      { dimension: "success_evidence", text: "Noted on the record" },
    ]);
  });
});
