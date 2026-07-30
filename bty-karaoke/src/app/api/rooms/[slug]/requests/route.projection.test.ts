// BUILD 20M-SERVER-R3.1A — public Guest queue projection security contract.
//
// These assert the RUNTIME SERIALIZED RESPONSE, not a TypeScript interface. The defect
// they lock out: the public, unauthenticated guest request API returned the raw
// `karaoke_requests` row, shipping `idempotency_key` / `session_id` / `room_id`. A reader
// could harvest {idempotency_key, youtube_video_id, guest_name} from the GET, replay that
// triple through the POST, receive `replayed`, and be handed a valid cancel capability for
// SOMEONE ELSE'S request — which the cancel and ready routes accept.
//
// The projection is an ALLOWLIST BY CONSTRUCTION (toGuestPublicRequest names every field),
// so `NEW_INTERNAL_COLUMN` below stands in for any column a future migration adds: it must
// not appear in a guest response without a deliberate code change.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env.server', () => ({
  optionalEnv: () => 'test-cap-secret',
  karaokeEnv: () => ({ url: 'https://example.invalid', key: 'test-service-role-key' }),
}));

/** The forbidden property names — capability-recovery material + internal ids. */
const FORBIDDEN = ['idempotency_key', 'session_id', 'room_id'] as const;

/** The exact Guest-safe allowlist the public API is contracted to return. */
const ALLOWED = [
  'id',
  'guest_name',
  'search_query',
  'youtube_video_id',
  'youtube_title',
  'youtube_channel_title',
  'position',
  'status',
  'ready_at',
  'event_id',
] as const;

// A fixture row shaped exactly like `select('*')` returns, including the internal columns
// and a stand-in for a column a future migration might add.
function row(over: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    room_id: 'ROOM-UUID-SHOULD-NOT-LEAK',
    guest_name: 'Victim',
    search_query: '노래',
    youtube_video_id: 'dQw4w9WgXcQ',
    youtube_title: '너에게원한건',
    youtube_channel_title: 'TJ',
    youtube_thumbnail_url: 'https://img/1.jpg',
    position: 1,
    status: 'waiting',
    session_id: 'SESSION-SHOULD-NOT-LEAK',
    event_id: 'evt-1',
    created_at: '2026-07-30T00:00:00Z',
    started_at: null,
    completed_at: null,
    ready_at: null,
    youtube_queued_at: null,
    idempotency_key: 'IDEMPOTENCY-SHOULD-NOT-LEAK',
    lyrics_text: 'internal lyrics',
    NEW_INTERNAL_COLUMN: 'A-FUTURE-MIGRATION-COLUMN',
    ...over,
  };
}

// Per-test knobs.
let activeRows: Record<string, unknown>[] = [];
let insertError: { code: string } | null = null;
let existingRow: Record<string, unknown> | null = null;
let insertedPayload: Record<string, unknown> | null = null;

function makeDb() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.is = () => b;
  b.in = () => b;
  b.insert = (p: Record<string, unknown>) => {
    insertedPayload = p;
    return b;
  };
  b.single = async () =>
    insertError ? { data: null, error: insertError } : { data: row({ ...insertedPayload, id: 'req-new' }), error: null };
  b.maybeSingle = async () => ({ data: existingRow, error: null });
  b.order = async () => ({ data: activeRows, error: null });
  b.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    resolve({ data: [{ position: 1 }], error: null });
  return { from: () => b };
}
vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => makeDb() }));

vi.mock('@/lib/rooms.server', async (orig) => {
  const real = await orig<typeof import('@/lib/rooms.server')>();
  return {
    ...real,
    getPublicRoomBySlug: async () => ({ id: 'room-1', slug: 'joy', status: 'open', display_name: 'Joy' }),
  };
});
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: async () => ({ id: 'evt-1', name: 'Joy', status: 'active' }),
  getLatestEndedEvent: async () => null,
  resolveEventAccess: async () => ({ ok: true, event: { id: 'evt-1', status: 'active' } }),
}));
vi.mock('@/lib/sessions.server', () => ({ requestAcceptance: async () => ({ ok: true, sessionId: 'sess-1' }) }));

import { GET, POST } from './route';
import { verifyCancelCapability } from '@/lib/capability.server';

function req(body?: unknown) {
  return new Request('https://example.invalid/api/rooms/joy/requests', {
    method: body ? 'POST' : 'GET',
    ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  }) as never;
}
const ctx = { params: Promise.resolve({ slug: 'joy' }) };

beforeEach(() => {
  activeRows = [];
  insertError = null;
  existingRow = null;
  insertedPayload = null;
});

describe('public Guest queue GET — projection contract', () => {
  it('succeeds for an active Event and returns every required Guest field', async () => {
    activeRows = [row()];
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event).toEqual({ id: 'evt-1', name: 'Joy', status: 'active' });
    expect(Object.keys(body.requests[0]).sort()).toEqual([...ALLOWED].sort());
    expect(body.requests[0].id).toBe('req-1');
    expect(body.requests[0].guest_name).toBe('Victim');
    expect(body.requests[0].youtube_video_id).toBe('dQw4w9WgXcQ');
    expect(body.requests[0].position).toBe(1);
    expect(body.requests[0].event_id).toBe('evt-1');
  });

  it.each(FORBIDDEN)('raw serialized response contains no "%s" (name or value)', async (field) => {
    activeRows = [row()];
    const raw = await (await GET(req(), ctx)).text();
    expect(raw).not.toContain(field);
  });

  it('raw serialized response leaks no internal VALUES', async () => {
    activeRows = [row()];
    const raw = await (await GET(req(), ctx)).text();
    for (const secret of [
      'IDEMPOTENCY-SHOULD-NOT-LEAK',
      'SESSION-SHOULD-NOT-LEAK',
      'ROOM-UUID-SHOULD-NOT-LEAK',
      'internal lyrics',
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('does NOT inherit a newly added internal column (allowlist, not blacklist)', async () => {
    activeRows = [row()];
    const raw = await (await GET(req(), ctx)).text();
    expect(raw).not.toContain('NEW_INTERNAL_COLUMN');
    expect(raw).not.toContain('A-FUTURE-MIGRATION-COLUMN');
  });

  it('carries no cancel-capability material', async () => {
    activeRows = [row()];
    const body = await (await GET(req(), ctx)).json();
    expect(body.cancelToken).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('cancelToken');
  });

  it('an empty queue is semantically unchanged', async () => {
    activeRows = [];
    const body = await (await GET(req(), ctx)).json();
    expect(body.requests).toEqual([]);
    expect(body.room.slug).toBe('joy');
    expect(body.event.status).toBe('active');
  });

  it('renders a waiting, a ready and a playing request', async () => {
    activeRows = [
      row({ id: 'p', status: 'playing' }),
      row({ id: 'w', status: 'waiting', position: 2 }),
      row({ id: 'r', status: 'waiting', position: 3, ready_at: '2026-07-30T01:00:00Z' }),
    ];
    const body = await (await GET(req(), ctx)).json();
    expect(body.requests.map((r: { id: string }) => r.id)).toEqual(['p', 'w', 'r']);
    expect(body.requests[0].status).toBe('playing');
    expect(body.requests[1].ready_at).toBeNull();
    expect(body.requests[2].ready_at).toBe('2026-07-30T01:00:00Z');
    // Server order is preserved verbatim (both clients rely on it).
    expect(body.requests.map((r: { position: number }) => r.position)).toEqual([1, 2, 3]);
  });
});

describe('client decoding contracts stay compatible', () => {
  it('native GuestRequestDTO decodes every field it declares', async () => {
    activeRows = [row({ ready_at: '2026-07-30T01:00:00Z' })];
    const r = (await (await GET(req(), ctx)).json()).requests[0];
    // Exactly the CodingKeys of BTYNorebangAdmin/GuestMode.swift GuestRequestDTO.
    for (const k of [
      'id', 'guest_name', 'search_query', 'youtube_video_id', 'youtube_title',
      'youtube_channel_title', 'position', 'status', 'ready_at', 'event_id',
    ]) {
      expect(r).toHaveProperty(k);
    }
    // Non-optional in Swift — a null here would fail decoding of the whole payload.
    expect(typeof r.id).toBe('string');
    expect(typeof r.guest_name).toBe('string');
    expect(typeof r.youtube_video_id).toBe('string');
    expect(typeof r.position).toBe('number');
    expect(typeof r.status).toBe('string');
  });

  it('web RoomLiveGuard still reads the event envelope', async () => {
    activeRows = [row()];
    const body = await (await GET(req(), ctx)).json();
    expect(body.event.id).toBe('evt-1');
    expect(body.event.status).toBe('active');
  });
});

describe('POST — projection applies to created AND replayed, replay semantics unchanged', () => {
  const submit = {
    guestName: 'Victim',
    youtubeVideoId: 'dQw4w9WgXcQ',
    idempotencyKey: 'IDEMPOTENCY-SHOULD-NOT-LEAK',
  };

  it('a created request returns the projected shape and a working capability', async () => {
    const res = await POST(req(submit), ctx);
    expect(res.status).toBe(201);
    const raw = await res.clone().text();
    for (const f of FORBIDDEN) expect(raw).not.toContain(f);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.replayed).toBe(false);
    expect(Object.keys(body.request).sort()).toEqual([...ALLOWED].sort());
    expect(await verifyCancelCapability(body.cancelToken, body.request.id)).toBe(true);
  });

  it('legitimate same-key replay still returns ONE canonical request + a valid capability', async () => {
    insertError = { code: '23505' };
    existingRow = row({ id: 'req-original' });
    const res = await POST(req(submit), ctx);
    // 200 (already existed), not a second insert.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replayed).toBe(true);
    expect(body.request.id).toBe('req-original');
    // Capability recovery — the property BUILD 20M-NATIVE-R3.1 depends on — is intact.
    expect(await verifyCancelCapability(body.cancelToken, 'req-original')).toBe(true);
    expect(await verifyCancelCapability(body.cancelToken, 'some-other-request')).toBe(false);
  });

  it('the replay response still does not echo internal columns back out', async () => {
    insertError = { code: '23505' };
    existingRow = row({ id: 'req-original' });
    const raw = await (await POST(req(submit), ctx)).text();
    for (const f of FORBIDDEN) expect(raw).not.toContain(f);
    expect(raw).not.toContain('SESSION-SHOULD-NOT-LEAK');
    expect(raw).not.toContain('NEW_INTERNAL_COLUMN');
  });

  it('a key reused for a DIFFERENT song is still a stable conflict (no silent success)', async () => {
    insertError = { code: '23505' };
    existingRow = row({ id: 'req-original', youtube_video_id: 'OTHER_VIDEO' });
    const res = await POST(req(submit), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('a DIFFERENT key for the same song still creates a new request (repeat performance)', async () => {
    const res = await POST(req({ ...submit, idempotencyKey: 'a-fresh-key' }), ctx);
    expect(res.status).toBe(201);
    expect(insertedPayload?.idempotency_key).toBe('a-fresh-key');
  });

  it('room scoping still happens internally even though room_id is not returned', async () => {
    await POST(req(submit), ctx);
    expect(insertedPayload?.room_id).toBe('room-1');
    expect(insertedPayload?.event_id).toBe('evt-1');
    expect(insertedPayload?.session_id).toBe('sess-1');
  });
});

describe('EXPLOIT REGRESSION — harvested-key replay is no longer possible', () => {
  it('the public GET no longer yields the key the attack requires', async () => {
    activeRows = [row({ id: 'req-victim' })];
    const body = await (await GET(req(), ctx)).json();
    const harvested = body.requests[0] as Record<string, unknown>;

    // The attack needs all THREE. Two are still public (they are rendered in the room);
    // the third — the key — is now unobtainable, so the triple cannot be assembled.
    expect(harvested.guest_name).toBe('Victim');
    expect(harvested.youtube_video_id).toBe('dQw4w9WgXcQ');
    expect(harvested.idempotency_key).toBeUndefined();
    expect(Object.keys(harvested)).not.toContain('idempotency_key');

    // And no capability is obtainable from a read.
    expect(JSON.stringify(body)).not.toContain('cancelToken');
  });

  it('without the real key, a guessed replay creates a SEPARATE request rather than granting the victim capability', async () => {
    // A guessed key does not collide → a plain insert of the attacker's own row.
    const res = await POST(
      req({ guestName: 'Victim', youtubeVideoId: 'dQw4w9WgXcQ', idempotencyKey: 'guessed-key' }),
      ctx,
    );
    const body = await res.json();
    expect(body.replayed).toBe(false);
    expect(body.request.id).not.toBe('req-victim');
    // The capability it receives is bound to the attacker's OWN row only.
    expect(await verifyCancelCapability(body.cancelToken, 'req-victim')).toBe(false);
  });
});
