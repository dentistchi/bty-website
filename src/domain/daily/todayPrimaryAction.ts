/**
 * Today — deterministic "one primary action" selector (App Shell + Today Simplification V1).
 *
 * PURE domain function — no I/O, no DB, no AI ranking, no randomness. It projects the SINGLE most
 * important next action. UI never computes this ordering (architecture rule 4); it renders the
 * chosen result. The selector ALWAYS returns exactly one action — Today must never show a decorative
 * message without a concrete next step.
 *
 * Priority (directive-fixed, most-important first):
 *   1. blocking correction / Needs revision   (state = needs_revision)
 *   2. due Field Action / due action           (category = ACTION_DUE)
 *   3. required learning                       (category = REQUIRED_LEARNING)
 *   4. due Arena practice                      (category = PRACTICE_DUE)
 *   5. follow-up due                           (category = FOLLOW_UP_DUE)
 *   -- reminder-backed tiers above; deterministic fallbacks below --
 *   6. continue an in-progress program         (fallback: hasActiveProgram)
 *   7. start an available Arena practice       (fallback: hasAvailablePractice)
 *   8. find a program in Learn                 (always-valid final fallback)
 *
 * needs_revision ALWAYS wins regardless of category. Ties break by category rank, then state
 * severity, then stableId, so the result is fully deterministic (identical input → identical single
 * output). Fallbacks are ordered 6 > 7 > 8; tier 8 is always available, so the result is NEVER null.
 * No urgency or completion is fabricated — fallbacks 6/7 fire only when their measured signal is true.
 */

export type PrimaryActionCategory =
  | "REQUIRED_LEARNING"
  | "ACTION_DUE"
  | "ACTION_REVISION"
  | "PRACTICE_DUE"
  | "FOLLOW_UP_DUE";

export type PrimaryActionState =
  | "overdue"
  | "needs_revision"
  | "due_today"
  | "incomplete_required"
  | "upcoming";

export type PrimaryActionCandidate = {
  stableId: string;
  category: PrimaryActionCategory;
  state: PrimaryActionState;
  title: string;
  deepLink: string;
};

/** Deterministic fallback signals, measured server-side (never fabricated). */
export type PrimaryActionFallbackContext = {
  /** An in-progress program exists (started but not complete) → tier 6 "continue". */
  hasActiveProgram: boolean;
  /** At least one Arena practice is available to start → tier 7 "start practice". */
  hasAvailablePractice: boolean;
};

/** The single chosen action, discriminated by tier. Tiers 6–8 carry no reminder payload. */
export type PrimaryActionResult =
  | { kind: "reminder"; candidate: PrimaryActionCandidate }
  | { kind: "continue_program" }
  | { kind: "start_practice" }
  | { kind: "find_program" };

/** Lower rank = higher priority. Mirrors the directive priority list. */
const CATEGORY_RANK: Record<PrimaryActionCategory, number> = {
  ACTION_REVISION: 0,
  ACTION_DUE: 1,
  REQUIRED_LEARNING: 2,
  PRACTICE_DUE: 3,
  FOLLOW_UP_DUE: 4,
};

/** Lower rank = more urgent. Reuses the canonical reminder STATE_RANK ordering. */
const STATE_RANK: Record<PrimaryActionState, number> = {
  overdue: 0,
  needs_revision: 1,
  due_today: 2,
  incomplete_required: 3,
  upcoming: 4,
};

const NO_FALLBACK: PrimaryActionFallbackContext = {
  hasActiveProgram: false,
  hasAvailablePractice: false,
};

/**
 * Select EXACTLY ONE primary action. Reminder-backed due work (tiers 1–5) always outranks the
 * fallbacks; among the fallbacks, an in-progress program (6) outranks an available practice (7),
 * which outranks "find a program" (8, always valid). Never returns null; never mutates the input.
 */
export function selectPrimaryAction(
  candidates: readonly PrimaryActionCandidate[],
  fallback: PrimaryActionFallbackContext = NO_FALLBACK,
): PrimaryActionResult {
  if (candidates.length > 0) {
    // Blocking correction takes absolute precedence over every other category.
    const revisions = candidates.filter((c) => c.state === "needs_revision");
    const pool = revisions.length > 0 ? revisions : candidates;
    const picked = [...pool].sort(
      (a, b) =>
        CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
        STATE_RANK[a.state] - STATE_RANK[b.state] ||
        a.stableId.localeCompare(b.stableId),
    )[0];
    return { kind: "reminder", candidate: picked };
  }
  if (fallback.hasActiveProgram) return { kind: "continue_program" };
  if (fallback.hasAvailablePractice) return { kind: "start_practice" };
  return { kind: "find_program" };
}
