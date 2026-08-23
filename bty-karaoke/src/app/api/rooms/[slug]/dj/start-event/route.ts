// Start a New Event from the DJ device (Event Lifecycle V1). The SYMMETRIC
// counterpart of dj/end-event: it lets the single enrolled Admin iPad (a dj-role
// device) rotate to a fresh Event on the SAME room WITHOUT a manager re-login,
// exactly as it can already END the Event from that device.
//
// Reuses the canonical services (startNewEvent + startSession) — the same ones
// admin/start-event calls; the ONLY difference is the auth boundary. admin/start-
// event uses authorizeAdmin (admin-role devices / master credential only), which
// REJECTS dj-role devices, so the iPad running the show could never reach it. This
// route uses authorizeDj (room master credential OR an ACTIVE dj/admin device
// scoped to this room), matching dj/end-event. Idempotent + double-tap safe:
// startNewEvent returns the existing live Event unchanged if one already exists, so
// two taps (or a lost response the client retries) never create two live Events.

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj } from '@/lib/rooms.server';
import { startHostedRoomSession, publicEvent } from '@/lib/events.server';
import { premiumRoomRefusalCopy, premiumRoomRefusalStatus } from '@/domain/premium-room-copy';
import { resolveRoomRelease } from '@/lib/release-contract.server';
import { CLIENT_UPDATE_REQUIRED_CODE, CLIENT_UPDATE_REQUIRED_KO } from '@/domain/release-contract';
import { startSession } from '@/lib/sessions.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const bearer = roomCredentialFromRequest(req);
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await authorizeDj(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // BUILD 26U-R1 — starting a hosted session IS the paid act, so this is the one
  // entitlement decision on this route. Idempotent as before: a live Event is returned
  // unchanged (one-live-per-room preserved) and NOTHING is activated, so a double-tap can
  // never spend a second pass. Otherwise a brand-new Event (new id + new guest_slug → new
  // Guest QR) is created inside the SAME transaction that starts the pass clock.
  // BUILD 26U-R2 — the release contract decides WHICH contract this start runs under, and is
  // threaded into the RPC so the decision and the Event write share one transaction. It can
  // never grant entitlement: on 'legacy' the RPC skips the entitlement read AND the activation.
  const release = await resolveRoomRelease(req, auth.room.id);
  if (release.contract === 'unsupported') {
    return NextResponse.json(
      { error: CLIENT_UPDATE_REQUIRED_KO, code: CLIENT_UPDATE_REQUIRED_CODE },
      { status: 409 },
    );
  }
  const started = await startHostedRoomSession(
    auth.room.id, auth.room.display_name, 'dj-device', release.contract,
  );
  if (!started.ok) {
    return NextResponse.json(
      { error: premiumRoomRefusalCopy(started.code), code: started.code },
      { status: premiumRoomRefusalStatus(started.code) },
    );
  }
  // A fresh night so guest requests are accepted again for the new Event.
  const session = await startSession(auth.room.id);

  return NextResponse.json(
    {
      ok: true,
      event: publicEvent(started.event),
      session,
      // The Host is told what their session is worth the moment it opens, from the
      // authority's own numbers. `activated` distinguishes "your pass just started" from
      // "you rejoined a session that was already running".
      premiumRoom: { activated: started.activated, expiresAt: started.expiresAt, source: started.source },
    },
    { status: 201 },
  );
}
