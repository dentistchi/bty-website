// V6 SINGLE ADMIN PLAYER — guest self-finish is REMOVED. The Admin Player ends
// the song ("차례 넘기기") after stopping the video on the TV. This route is closed
// (410) so no client — including an old cached guest page — can complete the
// playing song. Guests can still cancel their own WAITING request (that route is
// unchanged).

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST() {
  return NextResponse.json(
    {
      error: 'The Admin passes the turn from the player — not from a guest phone.',
      code: 'GUEST_FINISH_REMOVED',
    },
    { status: 410, headers: NO_STORE },
  );
}
