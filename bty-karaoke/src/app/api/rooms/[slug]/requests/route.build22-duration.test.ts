// BUILD 22 — the authoritative submit-time duration gate.
//
// The measured defect: POST /requests accepted ANY parseable videoId, so a Guest was confirmed
// into the queue ("You're #3") for a video the playback engine will refuse forever. The truth
// arrived minutes later, to the Host, on another device — and BUILD 21's own copy leaves the
// unplayable song sitting in the queue.
//
// The three rules these tests defend, in order of how badly each would hurt if broken:
//
//   1. FAIL OPEN on unknown. A quota outage or network blip must NOT block requests. Getting
//      this wrong converts a YouTube incident into a total product outage for every room.
//   2. NO HIDDEN ROW on rejection. A refusal that still inserted would be the worst of both
//      worlds — the Guest is told no, and the Host still has to remove the song.
//   3. NO LOOKUP before authorization, or on an 18B replay. Otherwise the endpoint is an
//      unauthenticated YouTube proxy, and every retry re-buys quota for a request that exists.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env.server', () => ({
  optionalEnv: () => 'test-cap-secret',
  karaokeEnv: () => ({ url: 'https://example.invalid', key: 'test-service-role-key' }),
}));

// Per-test knobs.
let insertedPayloads: Record<string, unknown>[] = [];
let existingKeyRow: Record<string, unknown> | null = null;
let roomStatus = 'open';
let eventAccess: Record<string, unknown> = { ok: true, event: { id: 'evt-1', status: 'active' } };
let acceptance: Record<string, unknown> = { ok: true, sessionId: 'sess-1' };
/** Every call the route made to the duration resolver. */
let durationCalls: string[] = [];
/** What the resolver should answer. */
let durationResult: unknown = { ok: true, seconds: 185 };

function makeDb() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.is = () => b;
  b.in = () => b;
  b.insert = (p: Record<string, unknown>) => {
    insertedPayloads.push(p);
    return b;
  };
  // Model the REAL unique index on (room_id, event_id, idempotency_key): when a row already
  // holds this key, the insert collides with 23505 and addRequest takes its replay/conflict
  // branch. Without this the harness would silently exercise a code path production cannot
  // reach, and the 18B assertions below would prove nothing.
  b.single = async () => {
    const last = insertedPayloads[insertedPayloads.length - 1] ?? {};
    if (existingKeyRow && last.idempotency_key === existingKeyRow.idempotency_key) {
      insertedPayloads.pop(); // the collision means nothing was actually written
      return { data: null, error: { code: '23505' } };
    }
    return { data: { ...last, id: 'req-new', created_at: 'now' }, error: null };
  };
  b.maybeSingle = async () => ({ data: existingKeyRow, error: null });
  b.order = async () => ({ data: [], error: null });
  b.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    resolve({ data: [{ position: 1 }], error: null });
  return { from: () => b };
}
vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => makeDb() }));

vi.mock('@/lib/rooms.server', async (orig) => {
  const real = await orig<typeof import('@/lib/rooms.server')>();
  return {
    ...real,
    getPublicRoomBySlug: async () => ({ id: 'room-1', slug: 'joy', status: roomStatus, display_name: 'Joy' }),
    hasExistingRequestForKey: async () => existingKeyRow !== null,
  };
});
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: async () => ({ id: 'evt-1', name: 'Joy', status: 'active' }),
  getLatestEndedEvent: async () => null,
  resolveEventAccess: async () => eventAccess,
}));
vi.mock('@/lib/sessions.server', () => ({ requestAcceptance: async () => acceptance }));
vi.mock('@/lib/youtube-duration.server', () => ({
  resolveRawVideoDuration: async (videoId: string) => {
    durationCalls.push(videoId);
    return durationResult;
  },
}));

import { POST } from './route';

const SHORT = 'dQw4w9WgXcQ';
function post(body: unknown) {
  return new Request('https://example.invalid/api/rooms/joy/requests', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as never;
}
const ctx = { params: Promise.resolve({ slug: 'joy' }) };
const base = { guestName: '한빛', youtubeVideoId: SHORT, youtubeTitle: '노래' };

beforeEach(() => {
  insertedPayloads = [];
  existingKeyRow = null;
  roomStatus = 'open';
  eventAccess = { ok: true, event: { id: 'evt-1', status: 'active' } };
  acceptance = { ok: true, sessionId: 'sess-1' };
  durationCalls = [];
  durationResult = { ok: true, seconds: 185 };
});

// ── ALLOWED ──────────────────────────────────────────────────────────────────────────────────

describe('BUILD 22 — an admissible song is inserted exactly as before', () => {
  it('a known 900s video inserts exactly ONE request and returns a queue position', async () => {
    durationResult = { ok: true, seconds: 900 };
    const res = await POST(post(base), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // A queue position EXISTS (its exact value comes from the live queue, which this harness
    // stubs empty) — the discriminating contrast with the refusal case, where it is absent.
    expect(typeof body.positionInQueue).toBe('number');
    expect(body.cancelToken).toBeTruthy();
    expect(insertedPayloads).toHaveLength(1);
  });

  it('an ordinary song is unaffected', async () => {
    const res = await POST(post(base), ctx);
    expect(res.status).toBe(201);
    expect(insertedPayloads).toHaveLength(1);
  });
});

// ── TOO LONG ─────────────────────────────────────────────────────────────────────────────────

describe('BUILD 22 — a positively over-limit song is refused BEFORE the insert', () => {
  beforeEach(() => {
    durationResult = { ok: true, seconds: 901 };
  });

  it('returns HTTP 400 with the stable machine code song_too_long', async () => {
    const res = await POST(post(base), ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('song_too_long');
    expect(body.reason).toBe('too_long');
    expect(body.durationSeconds).toBe(901);
    expect(body.maxDurationSeconds).toBe(900);
  });

  // RULE 2 — the assertion a mocked or optimistic implementation cannot satisfy.
  it('inserts ZERO rows', async () => {
    await POST(post(base), ctx);
    expect(insertedPayloads).toEqual([]);
  });

  it('returns NO queue position, no cancel capability, and no request body', async () => {
    const body = await (await POST(post(base), ctx)).json();
    expect(body.positionInQueue).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(body.cancelToken).toBeUndefined();
    expect(body.request).toBeUndefined();
    expect(body.ok).toBeUndefined();
  });

  it('states the limit and the remedy, and never invites a retry of the same video', async () => {
    const body = await (await POST(post(base), ctx)).json();
    expect(body.error).toContain('15분');
    expect(body.error).toContain('더 짧은 버전');
    expect(body.error).not.toContain('다시 시도');
  });

  it('a 2.5-hour medley is refused the same way', async () => {
    durationResult = { ok: true, seconds: 8917 };
    const res = await POST(post(base), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).durationSeconds).toBe(8917);
    expect(insertedPayloads).toEqual([]);
  });

  // MUTATION GUARD: changing the boundary to >= 900 makes this insert fail.
  it('EXACTLY 900 is still admitted — the bound is inclusive', async () => {
    durationResult = { ok: true, seconds: 900 };
    expect((await POST(post(base), ctx)).status).toBe(201);
    expect(insertedPayloads).toHaveLength(1);
  });
});

// ── UNKNOWN → FAIL OPEN ──────────────────────────────────────────────────────────────────────

describe('BUILD 22 — RULE 1: unknown fails OPEN, so a provider outage never blocks a room', () => {
  it.each([
    ['quota exhaustion', { ok: false, reason: 'quota_exceeded' }],
    ['a network/lookup failure', { ok: false, reason: 'lookup_failed' }],
    ['a deleted or private video', { ok: false, reason: 'video_unavailable' }],
    ['an unconfigured API key', { ok: false, reason: 'not_configured' }],
  ])('%s still inserts the request', async (_label, result) => {
    durationResult = result;
    const res = await POST(post(base), ctx);
    expect(res.status).toBe(201);
    expect(insertedPayloads).toHaveLength(1);
  });

  // MUTATION GUARD: treating unknown as too_long fails every case above and this one.
  it('never returns song_too_long for an unresolved duration', async () => {
    durationResult = { ok: false, reason: 'quota_exceeded' };
    const body = await (await POST(post(base), ctx)).json();
    expect(body.code).not.toBe('song_too_long');
  });

  it('V1 does NOT reject video_unavailable at submit time — only a positive length blocks', async () => {
    durationResult = { ok: false, reason: 'video_unavailable' };
    expect((await POST(post(base), ctx)).status).toBe(201);
  });
});

// ── RULE 3: no lookup before authorization, or on a replay ───────────────────────────────────

describe('BUILD 22 — RULE 3: the endpoint is not a YouTube lookup proxy', () => {
  it('a CLOSED room performs no duration lookup', async () => {
    roomStatus = 'closed';
    expect((await POST(post(base), ctx)).status).toBe(409);
    expect(durationCalls).toEqual([]);
  });

  it('an ENDED event performs no duration lookup', async () => {
    eventAccess = { ok: false, error: 'ended', code: 'EVENT_ENDED', status: 409 };
    expect((await POST(post(base), ctx)).status).toBe(409);
    expect(durationCalls).toEqual([]);
  });

  it('a night that is not open performs no duration lookup', async () => {
    acceptance = { ok: false };
    expect((await POST(post(base), ctx)).status).toBe(409);
    expect(durationCalls).toEqual([]);
  });

  it('a MALFORMED body performs no duration lookup', async () => {
    expect((await POST(post({ guestName: '' }), ctx)).status).toBe(400);
    expect(durationCalls).toEqual([]);
  });

  it('an unreadable videoId performs no duration lookup', async () => {
    expect((await POST(post({ guestName: '한빛', youtubeInput: 'not-a-link' }), ctx)).status).toBe(400);
    expect(durationCalls).toEqual([]);
  });

  it('a valid new request performs EXACTLY ONE lookup, for the canonical videoId', async () => {
    await POST(post({ ...base, idempotencyKey: 'k-1' }), ctx);
    expect(durationCalls).toEqual([SHORT]);
  });
});

// ── BUILD 18B idempotency is not weakened ────────────────────────────────────────────────────

describe('BUILD 18B — a replay is resolved as a replay, never re-adjudicated', () => {
  const replayRow = {
    id: 'req-existing',
    room_id: 'room-1',
    guest_name: '한빛',
    youtube_video_id: SHORT,
    youtube_title: '노래',
    position: 1,
    status: 'waiting',
    event_id: 'evt-1',
    idempotency_key: 'k-1',
  };

  it('an existing key performs NO duration lookup', async () => {
    existingKeyRow = replayRow;
    await POST(post({ ...base, idempotencyKey: 'k-1' }), ctx);
    expect(durationCalls).toEqual([]);
  });

  // The integrity rule: an accepted request must not become retroactively rejectable.
  it('an accepted request replays successfully EVEN IF a lookup would now say too_long', async () => {
    existingKeyRow = replayRow;
    durationResult = { ok: true, seconds: 8917 };
    const res = await POST(post({ ...base, idempotencyKey: 'k-1' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replayed).toBe(true);
    expect(body.request.id).toBe('req-existing');
    expect(durationCalls).toEqual([]);
  });

  it('the replay returns the SAME canonical request and creates no second row', async () => {
    existingKeyRow = replayRow;
    const body = await (await POST(post({ ...base, idempotencyKey: 'k-1' }), ctx)).json();
    expect(body.request.id).toBe('req-existing');
    expect(insertedPayloads).toEqual([]);
  });

  it('a key reused for a DIFFERENT song still conflicts (mismatch behaviour unchanged)', async () => {
    existingKeyRow = { ...replayRow, youtube_video_id: 'ZZZZZZZZZZZ' };
    const res = await POST(post({ ...base, idempotencyKey: 'k-1' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('a request with NO idempotency key is still adjudicated normally', async () => {
    durationResult = { ok: true, seconds: 901 };
    const res = await POST(post(base), ctx);
    expect(res.status).toBe(400);
    expect(durationCalls).toEqual([SHORT]);
  });
});
