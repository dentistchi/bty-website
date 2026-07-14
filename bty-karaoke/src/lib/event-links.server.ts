// URL + QR builders for events. Guests get a pretty, credential-free link
// (/j/<guestSlug>); the DJ-enrollment link REUSES the existing room pairing route
// (/r/<roomSlug>/dj/pair?token=…) so no new DJ flow is introduced. The room slug
// is derived deterministically from the public code — no extra query.

import { qrSvg } from './qr.server';
import { eventRoomSlug } from '@/domain/event-code';
import type { KaraokeEvent } from './events.server';

/** Public, credential-free guest join URL. */
export function guestUrlFor(origin: string, event: KaraokeEvent): string {
  return `${origin}/j/${encodeURIComponent(event.guest_slug)}`;
}

/** One-use DJ-enrollment URL (reuses the room pairing route). Carries the token. */
export function djEnrollUrlFor(origin: string, event: KaraokeEvent, token: string): string {
  const slug = eventRoomSlug(event.public_code);
  return `${origin}/r/${encodeURIComponent(slug)}/dj/pair?token=${encodeURIComponent(token)}`;
}

/** Guest URL + its QR SVG. */
export async function guestQrFor(origin: string, event: KaraokeEvent): Promise<{ url: string; qrSvg: string }> {
  const url = guestUrlFor(origin, event);
  return { url, qrSvg: await qrSvg(url) };
}

/** DJ-enrollment URL + its QR SVG for a freshly minted token. */
export async function djEnrollQrFor(
  origin: string,
  event: KaraokeEvent,
  token: string,
): Promise<{ url: string; qrSvg: string }> {
  const url = djEnrollUrlFor(origin, event, token);
  return { url, qrSvg: await qrSvg(url) };
}
