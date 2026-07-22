import { describe, it, expect } from "vitest";
import { validateDraftPatch, COMPLETION_PROMPT_MAX } from "./module-builder";
import { sharedQuestionOrNull } from "./module-publish";
import { validateSharedQuestionOptional } from "../events/foundry-training";

/**
 * Slice 3.1B-3G HOTFIX — the REAL production save round-trip the earlier tests missed:
 *   Builder answers → validateDraftPatch (the draft-save sanitizer whitelist) → saved answers
 *   → sharedQuestionOrNull → publish value.
 * The canonical defect was validateDraftPatch stripping sharedQuestion (not in the whitelist);
 * these prove it now survives, an intentional clear survives as "", and completionPrompt/unknown-
 * key/validation behavior are unchanged.
 */

function save(answers: Record<string, unknown>) {
  const r = validateDraftPatch({ answers });
  return r;
}

describe("sharedQuestion save round-trip (validateDraftPatch → sharedQuestionOrNull → publish)", () => {
  it("1-4. a populated sharedQuestion SURVIVES the save and reaches the publish value", () => {
    const r = save({ learningNeeds: ["shared_standard"], completionPrompt: "CP", sharedQuestion: "Explain the standard in your own words." });
    expect(r.ok).toBe(true);
    const answers = (r as { ok: true; value: { answers?: Record<string, unknown> } }).value.answers!;
    // 2. sanitized draft retains the EXACT question
    expect(answers.sharedQuestion).toBe("Explain the standard in your own words.");
    // 3. sharedQuestionOrNull receives the saved value
    expect(sharedQuestionOrNull(answers)).toBe("Explain the standard in your own words.");
    // 4. publish plumbing persists it (validateSharedQuestionOptional accepts → shared_question)
    expect(validateSharedQuestionOptional(sharedQuestionOrNull(answers))).toEqual({
      ok: true,
      value: "Explain the standard in your own words.",
    });
  });

  it("5-7. an intentionally CLEARED empty string survives the save, publishes as NULL, and is NOT re-proposed", () => {
    const r = save({ sharedQuestion: "" });
    expect(r.ok).toBe(true);
    const answers = (r as { ok: true; value: { answers?: Record<string, unknown> } }).value.answers!;
    // 5. empty string survives (intentional removal — NOT dropped to undefined)
    expect("sharedQuestion" in answers).toBe(true);
    expect(answers.sharedQuestion).toBe("");
    // 7. key is present (not undefined) → the Builder prefill guard `=== undefined` is false → never restored
    expect(answers.sharedQuestion).not.toBeUndefined();
    // 6. publish converts the cleared value to null
    expect(sharedQuestionOrNull(answers)).toBeNull();
  });

  it("8. completionPrompt behavior is unchanged (still whitelisted)", () => {
    const r = save({ completionPrompt: "What will you apply?" });
    const answers = (r as { ok: true; value: { answers?: Record<string, unknown> } }).value.answers!;
    expect(answers.completionPrompt).toBe("What will you apply?");
  });

  it("9. unknown answer keys remain stripped (sharedQuestion did not open a passthrough)", () => {
    const r = save({ sharedQuestion: "Q", bogusKey: "should not persist" });
    const answers = (r as { ok: true; value: { answers?: Record<string, unknown> } }).value.answers!;
    expect(answers.sharedQuestion).toBe("Q");
    expect("bogusKey" in answers).toBe(false);
  });

  it("10. an overlength sharedQuestion is REJECTED with the settled error contract", () => {
    const r = save({ sharedQuestion: "x".repeat(COMPLETION_PROMPT_MAX + 1) });
    expect(r.ok).toBe(false);
    expect((r as { ok: false; errors: string[] }).errors).toContain("shared_question_too_long");
  });

  it("absent sharedQuestion stays absent (untouched → prefill may propose)", () => {
    const r = save({ completionPrompt: "CP" });
    const answers = (r as { ok: true; value: { answers?: Record<string, unknown> } }).value.answers!;
    expect("sharedQuestion" in answers).toBe(false);
  });
});
