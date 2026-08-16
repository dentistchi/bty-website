// My Songs — account-scoped saved-song library (BUILD 20A).
//
// POST (web cookie OR native Bearer host session) { videoId, title, artist?, thumbnailUrl? }
//   -> save one song into the caller's library (idempotent on account+videoId).
// GET  -> list the caller's saved songs, newest first.
//
// The account is ALWAYS derived server-side from the session; the body's ownership
// fields (accountId/roomId/eventId/…) are REJECTED by the strict schema. Room/Event/
// Queue/entitlement are never read or touched. Uniform 401; no-store; no email/subject
// or internal identity is ever returned.

import { NextRequest, NextResponse } from 'next/server';
import { bearerFromHeader } from '@/lib/dj-auth.server';
import { authorizeHost } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { SaveSongSchema } from '@/lib/validation';
import { saveSavedSong, listSavedSongs } from '@/lib/saved-songs.server';
import { verifyYouTubeProvenance } from '@/lib/youtube-provenance.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

async function account(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get('authorization')) ?? hostTokenFromRequest(req);
  return authorizeHost(token);
}

export async function POST(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = SaveSongSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }

  // Account comes from the session — NEVER the body (parsed via .strict()).
  const savedSong = await saveSavedSong(acct.id, {
    videoId: parsed.data.videoId,
    title: parsed.data.title,
    artist: parsed.data.artist ?? null,
    thumbnailUrl: parsed.data.thumbnailUrl ?? null,
    // BUILD 26T-R1B-R6-R1B-R3 — verifier-sealed instant only. Built from the SAME values persisted
    // above, so a client cannot have one snapshot checked and another stored.
    youtubeMetadataFetchedAt: await verifyYouTubeProvenance(parsed.data.youtubeProvenance, {
      videoId: parsed.data.videoId,
      title: parsed.data.title,
      channelTitle: parsed.data.artist ?? null,
      thumbnailUrl: parsed.data.thumbnailUrl ?? null,
    }),
  });
  return NextResponse.json({ savedSong }, { headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  const acct = await account(req);
  if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const savedSongs = await listSavedSongs(acct.id);
  return NextResponse.json({ savedSongs }, { headers: NO_STORE });
}
