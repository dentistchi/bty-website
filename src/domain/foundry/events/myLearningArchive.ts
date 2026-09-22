/**
 * WHAT MY LEARNING SHOWS BY DEFAULT, AND WHAT FALLS BEHIND "Archived". PURE.
 * Slice My Learning Archive V1.
 *
 * ★ ARCHIVED IS NOT DELETED, AND IT IS NOT A STATE. Nothing is written, nothing is flagged and
 * nothing is removed: this is a PRESENTATION split, derived every time from two facts the product
 * already has — when a training was completed, and whether it still has something the learner can
 * act on. A learner never tidies their own history, and a record never becomes unreachable.
 *
 * ★ WHY DERIVED RATHER THAN STORED. Production holds ONE completed record today, so there is no
 * measured need for archive storage — and a stored flag would immediately need a rule for when to
 * set it, a migration to backfill it, and a way to be wrong. A derived view cannot drift from the
 * data it describes.
 *
 * ★ AN OBLIGATION OUTRANKS RECENCY, ALWAYS. A training with an unanswered follow-up, or one still
 * open to a later check-in, stays visible however old it is — otherwise the product would hide the
 * one thing it is asking the learner to do. Obligations are decided elsewhere, by the domain that
 * owns them; this function only asks a caller-supplied predicate.
 */

/** How many obligation-free trainings the default list keeps. */
export const RECENT_WITHOUT_OBLIGATION = 10;

export type LearningSplit<T> = {
  /** Rendered by default, in the order given — every actionable record, plus the recent ones. */
  visible: T[];
  /** Still fully available, one tap away. Never deleted, never unreachable. */
  archived: T[];
};

/**
 * Split a completion history into what to show and what to archive.
 *
 * `items` must already be in the order the product reads them (newest first, as every history read
 * in this product returns them). ORDER IS PRESERVED EXACTLY: an actionable record is not hoisted
 * to the top, because a history read by date and then silently re-sorted is harder to scan, not
 * easier — it is kept, not promoted.
 *
 * @param isActionable does this record still have something the learner can or should do?
 */
export function splitLearningHistory<T>(
  items: readonly T[],
  isActionable: (item: T) => boolean,
  limit: number = RECENT_WITHOUT_OBLIGATION,
): LearningSplit<T> {
  const rows = Array.isArray(items) ? items : [];
  const keep = Math.max(0, limit);

  const visible: T[] = [];
  const archived: T[] = [];
  let kept = 0;

  for (const item of rows) {
    if (isActionable(item)) {
      // An obligation is never archived, at any age.
      visible.push(item);
      continue;
    }
    if (kept < keep) {
      visible.push(item);
      kept += 1;
      continue;
    }
    archived.push(item);
  }

  return { visible, archived };
}
