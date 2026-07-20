// V5 security / no-inference guards. The canonical event MUST be resolved
// deterministically from the room (1:1) — never by "latest event", "first active
// session", or "current session" recency inference — and the honest reject gate
// must run on the operational read/write paths. Pinned to source so a regression
// fails CI.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)); // src/
const R = (p: string) => readFileSync(root + p, 'utf8');
const events = R('lib/events.server.ts');
const guestReq = R('app/api/rooms/[slug]/requests/route.ts');
const displayRoute = R('app/api/rooms/[slug]/display/route.ts');
const adminSession = R('app/api/rooms/[slug]/admin/session/route.ts');
const djQueue = R('app/api/rooms/[slug]/dj/queue/route.ts');
const guestQr = R('app/api/rooms/[slug]/guest-qr/route.ts');

/** Body of a top-level `export async function NAME` up to the next `export`. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  if (start < 0) return '';
  const rest = src.slice(start + name.length);
  const nextExport = rest.indexOf('\nexport ');
  return nextExport < 0 ? rest : rest.slice(0, nextExport);
}

describe('canonical event resolver is deterministic (no recency inference)', () => {
  it('getCanonicalEvent resolves the ONE live event deterministically (room_id + live status, maybeSingle)', () => {
    expect(events).toContain('export async function getCanonicalEvent');
    const body = fnBody(events, 'getCanonicalEvent');
    expect(body).toMatch(/\.eq\('room_id'/);
    expect(body).toMatch(/\.in\('status'/);
    expect(body).toContain('maybeSingle');
    expect(body).not.toMatch(/\.order\(/);
    expect(body).not.toMatch(/\.limit\(/);
  });

  it('getEventByRoomId selects by room_id with maybeSingle — no order/limit recency pick', () => {
    const body = fnBody(events, 'getEventByRoomId');
    expect(body).toMatch(/\.eq\('room_id'/);
    expect(body).toContain('maybeSingle');
    expect(body).not.toMatch(/\.order\(/);
    expect(body).not.toMatch(/\.limit\(/);
  });

  it('the canonical LIVE resolver never picks the event by recency', () => {
    // The LIVE identity is deterministic (partial unique index), never a
    // .order(...).limit(1) recency guess. The ONLY recency pick allowed in this
    // module is getLatestEndedEvent — read-only ENDED history for the summary, which
    // is never the canonical/live identity (V7). So scope the guard to the live
    // resolver rather than the whole file.
    const live = fnBody(events, 'getCanonicalEvent');
    expect(live).not.toMatch(/\.order\(/);
    expect(live).not.toMatch(/\.limit\(/);
    // Check CODE only — the doc comments deliberately name these anti-patterns.
    const eventsCode = events.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(eventsCode).not.toMatch(/latest\s*event|current\s*event|first\s*active\s*(event|session)/i);
  });
});

describe('honest reject gate runs on operational paths', () => {
  it('resolveEventAccess delegates to the pure decideEventAccess', () => {
    expect(events).toContain("from '@/domain/event-access'");
    expect(fnBody(events, 'resolveEventAccess')).toContain('decideEventAccess');
  });

  it('the guest request POST gates through resolveEventAccess (ended/mismatch honest)', () => {
    expect(guestReq).toContain('resolveEventAccess');
    // Gate runs before the request is written.
    expect(guestReq.indexOf('resolveEventAccess')).toBeLessThan(guestReq.indexOf('addRequest('));
  });

  it('the Display read injects the ONE canonical event (never a room-latest guess)', () => {
    expect(displayRoute).toContain('getCanonicalEvent');
    expect(displayRoute).toMatch(/event\s*:\s*event\s*\?/);
  });
});

describe('ZERO auto-create — no read path creates an Event (Event Lifecycle V1)', () => {
  it('the authenticated Admin Hub init (GET /admin/session) only READS the event', () => {
    expect(adminSession).toContain('getCanonicalEvent(auth.room.id');
    // The read runs only after the admin auth guard.
    expect(adminSession.indexOf('if (!auth) return')).toBeLessThan(
      adminSession.indexOf('getCanonicalEvent(auth.room.id'),
    );
    expect(adminSession).toMatch(/event:\s*event\s*\?\s*\{\s*id:\s*event\.id/);
  });

  it('the events module exposes NO get-or-create/bootstrap helper at all', () => {
    expect(events).not.toContain('export async function bootstrapInitialEvent');
    expect(events).not.toContain('export async function ensureCanonicalLiveEvent');
    expect(events).not.toContain('roomHasAnyEvent');
  });

  it('the Admin session still surfaces the ended summary when no live event exists', () => {
    expect(adminSession).toContain('getLatestEndedEvent');
    expect(adminSession).toContain('endedEvent');
  });

  it('NO read path (admin GET / guest / display / DJ / QR) ever creates an event', () => {
    for (const src of [adminSession, guestReq, displayRoute, djQueue, guestQr]) {
      expect(src).not.toContain('ensureCanonicalLiveEvent');
      expect(src).not.toContain('bootstrapInitialEvent');
      expect(src).not.toContain('startNewEvent');
    }
  });
});

describe('identity propagation — all four surfaces carry the same event.id', () => {
  it('Admin, Display, DJ, and Guest reads each expose the canonical event', () => {
    expect(adminSession).toMatch(/event:\s*event\s*\?\s*\{\s*id:\s*event\.id/);
    expect(displayRoute).toMatch(/event:\s*event\s*\?/);
    expect(djQueue).toContain('getCanonicalEvent');
    expect(djQueue).toMatch(/event:\s*event\s*\?/);
    expect(guestReq).toContain('getCanonicalEvent');
    expect(guestReq).toMatch(/event:\s*event\s*\?/);
  });
});

describe('QR compatibility decision (V5 2A)', () => {
  it('the Guest QR always opens the polished /r/<slug> screen (identity resolved server-side)', () => {
    const guestQrCode = guestQr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(guestQrCode).toMatch(/\/r\/\$\{encodeURIComponent\(slug\)\}/);
    expect(guestQrCode).not.toMatch(/\/j\//); // no flip to the event-join screen (code only)
    expect(guestQrCode).toContain('getCanonicalEvent'); // resolves the event for the name, never creates it
  });
});
