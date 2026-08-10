// POST /api/host/identities — Apple linking symmetry + nonce integrity (BUILD 26K).
//
// The Google leg of this route has shipped since Cross-Platform Identity V1; the Apple leg
// was correct-by-construction but never exercised, because the native client had no way to
// reach it. These tests are the proof that the SYMMETRIC path enforces the same ownership
// boundary, plus the new fail-closed nonce rule.
//
// Every negative case asserts the MUTATION BOUNDARY, not merely the status code. A 401 that
// still linked an identity would be a passing test and a broken product, so each refusal
// pins `linkIdentityToAccount` call count at 0 and the identity table byte-identical.

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** The linking authority's real outcomes, modelled over an in-memory identity table. */
type Identity = { accountId: string; provider: string; subject: string };

const db = {
  identities: [] as Identity[],
  accounts: ['acct-google-primary', 'acct-stranger'],
};

const state = {
  bearer: 'host-session-token' as string | null,
  account: { id: 'acct-google-primary', deleted_at: null } as { id: string; deleted_at: null } | null,
  /** What the provider verifiers should return next. */
  appleVerify: { ok: true, subject: 'apple-sub-NEW', email: 'host@example.com' } as
    | { ok: true; subject: string; email: string | null }
    | { ok: false; code: string; error: string },
  googleSubject: 'google-sub-UNCLAIMED',
};

/** Every argument object the Apple verifier was handed, in order. */
const appleVerifyCalls: Array<{ identityToken: string; rawNonce: string | null | undefined }> = [];
const linkCalls: Array<{ accountId: string; provider: string; subject: string }> = [];

vi.mock('@/lib/dj-auth.server', () => ({
  bearerFromHeader: () => state.bearer,
}));

vi.mock('@/lib/apple-auth.server', () => ({
  verifyAppleIdentityToken: vi.fn(async (args: { identityToken: string; rawNonce?: string | null }) => {
    appleVerifyCalls.push({ identityToken: args.identityToken, rawNonce: args.rawNonce });
    return state.appleVerify;
  }),
}));

vi.mock('@/lib/google-auth.server', () => ({
  verifyGoogleIdToken: vi.fn(async () => ({ ok: true, subject: state.googleSubject, email: null })),
}));

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async (token: string | null) => (token ? state.account : null)),
  listAccountIdentities: vi.fn(async (accountId: string) =>
    db.identities.filter((i) => i.accountId === accountId).map((i) => ({ provider: i.provider, createdAt: 'x' })),
  ),
  // The REAL ownership rules, modelled: same account → idempotent; another account →
  // refused and never re-pointed; otherwise attached.
  linkIdentityToAccount: vi.fn(async (args: { accountId: string; provider: string; subject: string }) => {
    linkCalls.push({ accountId: args.accountId, provider: args.provider, subject: args.subject });
    const existing = db.identities.find((i) => i.provider === args.provider && i.subject === args.subject);
    if (existing) {
      return existing.accountId === args.accountId ? { outcome: 'already_linked' } : { outcome: 'owned_by_other' };
    }
    db.identities.push({ accountId: args.accountId, provider: args.provider, subject: args.subject });
    return { outcome: 'linked' };
  }),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return {
    headers: { get: () => (state.bearer ? `Bearer ${state.bearer}` : null) },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

/** A Google-primary account: exactly one Google identity, no Apple identity. */
beforeEach(() => {
  db.identities = [{ accountId: 'acct-google-primary', provider: 'google', subject: 'google-sub-1' }];
  state.bearer = 'host-session-token';
  state.account = { id: 'acct-google-primary', deleted_at: null };
  state.appleVerify = { ok: true, subject: 'apple-sub-NEW', email: 'host@example.com' };
  state.googleSubject = 'google-sub-UNCLAIMED';
  appleVerifyCalls.length = 0;
  linkCalls.length = 0;
});

const snapshot = () => JSON.stringify(db.identities);

describe('POST /api/host/identities — Apple link onto a Google-primary account', () => {
  it('attaches Apple to the SAME account, keeping the Google identity', async () => {
    const before = db.identities.length;

    const res = await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', rawNonce: 'nonce-abc' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, outcome: 'linked' });

    // The account the identity landed on is the account that already existed — asserted
    // against the id directly, never inferred from the 200.
    expect(linkCalls).toHaveLength(1);
    expect(linkCalls[0].accountId).toBe('acct-google-primary');
    expect(linkCalls[0].provider).toBe('apple');

    // Exactly ONE new row, on that account; the original Google identity survives.
    expect(db.identities).toHaveLength(before + 1);
    expect(db.identities.filter((i) => i.accountId === 'acct-google-primary')).toHaveLength(2);
    expect(db.identities).toContainEqual({
      accountId: 'acct-google-primary', provider: 'google', subject: 'google-sub-1',
    });
    // No second account was invented as a side effect.
    expect(new Set(db.identities.map((i) => i.accountId))).toEqual(new Set(['acct-google-primary']));
  });

  it('forwards the EXACT rawNonce the client sent to the Apple verifier', async () => {
    await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', rawNonce: 'nonce-XYZ-987' }));

    // Replay protection is only real if the nonce actually reaches the verifier. A 200
    // proves nothing about that — this does.
    expect(appleVerifyCalls).toHaveLength(1);
    expect(appleVerifyCalls[0].rawNonce).toBe('nonce-XYZ-987');
    expect(appleVerifyCalls[0].identityToken).toBe('apple.jwt');
  });

  it('re-linking the same Apple identity is idempotent — no duplicate row', async () => {
    await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', rawNonce: 'n1' }));
    const afterFirst = snapshot();

    const res = await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', rawNonce: 'n2' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, outcome: 'already_linked' });
    expect(snapshot()).toBe(afterFirst);              // byte-identical: nothing was written
    expect(db.identities).toHaveLength(2);
  });
});

describe('POST /api/host/identities — Apple ownership conflict never merges', () => {
  it('refuses with 409 IDENTITY_TAKEN and moves nothing', async () => {
    // A REAL conflicting row: the Apple identity genuinely belongs to another account.
    // Asserting 409 against an empty table would prove nothing at all.
    db.identities.push({ accountId: 'acct-stranger', provider: 'apple', subject: 'apple-sub-TAKEN' });
    state.appleVerify = { ok: true, subject: 'apple-sub-TAKEN', email: null };
    const before = snapshot();

    const res = await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', rawNonce: 'n1' }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe('IDENTITY_TAKEN');

    // The identity is STILL the stranger's — never re-pointed, never copied, never merged.
    expect(snapshot()).toBe(before);
    expect(db.identities.find((i) => i.subject === 'apple-sub-TAKEN')!.accountId).toBe('acct-stranger');
    // The initiating account keeps exactly what it had: its Google identity, no Apple.
    const mine = db.identities.filter((i) => i.accountId === 'acct-google-primary');
    expect(mine).toHaveLength(1);
    expect(mine[0].provider).toBe('google');
  });
});

describe('POST /api/host/identities — refusals reach ZERO mutation', () => {
  it('an unverified Apple token is 401 and never reaches the linking authority', async () => {
    state.appleVerify = { ok: false, code: 'BAD_SIGNATURE', error: 'nope' };
    const before = snapshot();

    const res = await POST(makeReq({ provider: 'apple', identityToken: 'forged.jwt', rawNonce: 'n1' }));

    expect(res.status).toBe(401);
    expect(linkCalls).toHaveLength(0);               // the mutation boundary was never crossed
    expect(snapshot()).toBe(before);
  });

  it('no Host session is 401 and never reaches the linking authority', async () => {
    state.bearer = null;
    state.account = null;
    const before = snapshot();

    const res = await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', rawNonce: 'n1' }));

    expect(res.status).toBe(401);
    expect(linkCalls).toHaveLength(0);
    expect(appleVerifyCalls).toHaveLength(0);        // not even a token verification
    expect(snapshot()).toBe(before);
  });

  // BUILD 26K fail-closed rule. Each shape must refuse BEFORE verification, because a
  // verifier handed no nonce silently stops checking the token's nonce claim.
  const nonceShapes: Array<[string, Record<string, unknown>]> = [
    ['absent', {}],
    ['null', { rawNonce: null }],
    ['empty string', { rawNonce: '' }],
    ['whitespace only', { rawNonce: '   ' }],
    ['tab/newline only', { rawNonce: '\t\n ' }],
    ['wrong type (number)', { rawNonce: 12345 }],
  ];

  for (const [label, extra] of nonceShapes) {
    it(`an Apple link with a ${label} nonce is refused with zero mutation`, async () => {
      const before = snapshot();

      const res = await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', ...extra }));
      const json = await res.json();

      expect(res.status).toBe(401);
      // Identical to a failed verification — the endpoint does not narrate which part failed.
      expect(json.error).toBe('That sign-in could not be verified.');
      // Refused BEFORE the verifier, so a nonce-less token is never even evaluated.
      expect(appleVerifyCalls).toHaveLength(0);
      expect(linkCalls).toHaveLength(0);
      expect(snapshot()).toBe(before);
    });
  }

  it('MUTATION GUARD: the same request WITH a nonce does link — so the refusals above are the nonce rule, not a dead route', async () => {
    // Without this control, every zero-mutation assertion above would also pass if the
    // route were broken end-to-end.
    const res = await POST(makeReq({ provider: 'apple', identityToken: 'apple.jwt', rawNonce: 'n1' }));
    expect(res.status).toBe(200);
    expect(linkCalls).toHaveLength(1);
  });
});

describe('POST /api/host/identities — Google leg is unchanged by BUILD 26K', () => {
  it('a Google link with NO nonce still succeeds (Apple rule did not leak across providers)', async () => {
    state.account = { id: 'acct-stranger', deleted_at: null };
    const res = await POST(makeReq({ provider: 'google', idToken: 'google.jwt' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, outcome: 'linked' });
    expect(linkCalls[0]).toMatchObject({ accountId: 'acct-stranger', provider: 'google' });
  });

  it('an unknown provider is still a 400 with zero mutation', async () => {
    const before = snapshot();
    const res = await POST(makeReq({ provider: 'facebook', idToken: 'x', rawNonce: 'n' }));
    expect(res.status).toBe(400);
    expect(linkCalls).toHaveLength(0);
    expect(snapshot()).toBe(before);
  });
});
