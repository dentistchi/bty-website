// Section-13 security/concurrency coverage for the DJ pairing lifecycle. These
// exercise the REAL redeem/authorize code paths against an in-memory fake of the
// Supabase query builder that faithfully models the atomic conditional-UPDATE
// used for one-time consume (redeemed_at IS NULL AND expires_at > now). The
// fake's claim happens synchronously inside maybeSingle(), so two overlapping
// redeems race exactly as they would at the DB: first-to-claim wins, the other
// finds the row already stamped — the "exactly one winner" guarantee.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared in-memory store + builder, created via vi.hoisted so the vi.mock factory
// (hoisted above imports) can close over it.
const h = vi.hoisted(() => {
  interface Row {
    [k: string]: unknown;
  }
  const store: Record<string, Row[]> = {
    karaoke_pairing_tokens: [],
    karaoke_dj_devices: [],
  };
  let idSeq = 0;
  const nextId = () => `id-${++idSeq}`;

  function reset() {
    store.karaoke_pairing_tokens.length = 0;
    store.karaoke_dj_devices.length = 0;
    idSeq = 0;
  }

  class Query {
    private rows: Row[];
    private filters: Array<(r: Row) => boolean> = [];
    private op: 'select' | 'update' | 'insert' = 'select';
    private patch: Row = {};
    private toInsert: Row | null = null;
    private wantSelect = false;

    constructor(table: string) {
      this.rows = store[table] ?? (store[table] = []);
    }
    insert(row: Row) {
      this.op = 'insert';
      this.toInsert = row;
      return this;
    }
    update(patch: Row) {
      this.op = 'update';
      this.patch = patch;
      return this;
    }
    select(_cols?: string) {
      this.wantSelect = true;
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push((r) => r[col] === val);
      return this;
    }
    is(col: string, val: unknown) {
      this.filters.push((r) => (r[col] ?? null) === val);
      return this;
    }
    gt(col: string, val: unknown) {
      this.filters.push((r) => (r[col] as string) > (val as string));
      return this;
    }
    order() {
      return this;
    }
    private match(): Row[] {
      return this.rows.filter((r) => this.filters.every((f) => f(r)));
    }
    // Applies the pending operation and returns the affected rows. Called exactly
    // once per chain (by maybeSingle/single/then) — mutation is synchronous here,
    // which is what makes the concurrent-redeem race deterministic.
    private run(): Row[] {
      if (this.op === 'insert') {
        const row: Row = { id: nextId(), redeemed_at: null, ...this.toInsert };
        this.rows.push(row);
        return [row];
      }
      if (this.op === 'update') {
        const m = this.match();
        m.forEach((r) => Object.assign(r, this.patch));
        return m;
      }
      return this.match();
    }
    maybeSingle() {
      const a = this.run();
      return Promise.resolve({ data: a[0] ? { ...a[0] } : null, error: null });
    }
    single() {
      const a = this.run();
      return Promise.resolve({
        data: a[0] ? { ...a[0] } : null,
        error: a[0] ? null : { message: 'no row' },
      });
    }
    // Awaited chains with no maybeSingle/single (mint insert, best-effort updates).
    then<T>(res: (v: { data: Row[] | null; error: null }) => T, rej?: (e: unknown) => T) {
      const a = this.run();
      const payload = { data: this.wantSelect ? a.map((r) => ({ ...r })) : null, error: null as null };
      return Promise.resolve(payload).then(res, rej);
    }
  }

  const karaokeDb = () => ({ from: (table: string) => new Query(table) });
  return { store, reset, karaokeDb };
});

vi.mock('@/lib/supabase.server', () => ({ karaokeDb: h.karaokeDb }));

import { mintPairingToken, redeemPairingToken } from './pairing.server';
import { authorizeDevice, revokeDevice, createDeviceSession } from './devices.server';
import { sha256Hex } from './dj-auth.server';

const ROOM_A = 'room-a';
const ROOM_B = 'room-b';

beforeEach(() => {
  h.reset();
});

describe('mintPairingToken', () => {
  it('stores only the token HASH, never the raw token, with a 5-minute expiry', async () => {
    const t0 = Date.now();
    const minted = await mintPairingToken({ roomId: ROOM_A });
    const rows = h.store.karaoke_pairing_tokens;
    expect(rows).toHaveLength(1);
    const stored = rows[0];

    // The raw token must NOT be persisted; only its SHA-256 hash.
    expect(stored.token_hash).toBe(await sha256Hex(minted.token));
    expect(stored.token_hash).not.toBe(minted.token);
    expect(JSON.stringify(stored)).not.toContain(minted.token);

    // High-entropy raw token (192-bit → ~32 base64url chars).
    expect(minted.token.length).toBeGreaterThanOrEqual(30);

    // Expiry is ~5 minutes out.
    const ttl = new Date(minted.expiresAt).getTime() - t0;
    expect(ttl).toBeGreaterThan(4 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
  });
});

describe('redeemPairingToken', () => {
  it('valid token succeeds and creates a room-scoped DJ device', async () => {
    const minted = await mintPairingToken({ roomId: ROOM_A });
    const res = await redeemPairingToken({ roomId: ROOM_A, rawToken: minted.token });
    expect(res.outcome).toBe('ok');
    if (res.outcome !== 'ok') return;
    expect(res.deviceToken).toBeTruthy();
    expect(res.device.room_id).toBe(ROOM_A);
    expect(res.device.role).toBe('dj');

    // The device token is stored as a hash, not raw.
    const dev = h.store.karaoke_dj_devices[0];
    expect(dev.token_hash).toBe(await sha256Hex(res.deviceToken));
    // The pairing token is now stamped consumed and linked to the device.
    expect(h.store.karaoke_pairing_tokens[0].redeemed_at).not.toBeNull();
    expect(h.store.karaoke_pairing_tokens[0].redeemed_device_id).toBe(dev.id);
  });

  it('already-consumed token fails (no second device created)', async () => {
    const minted = await mintPairingToken({ roomId: ROOM_A });
    const first = await redeemPairingToken({ roomId: ROOM_A, rawToken: minted.token });
    expect(first.outcome).toBe('ok');
    const second = await redeemPairingToken({ roomId: ROOM_A, rawToken: minted.token });
    expect(second.outcome).toBe('invalid');
    expect(h.store.karaoke_dj_devices).toHaveLength(1);
  });

  it('expired token fails', async () => {
    const minted = await mintPairingToken({ roomId: ROOM_A });
    // Force the stored token into the past (as if 5 minutes elapsed).
    h.store.karaoke_pairing_tokens[0].expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await redeemPairingToken({ roomId: ROOM_A, rawToken: minted.token });
    expect(res.outcome).toBe('invalid');
    expect(h.store.karaoke_dj_devices).toHaveLength(0);
  });

  it('unknown / malformed token fails', async () => {
    await mintPairingToken({ roomId: ROOM_A });
    const res = await redeemPairingToken({ roomId: ROOM_A, rawToken: 'not-a-real-token' });
    expect(res.outcome).toBe('invalid');
  });

  it('wrong-room redemption fails (token minted for room A, redeemed against room B)', async () => {
    const minted = await mintPairingToken({ roomId: ROOM_A });
    const res = await redeemPairingToken({ roomId: ROOM_B, rawToken: minted.token });
    expect(res.outcome).toBe('invalid');
    expect(h.store.karaoke_dj_devices).toHaveLength(0);
  });

  it('two simultaneous redeems: exactly one succeeds', async () => {
    const minted = await mintPairingToken({ roomId: ROOM_A });
    const [a, b] = await Promise.all([
      redeemPairingToken({ roomId: ROOM_A, rawToken: minted.token }),
      redeemPairingToken({ roomId: ROOM_A, rawToken: minted.token }),
    ]);
    const wins = [a, b].filter((r) => r.outcome === 'ok').length;
    expect(wins).toBe(1);
    // Exactly one durable device from the double-scan.
    expect(h.store.karaoke_dj_devices).toHaveLength(1);
  });
});

describe('authorizeDevice (session scope + revocation)', () => {
  it('a paired session authorizes for ITS room but NOT another room', async () => {
    const minted = await mintPairingToken({ roomId: ROOM_A });
    const res = await redeemPairingToken({ roomId: ROOM_A, rawToken: minted.token });
    if (res.outcome !== 'ok') throw new Error('setup');

    const okA = await authorizeDevice(ROOM_A, res.deviceToken);
    expect(okA).not.toBeNull();
    expect(okA?.role).toBe('dj');

    // Room A's device token must be worthless against room B.
    const crossB = await authorizeDevice(ROOM_B, res.deviceToken);
    expect(crossB).toBeNull();
  });

  it('a revoked device is denied', async () => {
    const dev = await createDeviceSession({
      roomId: ROOM_A,
      rawToken: 'raw-dev-token',
      role: 'dj',
      label: 'iPad',
    });
    expect(await authorizeDevice(ROOM_A, 'raw-dev-token')).not.toBeNull();
    await revokeDevice(ROOM_A, dev.id);
    expect(await authorizeDevice(ROOM_A, 'raw-dev-token')).toBeNull();
  });

  it('an empty / unknown token is denied', async () => {
    expect(await authorizeDevice(ROOM_A, '')).toBeNull();
    expect(await authorizeDevice(ROOM_A, 'nope')).toBeNull();
  });
});
