// V5 security / no-inference guards. The canonical event MUST be resolved
// deterministically from the room (1:1) — never by "latest event", "first active
// session", or "current session" recency inference — and the honest reject gate
// must run on the operational read/write paths. Pinned to source so a regression
// fails CI.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)); // src/
const events = readFileSync(root + 'lib/events.server.ts', 'utf8');
const guestReq = readFileSync(root + 'app/api/rooms/[slug]/requests/route.ts', 'utf8');
const displayRoute = readFileSync(root + 'app/api/rooms/[slug]/display/route.ts', 'utf8');

/** Body of a top-level `export async function NAME` up to the next `export`. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  if (start < 0) return '';
  const rest = src.slice(start + name.length);
  const nextExport = rest.indexOf('\nexport ');
  return nextExport < 0 ? rest : rest.slice(0, nextExport);
}

describe('canonical event resolver is deterministic (no recency inference)', () => {
  it('getCanonicalEvent delegates to the 1:1 room lookup', () => {
    expect(events).toContain('export async function getCanonicalEvent');
    expect(fnBody(events, 'getCanonicalEvent')).toContain('getEventByRoomId');
  });

  it('getEventByRoomId selects by room_id with maybeSingle — no order/limit recency pick', () => {
    const body = fnBody(events, 'getEventByRoomId');
    expect(body).toMatch(/\.eq\('room_id'/);
    expect(body).toContain('maybeSingle');
    expect(body).not.toMatch(/\.order\(/);
    expect(body).not.toMatch(/\.limit\(/);
  });

  it('no single-event selection anywhere picks "the latest/first" event by recency', () => {
    // A single-event pick by recency would look like .order(...).limit(1).
    expect(events).not.toMatch(/limit\(1\)/);
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
