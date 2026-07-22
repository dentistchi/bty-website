// Room Settings V1 — update a Room's guest-facing identity (Room Settings).
//
// POST (Host cookie + CSRF) /api/host/rooms/{slug}/settings
//   body: { name, guestWelcomeMessage? }
//   Authenticated owner → update display name + optional welcome → 303 back to the
//   settings page with a success notice.
//
// The full authorization chain is derived SERVER-SIDE, never from the body:
//   Host web session → canonical account → ACTIVE membership → workspace owns {slug}.
// Unknown Room and unauthorized Room are the SAME 404 (no room-existence oracle).
// Only `name` + `guestWelcomeMessage` are read; any slug/owner/account/workspace
// field in the payload is ignored. The slug is immutable here. Writes ONLY the
// karaoke_rooms row — creates/mutates ZERO Events and changes no session.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeHost, accountHasRoomAccess } from '@/lib/host-auth.server';
import { hostTokenFromRequest } from '@/lib/host-web-session.server';
import { verifyHostCsrf, csrfFromForm } from '@/lib/host-csrf.server';
import { getPublicRoomBySlug, updateRoomSettings, updateRoomTheme } from '@/lib/rooms.server';
import { RoomSettingsSchema } from '@/lib/validation';
import { normalizeTheme } from '@/domain/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const settingsUrl = (req: NextRequest, slug: string, notice: string) =>
  new URL(`/host/rooms/${encodeURIComponent(slug)}/settings?notice=${notice}`, req.nextUrl.origin);

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  // 1. Identity FIRST. No session → the root shows the login entry.
  const hostToken = hostTokenFromRequest(req);
  const account = await authorizeHost(hostToken);
  if (!account) return NextResponse.redirect(new URL('/', req.nextUrl.origin), 303);

  // 2. CSRF: Origin + session-bound token. SameSite=Lax is a mitigation, not the check.
  const form = await req.formData().catch(() => null);
  const csrf = await verifyHostCsrf(req, hostToken, csrfFromForm(form));
  if (!csrf.ok) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 403, headers: NO_STORE });
  }

  // 3. Ownership. Unknown Room and unauthorized Room are the SAME 404 — swapping the
  //    slug reveals nothing about which Rooms exist or who owns them.
  const room = await getPublicRoomBySlug(slug);
  if (!room || !(await accountHasRoomAccess(account.id, room.id))) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404, headers: NO_STORE });
  }

  // 4. Strict allowlist parse — ONLY name + guestWelcomeMessage. An empty/absent
  //    welcome normalizes to null. Anything else in the body is simply not read.
  const parsed = RoomSettingsSchema.safeParse({
    name: form?.get('name'),
    guestWelcomeMessage: form?.get('guestWelcomeMessage') ?? undefined,
  });
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.path[0] === 'guestWelcomeMessage');
    return NextResponse.redirect(settingsUrl(req, room.slug, tooLong ? 'bad_welcome' : 'bad_name'), 303);
  }

  const welcome = parsed.data.guestWelcomeMessage;
  await updateRoomSettings(room.id, {
    displayName: parsed.data.name,
    guestWelcomeMessage: welcome && welcome.length > 0 ? welcome : null,
  });

  // Preset theme (Room Branding V1): allowlist ONLY — any unknown/injected value
  // normalizes to the default, so raw CSS/colors can never be stored. Updated only
  // when the field is present, so a name/welcome save never resets the theme.
  const rawTheme = form?.get('theme');
  if (typeof rawTheme === 'string') await updateRoomTheme(room.id, normalizeTheme(rawTheme));

  // 5. Back to the settings page (canonical slug unchanged) with a success notice.
  const res = NextResponse.redirect(settingsUrl(req, room.slug, 'saved'), 303);
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
