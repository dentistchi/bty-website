import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/supabase/route-client";
import { authCookieSecureForRequest } from "@/lib/bty/cookies/authCookies";
import { verifyFoundryRoomToken } from "./foundry-room-token";
import {
  participantCookieName,
  PARTICIPANT_COOKIE_MAX_AGE_SECONDS,
} from "./participant-session";

/**
 * Shared helpers for the anonymous public routes (`/api/bty/foundry/public/*`).
 * These routes have NO auth gate — identity is the signed join token + the
 * per-event participant session cookie. Nothing here trusts client state beyond
 * the opaque session token (whose hash the service re-checks against the DB).
 */

export function jsonNoStore(body: unknown, status = 200): NextResponse {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * The header a framed client presents its participant session in, when a cookie cannot travel.
 *
 * TEAMS-NATIVE DELIVERY V1. `/teams` is a third-party browsing context: Teams iOS blocks
 * third-party cookies and storage partitioning makes anything durable unreliable there, which is
 * why the tab's Supabase session is already memory-only. The participant session has exactly the
 * same problem, so the Teams learner presents it explicitly instead.
 *
 * This is NOT a second identity. It is the same opaque capability the cookie carries, over the
 * same same-origin request, and it is resolved the same way: hashed, then looked up SCOPED BY THE
 * EVENT the join token names (`findParticipantBySession` filters on `event_id`). A session minted
 * for event A therefore resolves nothing when presented with event B's token.
 */
export { PARTICIPANT_SESSION_HEADER } from "./publicRoute.shared";
import { PARTICIPANT_SESSION_HEADER } from "./publicRoute.shared";

/**
 * Read the participant session for a given join token, if valid.
 *
 * COOKIE FIRST and unchanged — every existing web and native caller behaves exactly as before.
 * The header is consulted ONLY when no cookie is present, so a framed client can be recognised
 * without changing what an unframed one does.
 */
export function readParticipantSession(req: NextRequest, token: string): string | null {
  const verified = verifyFoundryRoomToken(token);
  if (!verified.ok) return null;
  const cookie = req.cookies.get(participantCookieName(verified.payload.eventId))?.value;
  if (cookie) return cookie;
  const header = req.headers.get(PARTICIPANT_SESSION_HEADER);
  return header && header.trim().length > 0 ? header.trim() : null;
}

/** Set/refresh the per-event HttpOnly participant session cookie (raw token; hash-only in DB). */
export function setParticipantSessionCookie(
  res: NextResponse,
  req: NextRequest,
  eventId: string,
  sessionToken: string,
): void {
  setAuthCookie(
    res,
    participantCookieName(eventId),
    sessionToken,
    { maxAge: PARTICIPANT_COOKIE_MAX_AGE_SECONDS },
    authCookieSecureForRequest(req),
  );
}

/** Map service reason codes → HTTP status for the public routes. */
export const PUBLIC_REASON_STATUS: Record<string, number> = {
  // join
  name_required: 400,
  name_too_long: 400,
  // progress / completion
  response_required: 400,
  response_too_long: 400,
  // Slice 3.2M-1 — the program asked for a decision and none was given.
  decision_required: 400,
  video_not_complete: 409,
  reading_not_complete: 409,
  not_completed: 409,
  no_session: 401,
  removed: 403,
  event_closed: 409,
  qr_rotated: 410,
  inactive: 410,
  document_unavailable: 404,
  /*
    R4-R2G. `guidance_not_declared` is 409 for the same reason `reading_not_complete` is: the
    request is well-formed and the room is fine, but the learner has not yet made the exposure
    declaration this content type completes through.
  */
  guidance_not_declared: 409,
  /* Teams-native room open (Slice Teams-Native Delivery V1). */
  unauthenticated: 401,
  target_invalid: 400,
  participant_write_failed: 500,
  participant_unresolved: 500,
  unsupported_room: 409,
  guidance_unavailable: 404,
  study_required: 409,
  quiz_missing: 404,
  /* The room is completed by its quiz; the written-response path is not the way out of it. */
  quiz_required: 409,
  attempt_write_failed: 500,
  completion_write_failed: 500,
  attempt_mismatch: 409,
  award_failed: 500,
  progress_failed: 500,
  join_failed: 500,
};
