/**
 * Quick Training authoring — the pure rules (Slice Quick Training Authoring V1).
 *
 * Three questions this file answers, and nothing else:
 *   1. When is a completion question required, and when is the quiz the completion check?
 *   2. Can a manager actually FIX a quiz, whichever of the three methods produced it?
 *   3. Does the learner projection still withhold the answer key?
 */
import { describe, it, expect } from "vitest";
import { planCompletionEvidence, storedCompletionPrompt } from "./quickTrainingMaterial";
import { parseQuizCsv } from "./quickTrainingQuizCsv";
import {
  QUIZ_MAX_CHOICES,
  QUIZ_MAX_QUESTIONS,
  isQuizSourceKind,
  learnerQuizPayload,
  validateQuiz,
  type Quiz,
} from "./quickTrainingQuiz";
import {
  addQuizChoice,
  addQuizQuestion,
  blankQuizDraft,
  draftFromQuiz,
  quizDraftErrors,
  quizFromDraft,
  removeQuizChoice,
  removeQuizQuestion,
  setQuizChoiceLabel,
  setQuizCorrectChoice,
  setQuizExplanation,
  setQuizQuestionText,
  type QuizDraft,
} from "./quickTrainingQuizDraft";

// ---------------------------------------------------------------------------
// 1. Completion evidence
// ---------------------------------------------------------------------------

describe("the completion check is EITHER the question OR the quiz, never both and never neither", () => {
  it("without a quiz the completion question is required — exactly as it always was", () => {
    expect(planCompletionEvidence(undefined, false)).toEqual({ ok: false, reason: "prompt_required" });
    expect(planCompletionEvidence("   ", false)).toEqual({ ok: false, reason: "prompt_required" });
    expect(planCompletionEvidence("x".repeat(301), false)).toEqual({ ok: false, reason: "prompt_too_long" });
  });

  it("without a quiz a real question is accepted and is what gets stored", () => {
    const plan = planCompletionEvidence("  What will you do differently?  ", false);
    expect(plan).toEqual({ ok: true, value: { kind: "response", completionPrompt: "What will you do differently?" } });
    expect(plan.ok && storedCompletionPrompt(plan.value)).toBe("What will you do differently?");
  });

  it("WITH a quiz no completion question is asked, and NULL — never a placeholder — is stored", () => {
    for (const absent of [undefined, null, "", "   "]) {
      const plan = planCompletionEvidence(absent, true);
      expect(plan).toEqual({ ok: true, value: { kind: "quiz" } });
      expect(plan.ok && storedCompletionPrompt(plan.value)).toBeNull();
    }
  });

  it("a completion question supplied ALONGSIDE a quiz is refused, not quietly dropped", () => {
    expect(planCompletionEvidence("What did you learn?", true)).toEqual({
      ok: false,
      reason: "completion_prompt_not_applicable",
    });
    expect(planCompletionEvidence(42, true)).toEqual({ ok: false, reason: "completion_prompt_not_applicable" });
  });
});

// ---------------------------------------------------------------------------
// 2. The one shared editor
// ---------------------------------------------------------------------------

/** A complete two-question draft, built the way a manual author would build it. */
function manualDraft(): QuizDraft {
  let d = blankQuizDraft();
  d = setQuizQuestionText(d, "q1", "How soon must an incident be reported?");
  d = setQuizChoiceLabel(d, "q1", "a", "Within 24 hours");
  d = setQuizChoiceLabel(d, "q1", "b", "Within a week");
  d = setQuizCorrectChoice(d, "q1", "a");
  d = setQuizExplanation(d, "q1", "The policy names one day.");
  d = addQuizQuestion(d);
  d = setQuizQuestionText(d, "q2", "Who signs it off?");
  d = setQuizChoiceLabel(d, "q2", "a", "The shift lead");
  d = setQuizChoiceLabel(d, "q2", "b", "Anyone present");
  d = setQuizCorrectChoice(d, "q2", "b");
  return d;
}

describe("MANUAL — a manager can build a whole quiz from nothing", () => {
  it("starts with one empty question and two empty choices", () => {
    const d = blankQuizDraft();
    expect(d.questions).toHaveLength(1);
    expect(d.questions[0]!.choices).toHaveLength(2);
    expect(d.questions[0]!.correctChoiceId).toBe("");
  });

  it("builds a storable quiz, renumbering positions and dropping a blank explanation", () => {
    const built = quizFromDraft(manualDraft());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.quiz.schemaVersion).toBe(1);
    expect(built.quiz.questions.map((q) => q.position)).toEqual([1, 2]);
    expect(built.quiz.questions[0]!.explanation).toBe("The policy names one day.");
    expect("explanation" in built.quiz.questions[1]!).toBe(false);
    expect(validateQuiz(built.quiz)).toBeNull();
  });

  it("adds and removes questions, never below one and never above twenty", () => {
    let d = blankQuizDraft();
    expect(removeQuizQuestion(d, "q1").questions).toHaveLength(1);
    for (let i = 1; i < QUIZ_MAX_QUESTIONS + 3; i += 1) d = addQuizQuestion(d);
    expect(d.questions).toHaveLength(QUIZ_MAX_QUESTIONS);
    expect(new Set(d.questions.map((q) => q.id)).size).toBe(QUIZ_MAX_QUESTIONS);
    d = removeQuizQuestion(d, d.questions[3]!.id);
    expect(d.questions).toHaveLength(QUIZ_MAX_QUESTIONS - 1);
  });

  it("holds between two and four choices", () => {
    let d = blankQuizDraft();
    for (let i = 0; i < 5; i += 1) d = addQuizChoice(d, "q1");
    expect(d.questions[0]!.choices).toHaveLength(QUIZ_MAX_CHOICES);
    expect(new Set(d.questions[0]!.choices.map((c) => c.id)).size).toBe(QUIZ_MAX_CHOICES);
    d = removeQuizChoice(d, "q1", d.questions[0]!.choices[3]!.id);
    d = removeQuizChoice(d, "q1", d.questions[0]!.choices[2]!.id);
    expect(d.questions[0]!.choices).toHaveLength(2);
    // The floor holds: a third removal changes nothing.
    expect(removeQuizChoice(d, "q1", d.questions[0]!.choices[0]!.id).questions[0]!.choices).toHaveLength(2);
  });

  it("keeps EXACTLY ONE correct answer, and clears it rather than promoting a neighbour", () => {
    let d = manualDraft();
    d = addQuizChoice(d, "q1");
    d = setQuizChoiceLabel(d, "q1", "c", "Within a month");
    d = setQuizCorrectChoice(d, "q1", "b");
    expect(d.questions[0]!.correctChoiceId).toBe("b");
    d = removeQuizChoice(d, "q1", "b");
    expect(d.questions[0]!.correctChoiceId).toBe("");
    expect(quizDraftErrors(d).some((e) => e.code === "correct_choice_required")).toBe(true);
  });

  it("names every reason it is not yet storable, against the question at fault", () => {
    let d = blankQuizDraft();
    expect(quizDraftErrors(d).map((e) => e.code)).toEqual(
      expect.arrayContaining(["question_text_required", "choice_label_required", "correct_choice_required"]),
    );
    d = setQuizQuestionText(d, "q1", "Same?");
    d = setQuizChoiceLabel(d, "q1", "a", "Yes");
    d = setQuizChoiceLabel(d, "q1", "b", "  yes ");
    d = setQuizCorrectChoice(d, "q1", "a");
    expect(quizDraftErrors(d)).toEqual([{ questionId: "q1", code: "duplicate_choice" }]);
    expect(quizFromDraft(d).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. The other two methods land in the SAME editor
// ---------------------------------------------------------------------------

const CSV = [
  "question,option_a,option_b,option_c,option_d,correct_option,explanation",
  "When do you escalate?,Immediately,After the shift,,,a,Escalate at once.",
  "Who records it?,The lead,The visitor,The auditor,,a,",
].join("\n");

describe("CSV and AI both land in the editor, and neither publishes on its own", () => {
  it("CSV → an editable draft with every field the manager can correct", () => {
    const draft = draftFromQuiz(parseQuizCsv(CSV));
    expect(draft.questions).toHaveLength(2);
    expect(draft.questions[0]!.text).toBe("When do you escalate?");
    expect(draft.questions[0]!.choices.map((c) => c.label)).toEqual(["Immediately", "After the shift"]);
    expect(draft.questions[0]!.correctChoiceId).toBe("a");
    expect(draft.questions[0]!.explanation).toBe("Escalate at once.");
    // A blank CSV explanation becomes an empty editor field, not the string "undefined".
    expect(draft.questions[1]!.explanation).toBe("");

    // …and it is genuinely editable: the corrected quiz is what would be stored.
    const edited = setQuizQuestionText(draft, draft.questions[0]!.id, "When must you escalate?");
    const built = quizFromDraft(edited);
    expect(built.ok && built.quiz.questions[0]!.text).toBe("When must you escalate?");
  });

  it("an AI draft → the same editor, with the grounding evidence deliberately left behind", () => {
    const generated: Quiz = {
      schemaVersion: 1,
      questions: [
        {
          id: "q1",
          text: "What is the reporting window?",
          position: 1,
          choices: [
            { id: "a", label: "24 hours" },
            { id: "b", label: "7 days" },
          ],
          correctChoiceId: "a",
          explanation: "Stated in the policy.",
          sourceEvidence: "incidents must be reported within 24 hours",
        },
      ],
    };
    const draft = draftFromQuiz(generated);
    expect(draft.questions[0]!.text).toBe("What is the reporting window?");
    expect(draft.questions[0]!.correctChoiceId).toBe("a");
    /*
      `sourceEvidence` claims a question is a verbatim span of the supplied source. Once the
      manager can rewrite the question that claim cannot survive, so it is not carried forward.
    */
    const built = quizFromDraft(draft);
    expect(built.ok && "sourceEvidence" in built.quiz.questions[0]!).toBe(false);
  });

  it("only the three real authoring methods are accepted as a source kind", () => {
    expect(["manual", "csv", "generated"].every(isQuizSourceKind)).toBe(true);
    for (const bad of ["ai", "", "MANUAL", undefined, null, 1]) expect(isQuizSourceKind(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. The answer key
// ---------------------------------------------------------------------------

describe("the learner's pre-submit projection still hides the answer key", () => {
  it("serves questions and choices only — no correct answer, no explanation", () => {
    const built = quizFromDraft(manualDraft());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const payload = learnerQuizPayload(built.quiz);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("correctChoiceId");
    expect(serialized).not.toContain("explanation");
    expect(serialized).not.toContain("The policy names one day.");
    expect(payload.questions.map((q) => q.text)).toEqual(built.quiz.questions.map((q) => q.text));
  });
});
