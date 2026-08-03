import { HARDEST_WHEN_OPTIONS, type GuidedAnswers, type HardestWhenOption } from "./types";

/**
 * EDITING THE TWO GUIDED SETUP ANSWERS (Slice 3.2I-R5B2-R5C-4B).
 *
 * R5C-4A1 measured that `hardestWhen` and `avoidancePressure` are written once at draft creation
 * and have NO post-creation mutation path. R5C-4A2 then made two same-input refusals block the
 * draft with "review your setup" as the only way forward. Together those meant a Host could be told
 * to change their setup and given no way to change it — a dead end.
 *
 * This module owns what a MEANINGFUL change is, and it answers that question with GENERATION
 * semantics rather than object equality, because the epoch must move exactly when the model would
 * actually see something different.
 *
 * Measured from the production prompt builder:
 *   - `hardestWhen.choice` always reaches the prompt.
 *   - `hardestWhen.customText` reaches it ONLY when the choice is `other`; under any other choice
 *     it is inert, so a stale value left behind it is NOT a semantic change.
 *   - `avoidancePressure.text` reaches the prompt verbatim.
 *
 * PURE: no I/O, no clock. The server calls it; a client assertion never decides.
 */

/** Bounded to the same order of magnitude the creation contract already accepts. */
export const MAX_CUSTOM_TEXT_LENGTH = 300;
export const MAX_AVOIDANCE_TEXT_LENGTH = 600;

export type GuidedAnswerError =
  | "hardest_when_choice_invalid"
  | "hardest_when_custom_required"
  | "hardest_when_custom_too_long"
  | "avoidance_pressure_required"
  | "avoidance_pressure_too_long";

export type GuidedAnswerValidation =
  | { ok: true; value: GuidedAnswers }
  | { ok: false; errors: GuidedAnswerError[] };

/** Collapse runs of whitespace and trim. Case is PRESERVED — the model sees it. */
const collapse = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Validate and normalize a submitted pair.
 *
 * Both answers are required together rather than patched field-by-field: they are two halves of one
 * setup, and a partial write would let one be saved against a stale copy of the other.
 */
export function validateGuidedAnswers(raw: unknown): GuidedAnswerValidation {
  const errors: GuidedAnswerError[] = [];
  const r = (raw ?? {}) as { hardestWhen?: unknown; avoidancePressure?: unknown };
  const hw = (r.hardestWhen ?? {}) as { choice?: unknown; customText?: unknown };
  const ap = (r.avoidancePressure ?? {}) as { text?: unknown };

  const choice = hw.choice as HardestWhenOption;
  if (typeof choice !== "string" || !HARDEST_WHEN_OPTIONS.includes(choice)) errors.push("hardest_when_choice_invalid");

  const rawCustom = typeof hw.customText === "string" ? collapse(hw.customText) : "";
  if (choice === "other") {
    // `other` with no text would reach the prompt as a generic phrase, silently discarding the one
    // thing the Host chose `other` to say.
    if (rawCustom.length === 0) errors.push("hardest_when_custom_required");
    if (rawCustom.length > MAX_CUSTOM_TEXT_LENGTH) errors.push("hardest_when_custom_too_long");
  } else if (rawCustom.length > MAX_CUSTOM_TEXT_LENGTH) {
    errors.push("hardest_when_custom_too_long");
  }

  const text = typeof ap.text === "string" ? collapse(ap.text) : "";
  if (text.length === 0) errors.push("avoidance_pressure_required");
  if (text.length > MAX_AVOIDANCE_TEXT_LENGTH) errors.push("avoidance_pressure_too_long");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      // The inert custom text is dropped rather than carried: storing it would make two drafts that
      // generate identically look different.
      hardestWhen: choice === "other" ? { choice, customText: rawCustom } : { choice },
      avoidancePressure: { text },
    },
  };
}

/**
 * Would the model actually see something different?
 *
 * This is the flag that moves the generation-input epoch, so it must not fire on a change the
 * prompt cannot observe — otherwise re-saving the same answers would reset retry governance, which
 * is the exact bypass R5C-4A stopped this arc to prevent.
 */
export function guidedAnswersChanged(prev: GuidedAnswers | null | undefined, next: GuidedAnswers): boolean {
  if (!prev) return true;
  if (prev.hardestWhen?.choice !== next.hardestWhen.choice) return true;
  // Compared ONLY under `other`, because that is the only case the prompt reads it.
  if (next.hardestWhen.choice === "other") {
    if (collapse(prev.hardestWhen?.customText ?? "") !== collapse(next.hardestWhen.customText ?? "")) return true;
  }
  return collapse(prev.avoidancePressure?.text ?? "") !== collapse(next.avoidancePressure.text);
}
