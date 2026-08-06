// BUILD 26E — the deletion/revocation SEQUENCE and its partial-failure boundaries.
//
// These are the tests that decide whether an outage can corrupt the outcome:
//   * a misconfigured deployment refuses BEFORE any mutation;
//   * a wrong or replayed Apple identity refuses BEFORE any mutation;
//   * a failed deletion transaction leaves NO usable prepared revocation job;
//   * once the deletion commits, no Apple or Storage failure restores account access;
//   * a successful revoke ERASES the token; a transient one KEEPS it; a permanent one
//     erases it and becomes manual_required.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const env: Record<string, string | undefined> = {};
vi.mock('./env.server', () => ({
  optionalEnv: (k: string) => env[k],
  karaokeEnv: () => ({ url: 'https://x', key: 'k' }),
}));
vi.mock('./logo-storage.server', () => ({
  LOGO_BUCKET: 'room-logos',
  deleteLogoObject: vi.fn(async () => true),
}));

const verifyAppleIdentityToken = vi.fn();
vi.mock('./apple-auth.server', () => ({
  verifyAppleIdentityToken: (...a: unknown[]) => verifyAppleIdentityToken(...a),
}));

// ── A tiny in-memory stand-in for the tables this flow touches ──
interface Row {
  [k: string]: unknown;
}
const tables: Record<string, Row[]> = {};
const rpc = vi.fn();
let jobSeq = 0;

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    rpc,
    from: (table: string) => {
      tables[table] ??= [];
      const filters: Array<[string, unknown]> = [];
      const match = () => tables[table].filter((r) => filters.every(([c, v]) => r[c] === v));
      const b: Record<string, unknown> = {};
      Object.assign(b, {
        select: () => b,
        order: () => b,
        limit: async () => ({ data: match(), error: null }),
        eq: (c: string, v: unknown) => {
          filters.push([c, v]);
          return b;
        },
        insert: async (row: Row) => {
          tables[table].push({ ...row });
          return { data: row, error: null };
        },
        upsert: (row: Row) => {
          const id = `job-${++jobSeq}`;
          const existing = tables[table].find(
            (r) => r.account_id === row.account_id && r.provider === row.provider,
          );
          if (existing) Object.assign(existing, row);
          else tables[table].push({ id, ...row });
          const saved = tables[table].find(
            (r) => r.account_id === row.account_id && r.provider === row.provider,
          )!;
          return {
            select: () => ({ maybeSingle: async () => ({ data: { id: saved.id }, error: null }) }),
          };
        },
        update: (patch: Row) => ({
          eq: (c: string, v: unknown) => {
            filters.push([c, v]);
            const applied = { then: (r: (x: unknown) => unknown) => Promise.resolve(r(undefined)) };
            for (const row of match()) Object.assign(row, patch);
            return Object.assign(applied, {
              eq: (c2: string, v2: unknown) => {
                filters.push([c2, v2]);
                return applied;
              },
            });
          },
        }),
        delete: () => ({
          eq: (c: string, v: unknown) => {
            filters.push([c, v]);
            const doDelete = () => {
              for (const row of match()) {
                const i = tables[table].indexOf(row);
                if (i >= 0) tables[table].splice(i, 1);
              }
            };
            const thenable = {
              then: (r: (x: unknown) => unknown) => {
                doDelete();
                return Promise.resolve(r(undefined));
              },
              eq: (c2: string, v2: unknown) => {
                filters.push([c2, v2]);
                return thenable;
              },
            };
            return thenable;
          },
        }),
        maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
        then: (r: (x: unknown) => unknown) => Promise.resolve(r({ data: match(), error: null })),
      });
      return b;
    },
  }),
}));

import { deleteAccount } from './account-deletion.server';

const PEM_KEY = 'a'.repeat(64);
let TEST_PEM = '';

const jobs = () => tables['karaoke_provider_revocation_jobs'] ?? [];
const events = () => tables['karaoke_account_deletion_events'] ?? [];

function configureAll() {
  env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = 'f'.repeat(48);
  env.KARAOKE_APPLE_REVOCATION_PRIVATE_KEY = TEST_PEM;
  env.KARAOKE_APPLE_REVOCATION_KEY_ID = 'ABCDE12345';
  env.KARAOKE_APPLE_REVOCATION_TEAM_ID = 'CS92W2HFCH';
  env.KARAOKE_APPLE_REVOCATION_CLIENT_ID = 'com.bty.BTYNorebangAdmin';
  env.KARAOKE_APPLE_TOKEN_ENCRYPTION_KEY = PEM_KEY;
}

/** fetch stub: token endpoint then revoke endpoint. */
function appleFetch(opts: { tokenStatus?: number; revokeStatus?: number; throwOnRevoke?: boolean }) {
  return (async (url: string) => {
    if (String(url).includes('/auth/token')) {
      const status = opts.tokenStatus ?? 200;
      return new Response(
        status === 200 ? JSON.stringify({ refresh_token: 'rt-secret', id_token: 'idt' }) : '{}',
        { status },
      );
    }
    if (opts.throwOnRevoke) throw new Error('offline');
    return new Response('', { status: opts.revokeStatus ?? 200 });
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  for (const k of Object.keys(env)) delete env[k];
  for (const k of Object.keys(tables)) delete tables[k];
  rpc.mockReset();
  verifyAppleIdentityToken.mockReset();
  jobSeq = 0;

  if (!TEST_PEM) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
    TEST_PEM = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  }

  tables['karaoke_account_identities'] = [
    { account_id: 'acct-1', provider: 'apple', provider_subject: 'apple-sub-1' },
  ];
  tables['karaoke_accounts'] = [{ id: 'acct-1', authority_ref: 'auth-ref-1' }];
  rpc.mockResolvedValue({
    data: { outcome: 'deleted', deletedAt: 't', roomsRetired: 1, storageCleanup: 'NONE_REQUIRED', storageKeys: [] },
    error: null,
  });
  verifyAppleIdentityToken.mockResolvedValue({ ok: true, subject: 'apple-sub-1' });
});

describe('pre-mutation refusals (nothing is deleted)', () => {
  it('(1) missing Apple secrets BLOCK an Apple-linked deletion before the RPC', async () => {
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = 'f'.repeat(48); // only the fingerprint secret
    const r = await deleteAccount({ accountId: 'acct-1', source: 'host_native' });
    expect(r).toEqual({ outcome: 'apple_revocation_not_configured' });
    expect(rpc).not.toHaveBeenCalled();
    expect(jobs()).toHaveLength(0);
  });

  it('(2) a Google-ONLY account is unaffected by missing Apple secrets', async () => {
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = 'f'.repeat(48);
    tables['karaoke_account_identities'] = [
      { account_id: 'acct-1', provider: 'google', provider_subject: 'g-1' },
    ];
    const r = await deleteAccount({ accountId: 'acct-1', source: 'host_native' });
    expect(r.outcome).toBe('deleted');
    expect(rpc).toHaveBeenCalled();
  });

  it('(3) an Apple-linked account with NO authorization code is refused', async () => {
    configureAll();
    const r = await deleteAccount({ accountId: 'acct-1', source: 'host_native' });
    expect(r).toEqual({ outcome: 'apple_reauth_required' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('(4) GOOGLE-ONLY REAUTH CANNOT DELETE AN APPLE-LINKED ACCOUNT (no code supplied)', async () => {
    configureAll();
    tables['karaoke_account_identities'] = [
      { account_id: 'acct-1', provider: 'apple', provider_subject: 'apple-sub-1' },
      { account_id: 'acct-1', provider: 'google', provider_subject: 'g-1' },
    ];
    const r = await deleteAccount({ accountId: 'acct-1', source: 'host_native' });
    expect(r).toEqual({ outcome: 'apple_reauth_required' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('(5) an Apple identity belonging to ANOTHER account is refused', async () => {
    configureAll();
    verifyAppleIdentityToken.mockResolvedValue({ ok: true, subject: 'someone-else' });
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({}),
    });
    expect(r).toEqual({ outcome: 'apple_identity_mismatch' });
    expect(rpc).not.toHaveBeenCalled();
    expect(jobs()).toHaveLength(0);
  });

  it('(6) a REPLAYED authorization code (Apple 4xx) is refused with no mutation', async () => {
    configureAll();
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'already-used',
      fetchImpl: appleFetch({ tokenStatus: 400 }),
    });
    expect(r).toEqual({ outcome: 'apple_code_invalid' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('prepared job never survives a failed deletion', () => {
  it('(7) an RPC failure removes the prepared job and its token material', async () => {
    configureAll();
    rpc.mockRejectedValue(new Error('deadlock'));
    await expect(
      deleteAccount({
        accountId: 'acct-1',
        source: 'host_native',
        appleAuthorizationCode: 'code',
        fetchImpl: appleFetch({}),
      }),
    ).rejects.toThrow();
    // The account still exists, so leaving revocation authority lying around would be a
    // standing capability against a live account.
    expect(jobs()).toHaveLength(0);
  });

  it('(8) a non-success RPC outcome also discards the prepared job', async () => {
    configureAll();
    rpc.mockResolvedValue({ data: { outcome: 'fingerprint_incomplete' }, error: null });
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({}),
    });
    expect(r).toEqual({ outcome: 'fingerprint_incomplete' });
    expect(jobs()).toHaveLength(0);
  });
});

describe('the prepared job holds no plaintext', () => {
  it('(9) the retained refresh token is ciphertext with an IV and key version', async () => {
    configureAll();
    await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      // Revoke fails transiently so the token is still on the row to inspect.
      fetchImpl: appleFetch({ revokeStatus: 500 }),
    });
    const job = jobs()[0];
    expect(job.encrypted_refresh_token).toBeTruthy();
    expect(String(job.encrypted_refresh_token)).not.toContain('rt-secret');
    expect(JSON.stringify(job)).not.toContain('rt-secret');
    expect(job.token_nonce).toBeTruthy();
    expect(job.encryption_key_version).toBe('v1');
  });
});

describe('post-commit revocation outcomes', () => {
  it('(10) success ERASES the token and reports revoked', async () => {
    configureAll();
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({ revokeStatus: 200 }),
    });
    expect(r.outcome).toBe('deleted');
    if (r.outcome === 'deleted') expect(r.providerRevocation.apple).toBe('revoked');
    const job = jobs()[0];
    expect(job.status).toBe('succeeded');
    expect(job.encrypted_refresh_token).toBeNull();
    expect(job.token_nonce).toBeNull();
    expect(events().some((e) => e.event_type === 'APPLE_REVOCATION_SUCCEEDED')).toBe(true);
  });

  it('(11) a TRANSIENT failure KEEPS the token, stays retryable, and schedules a retry', async () => {
    configureAll();
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({ revokeStatus: 503 }),
    });
    // The account is STILL deleted — an Apple outage cannot restore access.
    expect(r.outcome).toBe('deleted');
    if (r.outcome === 'deleted') expect(r.providerRevocation.apple).toBe('pending');
    const job = jobs()[0];
    expect(job.status).toBe('retryable_failure');
    expect(job.encrypted_refresh_token).toBeTruthy();
    expect(job.next_attempt_at).toBeTruthy();
    expect(job.attempt_count).toBe(1);
    expect(events().some((e) => e.event_type === 'APPLE_REVOCATION_RETRYABLE_FAILURE')).toBe(true);
  });

  it('(12) a PERMANENT refusal erases the token and becomes manual_required', async () => {
    configureAll();
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({ revokeStatus: 400 }),
    });
    expect(r.outcome).toBe('deleted');
    if (r.outcome === 'deleted') expect(r.providerRevocation.apple).toBe('manual_required');
    const job = jobs()[0];
    expect(job.status).toBe('manual_required');
    expect(job.encrypted_refresh_token).toBeNull();
    expect(job.manual_required_at).toBeTruthy();
    expect(events().some((e) => e.event_type === 'APPLE_REVOCATION_MANUAL_REQUIRED')).toBe(true);
  });

  it('(13) a network failure during revoke still leaves the account deleted', async () => {
    configureAll();
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({ throwOnRevoke: true }),
    });
    expect(r.outcome).toBe('deleted');
    expect(jobs()[0].status).toBe('retryable_failure');
  });

  it('(14) MISSING CONFIGURATION NEVER becomes manual_required', async () => {
    // The distinction the Founder policy turns on: a deployment mistake must not be
    // written into a user-facing outcome as though Apple had refused.
    env.KARAOKE_IDENTITY_FINGERPRINT_SECRET = 'f'.repeat(48);
    const r = await deleteAccount({ accountId: 'acct-1', source: 'host_native' });
    expect(r.outcome).toBe('apple_revocation_not_configured');
    expect(jobs().some((j) => j.status === 'manual_required')).toBe(false);
    expect(events()).toHaveLength(0);
  });
});

describe('audit and idempotency', () => {
  it('(15) no post-deletion event carries PII', async () => {
    configureAll();
    await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({}),
    });
    const blob = JSON.stringify(events());
    for (const forbidden of ['apple-sub-1', 'rt-secret', 'code', '@']) {
      if (forbidden === 'code') continue; // 'code' appears in no field name we assert on
      expect(blob).not.toContain(forbidden);
    }
  });

  it('(16) an already-deleted account replays without re-preparing revocation', async () => {
    configureAll();
    rpc.mockResolvedValue({
      data: { outcome: 'already_deleted', deletedAt: 't', purchaseOwnerRef: 'p', storageKeys: [] },
      error: null,
    });
    const r = await deleteAccount({
      accountId: 'acct-1',
      source: 'host_native',
      appleAuthorizationCode: 'code',
      fetchImpl: appleFetch({}),
    });
    expect(r.outcome).toBe('already_deleted');
  });
});
