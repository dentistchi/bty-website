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
 * Difference in CALENDAR days between two "YYYY-MM-DD" BTY day keys (`to - from`). Positive when
 * `to` is later. The inverse of {@link addDaysToDayKey} and the same UTC-anchored technique: both
 * keys are read as plain calendar dates, so no wall clock, no offset and no DST transition can
 * enter the arithmetic. This is precisely why the attention window below is expressed in day keys
 * rather than elapsed hours — across a DST boundary "7 days later" and "168 hours later" are two
 * different instants, and only the first one is what a learner means by a week.
 */
export function daysBetweenDayKeys(fromDayKey: string, toDayKey: string): number {
  const asUtc = (key: string): number => {
    const [y, mo, d] = key.split("-").map(Number);
    return Date.UTC(y, mo - 1, d);
  };
  return Math.round((asUtc(toDayKey) - asUtc(fromDayKey)) / 86_400_000);
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

/**
 * How many BTY days Today keeps asking about an unanswered follow-up, counted from the due day
 * INCLUSIVE (Slice 3.2R-R3-R2, Founder-ratified). Due day + 7 is the last day it appears; due day
 * + 8 is the first day it does not.
 */
export const TODAY_ATTENTION_WINDOW_DAYS = 7;

/**
 * MAY TODAY STILL ASK? (Slice 3.2R-R3-R2)
 *
 * A follow-up obligation is a DURABLE unanswered fact; Today is a TIME-BOUNDED attention surface.
 * Before this, those two were the same thing, so four live PENDING rows sat at STATE_RANK 0
 * forever — Today shouting a question it had already asked twenty times. The Founder decision is
 * not that the question stops mattering, only that Today stops being the one asking.
 *
 * SO THIS DOES NOT REDEFINE "OVERDUE", AND DELIBERATELY DOES NOT LIVE INSIDE
 * `classifyFollowUpDue`. A nineteen-day-old unanswered follow-up is still truthfully overdue, and
 * the Host attention surface, the learner follow-up view and the due chip all still say so. This
 * is a SEPARATE question layered on top of that unchanged classification — which is why it calls
 * it rather than restating it. There is one authority for upcoming/due_today/overdue, and it is
 * still that function.
 *
 * FOUR OUTCOMES, ONE FUNCTION, ON PURPOSE. A pair of booleans (`todayEligible`, `stillAskable`)
 * would let two surfaces drift into disagreeing about the same row. The states are exhaustive:
 *
 *   settled  — RESPONDED. Not Today's business at any age (R3-R1); the later check-in route
 *              belongs to My Learning and is decided by `canCheckInAgain`, not by this.
 *   upcoming — the checkpoint has not arrived. Never shown, exactly as V1 already behaved.
 *   asking   — PENDING, due today or up to TODAY_ATTENTION_WINDOW_DAYS BTY days past. Today shows it.
 *   stale    — PENDING and beyond the window. Today does NOT show it, and NOTHING is written:
 *              status stays PENDING, outcome stays null, nothing is marked missed. Only the
 *              projection changes. The obligation stays reachable from My Learning, which is what
 *              `stale` is for — it is not a synonym for "gone".
 *
 * An unparseable due instant classifies as `upcoming` (via `classifyFollowUpDue`) and is therefore
 * hidden rather than shown at rank 0 — the direction that can only ever ask less.
 */
export type FollowUpTodayAttention = "settled" | "upcoming" | "asking" | "stale";

export function classifyFollowUpTodayAttention(
  status: FollowUpStatus,
  dueAtIso: string,
  now: Date,
  tz: string,
): FollowUpTodayAttention {
  if (status !== "PENDING") return "settled";
  const dueState = classifyFollowUpDue(dueAtIso, now, tz);
  if (dueState === "upcoming") return "upcoming";
  if (dueState === "due_today") return "asking";
  // Overdue: how far past, in the SAME day-key frame that just called it overdue.
  const daysPastDue = daysBetweenDayKeys(userDayKey(new Date(dueAtIso), tz, 5), userDayKey(now, tz, 5));
  return daysPastDue <= TODAY_ATTENTION_WINDOW_DAYS ? "asking" : "stale";
}

/**
 * MAY A SURFACE OFFER THE FIRST RESPONSE? (Slice 3.2R-R3-R2)
 *
 * The answer Today expiration must NOT change. `stale` counts here and does not count above, and
 * that difference IS the slice: an unanswered obligation stops occupying Today and stays reachable
 * from My Learning forever. `upcoming` is excluded because the checkpoint has genuinely not
 * arrived yet — asking early is a different defect from asking forever.
 *
 * NOT `canCheckInAgain`, AND THE TWO MUST NEVER MERGE. That one is about a SETTLED obligation
 * taking a LATER report, and its surface says "Check in again" / "You reported earlier". This one
 * is about an obligation with no answer at all, where both of those sentences would be lies. They
 * are disjoint by construction — this requires PENDING, that requires RESPONDED — so no row can
 * ever satisfy both.
 */
export function awaitsFirstResponse(status: FollowUpStatus, dueAtIso: string, now: Date, tz: string): boolean {
  const attention = classifyFollowUpTodayAttention(status, dueAtIso, now, tz);
  return attention === "asking" || attention === "stale";
}

/**
 * MAY TODAY DROP THIS OBLIGATION? (Slice 3.2R-R3-R2-R1)
 *
 * REACHABILITY OUTRANKS ATTENTION EXPIRATION — the Founder amendment, and the reason this function
 * exists at all rather than the caller filtering on `attention === "asking"`.
 *
 * R3-R2 bounded how long Today asks, on the stated assumption that My Learning always carries the
 * obligation onward. Measurement found that assumption is not universal: follow-up `124f5430` is 19
 * days past due and its completion row has `linked_user_id = NULL` (an anonymous, unclaimed
 * completion). My Learning lists by `linked_user_id`, so that record has no door — and there is no
 * third learner surface, because the ONLY producers of a `?followup=` target in the whole product
 * are the Today row and the two My Learning CTAs. Suppressing it would have made a durable
 * unanswered obligation unreachable from every learner surface. Silence is an acceptable cost of
 * attention expiry; disappearance is not.
 *
 * SO STALENESS ALONE NO LONGER SUPPRESSES. It takes staleness AND proof that the learner can still
 * get there. Two genuinely different questions, deliberately kept as two arguments rather than
 * folded into one classification: `attention` is a fact about TIME and is decided here in the
 * domain; `reachableElsewhere` is a fact about this learner's IDENTITY BINDING, which only a
 * service that can read their records can answer. A domain function that tried to answer both
 * would have to reach for the database.
 *
 * THE FOURTH CASE IS A COMPATIBILITY EXCEPTION, NOT THE DESIRED END STATE. A stale-and-unreachable
 * obligation stays in Today — noisy, honest, and reachable — until the unclaimed-completion
 * identity gap is closed in its own slice. When that lands, `reachableElsewhere` becomes true for
 * those rows and they leave Today by the ordinary rule, with nothing here to change.
 *
 * FAIL-SAFE DIRECTION. `reachableElsewhere` must be FALSE whenever the caller cannot PROVE a door
 * — including when the read that would prove it failed. Unproven reachability keeps the row, which
 * over-shows; the opposite default strands someone. This is not the caller's discretion: an
 * argument named "reachable" that meant "probably reachable" is how a learner loses a path.
 *
 * NOT `canCheckInAgain`, AND NOT ITS BUSINESS. This decides only whether a PENDING obligation with
 * no answer may leave Today. A RESPONDED row is `settled` and was already out of Today at every
 * age (R3-R1); its later-check-in route is a separate question with a separate authority.
 */
export function isFollowUpEligibleForToday(
  attention: FollowUpTodayAttention,
  reachableElsewhere: boolean,
): boolean {
  switch (attention) {
    case "settled": // answered — R3-R1, never returns to Today
    case "upcoming": // the checkpoint has not arrived — V1, never shown early
      return false;
    case "asking": // inside the attention window — shown, reachability irrelevant
      return true;
    case "stale":
      // Past the window. Today lets go ONLY if the learner has somewhere else to go.
      return !reachableElsewhere;
  }
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

/**
 * HONESTY MUST NOT BE A DEAD END (Slice 3.2M-3).
 *
 * The obligation was first-wins and immutable, which is right for evidence and wrong for
 * people: a learner who truthfully answered "not yet" on day 7 could never come back on day
 * 14 and say they had done it. The product punished the honest answer.
 *
 * So APPLIED is terminal and the other three are check-ins. A later report is a NEW truthful
 * fact, appended — never an erasure of the earlier one.
 */
export const TERMINAL_FOLLOW_UP_OUTCOME: FollowUpOutcome = "APPLIED";

export type FollowUpSubmission =
  /** No report yet — the first one. */
  | { kind: "first" }
  /** The same answer again: a double tap or a retry, not a second check-in. */
  | { kind: "repeat" }
  /** A genuinely different, later report against a non-terminal state. */
  | { kind: "progress" }
  /** Already applied. Nothing may downgrade or replace it. */
  | { kind: "terminal_locked" };

/**
 * What a submission MEANS, given what is already recorded. Pure — the service does the I/O
 * and the ownership check; this decides only what kind of act this is.
 */
export function classifyFollowUpSubmission(
  current: FollowUpOutcome | null,
  next: FollowUpOutcome,
): FollowUpSubmission {
  if (current === null) return { kind: "first" };
  if (current === next) return { kind: "repeat" };
  if (current === TERMINAL_FOLLOW_UP_OUTCOME) return { kind: "terminal_locked" };
  return { kind: "progress" };
}

/** Does this outcome establish the learner's own claim that they applied it? */
export function reportsApplication(outcome: FollowUpOutcome | null): boolean {
  return outcome === TERMINAL_FOLLOW_UP_OUTCOME;
}

/**
 * MAY THIS SETTLED OBLIGATION TAKE A LATER CHECK-IN? (Slice 3.2R-R3-R1)
 *
 * 3.2M-3 gave the service the ability to accept a genuinely later report, and no surface could
 * reach it: the learner surface treated every RESPONDED row as read-only, Today drops RESPONDED
 * rows, and the only `?followup=` link in the product is the Today row it just dropped. So the
 * capability existed and was, in production, dead. This is the single authority that decides
 * whether a surface may offer the way back.
 *
 * IT ASKS THE WRITE PATH'S OWN RULE RATHER THAN RESTATING IT. A second copy of "APPLIED is
 * terminal" is exactly how a surface eventually offers a button the server then refuses. So the
 * question is put to `classifyFollowUpSubmission`: is there ANY outcome that would count as
 * `progress` from here? For APPLIED every candidate answers `repeat` or `terminal_locked`, so
 * the answer is false without this file ever naming APPLIED.
 *
 * "AGAIN" IS LOAD-BEARING, AND IT IS WHY THIS IS FALSE FOR PENDING. A PENDING obligation can
 * obviously be answered — through the FIRST-response path, which is unchanged and is not this.
 * Naming it `canCheckIn` would have made `false` read as "you may not answer this", which is the
 * opposite of the truth for the only rows Today actually shows.
 */
export function canCheckInAgain(status: FollowUpStatus, outcome: FollowUpOutcome | null): boolean {
  if (status !== "RESPONDED" || outcome === null) return false;
  return FOLLOW_UP_OUTCOMES.some((next) => classifyFollowUpSubmission(outcome, next).kind === "progress");
}
