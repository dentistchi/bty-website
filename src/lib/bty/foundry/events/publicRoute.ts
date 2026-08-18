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

/** Read the per-event participant session cookie for a given join token, if valid. */
export function readParticipantSession(req: NextRequest, token: string): string | null {
  const verified = verifyFoundryRoomToken(token);
  if (!verified.ok) return null;
  return req.cookies.get(participantCookieName(verified.payload.eventId))?.value ?? null;
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
  guidance_unavailable: 404,
  award_failed: 500,
  progress_failed: 500,
  join_failed: 500,
};
