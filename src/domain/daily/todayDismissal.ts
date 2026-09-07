/**
 * "Remove this from my Today" — PURE domain.
 *
 * No I/O, no DB, no display strings. This file owns the two rules that must never be re-derived at
 * a call site: which cards a person is allowed to remove, and when a removed card comes back.
 *
 * ★ REMOVE MEANS HIDE, AND HIDING IS ONLY EVER SAFE FOR A SETTLED CARD.
 *
 * Today is where a person finds out what they owe and what somebody is waiting on. A gesture that
 * makes things disappear is therefore only allowed to touch cards where NOBODY is waiting: a
 * question with no answer yet, or an answer this person has not read, is not clutter — it is the
 * whole reason the surface exists. So removability is not "is it old", it is "is it settled".
 *
 * ★ AND HIDING EXPIRES. A dismissal records the card's monotonic ACTIVITY COUNT — never a
 * timestamp — so tidying up today cannot bury a message that was still uncommitted when the card
 * was removed. See `isHiddenFromToday` for the race that ruled a clock out.
 */

export const TODAY_ITEM_KINDS = ["track_recipient", "track_host"] as const;
export type TodayItemKind = (typeof TODAY_ITEM_KINDS)[number];

export function isTodayItemKind(v: unknown): v is TodayItemKind {
  return typeof v === "string" && (TODAY_ITEM_KINDS as readonly string[]).includes(v);
}

/**
 * ★ ONE CANONICAL ANSWER FOR "WHAT CAN THIS CARD DO RIGHT NOW".
 *
 * `removable` is the eligibility rule, UNCHANGED and NOT widened. `blocker` is the reason it is
 * false, and it exists because the previous shape — a bare boolean — could only tell a surface to
 * refuse. A refusal with no reason is what produced the real device defect: some cards swiped and
 * revealed an action, others physically would not move, and nothing explained the difference.
 *
 * Both fields come from HERE so a component can never invent a second interpretation. A surface
 * that re-derived "is this settled" would eventually disagree with the server that enforces it.
 */
export type TodayCardAction = {
  removable: boolean;
  /** Why not, when not. `null` exactly when `removable` is true. */
  blocker: "unread" | "needs_handling" | "needs_response" | null;
};

/**
 * A RECIPIENT's Track card.
 *
 *   needs_response   they have not answered. Somebody asked them something and is waiting; removing
 *                    it would let a tidy-up silently decline a colleague's question.
 *   unread           the Host has replied and they have not seen it. Hiding that is the exact harm
 *                    this feature must never cause.
 *
 * ★ HANDLED IS NOT CONSULTED, DELIBERATELY. `handled_at` is the HOST's workflow state and is not a
 * field of the recipient projection at all. A recipient who answered and has nothing waiting is
 * finished with the card on THEIR Today, whatever the Host has or has not done about it.
 */
export function recipientTodayAction(card: {
  response: string | null;
  unreadCount: number;
  /** `false` once the Host's account is gone. Absent means "unknown", read as the ordinary case. */
  hostAvailable?: boolean;
}): TodayCardAction {
  /*
    ★ NOBODY IS WAITING FOR AN ANSWER THAT CAN NEVER BE READ.

    When the Host's account has been deleted the Track is historical. `needs_response` would ask a
    person to answer somebody who no longer exists AND refuse to let them clear the card — a
    permanent obligation to nobody, which is the exact harm this feature must not cause.

    `unread` still outranks it, deliberately. A reply the Host wrote BEFORE the account was deleted
    was really sent to this person; they are owed those words, and the card stays until they have
    seen them. After that it is theirs to remove.
  */
  if (card.hostAvailable === false) {
    if (card.unreadCount > 0) return { removable: false, blocker: "unread" };
    return { removable: true, blocker: null };
  }
  if (card.response === null) return { removable: false, blocker: "needs_response" };
  if (card.unreadCount > 0) return { removable: false, blocker: "unread" };
  return { removable: true, blocker: null };
}

/**
 * A HOST's Track run.
 *
 * `needsAttention` stays the single authority for "is anybody waiting on me" — this reads it rather
 * than re-deriving it. The blocker only says WHICH kind of waiting, and unread is reported first
 * because reading what somebody said is what a Host must do before deciding anything is handled.
 *
 * A run whose recipients have not answered at all is removable: nobody is waiting on the HOST
 * there, and those recipients still see their own card on their own Today.
 */
export function hostTodayAction(card: {
  responders: readonly { needsAttention: boolean; unreadCount: number; response?: string | null; handledAt?: string | null }[];
}): TodayCardAction {
  if (!card.responders.some((r) => r.needsAttention)) return { removable: true, blocker: null };
  if (card.responders.some((r) => r.unreadCount > 0)) return { removable: false, blocker: "unread" };
  return { removable: false, blocker: "needs_handling" };
}

/**
 * ★ THE RESURFACE RULE, STATED ONCE — AND WHY IT IS A COUNT, NOT A CLOCK.
 *
 * The first version of this compared the card's latest activity TIMESTAMP against `dismissedAt`.
 * That is the same MVCC defect this codebase already paid for in the thread unread cursor:
 *
 *     T1  recipient writes a message, created_at = 10:00, DOES NOT COMMIT
 *     T2  the Host cannot see it and removes the card at 10:01
 *     T1  commits — the message lands, still stamped 10:00
 *     ==> latest activity (10:00) <= dismissed (10:01), FOREVER
 *
 * The card is hidden permanently even though a real message arrived after the tidy-up. No clock
 * fixes it, because the defect is commit order versus stamp order.
 *
 * So the authority is a MONOTONIC COUNT of attention-worthy activity. A dismissing transaction can
 * only count rows inside its own snapshot, so it necessarily records the PRE-COMMIT version; when
 * the concurrent write lands the count is strictly greater and the card returns.
 *
 * Strictly greater-than: activity already included in the recorded version was, by construction,
 * part of what the person was looking at when they removed the card.
 */
export function isHiddenFromToday(input: {
  dismissedActivityVersion: number | null;
  currentActivityVersion: number;
}): boolean {
  if (input.dismissedActivityVersion === null) return false;
  // A version we cannot read is not permission to hide anything.
  if (!Number.isFinite(input.dismissedActivityVersion)) return false;
  return input.currentActivityVersion <= input.dismissedActivityVersion;
}

/**
 * ★ THE ONE PLACE THAT DECIDES WHETHER A TRACK IS ON TODAY.
 *
 * Today and Past Tracks are a PARTITION, and the only way to guarantee that is for both to ask the
 * SAME question and take opposite answers. If Past re-derived "is this old" with its own rule, the
 * two would drift the first time either changed: a Track could appear in both (the person sees it
 * twice and cannot tell which is real) or in neither (history the database is deliberately keeping
 * becomes unreachable, which is the whole defect this surface exists to close).
 *
 * So this function is the definition, `scope: "past"` is its negation, and there is no second
 * approximation of it anywhere.
 *
 * ★ `historical` IS SUPPLIED BY THE CALLER, AND THE TWO SIDES DISAGREE — deliberately.
 *
 * A RECIPIENT's Today already hides a closed run: a Host who closed their run is not asking that
 * person for anything any more. A HOST's Today still shows their own closed runs, with a badge,
 * because closing is something they DID and the outcome is theirs to read back. Rather than bury
 * that asymmetry inside here, each caller states its own rule and this composes it with the
 * dismissal test — so the difference is visible at the two call sites instead of being a hidden
 * branch on a role.
 */
export function isTrackOnToday(card: {
  /** True when THIS side treats the run as no longer Today-eligible, whatever the dismissal says. */
  historical: boolean;
  dismissedActivityVersion: number | null;
  currentActivityVersion: number;
}): boolean {
  if (card.historical) return false;
  return !isHiddenFromToday({
    dismissedActivityVersion: card.dismissedActivityVersion,
    currentActivityVersion: card.currentActivityVersion,
  });
}

/** Which half of the partition a surface is asking for. */
export type TrackScope = "today" | "past";

/**
 * ★ THE PARTITION ITSELF, IN ONE LINE.
 *
 * Every caller-owned Track satisfies this for EXACTLY ONE scope, because `past` is the boolean
 * negation of `today` over the same inputs — not a separate query, not a status flag, and nothing
 * that has to be kept in sync. New activity that lifts a card back onto Today removes it from Past
 * in the same read, with no write anywhere.
 */
export function isTrackInScope(scope: TrackScope, card: {
  historical: boolean;
  dismissedActivityVersion: number | null;
  currentActivityVersion: number;
}): boolean {
  return scope === "today" ? isTrackOnToday(card) : !isTrackOnToday(card);
}

/**
 * ★ A RECIPIENT CARD'S ACTIVITY = HOST-AUTHORED MESSAGES.
 *
 * Once a recipient has settled their card, the only thing that can legitimately bring it back is
 * the Host writing to them. Their own replies are not activity they need resurfacing for — they
 * were there when they wrote them.
 *
 * Monotonic because thread messages are append-only: `service_role` holds SELECT and INSERT on
 * that table and no UPDATE or DELETE, so this count cannot go down while the card exists.
 */
export function recipientActivityVersion(messages: readonly { authorRole: string }[]): number {
  let n = 0;
  for (const m of messages) if (m.authorRole === "HOST") n += 1;
  return n;
}

/**
 * ★ A HOST CARD'S ACTIVITY = RECIPIENT MESSAGES + FIRST RESPONSES THAT ASK FOR SOMETHING.
 *
 * Two monotonic facts, added:
 *
 *   recipient-authored messages   append-only, across every recipient of the run
 *   QUESTION / HELP_NEEDED        write-once first responses
 *
 * Both terms are load-bearing and neither subsumes the other:
 *   * a QUESTION also appends a message, so it raises both — harmless, since the contract needs
 *     the number to INCREASE on new activity, not to equal any particular thing;
 *   * HELP_NEEDED deliberately fabricates NO message, so without the response term the very
 *     activity that most needs a Host would leave the version unmoved and the card buried.
 *
 * ACKNOWLEDGED is excluded on purpose: it is an ending, and it asks nothing of the Host.
 */
export function hostActivityVersion(
  messages: readonly { authorRole: string }[],
  responses: readonly (string | null)[],
): number {
  let n = 0;
  for (const m of messages) if (m.authorRole === "RECIPIENT") n += 1;
  for (const r of responses) if (r === "QUESTION" || r === "HELP_NEEDED") n += 1;
  return n;
}
