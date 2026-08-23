// BUILD 26U-R4A — ALLOW-1 … ALLOW-16: the controlled (account + room) rollout boundary.
//
// WHY THE PAIR, NOT THE ACCOUNT. BUILD 26U-R4 measured that a global `dual` would expose 14 live
// production Events — 12 NOT entitled — to a guard that ENDS a session when entitlement is
// absent. The Founder account that runs the validation also owns `bty-home`, a live room in
// daily use, so an account-scoped allowlist would have swept it in. The tests below exist mostly
// to prove that it does not.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveReleaseContract, parseClientRelease } from '@/domain/release-contract';

// ── Pure-matrix half: ALLOW-1 … ALLOW-5, ALLOW-13, ALLOW-14 ────────────────────────────────
const N110 = parseClientRelease('native/110');
const N109 = parseClientRelease('native/109');
const WEB = parseClientRelease('web/abc');
const UNKNOWN = parseClientRelease(null);

describe('ALLOW-1..5 — inside vs outside the controlled boundary', () => {
  it('ALLOW-1: build 110 inside an allowlisted pair → premium', () => {
    expect(resolveReleaseContract('dual_allowlist', N110, true)).toBe('premium');
  });

  it('ALLOW-2/3: any room or account outside the pair → legacy', () => {
    // `inRollout` is the exact (owner account, room) answer. A different room of the SAME
    // account, and any room of a different account, both arrive here as false.
    expect(resolveReleaseContract('dual_allowlist', N110, false)).toBe('legacy');
    expect(resolveReleaseContract('dual_allowlist', WEB, false)).toBe('legacy');
  });

  it('ALLOW-4: build 109 inside an allowlisted pair is STILL legacy', () => {
    // The allowlist can never override client generation — client compatibility is checked
    // first, so a database row cannot change how an unmodifiable binary is treated.
    expect(resolveReleaseContract('dual_allowlist', N109, true)).toBe('legacy');
  });

  it('ALLOW-5: an unidentified caller inside an allowlisted pair is STILL legacy', () => {
    expect(resolveReleaseContract('dual_allowlist', UNKNOWN, true)).toBe('legacy');
  });

  it('ALLOW-4/5: and neither is ever refused under dual_allowlist — they keep working', () => {
    for (const c of [N109, UNKNOWN]) {
      for (const inRollout of [true, false]) {
        expect(resolveReleaseContract('dual_allowlist', c, inRollout)).not.toBe('unsupported');
      }
    }
  });

  it('ALLOW-6/7: web is premium ONLY inside the pair', () => {
    expect(resolveReleaseContract('dual_allowlist', WEB, true)).toBe('premium');
    expect(resolveReleaseContract('dual_allowlist', WEB, false)).toBe('legacy');
  });
});

describe('ALLOW-13/14 — the other modes are unchanged', () => {
  it('ALLOW-13: global DUAL still ignores the allowlist entirely', () => {
    for (const inRollout of [true, false]) {
      expect(resolveReleaseContract('dual', N110, inRollout)).toBe('premium');
      expect(resolveReleaseContract('dual', WEB, inRollout)).toBe('premium');
      expect(resolveReleaseContract('dual', N109, inRollout)).toBe('legacy');
      expect(resolveReleaseContract('dual', UNKNOWN, inRollout)).toBe('legacy');
    }
  });

  it('ALLOW-14: PREMIUM_ALL still ignores the allowlist entirely', () => {
    for (const inRollout of [true, false]) {
      expect(resolveReleaseContract('premium_all', N110, inRollout)).toBe('premium');
      expect(resolveReleaseContract('premium_all', WEB, inRollout)).toBe('premium');
      expect(resolveReleaseContract('premium_all', N109, inRollout)).toBe('unsupported');
      expect(resolveReleaseContract('premium_all', UNKNOWN, inRollout)).toBe('unsupported');
    }
  });

  it('ALLOW-16: under legacy_free the allowlist is INERT — the deploy-safe state holds', () => {
    // This is what lets the mechanism and the row be installed before the mode is changed.
    for (const c of [N110, N109, WEB, UNKNOWN]) {
      for (const inRollout of [true, false]) {
        expect(resolveReleaseContract('legacy_free', c, inRollout)).toBe('legacy');
      }
    }
  });
});

// ── Server-scope half: ALLOW-8 … ALLOW-12, ALLOW-15 ────────────────────────────────────────
const root = fileURLToPath(new URL('../', import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function served(dir = root, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}${e.name}`;
    if (e.isDirectory()) served(`${p}/`, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const SOURCES = new Map(served().map((f) => [f.replace(root, 'src/'), strip(readFileSync(f, 'utf8'))]));
const MIG = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const allowSql = readFileSync(`${MIG}20260824120000_karaoke_premium_room_dual_allowlist_v1.sql`, 'utf8')
  .replace(/^\s*--.*$/gm, '');

describe('ALLOW-8 — a Guest can never become the Premium authority', () => {
  it('no guest surface resolves any release contract', () => {
    for (const f of ['src/app/api/rooms/[slug]/requests/route.ts',
                     'src/app/api/rooms/[slug]/requests/[id]/ready/route.ts',
                     'src/app/api/rooms/[slug]/requests/[id]/cancel/route.ts',
                     'src/app/r/[slug]/RequestForm.tsx']) {
      const src = SOURCES.get(f);
      if (!src) continue;
      for (const t of ['resolveRoomRelease', 'resolveAccountRelease', 'resolveRelease',
                       'assertPremiumRoomSession', 'premium_room_rollout']) {
        expect(src, `${f} must not reference "${t}"`).not.toContain(t);
      }
    }
  });
});

describe('ALLOW-9 — an allowlist row cannot create or activate a grant', () => {
  it('the migration writes no grant, no purchase, no catalog row', () => {
    for (const t of ['timed_access_pass_grants', 'timed_access_pass_audit', 'karaoke_apple_purchases',
                     'karaoke_product_catalog', 'is_active', 'fulfil_apple_purchase',
                     'issue_timed_access_pass']) {
      expect(allowSql, `the allowlist migration must not touch ${t}`).not.toContain(t);
    }
  });

  it('and it does not redefine the session-start authority', () => {
    expect(allowSql).not.toContain('karaoke_start_premium_room_session');
    expect(allowSql).not.toContain('karaoke_begin_song_v2');
  });

  it('the row carries identity and a note — nothing that could be mistaken for payment', () => {
    const table = allowSql.slice(
      allowSql.indexOf('create table if not exists public.karaoke_premium_room_rollout'),
      allowSql.indexOf('alter table public.karaoke_premium_room_rollout'),
    );
    expect(table).toContain('account_id uuid not null');
    expect(table).toContain('room_id    uuid not null');
    expect(table).toContain('primary key (account_id, room_id)');
    for (const t of ['transaction', 'apple', 'receipt', 'price', 'amount', 'entitle', 'grant', 'expires']) {
      expect(table.toLowerCase(), `the row must not carry "${t}"`).not.toContain(t);
    }
  });

  it('the browser roles cannot write it', () => {
    expect(allowSql).toContain('revoke all on table public.karaoke_premium_room_rollout from public, anon, authenticated;');
    expect(allowSql).toContain('alter table public.karaoke_premium_room_rollout enable row level security;');
    expect(allowSql).not.toMatch(/grant[^;]*to\s+(anon|authenticated)/);
  });
});

describe('ALLOW-10 — QR cannot create an allowlist row or an entitlement', () => {
  it('no QR/link module can reach the rollout table or its readers', () => {
    for (const f of ['src/lib/qr.server.ts', 'src/lib/event-links.server.ts',
                     'src/app/api/rooms/[slug]/guest-qr/route.ts']) {
      const src = SOURCES.get(f)!;
      for (const t of ['premium_room_rollout', 'roomInPremiumRollout', 'accountInPremiumRollout',
                       'resolveRoomRelease', 'resolveAccountRelease', 'timed_access_pass_grants']) {
        expect(src, `${f} must not reference "${t}"`).not.toContain(t);
      }
    }
  });

  it('participation is resolved from the room OWNER, never from a presented credential', () => {
    expect(allowSql).toContain('karaoke_room_owner_account(p_room_id)');
    // Ambiguous ownership is NOT in the rollout — the containing direction.
    expect(allowSql).toContain('if v_account is null then return false; end if;');
  });
});

describe('ALLOW-11/12 — visibility is account-scoped, enforcement is exact-pair', () => {
  it('ALLOW-11: the catalog uses the ACCOUNT scope', () => {
    const cat = SOURCES.get('src/app/api/host/commerce/catalog/route.ts')!;
    expect(cat).toContain('resolveAccountRelease(req, acct.id)');
    expect(cat).not.toContain('resolveRoomRelease');
  });

  it('ALLOW-12: every ROOM enforcement path uses the exact-pair scope', () => {
    for (const f of ['src/app/api/rooms/[slug]/dj/start/route.ts',
                     'src/app/api/rooms/[slug]/dj/pass-turn/route.ts',
                     'src/app/api/rooms/[slug]/requests/[id]/route.ts',
                     'src/app/api/rooms/[slug]/dj/start-event/route.ts',
                     'src/app/api/rooms/[slug]/admin/start-event/route.ts']) {
      const src = SOURCES.get(f)!;
      expect(src, `${f} must use the room scope`).toContain('resolveRoomRelease(req, auth.room.id)');
      expect(src, `${f} must NOT use the account scope`).not.toContain('resolveAccountRelease');
    }
  });

  it('ALLOW-12: the account scope can never authorize a hosted session', () => {
    // The session-start authority is SQL and takes a room, not an account-level flag; and no
    // route that starts a session consults the account-scoped reader (asserted above).
    const startOwner = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort().reverse()
      .find((f) => readFileSync(`${MIG}${f}`, 'utf8').includes('create or replace function public.karaoke_start_premium_room_session'))!;
    const sql = readFileSync(`${MIG}${startOwner}`, 'utf8').replace(/^\s*--.*$/gm, '');
    expect(sql).not.toContain('karaoke_account_in_premium_rollout');
  });

  it('the two readers exist and are separately scoped', () => {
    expect(allowSql).toContain('function public.karaoke_room_in_premium_rollout(p_room_id uuid)');
    expect(allowSql).toContain('function public.karaoke_account_in_premium_rollout(p_account_id uuid)');
    // A room may take part under exactly one account — a re-owned room cannot be doubly listed.
    expect(allowSql).toContain('create unique index if not exists karaoke_premium_room_rollout_room_idx');
  });
});

describe('ALLOW-15 — the FREE YouTube path ignores the allowlist entirely', () => {
  it('no free-path source can observe the rollout, the allowlist or the catalog', () => {
    for (const f of ['src/app/api/youtube/search/route.ts',
                     'src/app/r/[slug]/RequestResultCard.tsx',
                     'src/app/r/[slug]/dj/DjAddSongSheet.tsx',
                     'src/app/r/[slug]/player/PlayerClient.tsx',
                     'src/domain/youtube.ts']) {
      const src = SOURCES.get(f)!;
      for (const t of ['premium_room_rollout', 'roomInPremiumRollout', 'accountInPremiumRollout',
                       'resolveRoomRelease', 'resolveAccountRelease', 'resolveRelease',
                       'premium_room_mode', 'readActiveCommerceCatalog']) {
        expect(src, `${f} must not reference "${t}"`).not.toContain(t);
      }
    }
  });

  it('the allowlist migration touches nothing on the YouTube path', () => {
    for (const t of ['youtube', 'karaoke_video_durations', 'karaoke_requests', 'begin_song']) {
      expect(allowSql.toLowerCase(), `must not touch ${t}`).not.toContain(t.toLowerCase());
    }
  });
});

// ── Behavioural half: the scoped resolvers against a fake authority ───────────────────────
const db = { mode: 'dual_allowlist' as string, roomIn: false, acctIn: false, calls: [] as string[] };

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string) => {
      db.calls.push(name);
      if (name === 'karaoke_premium_room_mode') return Promise.resolve({ data: db.mode, error: null });
      if (name === 'karaoke_room_in_premium_rollout') return Promise.resolve({ data: db.roomIn, error: null });
      if (name === 'karaoke_account_in_premium_rollout') return Promise.resolve({ data: db.acctIn, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  }),
}));

const { resolveRoomRelease, resolveAccountRelease } = await import('./release-contract.server');
const req = (client?: string) => ({ headers: new Headers(client ? { 'x-bty-client': client } : {}) });

beforeEach(() => {
  db.mode = 'dual_allowlist';
  db.roomIn = false;
  db.acctIn = false;
  db.calls = [];
});

describe('the scoped resolvers behave as the boundary requires', () => {
  it('ALLOW-1: build 110 + allowlisted room → premium', async () => {
    db.roomIn = true;
    expect((await resolveRoomRelease(req('native/110'), 'room-x')).contract).toBe('premium');
  });

  it('ALLOW-2: build 110 + a room of the SAME account that is not listed → legacy', async () => {
    db.roomIn = false; // e.g. bty-home, owned by the same account as the test room
    expect((await resolveRoomRelease(req('native/110'), 'bty-home')).contract).toBe('legacy');
  });

  it('ALLOW-4: build 109 + allowlisted room → legacy', async () => {
    db.roomIn = true;
    expect((await resolveRoomRelease(req('native/109'), 'room-x')).contract).toBe('legacy');
  });

  it('ALLOW-5: unidentified + allowlisted room → legacy', async () => {
    db.roomIn = true;
    expect((await resolveRoomRelease(req(), 'room-x')).contract).toBe('legacy');
  });

  it('a room-scope failure fails CLOSED to legacy', async () => {
    db.roomIn = null as unknown as boolean; // RPC returned something unusable
    expect((await resolveRoomRelease(req('native/110'), 'room-x')).contract).toBe('legacy');
  });

  it('the allowlist is NOT queried outside dual_allowlist — no cost, no surprise', async () => {
    for (const m of ['legacy_free', 'dual', 'premium_all']) {
      db.mode = m;
      db.calls = [];
      await resolveRoomRelease(req('native/110'), 'room-x');
      expect(db.calls, `mode ${m}`).not.toContain('karaoke_room_in_premium_rollout');
    }
  });

  it('ALLOW-11: catalog visibility follows the ACCOUNT, not the room', async () => {
    db.acctIn = true;
    db.roomIn = false; // the account takes part, but this particular room does not
    expect((await resolveAccountRelease(req('native/110'), 'acct-1')).contract).toBe('premium');
    expect((await resolveRoomRelease(req('native/110'), 'bty-home')).contract).toBe('legacy');
  });

  it('ALLOW-16: under legacy_free everything is legacy even with both flags true', async () => {
    db.mode = 'legacy_free';
    db.roomIn = true;
    db.acctIn = true;
    expect((await resolveRoomRelease(req('native/110'), 'room-x')).contract).toBe('legacy');
    expect((await resolveAccountRelease(req('native/110'), 'acct-1')).contract).toBe('legacy');
  });
});
