import { describe, it, expect } from "vitest";
import {
  BTY_SUGGESTED_COMPLETION_PROMPTS,
  BTY_SUGGESTED_SHARED_QUESTIONS,
  classifyLearnerQuestion,
  copyLikeLearnerQuestions,
  isBtySuggestedCompletionPrompt,
  isBtySuggestedSharedQuestion,
  questionIsCopyLike,
} from "./learnerQuestionRole";
import { suggestCompletionPrompt, suggestSharedQuestion } from "@/components/foundry/event-rooms/moduleBuilderCopy";
import { mapAnswersToJourney } from "./journey";
import { requiredProgramKinds, attributionKind, isPreservableHostSection } from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE R4-R5C12A — LEARNER QUESTION ROLE TRUTH.
 *
 * R4-R5C11 contained BTY's own repetition across the seven rendered Journey sections and was
 * Founder-verified. The two sections that ASK the learner something were untouched, and the
 * corpus measurement that followed found the repetition had moved there rather than gone:
 *
 *   15 of 16 shared questions   byte-identical to one BTY default naming the standard as the answer
 *   22 of 37 completion questions   overlap the observable standard at 0.50 or more
 *   0 of either                  asked what happens in the learner's work today
 *
 * The fixtures below are the measured failures, pinned. Every one of them fails against pre-C12A
 * source, which is the only reason to trust that they pass against this one.
 */

const LEGACY_SHARED = "In your own words, what is the most important standard from this training?";
const LEGACY_SHARED_KO = "이 교육에서 가장 중요한 행동 기준을 자신의 말로 설명해 주세요.";
const STANDARD = "Employees make a confirmation call and follow a checklist of required questions and information to convey.";
/** The Founder's own device example, sanitized — the completion question that shipped. */
const DEVICE_COMPLETION =
  "Describe how you will use the checklist to ensure your confirmation calls include all required questions and information.";

const answers = (over: Partial<BuilderAnswers>): BuilderAnswers =>
  ({
    problem: "New patient bookings are not being confirmed.",
    observableBehavior: STANDARD,
    successEvidence: "A completed checklist is submitted after each call.",
    completionPrompt: "What is one thing you will do differently the next time this happens?",
    learningNeeds: ["shared_standard", "practice"],
    followUpDays: 7,
    ...over,
  }) as unknown as BuilderAnswers;

// ---------------------------------------------------------------------------
// T1–T3 · the new REFLECT default
// ---------------------------------------------------------------------------

describe("[R4-R5C12A · T1-T3] BTY's shared-question default asks about current practice", () => {
  it("T1 asks what happens today, not what the standard was", () => {
    const en = suggestSharedQuestion("en");
    expect(classifyLearnerQuestion(en, STANDARD).currentPracticeLike).toBe(true);
    expect(classifyLearnerQuestion(en, STANDARD).recallLike).toBe(false);
    expect(classifyLearnerQuestion(suggestSharedQuestion("ko"), STANDARD).currentPracticeLike).toBe(true);
  });

  it("T2 never mentions the standard, in either language", () => {
    expect(suggestSharedQuestion("en").toLowerCase()).not.toContain("standard");
    expect(suggestSharedQuestion("ko")).not.toContain("기준");
    expect(suggestSharedQuestion("en")).not.toBe(LEGACY_SHARED);
    expect(suggestSharedQuestion("ko")).not.toBe(LEGACY_SHARED_KO);
  });

  it("T3 stays answerable by someone who does NOT do the behaviour", () => {
    // The property Slice 3.2P-A2-R2 requires of the model is now required of BTY's own prefill:
    // the question may not presuppose that the trained behaviour already happens.
    const en = suggestSharedQuestion("en");
    expect(en).not.toMatch(/\b(?:ensure|make sure|always)\b/i);
    // It asks what IS, so "it doesn't happen" is a truthful answer to it.
    expect(en).toMatch(/\busually happens\b/i);
  });
});

// ---------------------------------------------------------------------------
// T4–T7 · provenance and the double-render
// ---------------------------------------------------------------------------

describe("[R4-R5C12A · T4-T7] BTY's prefill is not the Host's reflection", () => {
  it("T4 an untouched BTY shared question grounds no reflection element", () => {
    for (const q of BTY_SUGGESTED_SHARED_QUESTIONS) {
      const j = mapAnswersToJourney(answers({ sharedQuestion: q }));
      expect(j.elements.find((e) => e.kind === "reflection"), q).toBeUndefined();
    }
  });

  it("T5 a Host-authored shared question keeps full Host authority", () => {
    const hostOwn = "What gets in the way of calling a patient back on a busy morning?";
    const j = mapAnswersToJourney(answers({ sharedQuestion: hostOwn }));
    const el = j.elements.find((e) => e.kind === "reflection");
    expect(el?.content).toBe(hostOwn);
    expect(el?.grounding[0]?.sourceType).toBe("host_statement");
    expect(isPreservableHostSection(el)).toBe(true);
    expect(requiredProgramKinds(answers({ sharedQuestion: hostOwn }))).toContain("reflection");
  });

  it("T6 BTY's default can no longer produce a 'From your:' attribution", () => {
    const j = mapAnswersToJourney(answers({ sharedQuestion: LEGACY_SHARED }));
    const el = j.elements.find((e) => e.kind === "reflection");
    expect(el).toBeUndefined();
    // Nothing exists to attribute; the label that lied has no element to sit under.
    expect(attributionKind(el)).toBeNull();
  });

  it("T7 REFLECT and Shared Understanding cannot both be the same BTY default", () => {
    // The learner room renders the journey's REFLECT element AND, separately, the published
    // shared question. Three live drafts showed the identical BTY sentence in both.
    for (const q of BTY_SUGGESTED_SHARED_QUESTIONS) {
      const a = answers({ sharedQuestion: q });
      const j = mapAnswersToJourney(a);
      const reflectText = j.elements.find((e) => e.kind === "reflection")?.content ?? null;
      const sharedText = a.sharedQuestion ?? null;
      expect(sharedText, "the shared question keeps its own separate job").toBe(q);
      expect(reflectText, "and never occupies REFLECT as well").toBeNull();
    }
  });

  it("T7b BTY's prefill does not silently make the training gain a REFLECT section", () => {
    // Slice 3.2L-R11.4B found the same defect from the other end. Without this, the mapper and
    // `missingProgramKinds` disagree and publish refuses a draft over a sentence BTY wrote.
    expect(requiredProgramKinds(answers({ sharedQuestion: LEGACY_SHARED }))).not.toContain("reflection");
    expect(requiredProgramKinds(answers({ sharedQuestion: suggestSharedQuestion("en") }))).not.toContain("reflection");
  });
});

// ---------------------------------------------------------------------------
// T8–T9 · the new completion default
// ---------------------------------------------------------------------------

describe("[R4-R5C12A · T8-T9] BTY's completion default asks for the learner's own decision", () => {
  it("T8 does not interpolate the observable behaviour", () => {
    const a = { observableBehavior: STANDARD, problem: "New bookings go unconfirmed." };
    for (const loc of ["en", "ko"] as const) {
      const p = suggestCompletionPrompt(a, loc);
      expect(p).not.toContain(STANDARD);
      expect(p).not.toMatch(/^Thinking about "/);
      expect(p).not.toMatch(/^"/);
    }
    // The same sentence whatever the behaviour is — there is nothing of the Host's to leak.
    expect(suggestCompletionPrompt(a, "en")).toBe(suggestCompletionPrompt(undefined, "en"));
  });

  it("T9 asks for a learner-owned decision or application", () => {
    for (const loc of ["en", "ko"] as const) {
      const shape = classifyLearnerQuestion(suggestCompletionPrompt(undefined, loc), STANDARD);
      expect(shape.applicationLike, loc).toBe(true);
      expect(shape.recallLike, loc).toBe(false);
      expect(shape.highOverlap, loc).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// T11–T14 · the classifier, on the measured corpus failures
// ---------------------------------------------------------------------------

describe("[R4-R5C12A · T11-T14] both signals, because one is provably not enough", () => {
  it("T11 a high-overlap completion question is copy-like", () => {
    expect(questionIsCopyLike(DEVICE_COMPLETION, STANDARD)).toBe(true);
    const shape = classifyLearnerQuestion(DEVICE_COMPLETION, STANDARD);
    expect(shape.highOverlap).toBe(true);
    expect(shape.recallLike).toBe(true);
  });

  it("T11b the old template that quoted the standard is copy-like", () => {
    const old = `Thinking about "${STANDARD}", what is one thing you will apply this week?`;
    expect(classifyLearnerQuestion(old, STANDARD).highOverlap).toBe(true);
    expect(isBtySuggestedCompletionPrompt(old)).toBe(true);
  });

  it("T12 recall-style REFLECT with LOW lexical overlap is still copy-like", () => {
    // The essential case. Measured: 0 of 16 shared questions reached 0.50 overlap, so an
    // overlap-only rule would have declared the worse of the two defects clean.
    const shape = classifyLearnerQuestion(LEGACY_SHARED, STANDARD);
    expect(shape.highOverlap, "shares almost no words with the standard").toBe(false);
    expect(shape.recallLike).toBe(true);
    expect(questionIsCopyLike(LEGACY_SHARED, STANDARD)).toBe(true);
    expect(questionIsCopyLike(LEGACY_SHARED_KO, STANDARD)).toBe(true);
  });

  it("T13 a healthy current-practice question raises nothing", () => {
    for (const q of [
      "What usually happens when a booking comes in during a busy clinic?",
      "How is this handled today?",
      "What gets in the way of doing this?",
      "What makes this difficult on a busy morning?",
    ]) {
      expect(questionIsCopyLike(q, STANDARD), q).toBe(false);
    }
  });

  it("T14 a healthy learner-decision question raises nothing", () => {
    for (const q of [
      "What will you do differently the next time this happens?",
      "What is one thing you will try next time?",
      "What will you change about how you start the call?",
    ]) {
      expect(questionIsCopyLike(q, STANDARD), q).toBe(false);
    }
  });

  it("an empty or absent question is never advised about", () => {
    expect(questionIsCopyLike("", STANDARD)).toBe(false);
    expect(questionIsCopyLike(undefined, STANDARD)).toBe(false);
    expect(copyLikeLearnerQuestions(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T15 · Host authority, and §9 · BTY must not warn against itself
// ---------------------------------------------------------------------------

describe("[R4-R5C12A · T15] the Host's own question is never rewritten", () => {
  it("the advisory reports fields, and returns no replacement text", () => {
    const a = answers({ completionPrompt: DEVICE_COMPLETION, sharedQuestion: LEGACY_SHARED });
    const flagged = copyLikeLearnerQuestions(a);
    expect(flagged).toEqual(["completionPrompt", "sharedQuestion"]);
    // The selector's whole output is field names. There is nothing here that could replace a
    // sentence, which is the structural guarantee behind "never silently rewritten".
    expect(flagged.every((f) => typeof f === "string")).toBe(true);
    expect(a.completionPrompt).toBe(DEVICE_COMPLETION);
    expect(a.sharedQuestion).toBe(LEGACY_SHARED);
  });

  it("§9 BTY's own new defaults classify healthy — the product must not warn against itself", () => {
    for (const loc of ["en", "ko"] as const) {
      const a = answers({
        completionPrompt: suggestCompletionPrompt(undefined, loc),
        sharedQuestion: suggestSharedQuestion(loc),
      });
      expect(copyLikeLearnerQuestions(a), loc).toEqual([]);
    }
  });

  it("recognises BTY's own sentences exactly, and nothing that merely resembles them", () => {
    for (const q of BTY_SUGGESTED_SHARED_QUESTIONS) expect(isBtySuggestedSharedQuestion(q)).toBe(true);
    for (const q of BTY_SUGGESTED_COMPLETION_PROMPTS) expect(isBtySuggestedCompletionPrompt(q)).toBe(true);
    // Trimming is tolerated; paraphrase is not — a Host sentence that resembles a default keeps
    // full Host authority. This is the documented limit of string-based provenance.
    expect(isBtySuggestedSharedQuestion(`  ${LEGACY_SHARED}  `)).toBe(true);
    expect(isBtySuggestedSharedQuestion("In your own words, what is the most important standard here?")).toBe(false);
    expect(isBtySuggestedSharedQuestion("What usually happens in this situation today?")).toBe(false);
    expect(isBtySuggestedCompletionPrompt("What is one thing you will apply next week?")).toBe(false);
  });
});
