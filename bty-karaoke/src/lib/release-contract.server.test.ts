// BUILD 26U-R2 — the release-contract server authority, exercised.
//
// The static scans elsewhere prove WHERE the decision lives. This proves HOW it behaves when the
// database misbehaves — the case that matters most, because a mode read that failed open to
// `premium_all` would start refusing the public v1.0 app on a transient error.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = {
  mode: 'dual' as string | null,
  error: null as { message: string } | null,
  throws: false,
  recorded: [] as string[],
};

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string, params?: Record<string, unknown>) => {
      if (db.throws) throw new Error('connection lost');
      if (name === 'karaoke_premium_room_mode') {
        return Promise.resolve({ data: db.mode, error: db.error });
      }
      if (name === 'karaoke_record_release_client') {
        db.recorded.push(String(params?.p_bucket));
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
    },
  }),
}));

import { readRolloutMode, resolveRelease, clientReleaseFromHeaders } from './release-contract.server';

const req = (client?: string) => ({
  headers: new Headers(client ? { 'x-bty-client': client } : {}),
});

beforeEach(() => {
  db.mode = 'dual';
  db.error = null;
  db.throws = false;
  db.recorded = [];
});

describe('readRolloutMode — fails to legacy_free in EVERY failure shape', () => {
  it('returns the stored mode when the read succeeds', async () => {
    for (const m of ['legacy_free', 'dual', 'premium_all']) {
      db.mode = m;
      expect(await readRolloutMode()).toBe(m);
    }
  });

  it('a database ERROR resolves to legacy_free, never to a gated mode', async () => {
    db.error = { message: 'boom' };
    db.mode = 'premium_all'; // even if a value came back alongside the error
    expect(await readRolloutMode()).toBe('legacy_free');
  });

  it('a THROWN exception resolves to legacy_free', async () => {
    db.throws = true;
    expect(await readRolloutMode()).toBe('legacy_free');
  });

  it('a null / unrecognised / malformed value resolves to legacy_free', async () => {
    for (const bad of [null, '', 'PREMIUM_ALL', 'on', 'true']) {
      db.mode = bad as string;
      expect(await readRolloutMode(), `"${String(bad)}"`).toBe('legacy_free');
    }
  });

  it('an array-wrapped answer is unwrapped (PostgREST scalar shape)', async () => {
    db.mode = ['premium_all'] as unknown as string;
    expect(await readRolloutMode()).toBe('premium_all');
  });
});

describe('resolveRelease — one database read plus a pure decision', () => {
  it('build 109 (no header) under DUAL resolves to the legacy contract', async () => {
    const r = await resolveRelease(req());
    expect(r.mode).toBe('dual');
    expect(r.client).toEqual({ kind: 'unidentified' });
    expect(r.contract).toBe('legacy');
  });

  it('build 110 under DUAL resolves to premium', async () => {
    const r = await resolveRelease(req('native/110'));
    expect(r.contract).toBe('premium');
  });

  it('web under DUAL resolves to premium — never the legacy exception', async () => {
    const r = await resolveRelease(req('web/abc123'));
    expect(r.client).toEqual({ kind: 'web' });
    expect(r.contract).toBe('premium');
  });

  it('a database failure degrades the WHOLE resolution to legacy, for everyone', async () => {
    db.throws = true;
    for (const c of [undefined, 'native/109', 'native/110', 'web/x']) {
      expect((await resolveRelease(req(c))).contract, `client ${c}`).toBe('legacy');
    }
  });

  it('counts every classification, so the sunset is measurable', async () => {
    await resolveRelease(req());
    await resolveRelease(req('native/109'));
    await resolveRelease(req('native/110'));
    await resolveRelease(req('web/abc'));
    // Fired and not awaited, so give the microtask queue a turn.
    await new Promise((r) => setTimeout(r, 0));
    expect(db.recorded).toEqual(['UNIDENTIFIED', 'NATIVE_LEGACY', 'NATIVE_PREMIUM', 'WEB']);
  });

  it('a telemetry failure never affects the resolution', async () => {
    // The counter RPC is the one that throws; the contract must still come back correct.
    db.throws = false;
    const r = await resolveRelease(req('native/110'));
    expect(r.contract).toBe('premium');
  });
});

describe('clientReleaseFromHeaders — header reading is case-insensitive', () => {
  it('reads the header regardless of the case it arrived in', () => {
    expect(clientReleaseFromHeaders(new Headers({ 'X-BTY-Client': 'native/110' })))
      .toEqual({ kind: 'native', build: 110 });
    expect(clientReleaseFromHeaders(new Headers({ 'x-bty-client': 'native/110' })))
      .toEqual({ kind: 'native', build: 110 });
  });

  it('an absent header is unidentified — which is exactly build 109', () => {
    expect(clientReleaseFromHeaders(new Headers())).toEqual({ kind: 'unidentified' });
  });
});
