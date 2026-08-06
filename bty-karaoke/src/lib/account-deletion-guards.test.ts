// BUILD 26E — the two guards that make a deletion actually take effect.
//
//   1. a DELETED account authenticates as nobody, even holding a live token;
//   2. a RETIRED room has zero usable administrative authority.
//
// Both are re-resolved per request rather than baked into a credential, which is the
// existing Host Account V1 discipline — these tests pin that the deletion states join it.

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface AccountRow {
  id: string;
  provider: string | null;
  provider_subject: string | null;
  email: string | null;
  display_name: string | null;
  created_at: string;
  deleted_at: string | null;
}

const db = {
  session: null as { id: string; account_id: string; status: string; expires_at: string } | null,
  account: null as AccountRow | null,
};

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === 'karaoke_host_sessions' ? db.session : db.account,
            error: null,
          }),
        }),
      }),
      update: () => ({ eq: () => ({ then: (f: (v: unknown) => void) => f(undefined) }) }),
    }),
  }),
}));
vi.mock('./dj-auth.server', () => ({
  sha256Hex: async (s: string) => `hash:${s}`,
  randomToken: () => 'tok',
}));
vi.mock('./host-plan.server', () => ({ ensureDefaultFreePlan: vi.fn(async () => undefined) }));
vi.mock('@/domain/room-slug', () => ({ buildRoomSlug: () => 'slug' }));

import { authorizeHost } from './host-auth.server';
import { isRetiredRoom } from './rooms.server';

const LIVE_SESSION = {
  id: 's1',
  account_id: 'acct-1',
  status: 'active',
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
};

const account = (deleted_at: string | null): AccountRow => ({
  id: 'acct-1',
  provider: null,
  provider_subject: null,
  email: deleted_at ? null : 'a@example.com',
  display_name: null,
  created_at: '2026-01-01T00:00:00Z',
  deleted_at,
});

beforeEach(() => {
  db.session = { ...LIVE_SESSION };
  db.account = account(null);
});

describe('deleted-account authentication guard', () => {
  it('(1) a live account with a live session authorizes normally', async () => {
    const a = await authorizeHost('raw-token');
    expect(a?.id).toBe('acct-1');
  });

  it('(2) a DELETED account does NOT authorize, even with an unexpired ACTIVE session', async () => {
    // This is the belt to the deletion RPC's braces: deletion revokes every session, but
    // authorization must not depend on that having succeeded.
    db.account = account('2026-08-05T00:00:00Z');
    expect(await authorizeHost('raw-token')).toBeNull();
  });

  it('(3) the deleted account is indistinguishable from an unknown token', async () => {
    db.account = account('2026-08-05T00:00:00Z');
    const deleted = await authorizeHost('raw-token');
    db.session = null;
    const unknown = await authorizeHost('raw-token');
    expect(deleted).toBe(unknown); // both exactly null — no oracle
  });

  it('(4) a revoked session still fails for a live account', async () => {
    db.session = { ...LIVE_SESSION, status: 'revoked' };
    expect(await authorizeHost('raw-token')).toBeNull();
  });
});

describe('retired-room predicate', () => {
  it('(5) recognizes only the retired state', () => {
    expect(isRetiredRoom({ status: 'retired' })).toBe(true);
    expect(isRetiredRoom({ status: 'open' })).toBe(false);
    expect(isRetiredRoom({ status: 'closed' })).toBe(false);
  });

  it('(6) a missing room is not "retired" — absence and retirement are different answers', () => {
    expect(isRetiredRoom(null)).toBe(false);
    expect(isRetiredRoom(undefined)).toBe(false);
  });
});
