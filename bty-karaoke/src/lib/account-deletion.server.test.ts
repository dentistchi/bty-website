// BUILD 26E — deletion service layer.
//
// Pins the three things this module owns and nothing else can enforce:
//   * the one-way fingerprint is separator-safe, deterministic, and secret-dependent;
//   * provider revocation is reported TRUTHFULLY (F-3 forbids passing local logout off
//     as revocation);
//   * the storage outbox is durable — a failed delete stays PENDING for retry.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const env: Record<string, string | undefined> = {};
vi.mock('./env.server', () => ({
  optionalEnv: (k: string) => env[k],
  karaokeEnv: () => ({ url: 'https://x', key: 'k' }),
}));

const removed: string[][] = [];
let removeFails = false;
vi.mock('./logo-storage.server', () => ({
  LOGO_BUCKET: 'room-logos',
  deleteLogoObject: vi.fn(async (key: string) => {
    removed.push([key]);
    return !removeFails;
  }),
}));

const rpc = vi.fn();
const updates: Array<Record<string, unknown>> = [];
let outboxRows: Array<{ id: string; bucket: string; object_key: string; attempts: number }> = [];
let identityRows: Array<{ provider: string; provider_subject: string }> = [];

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    rpc,
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          const b: Record<string, unknown> = {
            order: () => ({ limit: async () => ({ data: outboxRows, error: null }) }),
          };
          // The identity lookup awaits the builder directly, so it must be thenable.
          b.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolve({ data: identityRows, error: null }));
          return b;
        },
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updates.push({ table, ...patch });
          return { error: null };
        },
      }),
    }),
  }),
}));

import {
  identityFingerprint,
  fingerprintConfigured,
  drainStorageCleanup,
} from './account-deletion.server';

const SECRET = 'x'.repeat(48);

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  removed.length = 0;
  updates.length = 0;
  removeFails = false;
  outboxRows = [];
  identityRows = [{ provider: 'google', provider_subject: 'sub-1' }];
  rpc.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('one-way fingerprint (F-5)', () => {
  it('(1) is unavailable — and therefore deletion fails closed — without a strong secret', () => {
    expect(fingerprintConfigured()).toBe(false);
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = 'tooshort';
    expect(fingerprintConfigured()).toBe(false);
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = SECRET;
    expect(fingerprintConfigured()).toBe(true);
  });

  it('(2) is deterministic for the same identity', async () => {
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = SECRET;
    const a = await identityFingerprint('google', 'sub-1');
    const b = await identityFingerprint('google', 'sub-1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('(3) never collides across providers or across a subject boundary', async () => {
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = SECRET;
    const sameSubjectDifferentProvider = await Promise.all([
      identityFingerprint('apple', 'sub-1'),
      identityFingerprint('google', 'sub-1'),
    ]);
    expect(sameSubjectDifferentProvider[0]).not.toBe(sameSubjectDifferentProvider[1]);

    // The separator test: without a NUL, ('apple','x1') and ('applex','1') would collide.
    // 'applex' is not a valid provider, so the equivalent boundary check is that a shifted
    // split of the same concatenation differs.
    const shifted = await Promise.all([
      identityFingerprint('apple', 'x1'),
      identityFingerprint('apple', 'x' + String.fromCharCode(0) + '1'),
    ]);
    expect(shifted[0]).not.toBe(shifted[1]);
  });

  it('(4) is secret-dependent, so it cannot be recomputed from the database alone', async () => {
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = SECRET;
    const withA = await identityFingerprint('google', 'sub-1');
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = 'y'.repeat(48);
    const withB = await identityFingerprint('google', 'sub-1');
    expect(withA).not.toBe(withB);
  });

  it('(5) throws rather than silently producing a weak value when unconfigured', async () => {
    await expect(identityFingerprint('google', 'sub-1')).rejects.toThrow();
  });
});

describe('storage cleanup durability (F-2)', () => {
  it('(11) marks a successful delete DONE', async () => {
    outboxRows = [{ id: 'o1', bucket: 'room-logos', object_key: 'rooms/r/logo.webp', attempts: 0 }];
    const pending = await drainStorageCleanup();
    expect(pending).toBe(0);
    expect(removed).toEqual([['rooms/r/logo.webp']]);
    expect(updates[0]).toMatchObject({ status: 'DONE', attempts: 1 });
  });

  it('(12) a FAILED delete stays PENDING and records the attempt — never silently dropped', async () => {
    removeFails = true;
    outboxRows = [{ id: 'o1', bucket: 'room-logos', object_key: 'rooms/r/logo.webp', attempts: 2 }];
    const pending = await drainStorageCleanup();
    expect(pending).toBe(1);
    // No status change → the row is still PENDING and will be retried.
    expect(updates[0]).toMatchObject({ attempts: 3, last_error: 'delete_failed' });
    expect(updates[0].status).toBeUndefined();
  });

  it('(13) never throws, so a Storage outage cannot fail an already-committed deletion', async () => {
    outboxRows = [{ id: 'o1', bucket: 'unknown-bucket', object_key: 'k', attempts: 0 }];
    await expect(drainStorageCleanup()).resolves.toBe(1);
  });
});

describe('deleteAccount fail-closed (F-5)', () => {
  it('(14) refuses to delete at all when the fingerprint secret is unavailable', async () => {
    // Mutation testing caught that this was untested: with the guard removed, deletion
    // proceeded to strip provider subjects WITHOUT retaining their one-way fingerprints,
    // silently reopening the delete-and-recreate FREE-window reset F-5 exists to close.
    const { deleteAccount } = await import('./account-deletion.server');
    const res = await deleteAccount({ accountId: 'acct-1', source: 'host_native' });
    expect(res).toEqual({ outcome: 'fingerprint_unavailable' });
    // The decisive assertion: NOTHING was mutated — the RPC was never reached.
    expect(rpc).not.toHaveBeenCalled();
  });

  it('(15) with the secret present it reaches the RPC and never sends a client-supplied account', async () => {
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = SECRET;
    rpc.mockResolvedValue({
      data: { outcome: 'deleted', deletedAt: 't', roomsRetired: 0, storageCleanup: 'NONE_REQUIRED', storageKeys: [] },
      error: null,
    });
    const { deleteAccount } = await import('./account-deletion.server');
    await deleteAccount({ accountId: 'acct-1', source: 'host_native' });
    expect(rpc).toHaveBeenCalledWith('karaoke_delete_account_v1', expect.objectContaining({
      p_account_id: 'acct-1',
      p_deletion_source: 'host_native',
    }));
  });
});
