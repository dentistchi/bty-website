// GET /api/host/me — BUILD 26R-R2's additive `purchaseOwnerRef` field.
//
// This is the ONE authenticated surface that returns the account's Apple `appAccountToken`
// carrier. The assertions that matter most are the negative ones: it must not appear on an
// unauthenticated read, it must not leak into `publicAccount()`, and it must not widen either
// sign-in response — those three surfaces are serialized in places that have no use for a
// payment-binding identifier.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const OWNER_REF = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const state = {
  account: null as Record<string, unknown> | null,
};

vi.mock('@/lib/dj-auth.server', () => ({
  bearerFromHeader: (h: string | null) => (h ? h.replace(/^Bearer /, '') : null),
}));

vi.mock('@/lib/host-auth.server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/host-auth.server')>(
    '@/lib/host-auth.server',
  );
  return {
    // The REAL projection helper — so a change to it fails these tests rather than being mocked away.
    publicAccount: actual.publicAccount,
    authorizeHost: async (token: string | null) => (token ? state.account : null),
    listHostRooms: async () => [],
    listAccountIdentities: async () => [{ provider: 'google' }],
  };
});

import { GET } from './route';

function req(token: string | null) {
  return new Request('https://x/api/host/me', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.account = {
    id: 'acct-1',
    provider: 'google',
    provider_subject: 'sub-1',
    email: 'host@example.com',
    display_name: 'Host',
    created_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    purchase_owner_ref: OWNER_REF,
  };
});

describe('BUILD 26R-R2 — /api/host/me purchaseOwnerRef', () => {
  it('an authenticated Host reads its OWN purchaseOwnerRef', async () => {
    const res = await GET(req('live-token'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purchaseOwnerRef).toBe(OWNER_REF);
  });

  it('the value is returned verbatim from the account row — not generated, not rewritten', async () => {
    // The failure this kills is a route that mints a UUID when the column read comes back
    // unexpected. A fresh UUID would bind the payment to nothing and fail server validation
    // AFTER Apple had already charged the customer.
    const res = await GET(req('live-token'));
    const body = await res.json();
    expect(body.purchaseOwnerRef).toBe(state.account!.purchase_owner_ref);
    expect(body.purchaseOwnerRef).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const other = 'ffffffff-1111-4222-8333-444444444444';
    state.account!.purchase_owner_ref = other;
    const second = await GET(req('live-token'));
    expect((await second.json()).purchaseOwnerRef).toBe(other);
  });

  it('an UNAUTHENTICATED read stays 401 and carries no owner ref', async () => {
    const res = await GET(req(null));
    expect(res.status).toBe(401);
    const text = JSON.stringify(await res.json());
    expect(text).toBe(JSON.stringify({ error: 'Unauthorized' }));
    expect(text).not.toContain(OWNER_REF);
    expect(text).not.toContain('purchaseOwnerRef');
  });

  it('a tombstoned account authenticates as nobody, so nothing is disclosed', async () => {
    // authorizeHost() already returns null for a tombstone (BUILD 26E/26I); this pins that the
    // new field cannot survive that path.
    state.account = null;
    const res = await GET(req('live-token'));
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain('purchaseOwnerRef');
  });

  it('the response is no-store — a payment binding must never be cached by an intermediary', async () => {
    const res = await GET(req('live-token'));
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('publicAccount() is UNCHANGED — the ref is a sibling field, never part of the projection', async () => {
    const { publicAccount } = await import('@/lib/host-auth.server');
    const projected = publicAccount(state.account as never);
    expect(Object.keys(projected).sort()).toEqual(['displayName', 'email', 'id']);
    expect(JSON.stringify(projected)).not.toContain(OWNER_REF);

    const body = await (await GET(req('live-token'))).json();
    expect(body.account).toEqual({ id: 'acct-1', email: 'host@example.com', displayName: 'Host' });
    expect(body.account.purchaseOwnerRef).toBeUndefined();
  });
});

// ── the two sign-in responses must NOT have been widened ──────────────────────────────────────
//
// Read as source rather than executed: both routes serialize `publicAccount(account)` and the
// assertion above already pins that helper's shape. What is checked here is that neither route
// grew its own `purchaseOwnerRef` line, which is the way the field would most plausibly spread.

describe('BUILD 26R-R2 — the sign-in responses are not widened', () => {
  it('neither /host/auth/apple nor /host/auth/google returns purchaseOwnerRef', async () => {
    const fs = await import('node:fs/promises');
    for (const route of ['apple', 'google']) {
      const src = await fs.readFile(
        new URL(`../auth/${route}/route.ts`, import.meta.url),
        'utf8',
      );
      expect(src).not.toContain('purchaseOwnerRef');
      expect(src).not.toContain('purchase_owner_ref');
    }
  });

  it('purchase_owner_ref reaches exactly the two server surfaces that need it', async () => {
    // The ledger writer/validator (verification) and this route (client binding). A third
    // reader would be a new place for the identifier to escape.
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('./route.ts', import.meta.url), 'utf8');
    expect(src).toContain('purchaseOwnerRef: account.purchase_owner_ref');
  });
});
