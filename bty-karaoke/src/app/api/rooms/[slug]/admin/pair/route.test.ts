// Section-13 "Pair creation" coverage for the admin DJ-pairing mint route.
// Verifies: only an authenticated admin can mint; an unauthenticated caller and a
// caller whose device isn't an admin for THIS room are denied; a successful mint
// returns a ready-to-scan QR + pairing URL and leaks no raw secret beyond the
// one-time token embedded in that URL.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = { result: null as null | { room: { id: string; display_name: string } } };

vi.mock('@/lib/rooms.server', () => ({
  authorizeAdmin: vi.fn(async () => auth.result),
}));

vi.mock('@/lib/pairing.server', () => ({
  mintPairingToken: vi.fn(async () => ({
    token: 'RAW-ONE-TIME-TOKEN',
    role: 'dj',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })),
}));

vi.mock('@/lib/qr.server', () => ({
  qrSvg: vi.fn(async () => '<svg id="pair-qr"/>'),
}));

import { POST } from './route';

function makeReq(authorization?: string) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => ({}),
    nextUrl: { origin: 'https://norebang.test' },
  } as unknown as Parameters<typeof POST>[0];
}

const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  auth.result = { room: { id: 'room-1', display_name: 'BTY Home' } };
});

describe('POST /api/rooms/[slug]/admin/pair', () => {
  it('rejects a caller with no bearer token (401)', async () => {
    const res = await POST(makeReq(undefined), ctx);
    expect(res.status).toBe(401);
  });

  it('rejects a caller who is not an admin for this room (401)', async () => {
    auth.result = null; // authorizeAdmin denies (wrong room / not admin / revoked)
    const res = await POST(makeReq('Bearer some-device-token'), ctx);
    expect(res.status).toBe(401);
  });

  it('authenticated admin mints a QR + pairing URL for this room', async () => {
    const res = await POST(makeReq('Bearer admin-token'), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.qrSvg).toContain('<svg');
    expect(data.pairUrl).toContain('/r/bty-home/dj/pair?token=');
    expect(data.roomName).toBe('BTY Home');
    expect(typeof data.expiresAt).toBe('string');
    expect(data.ttlSeconds).toBeGreaterThan(0);
  });

  it('does not leak internal room/secret identifiers in the response', async () => {
    const res = await POST(makeReq('Bearer admin-token'), ctx);
    const data = await res.json();
    const raw = JSON.stringify(data).toLowerCase();
    // The one-time token intentionally rides inside pairUrl; nothing else leaks.
    expect(raw).not.toContain('room-1'); // internal room UUID
    expect(raw).not.toContain('token_hash');
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('credential');
  });
});
