/**
 * TODAY OPEN WORK — what Today shows as still waiting, from the `/api/me/today/brief` answer. PURE.
 *
 * ONE PREDICATE, TWO READERS. Today's list renders from this, and the native "something is still
 * waiting" reminder decides from this. It is extracted from TodayHome rather than re-derived beside
 * it, so the reminder can never count something Today does not show, or miss something it does.
 *
 * MEASURED (2026-09-26) — what the live Today actually renders from the brief:
 *   - `reminders` → the canonical Today list (deduplicated by `stableId`, order preserved);
 *   - `hostAttention` FOLLOW_UP_OVERDUE / FOLLOW_UP_NEEDED → the leadership follow-up rows;
 *   - `hostAttention` SHARED_REVIEW_DUE → counted into the reviews row.
 * The brief's `actionStatus` and `brief` fields are NOT rendered by the live Today — their only
 * consumer (`TodayPersonalBrief`) is not mounted — so they are deliberately not counted here.
 *
 * The reviews row also adds `/api/arena/action-review-queue` items, a DIFFERENT read. That count
 * stays in the UI and is not part of `openCount`: the reminder must be decidable from the brief
 * alone, so a resume check and a Today load always reach the same answer.
 */
import { normalizeTodayItems, type TodayItem } from "@/domain/daily/todayList";

/** The brief's reminder row, as far as Today reads it. */
export type BriefReminder = {
  stableId: string;
  category: string;
  state: string;
  title: string;
  canonicalDeepLink: string;
  note?: string | null;
};

export type FollowUpCategory = "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_NEEDED";

export type TodayOpenWork<H extends { category: string }> = {
  /** The canonical Today list, exactly as rendered. */
  items: TodayItem[];
  /** Leadership follow-ups, in the server's order (never re-ranked here). */
  followUps: (H & { category: FollowUpCategory })[];
  /** SHARED_REVIEW_DUE rows — the brief's share of the reviews row. */
  sharedReviewsDue: number;
  /** Everything above. > 0 means Today is showing at least one thing still waiting. */
  openCount: number;
};

function isFollowUp<H extends { category: string }>(h: H): h is H & { category: FollowUpCategory } {
  return h.category === "FOLLOW_UP_OVERDUE" || h.category === "FOLLOW_UP_NEEDED";
}

export function selectTodayOpenWork<H extends { category: string }>(
  reminders: readonly BriefReminder[],
  hostAttention: readonly H[],
): TodayOpenWork<H> {
  /*
    `note` MUST be carried (Slice 3.2R-R2.6): the server sends the source training title for
    APPLY_DUE, and narrowing it away left two apply cards indistinguishable.
  */
  const items = normalizeTodayItems(
    reminders.map((r) => ({
      stableId: r.stableId,
      category: r.category,
      state: r.state,
      title: r.title,
      deepLink: r.canonicalDeepLink,
      context: r.category === "APPLY_DUE" ? r.note ?? null : null,
    })),
  );
  const followUps = hostAttention.filter(isFollowUp);
  const sharedReviewsDue = hostAttention.filter((h) => h.category === "SHARED_REVIEW_DUE").length;
  return { items, followUps, sharedReviewsDue, openCount: items.length + followUps.length + sharedReviewsDue };
}
