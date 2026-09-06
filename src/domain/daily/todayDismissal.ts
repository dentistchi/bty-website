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
 * A RECIPIENT's Track card is settled when they have answered AND nothing is waiting to be read.
 *
 * Both halves are load-bearing:
 *   * unanswered — somebody asked this person something and is waiting. Removing it would let a
 *     tidy-up silently decline a colleague's question.
 *   * unread     — the Host has replied and this person has not seen it. Hiding that is the exact
 *     harm the whole feature must not cause.
 */
export function recipientCardRemovable(card: { response: string | null; unreadCount: number }): boolean {
  return card.response !== null && card.unreadCount <= 0;
}

/**
 * A HOST's Track card is settled when NO recipient still needs their attention.
 *
 * `needsAttention` is the server's own rule (an open QUESTION/HELP_NEEDED, or an unread message
 * from that person), so this does not re-derive it — a second definition of "who is waiting" is
 * how the two surfaces would eventually disagree.
 *
 * A run whose recipients have not answered at all is still removable: nobody is waiting on the
 * HOST there, and the Host is not the person who owes anything. The unanswered recipients keep
 * seeing their own card on their own Today, which is the surface that actually needs them.
 */
export function hostCardRemovable(card: { responders: readonly { needsAttention: boolean }[] }): boolean {
  return !card.responders.some((r) => r.needsAttention);
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
