/**
 * Today action list — pure normalization (Slice 3.2C-B3A.2B).
 *
 * The Today section is ONE canonical, ordered list of the user's actionable items
 * (required learning, needs-revision, verification-pending, awaiting-resolution,
 * follow-up, …). This module only NORMALIZES: it deduplicates by stable canonical
 * identity (never by title text) and preserves the incoming priority order — it
 * does NOT redefine urgency/priority/status. Display trimming (top-3) is separate.
 *
 * Pure domain: no I/O, no new action types.
 */

export type TodayItem = {
  /** Canonical identity used for dedup — event/assignment or action-contract id. */
  stableId: string;
  category: string;
  state: string;
  title: string;
  /** Existing canonical in-shell destination. */
  deepLink: string;
  /**
   * Secondary, NON-PRIVATE provenance for the item — which training this came from
   * (Slice 3.2R-R2.6). Carried verbatim from the canonical source projection; never derived
   * here, never AI-authored, and never learner-private text. Absent for sources that have none.
   *
   * It exists because two APPLY_DUE items are two sentences the learner wrote themselves, and
   * nothing in the sentence says where it came from.
   */
  context?: string | null;
};

export const TODAY_TOP_N = 3;

/**
 * Dedup by `stableId` (NOT title) preserving first-seen order. Two different items
 * that happen to share a title are kept separate; the same item appearing in
 * multiple source projections is collapsed to one.
 */
export function normalizeTodayItems(items: TodayItem[]): TodayItem[] {
  const seen = new Set<string>();
  const out: TodayItem[] = [];
  for (const it of items) {
    if (!it.stableId || seen.has(it.stableId)) continue;
    seen.add(it.stableId);
    out.push(it);
  }
  return out;
}

/**
 * Display rule: 0 → empty; 1–3 → all (no "show more"); 4+ → first 3 with a
 * "show more" that reveals all; collapsing restores the same first three in order.
 */
export function todayVisible(
  items: TodayItem[],
  expanded: boolean,
): { visible: TodayItem[]; hasMore: boolean } {
  const hasMore = items.length > TODAY_TOP_N;
  const visible = !hasMore || expanded ? items : items.slice(0, TODAY_TOP_N);
  return { visible, hasMore };
}
