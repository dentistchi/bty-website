/**
 * FOUNDRY APPLY WINDOW — pure domain (Slice 3.2R-R2).
 *
 * A learner recorded what they will do. This is the period in which that decision is live in
 * real work, and the rules for reading it. No I/O, no clock, no DB.
 *
 * THE WINDOW OPENS AT COMPLETION, NOT AT CREATION. There is deliberately no `available_at`:
 * `completionBtyDay` already states the start truthfully, and it is the value that stays correct
 * when an anonymous completion is claimed days later — the obligation belongs to the day the
 * learner decided, not the day their account caught up. Inventing a second start column would
 * have produced a value identical to one we already store, except when it was wrong.
 *
 * DAY-GRANULAR, LIKE THE FOLLOW-UP AND UNLIKE ACTION/PRACTICE. `dueAt` is the 05:00-local START
 * of the due day, so an instant comparison would read "past" from the first moment of that day
 * and mark a window overdue while the learner still has it. `classifyApplyWindow` therefore
 * compares BTY DAY KEYS, exactly as `classifyFollowUpDue` does and for exactly that reason.
 *
 * NOTHING HERE ESTABLISHES EVIDENCE. Every state below is a statement about the CALENDAR. None
 * of them says the learner did anything: `due_today` is not "due to be finished", it is the last
 * day of the window, and `overdue` is not failure. APPLIED is established only by the follow-up
 * authority, and this file has no opinion on it.
 */
import { userDayKey } from "@/domain/daily/userDayKey";
import { dayKeyToStartInstant } from "@/domain/daily/userDayStartInstant";
import { addDaysToDayKey } from "@/domain/foundry/followup/followUpObligation";

/** V1 admits one window length. A column exists so the Host can author it later; 7 is all it may hold. */
export const APPLY_WINDOW_DAYS = 7 as const;
export type ApplyWindowDays = typeof APPLY_WINDOW_DAYS;

export function isApplyWindowDays(n: unknown): n is ApplyWindowDays {
  return n === APPLY_WINDOW_DAYS;
}

/**
 * How a window reads today.
 *
 *   pending    the window has not opened yet. Not reachable in V1 (it opens at completion) and
 *              represented anyway, because a rule that cannot express "not yet" will eventually
 *              be asked to and will answer something else.
 *   active     open and actionable NOW, and not the last day. THIS is the state that made a new
 *              Today `ReminderState` necessary: calling it `upcoming` would have been false —
 *              the learner is meant to act today — and calling it `due_today` would have been
 *              false too.
 *   due_today  the last day of the window.
 *   overdue    the window has closed. NOT a failure and NOT a missed task: it means the period
 *              the decision was live has ended, and the follow-up is what asks how it went.
 */
export type ApplyWindowState = "pending" | "active" | "due_today" | "overdue";

export type ApplyWindowDue = {
  /** BTY day the training was completed — the day the window OPENS. */
  completionBtyDay: string;
  /** completionBtyDay + APPLY_WINDOW_DAYS. The last day of the window. */
  dueBtyDay: string;
  /** Fixed UTC instant (05:00-local start of dueBtyDay). Stored as timestamptz. */
  dueAtIso: string;
};

/**
 * Compute the window ONCE from a completion instant + resolved tz. Pure: same inputs, same
 * output, no clock. Reuses `addDaysToDayKey` and `dayKeyToStartInstant` rather than restating
 * calendar arithmetic — the follow-up already proved this math across DST, and two copies of it
 * would eventually disagree by a day.
 */
export function computeApplyWindow(completedAtIso: string, tz: string): ApplyWindowDue {
  const completionBtyDay = userDayKey(new Date(completedAtIso), tz, 5);
  const dueBtyDay = addDaysToDayKey(completionBtyDay, APPLY_WINDOW_DAYS);
  return {
    completionBtyDay,
    dueBtyDay,
    dueAtIso: dayKeyToStartInstant(dueBtyDay, tz, 5).toISOString(),
  };
}

/**
 * Classify a window against "now", by BTY DAY in the CURRENT reader timezone.
 *
 * Reader tz, not the stored snapshot: a learner who travels is judged in the frame they are
 * actually living in, the same choice Action, Practice and Follow-up all already make. The
 * stored `dueAt` instant is never rewritten.
 */
export function classifyApplyWindow(
  completionBtyDay: string,
  dueBtyDay: string,
  now: Date,
  tz: string,
): ApplyWindowState {
  const today = userDayKey(now, tz, 5);
  if (today < completionBtyDay) return "pending";
  if (today > dueBtyDay) return "overdue";
  if (today === dueBtyDay) return "due_today";
  return "active";
}

/**
 * WHEN THE APPLY CARD STEPS ASIDE (Slice 3.2R-R2).
 *
 * Once the follow-up is asking what happened, two cards about the same decision are one card too
 * many — and the follow-up is the one that can actually record something. So Today shows the
 * follow-up and suppresses the window.
 *
 * SUPPRESSION IS A PROJECTION RULE, NEVER A DELETE. The row is untouched; only this read hides
 * it. A suppressed window is still a durable fact about what the learner committed to.
 *
 * The trigger is the FOLLOW-UP's own state, not the window's dates. Those two can disagree — a
 * 30-day checkpoint on a 7-day window leaves three weeks where the window has closed and the
 * follow-up has not yet arrived — and in that gap the honest answer is that the window is over
 * and nothing is being asked yet, which is what `overdue` says.
 */
export function suppressApplyWindow(args: {
  /** A follow-up obligation exists for this same progress row AND is due today or overdue. */
  readonly followUpIsAsking: boolean;
  /** That follow-up has already been answered. */
  readonly followUpResponded: boolean;
}): boolean {
  return args.followUpIsAsking || args.followUpResponded;
}

/*
  APPLY ACTION DAY V1 — the learner's own "when", as a structured DAY inside the window.

  The decision sentence says WHAT. This says WHEN, and it is chosen, never inferred: nothing here
  reads prose, so "Tomorrow morning" written in a decision stays prose and changes nothing.

  WIRE TOKENS (strict; anything else is "no choice", which is the existing 7-day behaviour):
    "today" | "tomorrow" | "pick:2" … "pick:6" | "this_week"
  "pick:N" is an OFFSET from the completion day, not a calendar date, so the client never has to
  know the learner's BTY day: the server anchors every choice to completionBtyDay, computed in the
  learner's canonical timezone by computeApplyWindow.

  BOUNDARY: completionBtyDay <= action < dueBtyDay. The due day belongs to the follow-up.
*/
export type ApplyActionChoice =
  | { readonly kind: "today" }
  | { readonly kind: "tomorrow" }
  | { readonly kind: "pick"; readonly offsetDays: number }
  | { readonly kind: "this_week" };

/** Offsets "Pick a day" may offer: after Tomorrow, before the due (follow-up) day. */
export const APPLY_ACTION_PICK_OFFSETS = [2, 3, 4, 5, 6] as const;

export function parseApplyActionChoice(raw: unknown): ApplyActionChoice | null {
  if (raw === "today") return { kind: "today" };
  if (raw === "tomorrow") return { kind: "tomorrow" };
  if (raw === "this_week") return { kind: "this_week" };
  if (typeof raw === "string") {
    const m = /^pick:([0-9])$/.exec(raw);
    if (m) {
      const offset = Number(m[1]);
      if ((APPLY_ACTION_PICK_OFFSETS as readonly number[]).includes(offset)) return { kind: "pick", offsetDays: offset };
    }
  }
  return null;
}

/** True only for a day inside the window: completion <= day < due. Day keys compare lexically. */
export function isValidApplyActionDay(day: string, completionBtyDay: string, dueBtyDay: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= completionBtyDay && day < dueBtyDay;
}

/**
 * The action day to store, or null. Null means "the 7-day window governs" — for "Sometime this
 * week", for no choice, and for any choice that would fall outside the window (never clamped).
 */
export function resolveApplyActionDay(
  choice: ApplyActionChoice | null,
  completionBtyDay: string,
  dueBtyDay: string,
): string | null {
  if (!choice || choice.kind === "this_week") return null;
  const offset = choice.kind === "today" ? 0 : choice.kind === "tomorrow" ? 1 : choice.offsetDays;
  const day = addDaysToDayKey(completionBtyDay, offset);
  return isValidApplyActionDay(day, completionBtyDay, dueBtyDay) ? day : null;
}

/**
 * Has the learner's chosen day already gone by, in the reader's BTY day? A null action day never
 * passes: the window's own state keeps governing, exactly as before V1.
 */
export function applyActionDayPassed(actionBtyDay: string | null | undefined, now: Date, tz: string): boolean {
  if (!actionBtyDay) return false;
  return userDayKey(now, tz, 5) > actionBtyDay;
}
