// Canonical room-slug resolution for events (the Open Admin Player / Connect
// Display "Room not found" fix). An event's room may be a PRE-EXISTING room whose
// slug is NOT `evt-<public_code>` (e.g. bty-home). Deriving the slug from the public
// code sends the button to a dead route; the canonical slug comes from room_id.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { djEnrollUrlFor, guestUrlFor } from './event-links.server';
import type { KaraokeEvent } from './events.server';

// A fake room table keyed by id, driven per-test.
const rooms = { byId: new Map<string, string>() };
vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: () => {
      let roomId: string | null = null;
      const b: Record<string, unknown> = {};
      Object.assign(b, {
        select: () => b,
        eq: (_c: string, v: string) => { roomId = v; return b; },
        maybeSingle: async () => ({
          data: roomId && rooms.byId.has(roomId) ? { slug: rooms.byId.get(roomId) } : null,
          error: null,
        }),
      });
      return b;
    },
  }),
}));

const evt = (over: Partial<KaraokeEvent> = {}): KaraokeEvent =>
  ({ id: 'e1', room_id: 'room-abc', public_code: 'VZQRPZ', guest_slug: 'btynorebang-vzqrpz', name: 'btyNorebang', ...over } as KaraokeEvent);

beforeEach(() => { rooms.byId.clear(); });

describe('eventRoomSlugOf — canonical room slug (never derived from the public code)', () => {
  it('returns the ACTUAL room slug when it differs from evt-<public_code>', async () => {
    const { eventRoomSlugOf } = await import('./events.server');
    rooms.byId.set('room-abc', 'bty-home'); // pre-existing room; slug != evt-vzqrpz
    const slug = await eventRoomSlugOf(evt());
    expect(slug).toBe('bty-home');
    expect(slug).not.toBe('evt-vzqrpz'); // the bug was returning this
  });

  it('returns null when the event has no mapped room (→ caller disables the button)', async () => {
    const { eventRoomSlugOf } = await import('./events.server');
    const slug = await eventRoomSlugOf(evt({ room_id: 'gone' }));
    expect(slug).toBeNull();
  });

  it('always reflects the CURRENT room_id (a restarted event never reuses a stale slug)', async () => {
    const { eventRoomSlugOf } = await import('./events.server');
    rooms.byId.set('room-old', 'evt-oldcode');
    rooms.byId.set('room-new', 'bty-home');
    expect(await eventRoomSlugOf(evt({ room_id: 'room-old' }))).toBe('evt-oldcode');
    expect(await eventRoomSlugOf(evt({ room_id: 'room-new' }))).toBe('bty-home');
  });
});

describe('event link builders use canonical identifiers', () => {
  it('djEnrollUrlFor builds /r/<canonical roomSlug>/dj/pair — from the passed slug, not the code', () => {
    const url = djEnrollUrlFor('https://x.test', 'bty-home', 'tok123');
    expect(url).toBe('https://x.test/r/bty-home/dj/pair?token=tok123');
    expect(url).not.toContain('evt-'); // never a derived event slug
  });

  it('guestUrlFor keys on the event guest_slug (a real column), not a room slug', () => {
    expect(guestUrlFor('https://x.test', evt())).toBe('https://x.test/j/btynorebang-vzqrpz');
  });
});
