/**
 * Tracked Announcement — PURE domain. Slice A1.
 *
 * No I/O, no DB, no display strings. This file owns three things that must never be re-derived at
 * a call site: what a response is allowed to be, what the Host's five buckets mean, and what a
 * recipient is allowed to see.
 *
 * WHAT A RESPONSE PROVES, STATED ONCE SO NO SURFACE CAN OVERSTATE IT:
 *
 *   ACKNOWLEDGED  a person explicitly tapped "Got it" at a timestamp.
 *   QUESTION      the same, plus they declared their understanding is not closed.
 *   HELP_NEEDED   the same, plus they declared a barrier to applying it.
 *
 * NONE of them proves the message was read, understood, agreed with, complied with, or acted on.
 * There is deliberately no fourth value meaning "seen", because delivery is not a response and
 * BTY has no way to observe it. This is NOT an Evidence Ladder rung and this module does not
 * import that vocabulary — an announcement is not training.
 */

export const ANNOUNCEMENT_RESPONSES = ["ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"] as const;
export type AnnouncementResponse = (typeof ANNOUNCEMENT_RESPONSES)[number];

export const QUESTION_TEXT_MAX = 1000;
export const HOST_FRAMING_MAX = 1000;

export function isAnnouncementResponse(v: unknown): v is AnnouncementResponse {
  return typeof v === "string" && (ANNOUNCEMENT_RESPONSES as readonly string[]).includes(v);
}

/** Entra object ids and tenant ids are GUIDs. Anything else is not an identity. */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Canonicalize the People Picker's submitted value into a deterministic recipient set.
 *
 * The control returns a COMMA-SEPARATED string of Microsoft Entra IDs when `isMultiSelect` is
 * true, and a bare id when it is false — so both shapes are accepted. The result is lowercased,
 * de-duplicated and order-stable, because:
 *
 *   * a duplicate would inflate the denominator against a set that cannot contain the same person
 *     twice (the table's UNIQUE would reject the second row and the count would then disagree with
 *     what the Host was told);
 *   * casing must not be able to defeat that uniqueness;
 *   * anything that is not a GUID is not an identity, and is dropped rather than stored as one.
 *
 * Returns an empty array for anything unusable — an announcement with no audience is refused
 * upstream rather than created with a denominator of zero.
 */
export function parsePickedRecipients(raw: unknown): string[] {
  const text =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw.filter((v) => typeof v === "string").join(",") : "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(",")) {
    const id = part.trim().toLowerCase();
    if (!GUID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** The Host's own words. Bounded, trimmed, and never empty. */
export function normalizeHostFraming(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length < 1 || s.length > HOST_FRAMING_MAX) return null;
  return s;
}

/** Optional, and ONLY meaningful for QUESTION. */
export function normalizeQuestionText(raw: unknown, response: AnnouncementResponse): string | null {
  if (response !== "QUESTION") return null;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length < 1 || s.length > QUESTION_TEXT_MAX) return null;
  return s;
}

/** One recipient, as the Host's outcome read sees them. */
export type RecipientFact = {
  /** Null until this person's first canonical BTY entry. */
  readonly boundUserId: string | null;
  readonly response: AnnouncementResponse | null;
};

/**
 * The five buckets. They are counts, never a score.
 *
 * ★ `notYetActivated` IS NOT `noResponse`, AND THE DIFFERENCE IS THE PRODUCT.
 *
 * A Host may legitimately choose a colleague who has never opened BTY. That person has no usable
 * response path yet — they have not declined to answer, they have not been asked in a way they
 * could answer. Counting them as silence would report platform onboarding as a human choice, and
 * it would do it in the one place a Host is deciding who to follow up with.
 *
 * So `noResponse` requires a BOUND user: a person who could have answered and has not. There is
 * deliberately no combined total, no percentage and no "engagement" figure anywhere in this file —
 * a Host who is shown one number has been told something nobody measured.
 */
export type AnnouncementFunnel = {
  readonly announcedTo: number;
  readonly gotIt: number;
  readonly question: number;
  readonly needHelp: number;
  readonly noResponse: number;
  readonly notYetActivated: number;
};

export function summariseAnnouncement(
  resolvedCount: number,
  recipients: readonly RecipientFact[],
): AnnouncementFunnel {
  let gotIt = 0;
  let question = 0;
  let needHelp = 0;
  let noResponse = 0;
  let notYetActivated = 0;

  for (const r of recipients) {
    if (r.response === "ACKNOWLEDGED") gotIt += 1;
    else if (r.response === "QUESTION") question += 1;
    else if (r.response === "HELP_NEEDED") needHelp += 1;
    else if (r.boundUserId) noResponse += 1;
    // Unbound AND unanswered: not silence, not yet reachable.
    else notYetActivated += 1;
  }

  return { announcedTo: resolvedCount, gotIt, question, needHelp, noResponse, notYetActivated };
}

/**
 * The five buckets must account for every recipient, exactly once.
 *
 * Exported so the Host surface can refuse to render a funnel that does not add up rather than
 * display one that quietly loses a person.
 */
export function funnelIsComplete(f: AnnouncementFunnel): boolean {
  return f.gotIt + f.question + f.needHelp + f.noResponse + f.notYetActivated === f.announcedTo;
}

/**
 * WHAT A RECIPIENT IS ALLOWED TO SEE — the privacy boundary, as a pure whitelist.
 *
 * ★ BTY AUDIENCE MEMBERSHIP DOES NOT PROVE TEAMS SOURCE ACCESS.
 *
 * The source may be a private-channel post. Being selected into a BTY audience says the Host chose
 * you; it says nothing about whether Teams would let you read the original. So the captured message
 * body is NEVER projected to a recipient — they see the Host's own framing instead, which the Host
 * wrote knowing who would read it.
 *
 * The link is included when present because TEAMS remains the authority on it: an `Open in Teams`
 * URL opens Teams, and Teams decides whether that person may see the message. Handing over the
 * BODY would bypass that decision; handing over the LINK defers to it.
 *
 * Internal Microsoft identifiers never cross this line either — tenant, conversation, channel and
 * chat ids, and the capture's external key, are provenance for BTY, not content for a person.
 */
export type RecipientProjection = {
  readonly announcementId: string;
  readonly hostFraming: string;
  readonly hostDisplay: string | null;
  readonly sourceUrl: string | null;
  readonly response: AnnouncementResponse | null;
  readonly respondedAt: string | null;
};

/** Only `https:` and Teams' own scheme may become a tappable link. */
export function safeSourceUrl(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  return /^(https:\/\/|msteams:)/i.test(s) ? s : null;
}

export function projectForRecipient(row: {
  announcementId: string;
  hostFraming: string;
  hostDisplay?: unknown;
  sourceUrl?: unknown;
  response?: unknown;
  respondedAt?: unknown;
}): RecipientProjection {
  return {
    announcementId: row.announcementId,
    hostFraming: row.hostFraming,
    hostDisplay: typeof row.hostDisplay === "string" && row.hostDisplay.trim() ? row.hostDisplay.trim() : null,
    sourceUrl: safeSourceUrl(row.sourceUrl),
    response: isAnnouncementResponse(row.response) ? row.response : null,
    respondedAt: typeof row.respondedAt === "string" ? row.respondedAt : null,
  };
}
