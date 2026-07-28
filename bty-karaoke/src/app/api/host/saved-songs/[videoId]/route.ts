// My Songs — remove one saved song (BUILD 20A).
//
// DELETE /api/host/saved-songs/{videoId} (web cookie OR native Bearer host session)
//   -> remove the song from the CALLER's library. Scoped by (account_id, video_id);
//   idempotent — deleting an absent or another account's row returns the same success
//   and reveals nothing about whether such a row exists. Uniform 401; no-store.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { deleteSavedSong } from '@/lib/saved-songs.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ videoId: string }> }) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const { videoId } = await ctx.params;
  if (!YOUTUBE_VIDEO_ID.test(videoId ?? '')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  const result = await deleteSavedSong(acct.id, videoId);
  return NextResponse.json(result, { headers: NO_STORE });
}
