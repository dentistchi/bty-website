/**
 * Quick Training — the material a manager attaches, and how the training is COMPLETED (pure).
 *
 * THE THREE MATERIALS. Quick Training offers Video, PDF and Text. They are not three new
 * systems: each maps onto a `foundry_events.content_type` that already exists and already has a
 * learner runtime, a completion path and a history entry. Text in particular reuses
 * `written_guidance` exactly — same content type, same frozen `publishedGuidanceV1` contract,
 * same learner client. Nothing here creates a parallel text-learning system.
 *
 * THE TWO COMPLETION CHECKS, AND WHY THEY ARE EXCLUSIVE.
 *
 * A training asks the learner for evidence that they engaged with it. Historically that was
 * always a written answer to the Host's completion question, stored as `response_text`. A quiz
 * is a SECOND, equally valid form of that evidence — an immutable scored attempt.
 *
 * A quiz-backed training therefore does NOT ask the completion question, and a training with no
 * quiz still must. The alternative — keeping a completion question beside a quiz — asks the
 * learner to prove the same thing twice; and the other alternative — storing an invented prompt
 * so the column is never null — puts a sentence no Host wrote in front of a learner. Both were
 * rejected. `planCompletionEvidence` is the single place that decides which of the two a given
 * creation request is, and it refuses anything that is neither or both.
 */

import type { ValidationResult } from "./foundry-event";
import { validateCompletionPrompt } from "./foundry-training";

/** What the manager chose in the authoring form. */
export const QUICK_TRAINING_MATERIALS = ["video", "pdf", "text"] as const;
export type QuickTrainingMaterial = (typeof QUICK_TRAINING_MATERIALS)[number];

/**
 * The `foundry_events.content_type` each material is stored as. A TOTAL map, so a new material
 * cannot be added without deciding what it is stored as.
 */
export const QUICK_TRAINING_CONTENT_TYPE: Readonly<Record<QuickTrainingMaterial, string>> = {
  video: "youtube",
  pdf: "document",
  text: "written_guidance",
};

export type CompletionEvidencePlan =
  /** The learner answers the Host's completion question. `response_text` is the evidence. */
  | { kind: "response"; completionPrompt: string }
  /** The learner submits the attached quiz. The immutable attempt is the evidence. */
  | { kind: "quiz" };

/**
 * Decide how this training will be completed.
 *
 * - No quiz  → the completion question is REQUIRED, exactly as it has always been. Every legacy
 *   creation path lands here and behaves identically.
 * - Quiz     → the completion question must be ABSENT. A prompt supplied alongside a quiz is
 *   refused rather than quietly dropped: it would be stored and never shown, or shown and never
 *   answered, and neither is a thing the manager asked for.
 */
export function planCompletionEvidence(
  rawPrompt: unknown,
  quizAttached: boolean,
): ValidationResult<CompletionEvidencePlan> {
  if (!quizAttached) {
    const prompt = validateCompletionPrompt(rawPrompt);
    return prompt.ok ? { ok: true, value: { kind: "response", completionPrompt: prompt.value } } : prompt;
  }
  const supplied = typeof rawPrompt === "string" ? rawPrompt.trim() : "";
  if (rawPrompt !== undefined && rawPrompt !== null && typeof rawPrompt !== "string") {
    return { ok: false, reason: "completion_prompt_not_applicable" };
  }
  if (supplied.length > 0) return { ok: false, reason: "completion_prompt_not_applicable" };
  return { ok: true, value: { kind: "quiz" } };
}

/** The value to store in a `completion_prompt` column for this plan. null ⇔ quiz-backed. */
export function storedCompletionPrompt(plan: CompletionEvidencePlan): string | null {
  return plan.kind === "response" ? plan.completionPrompt : null;
}
