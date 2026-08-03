// BUILD 25 — the ONE place a request's final disposition is named and worded.
//
// PURE — no DB, no network, no clock, no framework. Both the server projection and the web client
// import from here, and the native mirror (`RequestResolution` in GuestMode.swift) is held to the
// same table, so the three surfaces cannot drift into describing the same disposition differently.
//
// THE DISTINCTION THIS MODULE EXISTS TO PROTECT. `karaoke_requests.status` cannot carry WHY a row
// left the queue: three writers produce 'removed' (Guest cancel, Host remove, Event end) and three
// produce 'skipped' (Host skip of a waiting row, Host stop of a playing row, Event end). Telling a
// Guest they cancelled a song the Host removed is the specific failure this build exists to
// prevent, so the reason travels as a stable machine code written by the mutation that knows it.

/**
 * The four codes a server mutation may PERSIST. Each has exactly one production writer; none is
 * inferred, defaulted, or client-supplied.
 */
export const RESOLUTION_CODES = [
  'guest_cancelled',
  'host_removed',
  'host_skipped',
  'event_ended',
] as const;

export type ResolutionCode = (typeof RESOLUTION_CODES)[number];

/**
 * The projection fallback for a terminal row whose reason is null — a legacy row written before
 * this build, or a future writer this build does not know.
 *
 * DELIBERATELY NOT STORABLE. The database CHECK rejects it, because persisting it would erase the
 * difference between "no reason was ever recorded" and "the reason is genuinely unknown". It only
 * ever appears in a projection, and only to the verified owner.
 */
export const UNKNOWN_RESOLUTION = 'unknown_resolution' as const;

/** What a client renders: a real stored code, or the unknown fallback. */
export type DisplayResolution = ResolutionCode | typeof UNKNOWN_RESOLUTION;

/** True for a value this build may persist. Used to validate what came back from the database. */
export function isResolutionCode(v: unknown): v is ResolutionCode {
  return typeof v === 'string' && (RESOLUTION_CODES as readonly string[]).includes(v);
}

/**
 * Normalize a stored value into something renderable. A null (legacy) or unrecognized (future)
 * value degrades to `unknown_resolution` rather than being dropped — silence is the defect this
 * build is fixing, so an unexplained disposition must still be SHOWN, just honestly.
 */
export function toDisplayResolution(stored: unknown): DisplayResolution {
  return isResolutionCode(stored) ? stored : UNKNOWN_RESOLUTION;
}

/**
 * Korean copy, one sentence per disposition.
 *
 * Rules every line obeys:
 *   - no blame: the Host's action is stated as a fact, never as fault;
 *   - never claims completion — none of these songs completed;
 *   - never claims the Guest cancelled unless the Guest actually did;
 *   - no internal detail: no error text, no account id, no token, no Host identity.
 */
export const RESOLUTION_COPY: Readonly<Record<DisplayResolution, string>> = {
  guest_cancelled: '신청을 취소했어요.',
  host_removed: 'Host가 이 곡을 대기열에서 제거했어요.',
  host_skipped: 'Host가 이 곡의 재생을 종료했어요.',
  event_ended: '노래방이 종료되어 이 신청곡의 진행이 끝났어요.',
  // Says only what is certainly true. It never guesses which of the four actually happened.
  [UNKNOWN_RESOLUTION]: '이 곡은 더 이상 대기열에 없어요.',
};

/** The sentence for a stored value. Total: every input yields honest copy, never an empty string. */
export function resolutionCopy(stored: unknown): string {
  return RESOLUTION_COPY[toDisplayResolution(stored)];
}

/**
 * One VoiceOver / screen-reader label for a resolved card: what the song was, then what happened.
 * The reason comes last because it is the new information; the title identifies which card.
 */
export function resolutionAccessibilityLabel(title: string, stored: unknown): string {
  const t = title.trim();
  return `${t.length > 0 ? t : '신청곡'}. ${resolutionCopy(stored)}`;
}

/**
 * The exact Guest-safe shape the owner-only projection returns. Declared here so the route, the
 * web client, and the contract test all agree on ONE key list.
 *
 * Every field is already Guest-visible on the public queue surface. Deliberately absent — and
 * absent by construction, since the projection builds this object key by key rather than
 * spreading a row: account ids, guest session ids, Host identity, capability tokens or hashes,
 * segment/lease identifiers, admission internals, idempotency keys, and database error text.
 */
export interface ResolvedRequestView {
  requestId: string;
  videoId: string | null;
  title: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  status: 'removed' | 'skipped';
  resolutionCode: DisplayResolution;
  resolvedAt: string | null;
  eventId: string | null;
}

/** The allowlist, as data — the contract test asserts a response has exactly these keys. */
export const RESOLVED_VIEW_KEYS: readonly (keyof ResolvedRequestView)[] = [
  'requestId',
  'videoId',
  'title',
  'channelTitle',
  'thumbnailUrl',
  'status',
  'resolutionCode',
  'resolvedAt',
  'eventId',
];

/** How many resolved rows one owner-only call may return. Bounded so a caller cannot */
/** turn the endpoint into a bulk reader, and so the client's list stays renderable. */
export const RESOLVED_MAX = 50;

// ── Client merge rules (pure) ──────────────────────────────────────────────────────────────────
//
// Both Guest clients keep two collections keyed by requestId, and the SAME rules govern both.
// Native mirrors this function; the web imports it directly.

/** The minimum an active row needs for the merge. Keyed by requestId — NEVER by videoId. */
export interface ActiveEntry {
  requestId: string;
}

export interface ResolutionMergeResult<A extends ActiveEntry> {
  active: A[];
  resolved: ResolvedRequestView[];
}

/**
 * Merge a freshly polled active snapshot with the known resolutions.
 *
 * THE RULES, and why each exists:
 *
 *   - RESOLUTION WINS. A request that appears in BOTH is removed from `active`. A poll in flight
 *     when the Host acted still describes the request as waiting; letting that win would make a
 *     resolved song flicker back into the queue — the "stale poll resurrects it" failure.
 *   - MUTUALLY EXCLUSIVE. A requestId is in exactly one collection, always.
 *   - NO DUPLICATES. Resolutions are deduplicated by requestId, so repeated polls returning the
 *     same result do not stack cards.
 *   - REQUEST IDENTITY, NOT MEDIA IDENTITY. Everything keys on requestId. Re-requesting the same
 *     video creates a genuinely different request that must stay independently active while the
 *     old one stays resolved — keying on videoId would collapse the two and let one song's
 *     outcome overwrite the other's.
 *   - ACCUMULATIVE. Previously known resolutions survive a poll that does not mention them; the
 *     owner-only endpoint returns only what the client still holds capabilities for, and a
 *     capability expiring must not erase an explanation already shown.
 *
 * Newest resolution first, with a stable tie-break on requestId so equal timestamps cannot
 * reshuffle the list between polls.
 */
export function mergeResolutions<A extends ActiveEntry>(
  activeSnapshot: readonly A[],
  knownResolved: readonly ResolvedRequestView[],
  incomingResolved: readonly ResolvedRequestView[],
): ResolutionMergeResult<A> {
  const byId = new Map<string, ResolvedRequestView>();
  // Incoming last so a fresher server view replaces a stale cached one for the same request.
  for (const r of knownResolved) byId.set(r.requestId, r);
  for (const r of incomingResolved) byId.set(r.requestId, r);

  const resolved = [...byId.values()].sort((a, b) => {
    const at = a.resolvedAt ?? '';
    const bt = b.resolvedAt ?? '';
    if (at !== bt) return at < bt ? 1 : -1;
    return a.requestId < b.requestId ? -1 : a.requestId > b.requestId ? 1 : 0;
  });

  return { active: activeSnapshot.filter((a) => !byId.has(a.requestId)), resolved };
}

/**
 * Whether stored resolutions may carry over into the Event now in force.
 *
 * Event isolation is a CLIENT-side scope decision as well as a server one: a genuinely different
 * Event must start with an empty result list, or last night's cancellations reappear under
 * tonight's room. A null/unknown incoming Event is treated as "not a different Event" so a
 * transient read that omits the id cannot wipe a Guest's history; a real change always clears.
 */
export function resolutionsSurviveEvent(
  storedEventId: string | null | undefined,
  currentEventId: string | null | undefined,
): boolean {
  if (currentEventId == null || storedEventId == null) return true;
  return storedEventId === currentEventId;
}
