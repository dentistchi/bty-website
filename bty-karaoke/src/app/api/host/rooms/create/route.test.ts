// Native first-Room creation endpoint (New Host Onboarding — native path).
//
// Bearer/JSON sibling of the web form endpoint. Pins the route contract:
//   - Bearer host session required (401 JSON when absent/invalid) — owner is the account
//   - the ONLY accepted input is a bounded display name (+ optional idempotencyKey)
//   - first Room (kind 'entered', incl. idempotent re-entry) → 200 { ok, slug, roomId }
//   - additional Room (kind 'added') → 200 with slug/roomId
//   - idempotency_conflict / blocked → 409 with a stable code, nothing created
//   - the owner is ALWAYS the authenticated account — never read from the body
//   - NO Manager passcode, NO CSRF/cookie/redirect (this is the native JSON path)

import { describe, it, expect, vi, beforeEach } from 'vitest';

type CreateRoomResult =
  | { kind: 'entered'; slug: string; roomId: string }
  | { kind: 'added'; slug: string; roomId: string }
  | { kind: 'idempotency_conflict' }
  | { kind: 'blocked' };

const state = {
  account: { id: 'acct-1' } as null | { id: string },
  result: { kind: 'entered', slug: 'my-first-room-ab12', roomId: 'room-new' } as CreateRoomResult,
};

const createSpy = vi.fn(async (_args: { accountId: string; displayName: string; idempotencyKey: string }) => state.result);

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  createRoomForAccount: (args: { accountId: string; displayName: string; idempotencyKey: string }) => createSpy(args),
}));
vi.mock('@/lib/dj-auth.server', () => ({
  bearerFromHeader: (h: string | null) => (h ? h.replace(/^Bearer\s+/i, '') : null),
}));

import { POST } from './route';

function makeReq(body: unknown, authorization: string | undefined = 'Bearer host-token') {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.result = { kind: 'entered', slug: 'my-first-room-ab12', roomId: 'room-new' };
  createSpy.mockClear();
});

describe('POST /api/host/rooms/create (native Bearer/JSON)', () => {
  it('first Room (entered) → 200 { ok, slug, roomId, displayName }; owner = session account', async () => {
    const res = await POST(makeReq({ name: '첫 노래방' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ ok: true, kind: 'entered', slug: 'my-first-room-ab12', roomId: 'room-new', displayName: '첫 노래방' });
  });

  it('a BLANK/absent idempotency key is replaced by a server-generated one (never passed blank)', async () => {
    // Root cause of the build-11 409: create_karaoke_room fails closed on a blank key.
    // The route must mint a non-blank account-scoped key so a valid first create succeeds.
    await POST(makeReq({ name: 'Joy' })); // no idempotencyKey field at all
    const call = createSpy.mock.calls.at(-1)![0];
    expect(call.accountId).toBe('acct-1');
    expect(call.displayName).toBe('Joy');
    expect(typeof call.idempotencyKey).toBe('string');
    expect(call.idempotencyKey.length).toBeGreaterThanOrEqual(1);
  });

  it('an explicit client key (native per-attempt UUID) is used as-is', async () => {
    await POST(makeReq({ name: '첫 노래방', idempotencyKey: 'attempt-uuid-1' }));
    expect(createSpy).toHaveBeenCalledWith({ accountId: 'acct-1', displayName: '첫 노래방', idempotencyKey: 'attempt-uuid-1' });
  });

  it('idempotent retry returns the SAME first Room (no duplicate) — entered again', async () => {
    // The service is idempotent: a retry for a Host that now owns a Room returns 'entered'
    // with the same slug (account-level has_room). The route passes it through as success.
    state.result = { kind: 'entered', slug: 'my-first-room-ab12', roomId: 'room-new' };
    const res = await POST(makeReq({ name: '첫 노래방', idempotencyKey: 'idem-1' }));
    expect((await res.json()).slug).toBe('my-first-room-ab12');
  });

  it('additional Room (added) → 200 with slug/roomId', async () => {
    state.result = { kind: 'added', slug: 'second-room', roomId: 'room-2' };
    const res = await POST(makeReq({ name: 'Second' }));
    expect(res.status).toBe(200);
    expect((await res.json())).toMatchObject({ ok: true, kind: 'added', slug: 'second-room' });
  });

  it('idempotency_conflict → 409 room_conflict, nothing created', async () => {
    state.result = { kind: 'idempotency_conflict' };
    const res = await POST(makeReq({ name: 'X', idempotencyKey: 'reused' }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('room_conflict');
  });

  it('blocked → 409 room_blocked, nothing created', async () => {
    state.result = { kind: 'blocked' };
    const res = await POST(makeReq({ name: 'X' }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('room_blocked');
  });

  it('unauthenticated (no/invalid Bearer) → 401 JSON, nothing created', async () => {
    state.account = null;
    const res = await POST(makeReq({ name: 'X' }, undefined));
    expect(res.status).toBe(401);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('empty/invalid name → 400 bad_name, nothing created', async () => {
    const res = await POST(makeReq({ name: '   ' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('bad_name');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('ignores client-supplied owner/slug/account — only account + name reach the service', async () => {
    await POST(makeReq({ name: 'Room X', accountId: 'attacker', ownerId: 'x', slug: 'pwned' }));
    const call = createSpy.mock.calls.at(-1)![0];
    expect(call.accountId).toBe('acct-1'); // the session account, never the body
    expect(call.displayName).toBe('Room X');
  });
});
