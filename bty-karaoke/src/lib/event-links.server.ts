// URL + QR builders for events. Guests get a pretty, credential-free link
// (/j/<guestSlug>, keyed on the event's real guest_slug column); the DJ-enrollment
// link REUSES the existing room pairing route (/r/<roomSlug>/dj/pair?token=…). The
// room slug MUST be the canonical one (karaoke_rooms.slug for the event's room_id,
// resolved by the caller via eventRoomSlugOf) — NEVER derived from the public code,
// which is wrong for an event on a pre-existing room and yields a dead route.

import { qrSvg } from './qr.server';
import type { KaraokeEvent } from './events.server';

/** Public, credential-free guest join URL (keyed on the event's real guest_slug). */
export function guestUrlFor(origin: string, event: KaraokeEvent): string {
  return `${origin}/j/${encodeURIComponent(event.guest_slug)}`;
}

/** One-use DJ-enrollment URL. `roomSlug` MUST be the canonical room slug. */
export function djEnrollUrlFor(origin: string, roomSlug: string, token: string): string {
  return `${origin}/r/${encodeURIComponent(roomSlug)}/dj/pair?token=${encodeURIComponent(token)}`;
}

/** Guest URL + its QR SVG. */
export async function guestQrFor(origin: string, event: KaraokeEvent): Promise<{ url: string; qrSvg: string }> {
  const url = guestUrlFor(origin, event);
  return { url, qrSvg: await qrSvg(url) };
}

/** DJ-enrollment URL + its QR SVG for a freshly minted token. `roomSlug` canonical. */
export async function djEnrollQrFor(
  origin: string,
  roomSlug: string,
  token: string,
): Promise<{ url: string; qrSvg: string }> {
  const url = djEnrollUrlFor(origin, roomSlug, token);
  return { url, qrSvg: await qrSvg(url) };
}
