// Lyrics V1 — Admin sets/clears a song's lyrics. Auth boundary (DJ/Admin bearer),
// event gate, validation (length), and delegation to setRequestLyrics. Guests
// have no bearer, so the 401 path is the "guest cannot write lyrics" guarantee.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: null as null | { room: { id: string } },
  access: { ok: true, event: null } as
    | { ok: true; event: null }
    | { ok: false; error: string; code: string; status: number },
  outcome: { outcome: 'ok' } as { outcome: 'ok' | 'not_found' },
};

const setRequestLyrics = vi.fn(async () => state.outcome);
vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  setRequestLyrics: (...a: unknown[]) => setRequestLyrics(...(a as [])),
}));
vi.mock('@/lib/events.server', () => ({
  resolveEventAccess: vi.fn(async () => state.access),
}));

import { POST } from './route';

function makeReq(authorization: string | undefined, body: unknown) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true, event: null };
  state.outcome = { outcome: 'ok' };
  setRequestLyrics.mockClear();
});

describe('POST .../dj/requests/[id]/lyrics', () => {
  it('401 without a bearer — a guest can never write lyrics', async () => {
    const res = await POST(makeReq(undefined, { lyrics: 'x' }), ctx);
    expect(res.status).toBe(401);
    expect(setRequestLyrics).not.toHaveBeenCalled();
  });

  it('401 when the credential does not authorize', async () => {
    state.auth = null;
    const res = await POST(makeReq('Bearer nope', { lyrics: 'x' }), ctx);
    expect(res.status).toBe(401);
    expect(setRequestLyrics).not.toHaveBeenCalled();
  });

  it('saves lyrics for an authorized Admin/DJ', async () => {
    const res = await POST(makeReq('Bearer good', { lyrics: '첫 줄\n둘째 줄' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(setRequestLyrics).toHaveBeenCalledWith('room-1', 'req-1', '첫 줄\n둘째 줄');
    expect(await res.json()).toMatchObject({ ok: true, cleared: false });
  });

  it('treats an empty string as a clear', async () => {
    const res = await POST(makeReq('Bearer good', { lyrics: '   ' }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, cleared: true });
  });

  it('400 when lyrics exceed the length bound', async () => {
    const res = await POST(makeReq('Bearer good', { lyrics: 'x'.repeat(8001) }), ctx);
    expect(res.status).toBe(400);
    expect(setRequestLyrics).not.toHaveBeenCalled();
  });

  it('400 on a malformed body (missing lyrics)', async () => {
    const res = await POST(makeReq('Bearer good', { nope: true }), ctx);
    expect(res.status).toBe(400);
    expect(setRequestLyrics).not.toHaveBeenCalled();
  });

  it('404 when the request is not in this room (cross-room write refused)', async () => {
    state.outcome = { outcome: 'not_found' };
    const res = await POST(makeReq('Bearer good', { lyrics: 'x' }), ctx);
    expect(res.status).toBe(404);
  });

  it('refuses on an ended Event (event gate)', async () => {
    state.access = { ok: false, error: 'Event ended', code: 'EVENT_ENDED', status: 409 };
    const res = await POST(makeReq('Bearer good', { lyrics: 'x' }), ctx);
    expect(res.status).toBe(409);
    expect(setRequestLyrics).not.toHaveBeenCalled();
  });

  it('never renders lyrics as HTML — no dangerouslySetInnerHTML in the write path', async () => {
    const raw = (await import('node:fs')).readFileSync(
      (await import('node:url')).fileURLToPath(new URL('./route.ts', import.meta.url)),
      'utf8',
    );
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // code only
    expect(src).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});
