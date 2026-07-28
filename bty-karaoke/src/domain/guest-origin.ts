// Canonical Guest-facing WEB origin (BUILD 20B-R1 QR hotfix). Every guest-scannable QR /
// share link (/r/<slug>, /j/<guestSlug>, /r/<slug>/display, DJ pair) MUST encode the ONE public
// production origin — NEVER req.nextUrl.origin / Host / X-Forwarded-Host, which is the deployed
// workers.dev origin (or localhost in dev) and leaks a development host into a printed/scanned QR.
//
// This mirrors CANONICAL_APP_LINK_ORIGIN (app-link.ts): the Worker is reachable on BOTH
// norebang.btydaily.com and *.workers.dev, so pinning the guest origin to the custom domain is
// always resolvable and never regresses slug/event resolution.

export const CANONICAL_GUEST_ORIGIN = 'https://norebang.btydaily.com';
export const CANONICAL_GUEST_HOST = 'norebang.btydaily.com';

/**
 * The single fixed production origin for guest-facing links. A DEV build MAY override it via
 * KARAOKE_PUBLIC_ORIGIN (e.g. an https tunnel or http://localhost for LAN testing) — but a
 * workers.dev / *.pages.dev / staging value is REJECTED, so a development origin can never leak
 * into a Release QR. Production leaves the env unset and always gets the canonical host.
 */
export function canonicalGuestOrigin(): string {
  const raw = process.env.KARAOKE_PUBLIC_ORIGIN?.trim();
  if (raw) {
    try {
      const u = new URL(raw);
      const host = u.host.toLowerCase();
      const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      const isForbidden =
        host.endsWith('workers.dev') || host.endsWith('pages.dev') || host.includes('staging');
      if (!isForbidden && (u.protocol === 'https:' || isLocal)) {
        return `${u.protocol}//${u.host}`;
      }
    } catch {
      // fall through to the canonical constant
    }
  }
  return CANONICAL_GUEST_ORIGIN;
}

/** Canonical guest ROOM URL: `https://norebang.btydaily.com/r/<slug>` (+ `?e=<eventId>`). */
export function canonicalGuestRoomUrl(slug: string, eventId?: string | null): string {
  const base = `${canonicalGuestOrigin()}/r/${encodeURIComponent(slug)}`;
  const e = (eventId ?? '').trim();
  return e ? `${base}?e=${encodeURIComponent(e)}` : base;
}
