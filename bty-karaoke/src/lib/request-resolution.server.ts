// BUILD 25 — owner-only retrieval of a Guest's OWN resolved requests.
//
// WHY THIS IS A SEPARATE SURFACE. `GET /api/rooms/[slug]/requests/[id]` already reports a coarse
// terminal state, and it is PUBLIC — no capability check — so anyone holding a request id can
// call it. Attaching a resolution reason there would publish every Guest's outcome to every
// caller. Forensics flagged that route explicitly; this module exists so the reason travels ONLY
// on a path where ownership is proven first.
//
// THE OWNERSHIP PROOF is the capability already issued at submit (`signOwnerCapability`): a signed
// HMAC binding exactly one request id plus an expiry, held only by the device that submitted it.
// Nothing here trusts a caller-supplied owner id, guest name, session id, or event id — the only
// thing a caller can influence is WHICH request ids it asks about, and each of those must come
// with a valid signature for that exact id.

import { karaokeDb } from './supabase.server';
import { verifyOwnerCapability } from './capability.server';
import {
  RESOLVED_MAX,
  toDisplayResolution,
  type ResolvedRequestView,
} from '@/domain/request-resolution';

/** One (requestId, capability) pair as submitted by the client. */
export interface OwnedRequestClaim {
  requestId: string;
  token: string;
}

/**
 * Verify each claim independently and return ONLY the ids whose capability actually signs that
 * id. A caller mixing one valid claim with nine forged ones gets exactly one row back — the
 * forged ones are dropped silently rather than failing the whole call, because a partial answer
 * to an honest client (whose other capabilities may simply have expired) is more useful than an
 * error, and a dishonest client learns nothing either way.
 *
 * Verification happens BEFORE any database read, so an unproven id never reaches a query.
 */
export async function verifyOwnedClaims(
  claims: readonly OwnedRequestClaim[],
  nowMs = Date.now(),
): Promise<string[]> {
  const verified: string[] = [];
  for (const c of claims.slice(0, RESOLVED_MAX)) {
    if (typeof c?.requestId !== 'string' || typeof c?.token !== 'string') continue;
    // The capability binds the id, so a token valid for request A cannot vouch for request B.
    if (await verifyOwnerCapability(c.token, c.requestId, nowMs)) verified.push(c.requestId);
  }
  return verified;
}

/** The columns the projection needs. Selected explicitly — never `*` — so a column added to the
 *  table later cannot silently start reaching Guests. */
const RESOLVED_COLUMNS =
  'id, youtube_video_id, youtube_title, youtube_channel_title, youtube_thumbnail_url, ' +
  'status, resolution_code, resolved_at, event_id';

interface ResolvedRow {
  id: string;
  youtube_video_id: string | null;
  youtube_title: string | null;
  youtube_channel_title: string | null;
  youtube_thumbnail_url: string | null;
  status: string;
  resolution_code: string | null;
  resolved_at: string | null;
  event_id: string | null;
}

/**
 * Build the Guest-safe view KEY BY KEY.
 *
 * Deliberately not a spread or a delete-list: a field reaches a Guest only because someone wrote
 * a line for it here. That is what makes leakage a reviewable event rather than the default
 * behaviour of a widening `select`.
 */
function toView(r: ResolvedRow): ResolvedRequestView {
  return {
    requestId: r.id,
    videoId: r.youtube_video_id ?? null,
    title: r.youtube_title ?? null,
    channelTitle: r.youtube_channel_title ?? null,
    thumbnailUrl: r.youtube_thumbnail_url ?? null,
    // Narrowed by the query itself (`resolution_code is not null` implies a non-normal terminal
    // status via the DB CHECK), so this cast cannot smuggle 'waiting'/'playing'/'completed'.
    status: r.status === 'skipped' ? 'skipped' : 'removed',
    // A legacy null or an unrecognized future value becomes `unknown_resolution` — shown, never
    // dropped, and never guessed into one of the four real reasons.
    resolutionCode: toDisplayResolution(r.resolution_code),
    resolvedAt: r.resolved_at ?? null,
    eventId: r.event_id ?? null,
  };
}

/**
 * The resolved requests the caller has PROVEN it owns, within ONE canonical Event.
 *
 * Event scope comes from the server's canonical event for the room — never from the client — so a
 * caller cannot ask for another Event's rows by naming it, and a stale client still polling an old
 * Event cannot contaminate the new one. `eventId` null means a legacy eventless room, which scopes
 * to rows that likewise carry no event.
 *
 * Ordering is newest-resolution-first and stable, so repeated polls do not reshuffle the list.
 */
export async function listOwnedResolvedRequests(
  roomId: string,
  eventId: string | null,
  verifiedRequestIds: readonly string[],
): Promise<ResolvedRequestView[]> {
  if (verifiedRequestIds.length === 0) return [];

  let q = karaokeDb()
    .from('karaoke_requests')
    .select(RESOLVED_COLUMNS)
    .eq('room_id', roomId)
    .in('id', verifiedRequestIds.slice(0, RESOLVED_MAX) as string[])
    // Only genuinely resolved rows. An active request the caller also owns is simply absent,
    // which is what keeps the client's active and resolved collections mutually exclusive.
    .not('resolution_code', 'is', null);
  q = eventId === null ? q.is('event_id', null) : q.eq('event_id', eventId);

  const { data, error } = await q.order('resolved_at', { ascending: false }).limit(RESOLVED_MAX);
  if (error) throw error;
  return ((data ?? []) as unknown as ResolvedRow[]).map(toView);
}
