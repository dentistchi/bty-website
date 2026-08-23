// Admin: Start a New Event (V7 PART D — Event rotation).
//   POST -> create a fresh live Event for this room (new id, new guest_slug → new
//           Guest QR) and start a new karaoke-night session so guests can request
//           again. Idempotent: if a live Event already exists it is returned
//           unchanged (the one-live-per-room invariant is never violated), so a
//           double-tap is safe. The previous ended Event stays as history and its
//           old Guest QR can never join this new Event.
//
// Authorization is authorizeAdmin (room master credential OR an admin device) —
// this is a lifecycle action, never available to a plain guest or DJ device.

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeAdmin } from '@/lib/rooms.server';
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

  const auth = await authorizeAdmin(slug, bearer);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // BUILD 26U-R1 — same single entitlement decision as dj/start-event; only the auth
  // boundary above differs. Starting a hosted session is the paid act, and it is the only
  // place a Timed Access Pass starts its clock.
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
    auth.room.id, auth.room.display_name, 'admin-hub', release.contract,
  );
  if (!started.ok) {
    return NextResponse.json(
      { error: premiumRoomRefusalCopy(started.code), code: started.code },
      { status: premiumRoomRefusalStatus(started.code) },
    );
  }
  // A new night so guest requests are accepted for the new Event (the previous
  // session was ended together with the previous Event).
  const session = await startSession(auth.room.id);

  return NextResponse.json(
    {
      ok: true,
      event: publicEvent(started.event),
      session,
      premiumRoom: { activated: started.activated, expiresAt: started.expiresAt, source: started.source },
    },
    { status: 201 },
  );
}
