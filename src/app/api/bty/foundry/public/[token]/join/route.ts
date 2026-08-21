import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { joinEvent } from "@/lib/bty/foundry/events/foundryEventService";
import { verifyFoundryRoomToken } from "@/lib/bty/foundry/events/foundry-room-token";
import {
  participantCookieName,
  PARTICIPANT_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/bty/foundry/events/participant-session";
import { setAuthCookie } from "@/lib/supabase/route-client";
import { authCookieSecureForRequest } from "@/lib/bty/cookies/authCookies";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/join — anonymous name-only join.
 *
 * No BTY account. Rate-limited per-IP (public write). On success sets a per-event
 * HttpOnly session cookie (raw token; only its hash is stored in the DB) so the
 * same device is restored on re-entry without re-entering a name. Idempotent for
 * a returning valid session (no duplicate participant). Rejects new joins on a
 * rotated QR or a closed event. Never echoes the join or session token.
 */
function jsonNoStore(body: unknown, status = 200): NextResponse {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

const REASON_STATUS: Record<string, number> = {
  name_required: 400,
  name_too_long: 400,
  event_closed: 409,
  qr_rotated: 410,
  inactive: 410,
  join_failed: 500,
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  // Rate limit the public write path (fails closed in staging/prod).
  const rl = await rateLimitKV({
    endpoint: "foundry_join",
    identifier: getCfClientIp(req),
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    const res = jsonNoStore({ ok: false, error: "rate_limited" }, 429);
    res.headers.set("Retry-After", String(rl.retryAfterSeconds));
    return res;
  }

  const { token } = await ctx.params;

  // Read the existing per-event session (if any) for idempotent re-join.
  let existingSession: string | null = null;
  const verified = verifyFoundryRoomToken(token);
  if (verified.ok) {
    existingSession = req.cookies.get(participantCookieName(verified.payload.eventId))?.value ?? null;
  }

  const body = await req.json().catch(() => ({}));
  /*
    OPTIONAL AUTH — the same read the three completion routes already ship (R4-R5C3A1).
    This route stays PUBLIC: no 401 gate, an anonymous caller resolves to null, and any failure
    degrades to null. It exists so the server can tell whether this browser's participant belongs
    to the account that is actually signed in (account-switch containment).
  */
  let authUserId: string | null = null;
  try {
    const supa = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    authUserId = user?.id ?? null;
  } catch {
    authUserId = null;
  }

  const result = await joinEvent(admin, token, body?.display_name, existingSession, authUserId);

  if (!result.ok) {
    return jsonNoStore({ ok: false, error: result.reason }, REASON_STATUS[result.reason] ?? 400);
  }

  const res = jsonNoStore({ ok: true, ...result.snapshot }, 200);
  // Set/refresh the per-event HttpOnly session cookie (raw token, never stored raw).
  setAuthCookie(
    res,
    participantCookieName(result.eventId),
    result.sessionToken,
    { maxAge: PARTICIPANT_COOKIE_MAX_AGE_SECONDS },
    authCookieSecureForRequest(req),
  );
  return res;
}
