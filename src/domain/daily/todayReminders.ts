/**
 * Today Reminders — pure domain (Slice 3.1B-3J).
 *
 * Deterministic ONLY. AI never enters this file: what is incomplete/due/overdue, the priority,
 * the deep links, and the role context are all decided here from canonical timestamps. The AI
 * layer may not add, remove, or reprioritize any of these.
 */
import { userDayKey } from "./userDayKey";

// ACTION_REVISION (Slice 3.1B-3M): a REJECTED Action Contract that needs correction/resubmit — an
// actionable DON'T MISS TODAY item, but NOT plain "Overdue". (submitted/escalated are NOT reminders —
// they render in the separate calm actionStatus section; see src/domain/daily/actionStatus.ts.)
export type ReminderCategory = "REQUIRED_LEARNING" | "ACTION_DUE" | "ACTION_REVISION" | "PRACTICE_DUE" | "FOLLOW_UP_DUE";
/** overdue > needs_revision > due_today > incomplete_required (no date) > upcoming (dated future). */
export type ReminderState = "overdue" | "needs_revision" | "due_today" | "incomplete_required" | "upcoming";

export type TodayReminder = {
  /** Stable, source-derived id (never an array index). Used for dedup + React keys. */
  stableId: string;
  category: ReminderCategory;
  title: string;
  state: ReminderState;
  /** Canonical source timestamp (deadline/scheduled), or null when the source has no date. */
  sourceTimestamp: string | null;
  roleContext: "learner" | "host";
  canonicalDeepLink: string;
  /**
   * Optional learner-facing note carried by the canonical source (Slice 3.1B-3N-5C):
   * the Host's revision note for an ACTION_REVISION item. Owner-scoped read only; never a
   * guess, never AI-authored. Absent for every other category.
   */
  note?: string | null;
};

const STATE_RANK: Record<ReminderState, number> = {
  overdue: 0,
  needs_revision: 1, // a rejected submission the learner must correct — urgent, just after overdue
  due_today: 2,
  incomplete_required: 3,
  upcoming: 4,
};

/**
 * Classify a dated obligation against "now" on the canonical BTY day boundary (05:00 local).
 *   overdue   — the deadline instant has already passed
 *   due_today — not yet passed, same BTY day as today
 *   upcoming  — a later BTY day
 */
export function classifyDue(deadlineIso: string, now: Date, tz: string): "overdue" | "due_today" | "upcoming" {
  const deadline = new Date(deadlineIso);
  if (Number.isNaN(deadline.getTime())) return "upcoming";
  if (deadline.getTime() < now.getTime()) return "overdue";
  return userDayKey(deadline, tz, 5) === userDayKey(now, tz, 5) ? "due_today" : "upcoming";
}

/**
 * Deterministic ordering: state rank, then earliest source timestamp, then stableId. Total order
 * (never tz/locale/random dependent), so the same inputs always render in the same order.
 */
export function sortReminders(reminders: TodayReminder[]): TodayReminder[] {
  return [...reminders].sort((a, b) => {
    const r = STATE_RANK[a.state] - STATE_RANK[b.state];
    if (r !== 0) return r;
    const ts = (a.sourceTimestamp ?? "").localeCompare(b.sourceTimestamp ?? "");
    if (ts !== 0) return ts;
    return a.stableId.localeCompare(b.stableId);
  });
}

/** Drop reminders whose stableId is already surfaced elsewhere (dedup vs Today Intelligence primary). */
export function dedupeReminders(reminders: TodayReminder[], suppressStableIds: ReadonlySet<string>): TodayReminder[] {
  if (suppressStableIds.size === 0) return reminders;
  return reminders.filter((r) => !suppressStableIds.has(r.stableId));
}
