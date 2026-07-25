/**
 * Today — deterministic "one primary action" selector (App Shell + Today Simplification V1).
 *
 * PURE domain function — no I/O, no DB, no AI ranking. It projects the SINGLE most important
 * next action from the already-canonical reminder states the server composes for the Today
 * brief. UI never computes this ordering (architecture rule 4); it renders the chosen result.
 *
 * Priority (directive-fixed, most-important first):
 *   1. blocking correction / Needs revision   (state = needs_revision)
 *   2. due Field Action / due action           (category = ACTION_DUE)
 *   3. required learning                       (category = REQUIRED_LEARNING)
 *   4. due Arena practice                      (category = PRACTICE_DUE)
 *   5. follow-up due                           (category = FOLLOW_UP_DUE)
 * (6 "continue active Program" / 7 "calm optional recommendation" are not reminder-backed in V1;
 *  the caller renders a calm optional line when this returns null.)
 *
 * needs_revision ALWAYS wins regardless of category — an open correction is blocking. Ties break
 * by category rank, then by state severity, then by stableId so the result is fully deterministic
 * (identical input → identical single output; property proven in tests).
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

/**
 * Select exactly one primary action, or null when there is nothing actionable (caller then shows a
 * calm optional line). Never mutates the input.
 */
export function selectPrimaryAction(
  candidates: readonly PrimaryActionCandidate[],
): PrimaryActionCandidate | null {
  if (candidates.length === 0) return null;
  // Blocking correction takes absolute precedence over every other category.
  const revisions = candidates.filter((c) => c.state === "needs_revision");
  const pool = revisions.length > 0 ? revisions : candidates;
  return [...pool].sort(
    (a, b) =>
      CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
      STATE_RANK[a.state] - STATE_RANK[b.state] ||
      a.stableId.localeCompare(b.stableId),
  )[0];
}
