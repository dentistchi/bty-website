import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPublicSnapshot } from "@/lib/bty/foundry/events/foundryEventService";
import {
  verifyFoundryRoomToken,
} from "@/lib/bty/foundry/events/foundry-room-token";
import { participantCookieName } from "@/lib/bty/foundry/events/participant-session";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/public/[token] — the anonymous unified snapshot for the
 * QR landing page. Serves BOTH pre-join and room-restore: the client renders
 * from `room_state`. No auth (employees have no BTY account). Never exposes the
 * owner id, internal event id, roster, or another event. A returning visitor is
 * recognised via their per-event HttpOnly session cookie.
 */
function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return noStore(NextResponse.json({ error: "unavailable" }, { status: 503 }));

  const { token } = await ctx.params;

  // Resolve the per-event session cookie (needs the eventId from the token).
  let rawSession: string | null = null;
  const verified = verifyFoundryRoomToken(token);
  if (verified.ok) {
    rawSession = req.cookies.get(participantCookieName(verified.payload.eventId))?.value ?? null;
  }

  const snapshot = await getPublicSnapshot(admin, token, rawSession);
  return noStore(NextResponse.json(snapshot));
}
