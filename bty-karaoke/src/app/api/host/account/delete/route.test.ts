// POST /api/host/account/delete — BUILD 26E permanent deletion route.
//
// The properties pinned here are the ones an attacker or a bug would exploit:
//   * the account comes from the SESSION and a body-supplied accountId changes nothing;
//   * deletion is unreachable without the exact confirmation phrase and a FRESH re-auth;
//   * a cookie caller must pass CSRF; a Bearer caller is not cookie-ambient;
//   * a retried deletion is indistinguishable from the first;
//   * a missing fingerprint secret fails CLOSED, having deleted nothing.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  account: null as { id: string; deleted_at: string | null } | null,
  csrfOk: true,
};

vi.mock('@/lib/dj-auth.server', () => ({
  bearerFromHeader: (h: string | null) => (h ? h.replace(/^Bearer\s+/, '') : null),
}));
vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
}));
vi.mock('@/lib/host-web-session.server', () => ({
  hostTokenFromRequest: (req: { headers: { get: (k: string) => string | null } }) =>
    req.headers.get('cookie')?.includes('bty_host=') ? 'cookie-token' : null,
  clearedHostCookie: () => ({ name: 'bty_host', value: '', path: '/', maxAge: 0 }),
}));
vi.mock('@/lib/host-csrf.server', () => ({
  verifyHostCsrf: vi.fn(async () => (state.csrfOk ? { ok: true } : { ok: false, reason: 'bad_token' })),
}));
vi.mock('@/lib/rate-limit.server', () => ({
  makeLimiter: vi.fn(async () => null),
  isLockedOut: vi.fn(async () => false),
  recordFailure: vi.fn(async () => undefined),
}));

const deleteAccount = vi.fn();
vi.mock('@/lib/account-deletion.server', () => ({
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
}));

import { POST, DELETE_CONFIRMATION, RECENT_AUTH_MAX_AGE_MS } from './route';

function req(body: unknown, opts: { auth?: string | null; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth !== null) headers.authorization = opts.auth ?? 'Bearer tok';
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request('https://x/api/host/account/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

const fresh = () => new Date().toISOString();
const good = () => ({ confirmation: DELETE_CONFIRMATION, reauthenticatedAt: fresh() });

beforeEach(() => {
  state.account = { id: 'acct-1', deleted_at: null };
  state.csrfOk = true;
  deleteAccount.mockReset();
  deleteAccount.mockResolvedValue({
    outcome: 'deleted',
    deletedAt: '2026-08-05T00:00:00Z',
    roomsRetired: 2,
    storageCleanup: 'ENQUEUED',
    storagePending: 0,
    providerRevocation: { apple: 'revoked', google: 'not_linked' },
  });
});

describe('authority', () => {
  it('(1) derives the account from the SESSION', async () => {
    const res = await POST(req(good()));
    expect(res.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acct-1', source: 'host_native' }));
  });

  it('(2) a body-supplied accountId cannot redirect the deletion', async () => {
    const res = await POST(req({ ...good(), accountId: 'victim-account' }));
    expect(res.status).toBe(200);
    // Still the session account — the body value never reaches the service layer.
    expect(deleteAccount).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acct-1', source: 'host_native' }));
    expect(deleteAccount).not.toHaveBeenCalledWith(expect.objectContaining({ accountId: 'victim-account' }));
  });

  it('(3) unauthenticated → uniform 401 and NO deletion', async () => {
    state.account = null;
    const res = await POST(req(good()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});

describe('destructive confirmation', () => {
  it('(4) refuses without the exact confirmation phrase', async () => {
    const res = await POST(req({ confirmation: 'yes', reauthenticatedAt: fresh() }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'confirmation_required' });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('(5) refuses an empty body', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});

describe('recent re-authentication', () => {
  it('(6) refuses a stale re-auth', async () => {
    const stale = new Date(Date.now() - RECENT_AUTH_MAX_AGE_MS - 1000).toISOString();
    const res = await POST(req({ confirmation: DELETE_CONFIRMATION, reauthenticatedAt: stale }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'reauth_required' });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('(7) refuses an unparseable re-auth timestamp', async () => {
    const res = await POST(req({ confirmation: DELETE_CONFIRMATION, reauthenticatedAt: 'soon' }));
    expect(res.status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('(8) refuses a FUTURE-dated re-auth (a client clock cannot buy extra validity)', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const res = await POST(req({ confirmation: DELETE_CONFIRMATION, reauthenticatedAt: future }));
    expect(res.status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});

describe('CSRF', () => {
  it('(9) a cookie caller with a bad CSRF token is refused', async () => {
    state.csrfOk = false;
    const res = await POST(req(good(), { auth: null, cookie: 'bty_host=abc' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'csrf_failed' });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('(10) a cookie caller with a valid CSRF token deletes as host_web', async () => {
    const res = await POST(req({ ...good(), csrf: 'tok' }, { auth: null, cookie: 'bty_host=abc' }));
    expect(res.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acct-1', source: 'host_web' }));
  });

  it('(11) a Bearer caller is not CSRF-gated (no ambient credential to abuse)', async () => {
    state.csrfOk = false;
    const res = await POST(req(good()));
    expect(res.status).toBe(200);
  });
});

describe('idempotency and failure', () => {
  it('(12) a repeated deletion is INDISTINGUISHABLE from the first', async () => {
    const first = await POST(req(good()));
    const firstBody = await first.json();

    deleteAccount.mockResolvedValue({
      outcome: 'already_deleted',
      deletedAt: '2026-08-05T00:00:00Z',
      roomsRetired: 2,
      storageCleanup: 'NONE_REQUIRED',
      storagePending: 0,
      providerRevocation: { apple: 'revoked', google: 'not_linked' },
    });
    const second = await POST(req(good()));
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(firstBody);
  });

  it('(13) a missing fingerprint secret fails CLOSED with 503, not a partial delete', async () => {
    deleteAccount.mockResolvedValue({ outcome: 'fingerprint_unavailable' });
    const res = await POST(req(good()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'deletion_unavailable' });
  });

  it('(14) an incomplete fingerprint set also fails closed', async () => {
    deleteAccount.mockResolvedValue({ outcome: 'fingerprint_incomplete' });
    const res = await POST(req(good()));
    expect(res.status).toBe(503);
  });

  it('(15) reports pending storage cleanup truthfully', async () => {
    deleteAccount.mockResolvedValue({
      outcome: 'deleted',
      deletedAt: 'now',
      roomsRetired: 1,
      storageCleanup: 'ENQUEUED',
      storagePending: 3,
      providerRevocation: { apple: 'revoked', google: 'not_linked' },
    });
    const res = await POST(req(good()));
    expect((await res.json()).storageCleanup).toBe('pending');
  });

  it('(16) the response exposes ONLY the three permitted keys', async () => {
    const body = await (await POST(req(good()))).json();
    expect(Object.keys(body).sort()).toEqual(
      ['providerRevocation', 'status', 'storageCleanup'].sort(),
    );
    // Explicitly none of the forbidden internals.
    const blob = JSON.stringify(body);
    for (const forbidden of ['acct-1', 'accountId', 'refresh', 'authorizationCode', 'auditId']) {
      expect(blob).not.toContain(forbidden);
    }
  });
});

describe('Apple revocation authority (BUILD 26E revision)', () => {
  it('(17) a deployment without Apple secrets answers 503 apple_revocation_not_configured', async () => {
    // The Founder rule: this is a DEPLOYMENT failure, so it is a distinct machine code —
    // never a per-user audit outcome and never a generic "deletion unavailable".
    deleteAccount.mockResolvedValue({ outcome: 'apple_revocation_not_configured' });
    const res = await POST(req(good()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'apple_revocation_not_configured' });
  });

  it('(18) a missing Apple authorization code asks for re-authentication', async () => {
    deleteAccount.mockResolvedValue({ outcome: 'apple_reauth_required' });
    const res = await POST(req(good()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'apple_reauth_required' });
  });

  it('(19) an Apple identity for another account is a 409, revealing nothing else', async () => {
    deleteAccount.mockResolvedValue({ outcome: 'apple_identity_mismatch' });
    const res = await POST(req(good()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'apple_identity_mismatch' });
  });

  it('(20) a replayed/expired code is reported as needing re-authentication', async () => {
    deleteAccount.mockResolvedValue({ outcome: 'apple_code_invalid' });
    const res = await POST(req(good()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'apple_reauth_required' });
  });

  it('(21) the authorization code is forwarded to the service layer, never echoed back', async () => {
    const res = await POST(req({ ...good(), appleAuthorizationCode: 'apple-code-xyz' }));
    expect(deleteAccount).toHaveBeenCalledWith(
      expect.objectContaining({ appleAuthorizationCode: 'apple-code-xyz' }),
    );
    expect(JSON.stringify(await res.json())).not.toContain('apple-code-xyz');
  });

  it('(22) a PENDING Apple revocation is still a completed deletion', async () => {
    deleteAccount.mockResolvedValue({
      outcome: 'deleted',
      deletedAt: 'now',
      roomsRetired: 0,
      storageCleanup: 'NONE_REQUIRED',
      storagePending: 0,
      providerRevocation: { apple: 'pending', google: 'not_linked' },
    });
    const res = await POST(req(good()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('deleted');
    expect(body.providerRevocation.apple).toBe('pending');
  });

  it('(23) manual_required is reported without softening the deletion', async () => {
    deleteAccount.mockResolvedValue({
      outcome: 'deleted',
      deletedAt: 'now',
      roomsRetired: 0,
      storageCleanup: 'NONE_REQUIRED',
      storagePending: 0,
      providerRevocation: { apple: 'manual_required', google: 'revoked' },
    });
    const body = await (await POST(req(good()))).json();
    expect(body.status).toBe('deleted');
    expect(body.providerRevocation).toEqual({ apple: 'manual_required', google: 'revoked' });
  });
});
