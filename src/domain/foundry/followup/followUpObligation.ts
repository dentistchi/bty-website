/**
 * Foundry Follow-up Obligation — pure domain (Slice 3.1B-3K).
 *
 * The deadline for a follow-up obligation is materialized EXACTLY ONCE at creation and is
 * NEVER reconstructed at read time (the Today engine must never invent a deadline). This file
 * holds the pure time math + the outcome/status value objects. No I/O, no Date.now(), no DB.
 *
 * Due-date contract (Commander-ratified):
 *   completionBtyDay = userDayKey(completed_at, tz, 05:00)   // pre-05:00 → previous BTY day
 *   dueBtyDay        = completionBtyDay + followUpDays calendar days
 *   dueAt            = dayKeyToStartInstant(dueBtyDay, tz, 05:00)  // fixed UTC instant, DST-safe
 * The stored dueAt is a fixed instant; a later travel / profile-tz change never rewrites it.
 * Today classification (overdue/due_today) still uses the CURRENT reader tz, exactly like
 * Action and Practice reminders.
 */
import { userDayKey } from "@/domain/daily/userDayKey";
import { dayKeyToStartInstant } from "@/domain/daily/userDayStartInstant";

/** Settled authoring enum (module_snapshot.followUpDays): 0 = none (no obligation), else 7 | 30. */
export type FollowUpDays = 7 | 30;

export const FOLLOW_UP_DAYS_VALUES: readonly FollowUpDays[] = [7, 30] as const;

/** Only 7 or 30 materialize an obligation; 0 / null / anything else → none. */
export function isFollowUpDays(n: unknown): n is FollowUpDays {
  return n === 7 || n === 30;
}

/** Learner-reported application outcome. Self-reported — NEVER "verified" behavior. */
export type FollowUpOutcome = "APPLIED" | "PARTLY_APPLIED" | "NOT_YET" | "BLOCKED";

export const FOLLOW_UP_OUTCOMES: readonly FollowUpOutcome[] = [
  "APPLIED",
  "PARTLY_APPLIED",
  "NOT_YET",
  "BLOCKED",
] as const;

export function isFollowUpOutcome(v: unknown): v is FollowUpOutcome {
  return v === "APPLIED" || v === "PARTLY_APPLIED" || v === "NOT_YET" || v === "BLOCKED";
}

/** Obligation lifecycle. DUE/OVERDUE are DERIVED Today states, never stored (stored = PENDING|RESPONDED). */
export type FollowUpStatus = "PENDING" | "RESPONDED";

/**
 * Advance a "YYYY-MM-DD" BTY day key by `days` calendar days (pure, UTC calendar math — the same
 * technique userDayKey uses for its pre-open-hour subtraction). Days may be negative.
 */
export function addDaysToDayKey(dayKey: string, days: number): string {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, mo - 1, d) + days * 86_400_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Classify a follow-up obligation for Today, by BTY DAY (not instant). A follow-up is a day-granular
 * obligation: the whole due BTY day reads "due_today", the days after read "overdue", the days before
 * "upcoming" — using the CURRENT reader tz (a traveled learner is judged in their current frame; the
 * stored dueAt instant is never rewritten). This deliberately differs from the instant-based
 * classifyDue used by Action/Practice (which carry real time-of-day deadlines): dueAt here is the
 * 05:00-local START of the due day, so an instant compare would read "overdue" all day — wrong for a
 * day-granular check. Day-key strings ("YYYY-MM-DD") compare chronologically.
 */
export function classifyFollowUpDue(
  dueAtIso: string,
  now: Date,
  tz: string,
): "overdue" | "due_today" | "upcoming" {
  const due = new Date(dueAtIso);
  if (Number.isNaN(due.getTime())) return "upcoming";
  const dueKey = userDayKey(due, tz, 5);
  const todayKey = userDayKey(now, tz, 5);
  if (dueKey < todayKey) return "overdue";
  if (dueKey === todayKey) return "due_today";
  return "upcoming";
}

export type FollowUpDueComputation = {
  /** BTY day the learner completed on (pre-05:00 counts as the previous day). */
  completionBtyDay: string;
  /** completionBtyDay + followUpDays calendar days. */
  dueBtyDay: string;
  /** The fixed UTC instant (05:00-local start of dueBtyDay). Stored as timestamptz. */
  dueAtIso: string;
};

/**
 * Compute the follow-up deadline ONCE from a completion instant + the resolved user tz + the
 * configured checkpoint. Returns the two audit day-keys and the fixed UTC due instant. Pure:
 * given the same inputs it always returns the same output (no clock, no I/O).
 */
export function computeFollowUpDue(
  completedAtIso: string,
  tz: string,
  followUpDays: FollowUpDays,
): FollowUpDueComputation {
  const completedAt = new Date(completedAtIso);
  const completionBtyDay = userDayKey(completedAt, tz, 5);
  const dueBtyDay = addDaysToDayKey(completionBtyDay, followUpDays);
  const dueAtIso = dayKeyToStartInstant(dueBtyDay, tz, 5).toISOString();
  return { completionBtyDay, dueBtyDay, dueAtIso };
}
