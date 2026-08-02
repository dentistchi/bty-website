/**
 * WHICH PRACTICE SURFACE IS ON SCREEN (Slice 3.2I-R5B2-R2).
 *
 * R1 mounted the Host authoring entry as a SIBLING of `ArenaRoom`. `ArenaRoom` owns its own view
 * state — list, starting, playing — entirely inside itself, so `PracticeLanding` had no way to know
 * what was actually being shown. Tapping "Practice again" therefore opened the learner runtime with
 * "Create practice" still sitting above it: an authoring control inside someone's execution.
 *
 * The answer is not to hide the control with CSS. `ArenaRoom` now REPORTS which surface it is
 * showing, and this module is the single place that decides what that means. The rule is stated
 * once, as data, so the screen and the tests read the same authority.
 *
 * The distinction that matters is INDEX versus EXECUTION — not "is the list loaded". A Host whose
 * list is still loading, empty, or failed is still standing on the situations index and must keep
 * their way in; a Host who has started a practice is inside the learner runtime and must not.
 * Hiding during loading would also make the control BLINK on every return from a practice, because
 * `ArenaRoom` reloads its list each time it comes back.
 *
 * Pure: no React, no I/O.
 */

export const PRACTICE_SURFACES = [
  /** The situations index, list still loading. Still the index. */
  "index_loading",
  /** The situations index, list failed to load. Still the index — and the way in is unrelated. */
  "index_error",
  /** The situations index with nothing in it yet. */
  "index_empty",
  /** The situations index with practices in it. */
  "index_list",
  /** Learner execution: a practice is being started. */
  "runtime_starting",
  /** Learner execution: a practice is being played. */
  "runtime_playing",
] as const;

export type PracticeSurface = (typeof PRACTICE_SURFACES)[number];

const EXECUTION: readonly PracticeSurface[] = ["runtime_starting", "runtime_playing"];

/** True while the learner runtime owns the screen. */
export const isPracticeExecution = (s: PracticeSurface): boolean => EXECUTION.includes(s);

/**
 * Whether the Host authoring entry belongs on this surface.
 *
 * Authoring starts or resumes from the INDEX. It has no business inside execution, and the
 * authoring flow itself (setup, editor, preview, published) is a different branch of
 * `PracticeLanding` entirely — the list-level entry is not rendered there at all.
 */
export const showsAuthoringEntry = (s: PracticeSurface): boolean => !isPracticeExecution(s);
