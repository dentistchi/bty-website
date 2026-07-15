// V6 SINGLE ADMIN PLAYER — guest self-start is REMOVED. Only the one Admin Player
// starts songs on the TV (via the admin-authorized action). This route is closed
// so no client — including an old cached guest page — can promote a song to the
// stage. Guests now only signal Ready (/ready); the Admin starts. Kept as a 410
// (not deleted) so a stale client gets a clear, honest refusal, never a 404 that
// looks like a transient error.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST() {
  return NextResponse.json(
    {
      error: 'Songs are started by the Admin on the TV — not from a guest phone.',
      code: 'GUEST_START_REMOVED',
    },
    { status: 410, headers: NO_STORE },
  );
}
