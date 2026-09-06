/**
 * Track — the continuing conversation. PURE domain.
 *
 * No I/O, no DB, no display strings. This file owns the four things that must never be re-derived
 * at a call site: what a message is allowed to be, who counts as an author, what "unread" means for
 * each side, and when a recipient still needs the Host's attention.
 *
 * ★ THE UNIT IS THE RECIPIENT, NOT THE ANNOUNCEMENT.
 *
 * A tracked announcement has many recipients, and each one owns a PRIVATE two-party thread with the
 * Host. Nothing in this module takes an announcement id, and nothing here can combine two
 * recipients' messages — the type simply does not carry the field that would let it.
 *
 * ★ THIS IS NOT CHAT, AND IT IS NOT TRAINING. There is no room, no presence, no typing state, no
 * reaction, no read receipt for an individual message, and no Evidence Ladder rung. Two people
 * finishing a conversation that a workplace announcement started.
 */

/**
 * The same bound the product already gives a person writing about an announcement: `host_framing`
 * and `question_text` are both `1..1000` in the schema, and `QUESTION_TEXT_MAX` is 1000. A reply is
 * the same act of writing as the question that started it, so it gets the same number rather than a
 * second one somebody has to remember.
 */
export const THREAD_MESSAGE_MAX = 1000;

/** A client nonce is a nonce. It names nothing and authorizes nothing; it is only bounded. */
export const CLIENT_MESSAGE_KEY_MAX = 100;

export const THREAD_ROLES = ["HOST", "RECIPIENT"] as const;
export type ThreadRole = (typeof THREAD_ROLES)[number];

export function isThreadRole(v: unknown): v is ThreadRole {
  return typeof v === "string" && (THREAD_ROLES as readonly string[]).includes(v);
}

/**
 * One message, as every surface sees it.
 *
 * `authorRole` is what the SERVER derived from announcement ownership. It is carried rather than
 * recomputed on the client precisely so a renderer cannot decide for itself who said something.
 */
export type ThreadMessage = {
  readonly id: string;
  readonly authorRole: ThreadRole;
  readonly authorDisplay: string | null;
  readonly body: string;
  readonly createdAt: string;
};

/**
 * Trim, then bound. Returns null for anything that is not a message.
 *
 * Whitespace-only is NOT a message: a person who taps Send on an empty box has not said anything,
 * and storing a blank row in a conversation their manager reads would be noise nobody wrote.
 */
export function normalizeThreadMessage(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length < 1 || s.length > THREAD_MESSAGE_MAX) return null;
  return s;
}

/** A nonce, or nothing. Never an identifier this system will read meaning out of. */
export function normalizeClientMessageKey(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length < 1 || s.length > CLIENT_MESSAGE_KEY_MAX) return null;
  return s;
}

/**
 * How many of the OTHER side's messages this reader has not seen.
 *
 * ★ AN AUTHOR NEVER CREATES UNREAD FOR THEMSELVES, and that is a property of this function rather
 * than a rule a caller is trusted to remember: `viewer` selects the messages written by the OPPOSITE
 * role, so a Host's own reply can never appear in the Host's count.
 *
 * A null cursor means "never opened", which is correctly every message the other side has sent —
 * including on the day this ships, when every existing row has one.
 *
 * The comparison is strictly greater-than: a message stamped at the same instant the cursor was
 * moved was, by construction, part of what that person just opened.
 */
export function countUnreadFor(
  viewer: ThreadRole,
  messages: readonly { authorRole: ThreadRole; createdAt: string }[],
  lastReadAt: string | null,
): number {
  const from: ThreadRole = viewer === "HOST" ? "RECIPIENT" : "HOST";
  const cursor = lastReadAt ? Date.parse(lastReadAt) : Number.NEGATIVE_INFINITY;
  // An unparseable cursor is treated as never-read rather than as "everything is read": showing a
  // message twice is recoverable, and silently hiding one somebody is waiting on is not.
  const since = Number.isNaN(cursor) ? Number.NEGATIVE_INFINITY : cursor;
  let n = 0;
  for (const m of messages) {
    if (m.authorRole !== from) continue;
    const at = Date.parse(m.createdAt);
    if (Number.isNaN(at) || at > since) n += 1;
  }
  return n;
}

/**
 * ★ THE HANDLED / REOPEN RULE, STATED ONCE.
 *
 * The existing model is untouched and still means exactly what it meant: `handled_at` is the moment
 * the OWNING Host settled this person's original QUESTION or HELP_NEEDED request, it is only
 * writable for those two responses, and it is never cleared by anything in this slice — acting on a
 * request is not permission to erase the record of having acted.
 *
 * What changes is that it no longer gets the last word. A recipient who sends a NEW message after
 * being marked handled is asking for something the Host has not answered, and a stale flag that
 * means "nothing left for me here" must not be allowed to hide them.
 *
 * So attention is the OR of two independent facts:
 *
 *   (a) the original request is open      response ∈ {QUESTION, HELP_NEEDED} and handledAt is null
 *   (b) they have said something new      unreadForHost > 0
 *
 * With no thread messages, (b) is always false and this returns exactly what the product returned
 * before — the existing behaviour is a special case of the new rule, not a thing replaced by it.
 */
export function recipientNeedsHostAttention(r: {
  response: string | null;
  handledAt: string | null;
  unreadForHost: number;
}): boolean {
  const openRequest = (r.response === "QUESTION" || r.response === "HELP_NEEDED") && r.handledAt === null;
  return openRequest || r.unreadForHost > 0;
}
