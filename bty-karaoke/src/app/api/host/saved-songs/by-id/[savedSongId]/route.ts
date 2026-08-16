// My Songs — remove one saved song by its STABLE BTY row id (BUILD 26T-R1B-R6-R1B-R6 §F).
//
// DELETE /api/host/saved-songs/by-id/{savedSongId} (web cookie OR native Bearer host session)
//   -> remove the row from the CALLER's library. Scoped by (id, account_id); idempotent —
//   deleting an absent or another account's row returns the same success and reveals nothing
//   about whether such a row exists. Uniform 401; no-store.
//
// WHY THIS ROUTE EXISTS. The videoId-keyed route cannot address a row whose retention transition
// set `video_id` to NULL, which would leave the owner permanently unable to delete their own
// library entry. This is strictly ADDITIVE: `/api/host/saved-songs/{videoId}` is unchanged and
// keeps working for build 106 and every legacy client.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { deleteSavedSongById } from '@/lib/saved-songs.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

/** Canonical UUID form. A malformed id fails CLOSED — it never reaches the database. */
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ savedSongId: string }> }) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const { savedSongId } = await ctx.params;
  if (!UUID.test(savedSongId ?? '')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const result = await deleteSavedSongById(acct.id, savedSongId);
  return NextResponse.json(result, { headers: NO_STORE });
}
