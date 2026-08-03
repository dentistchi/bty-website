/**
 * CANONICAL GENERATION-INPUT REVISION (Slice 3.2I-R5B2-R5C-4A1).
 *
 * R5C-4A measured that the draft's `revision` column is an optimistic-concurrency token. It
 * increments on writes that leave the generation input identical — a scenario-editor save, a
 * successful generation, or an idempotent boundary save that changes nothing. Same-input retry
 * governance built on it would let a Host re-save the same boundary, bump `revision`, and make
 * identical input eligible to spend again.
 *
 * So there are two versions with two meanings, and this module owns the second one:
 *
 *   revision                   did the ROW change?     (concurrency; unchanged by this slice)
 *   generation_input_revision  did the INPUT change?   (semantics; defined here)
 *
 * PURE: the server decides, from stored values, using each writer's already-measured `changed`
 * comparison. A client assertion never moves it.
 */

/**
 * Every draft — new or pre-existing — starts here.
 *
 * For existing rows this does NOT claim their input has never changed. It declares the CURRENT
 * stored input to be baseline epoch 1, which is the most that can honestly be said about drafts
 * that predate the contract.
 */
export const GENERATION_INPUT_BASELINE_REVISION = 1;

export function isValidGenerationInputRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= GENERATION_INPUT_BASELINE_REVISION;
}

/**
 * The next input revision after a write.
 *
 * Increments EXACTLY ONCE when the write meaningfully changed the input, regardless of how many
 * fields moved — one save is one input epoch. `changed` comes from the writer's own canonical
 * comparison, so this function never re-derives equality and cannot disagree with the scenario
 * invalidation decision made from the same flag.
 */
export function nextGenerationInputRevision(current: unknown, changed: boolean): number {
  const base = isValidGenerationInputRevision(current) ? current : GENERATION_INPUT_BASELINE_REVISION;
  return changed ? base + 1 : base;
}

/**
 * LEGACY BASELINE POLICY — the data contract only. This slice counts nothing.
 *
 * The two historical attempts carry `generation_input_revision = NULL`: they were recorded before
 * the contract existed and were never backfilled, because a fabricated epoch is indistinguishable
 * from a measured one once written.
 *
 * The rule the governance slice must apply, stated here so it cannot be quietly reinterpreted:
 *
 *   draft epoch 1  → a NULL attempt on the same draft IS a baseline-epoch attempt. The input has
 *                    not meaningfully changed since the contract began, so those refusals still
 *                    describe the input a Host would submit right now.
 *
 *   draft epoch ≥2 → a NULL attempt is NOT counted. The input has demonstrably moved at least
 *                    once since, and an attempt whose epoch was never recorded cannot be proven
 *                    to describe the current one.
 *
 * The asymmetry is deliberate and conservative in the direction that matters: at epoch 1 it
 * PRESERVES the evidence that blocks repeated spending; past epoch 1 it discards evidence it
 * cannot place, rather than blocking a Host on attempts that may predate their edits.
 */
export function isSameInputEpochAttempt(
  draftGenerationInputRevision: number,
  attemptGenerationInputRevision: number | null | undefined,
): boolean {
  if (attemptGenerationInputRevision === null || attemptGenerationInputRevision === undefined) {
    // Legacy attempt: only comparable while the draft is still at the baseline epoch.
    return draftGenerationInputRevision === GENERATION_INPUT_BASELINE_REVISION;
  }
  return attemptGenerationInputRevision === draftGenerationInputRevision;
}
