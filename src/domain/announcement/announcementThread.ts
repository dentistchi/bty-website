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
 * ★ WHY THIS TAKES A SET OF READ MESSAGE IDS AND NOT A TIMESTAMP CURSOR.
 *
 * The first version compared each message's `created_at` against a per-side "last read" timestamp.
 * That is unsound under MVCC, and not in a corner case:
 *
 *     T1 begins, inserts a message stamped 10:00:00, and does not commit
 *     T2 begins at 10:00:05, sees nothing, and stores its cursor as 10:00:05
 *     T1 commits — the message lands, still stamped 10:00:00
 *     => created_at < cursor, so it counts as READ, permanently
 *
 * A person is told nobody is waiting on them while somebody is. No later action repairs it, because
 * the cursor only moves forward. Any monotonic proxy — `clock_timestamp()`, a sequence — fails
 * identically, because the defect is commit order versus stamp order, not resolution.
 *
 * So the authority is a RECEIPT PER MESSAGE. A receipt can only be written for a row the writer's
 * snapshot actually contained, so the invisible message simply has none and stays unread. Proven
 * against a real PostgreSQL server in `threadPostgres.pg.test.ts`.
 */
export function countUnreadFor(
  viewer: ThreadRole,
  messages: readonly { messageId: string; authorRole: ThreadRole }[],
  readMessageIds: ReadonlySet<string>,
): number {
  const from: ThreadRole = viewer === "HOST" ? "RECIPIENT" : "HOST";
  let n = 0;
  for (const m of messages) {
    if (m.authorRole !== from) continue;
    if (!readMessageIds.has(m.messageId)) n += 1;
  }
  return n;
}

/**
 * ★ THE HANDLED / REOPEN RULE, STATED ONCE.
 *
 * `handled_at` still means exactly what it meant: the moment the OWNING Host settled this person's
 * QUESTION or HELP_NEEDED request. It is still only writable for those two responses, and the
 * explicit `bty_handle_announcement_recipient` is still the only thing that SETS it.
 *
 * What changed after the production audit is that a new RECIPIENT message now CLEARS it, in the same
 * database transaction that appends the message. An earlier design left the flag standing and merely
 * out-ranked it here — which meant the stored state still said "settled" while the product behaved
 * as though it were not, and any surface that read the column directly disagreed with any surface
 * that read this rule. One fact, one place.
 *
 * READING IS NOT RESOLVING, and that is enforced in SQL too: `bty_mark_announcement_thread_read`
 * does not touch `handled_at`, so a Host opening a conversation never marks it dealt with.
 *
 * Attention therefore remains the OR of two independent facts:
 *
 *   (a) the original request is open      response ∈ {QUESTION, HELP_NEEDED} and handledAt is null
 *   (b) they have said something new      unreadForHost > 0
 *
 * (b) is still load-bearing rather than implied by (a): a recipient who answered ACKNOWLEDGED can
 * never satisfy (a) — the schema forbids `handled_at` on that response — yet a message from them
 * is still something the Host has not answered.
 *
 * ★ WHAT IS LOST, STATED PLAINLY. Clearing the column discards WHEN the Host had settled it. Only
 * the reopen is recorded, not the history of having handled it before. `response`, `responded_at`,
 * `question_text` and every message are untouched, so what the person actually SAID is fully
 * preserved; if the audit of Host actions is later needed, that is an append-only log of its own,
 * not a flag that has to mean two things at once.
 */
export function recipientNeedsHostAttention(r: {
  response: string | null;
  handledAt: string | null;
  unreadForHost: number;
}): boolean {
  const openRequest = (r.response === "QUESTION" || r.response === "HELP_NEEDED") && r.handledAt === null;
  return openRequest || r.unreadForHost > 0;
}
