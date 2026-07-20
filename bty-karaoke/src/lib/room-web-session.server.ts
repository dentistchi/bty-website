// Short-lived, account-bound, Room-bound web credential for the browser Admin.
//
// NO MIGRATION: karaoke_dj_devices already satisfies every required invariant —
// opaque token stored only as a SHA-256 hash, room-bound (room_id), account-bound
// (account_id, added in Host Account V1), revocable (status), and carrying no Event
// or provider binding. A browser Room session is simply an account-bound device
// whose raw token lives in an HttpOnly cookie instead of the Keychain.
//
// Because authorizeDevice() filters by room_id, a cookie minted for Room A can
// never authorize Room B — presence of the cookie is never authority by itself.

import { NextRequest } from 'next/server';
import { randomToken } from './dj-auth.server';
import { createDeviceSession } from './devices.server';

export const ROOM_COOKIE = 'bty_room';
/** Bounded: the browser re-issues on entry, so this stays short. */
export const ROOM_SESSION_TTL_SECONDS = 12 * 60 * 60;

export function roomSessionCookie(req: NextRequest, value: string, maxAge = ROOM_SESSION_TTL_SECONDS) {
  return {
    name: ROOM_COOKIE,
    value,
    httpOnly: true,                                // never readable by JavaScript
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',                                     // the Admin page + /api/rooms/* both need it
    maxAge,
  };
}

export function clearedRoomCookie(req: NextRequest) {
  return { ...roomSessionCookie(req, '', 0), maxAge: 0 };
}

export function roomTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(ROOM_COOKIE)?.value ?? null;
}

/**
 * Mint a fresh account-bound admin credential for ONE room. Caller MUST have
 * already established: Host session -> account -> active membership -> workspace
 * owns this room. Creates no Event.
 */
export async function issueRoomWebSession(roomId: string, accountId: string): Promise<string> {
  const raw = randomToken(32);
  await createDeviceSession({
    roomId, rawToken: raw, role: 'admin',
    label: 'BTY Host Web', accountId,
  });
  return raw;
}
