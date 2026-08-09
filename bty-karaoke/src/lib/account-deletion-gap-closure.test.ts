// BUILD 26I — automated gap closure over the already-deployed BUILD 26E deletion
// authority. This file ADDS coverage; it changes no behaviour and weakens nothing.
//
// BUILD 26E's 96 deletion tests are comprehensive on authority, Apple revocation and
// fail-closed ordering. Mapping them against the BUILD 26I §4 matrix left seven items
// with no automated assertion anywhere — each one a rule that is real in production but
// would survive a regression silently:
//
//   §4.5   a tombstoned account is refused by a protected READ route, not just by
//          authorizeHost() in isolation
//   §4.7/8 EVERY active session is revoked — the statement is account-scoped, not
//          one-row-scoped
//   §4.13  deleting through ONE provider deletes the BTY ACCOUNT, not that identity row
//   §4.16  saved songs and other non-retained user content are actually deleted
//   §4.30/31 a same-provider signup produces a NEW account and can never relink,
//          reactivate or resurrect the tombstone it matched
//   §4.33/35 an ACTIVE paid pass is revoked with its activation facts RETAINED, and the
//          retained evidence confers no playback authority afterwards
//
// Two styles, deliberately: behaviour where TypeScript can observe it, SQL text where the
// rule exists only in the migration. SQL assertions strip full-line comments first — a
// comment describing a rule must never be able to satisfy an assertion about the rule
// (the mutation-testing lesson from BUILD 26E's schema pins).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── SQL under test ───────────────────────────────────────────────────────────

const FILE = 'supabase/migrations/20260809120000_karaoke_account_deletion_authority_v1.sql';
const REPAIR = 'supabase/migrations/20260810120000_karaoke_deletion_fingerprint_latest_tombstone_v1.sql';
const stripComments = (t: string) =>
  t
    .split('\n')
    .map((l) => (l.trimStart().startsWith('--') ? '' : l))
    .join('\n');
const read = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
const sql = read(FILE);
const repair = read(REPAIR);

/**
 * The body of the deletion RPC only, so a match cannot come from some other function.
 *
 * Taken from the BUILD 26I REPAIR migration, not from BUILD 26E: `create or replace`
 * means the newest re-issue is what production runs, and a test that keeps asserting
 * against a superseded body would go on passing while the live function drifted.
 */
const deleteRpc = repair.slice(
  repair.indexOf('create or replace function public.karaoke_delete_account_v1'),
  repair.indexOf('revoke all on function public.karaoke_delete_account_v1'),
);
/** The carryover RPC only. */
const carryoverRpc = sql.slice(
  sql.indexOf('create or replace function public.karaoke_apply_free_window_carryover_v1'),
  sql.indexOf('revoke all on function public.karaoke_apply_free_window_carryover_v1'),
);
/** begin_song_v2 only — where a pass either does or does not confer playback authority. */
const beginSong = sql.slice(
  sql.indexOf('create or replace function public.karaoke_begin_song_v2'),
  sql.indexOf('revoke all on function public.karaoke_begin_song_v2'),
);

// ── db double for the behavioural groups ─────────────────────────────────────

const state = {
  account: null as { id: string; deleted_at: string | null } | null,
  session: null as { id: string; account_id: string; status: string; expires_at: string } | null,
};

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === 'karaoke_host_sessions' ? state.session : state.account,
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
  bearerFromHeader: (h: string | null) => (h ? h.replace(/^Bearer\s+/, '') : null),
}));
vi.mock('./host-plan.server', () => ({ ensureDefaultFreePlan: vi.fn(async () => undefined) }));
vi.mock('@/domain/room-slug', () => ({ buildRoomSlug: () => 'slug' }));

import { authorizeHost } from './host-auth.server';

const LIVE_SESSION = {
  id: 's1',
  account_id: 'acct-1',
  status: 'active',
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
};

beforeEach(() => {
  state.session = { ...LIVE_SESSION };
  state.account = { id: 'acct-1', deleted_at: null };
});

// ── §4.5 — a protected READ route refuses a tombstone ────────────────────────

describe('BUILD 26I §4.5 — post-deletion protected API refusal', () => {
  it('(1) GET /api/host/me answers 401 for a tombstoned account holding a LIVE session', async () => {
    // BUILD 26E proved authorizeHost() returns null. This proves the ROUTE acts on it:
    // the failure mode being excluded is a route that reads `accountDeleted` and still
    // returns 200 with the account payload, which would leave a deleted user's rooms and
    // linked providers readable with a credential that was supposed to be dead.
    const { GET } = await import('@/app/api/host/me/route');
    state.account = { id: 'acct-1', deleted_at: '2026-08-08T05:36:46Z' };

    const res = await GET(
      new Request('https://x/api/host/me', {
        headers: { authorization: 'Bearer live-token' },
      }) as unknown as import('next/server').NextRequest,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('(2) the refusal leaks nothing a live account would have returned', async () => {
    const { GET } = await import('@/app/api/host/me/route');
    state.account = { id: 'acct-1', deleted_at: '2026-08-08T05:36:46Z' };

    const res = await GET(
      new Request('https://x/api/host/me', {
        headers: { authorization: 'Bearer live-token' },
      }) as unknown as import('next/server').NextRequest,
    );
    const text = JSON.stringify(await res.json());

    for (const leaked of ['rooms', 'linkedProviders', 'accountDeleted', 'ownedRoomCount', 'acct-1']) {
      expect(text).not.toContain(leaked);
    }
    // …and it must be byte-identical to the answer for a token that never existed.
    state.session = null;
    const unknown = await GET(
      new Request('https://x/api/host/me', {
        headers: { authorization: 'Bearer never-existed' },
      }) as unknown as import('next/server').NextRequest,
    );
    expect(text).toBe(JSON.stringify(await unknown.json()));
  });

  it('(3) the guard is re-resolved per request, so a pre-deletion session cannot be replayed', async () => {
    expect(await authorizeHost('live-token')).not.toBeNull(); // before
    state.account = { id: 'acct-1', deleted_at: '2026-08-08T05:36:46Z' };
    expect(await authorizeHost('live-token')).toBeNull(); // after — same token
  });
});

// ── §4.7 / §4.8 — every session, not one session ─────────────────────────────

describe('BUILD 26I §4.7/4.8 — multi-session revocation is account-scoped', () => {
  it('(4) revokes host sessions by ACCOUNT, with no row limit that could leave one alive', () => {
    const stmt = deleteRpc.slice(
      deleteRpc.indexOf('update public.karaoke_host_sessions'),
      deleteRpc.indexOf('select count(*) into v_sessions'),
    );
    expect(stmt).toMatch(/set status = 'revoked', revoked_at = v_now/);
    expect(stmt).toMatch(/where account_id = p_account_id and status = 'active'/);
    // The bug this excludes: `and id = ...` or `limit 1`, which would revoke the calling
    // device's session and silently leave every other signed-in device authenticated.
    expect(stmt).not.toMatch(/\blimit\b/i);
    expect(stmt).not.toMatch(/\bid\s*=/);
  });

  it('(5) the same account-scoped shape governs devices, and never a null account_id instead', () => {
    const stmt = deleteRpc.slice(
      deleteRpc.indexOf('update public.karaoke_dj_devices'),
      deleteRpc.indexOf('select count(*) into v_devices'),
    );
    expect(stmt).toMatch(/set status = 'revoked', revoked_at = v_now/);
    expect(stmt).toMatch(/account_id = p_account_id or room_id = any\(v_room_ids\)/);
    expect(stmt).not.toMatch(/account_id\s*=\s*null/i);
    expect(stmt).not.toMatch(/\blimit\b/i);
  });

  it('(6) the audit records the session count, so "how many" is evidence and not an assumption', () => {
    expect(deleteRpc).toMatch(/'hostSessions', v_sessions/);
  });
});

// ── §4.13 — one provider, whole account ──────────────────────────────────────

describe('BUILD 26I §4.13 — deletion is ACCOUNT-scoped, never identity-row-scoped', () => {
  it('(7) the identity delete carries no provider predicate', () => {
    const stmt = 'delete from public.karaoke_account_identities where account_id = p_account_id;';
    expect(deleteRpc).toContain(stmt);
    // An Apple+Google account deleted through the Apple session must not keep a usable
    // Google link. A `and provider = ...` clause here is exactly that bug.
    const line = deleteRpc
      .split('\n')
      .find((l) => l.includes('delete from public.karaoke_account_identities'));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/provider\s*=/);
  });

  it('(8) a fingerprint is retained for EVERY supplied identity, not just the first', () => {
    const block = deleteRpc.slice(
      deleteRpc.indexOf('insert into public.karaoke_identity_fingerprints'),
      deleteRpc.indexOf('delete from public.karaoke_account_identities'),
    );
    expect(block).toMatch(/jsonb_array_elements\(coalesce\(p_fingerprints, '\[\]'::jsonb\)\)/);
    expect(block).not.toMatch(/\blimit\b/i);
    expect(block).toMatch(/on conflict \(fingerprint\) do update set/);
  });

  it('(9) the completeness guard counts ALL identities, so a partial set fails closed', () => {
    const block = deleteRpc.slice(
      deleteRpc.indexOf('select count(*) into v_missing'),
      deleteRpc.indexOf("return jsonb_build_object('outcome', 'fingerprint_incomplete')"),
    );
    expect(block).toMatch(/from public\.karaoke_account_identities i/);
    expect(block).toMatch(/where i\.account_id = p_account_id/);
    expect(block).not.toMatch(/\blimit\b/i);
  });

  it('(10) the tombstone also nulls the DEPRECATED provider columns on the account row', () => {
    // A second, older copy of provider identity that an identity-row-only delete misses.
    // `where id = p_account_id` also appears in the earlier SELECT ... FOR UPDATE, so the
    // slice must be anchored from the tombstone UPDATE forward, not from the file start.
    const start = deleteRpc.indexOf('update public.karaoke_accounts');
    const block = deleteRpc.slice(start, deleteRpc.indexOf('where id = p_account_id', start));
    expect(block).toContain('set email = null');
    expect(block).toMatch(/provider = null/);
    expect(block).toMatch(/provider_subject = null/);
  });
});

// ── §4.16 — non-retained user content is really deleted ──────────────────────

describe('BUILD 26I §4.16 — non-retained user content is deleted, not merely orphaned', () => {
  it('(11) saved songs are deleted', () => {
    expect(deleteRpc).toContain(
      'delete from public.karaoke_user_saved_songs where account_id = p_account_id;',
    );
  });

  it('(12) room-creation idempotency and lease-rollout rows are deleted', () => {
    expect(deleteRpc).toContain(
      'delete from public.karaoke_room_creation_idempotency where account_id = p_account_id;',
    );
    expect(deleteRpc).toContain(
      'delete from public.karaoke_lease_rollout where account_id = p_account_id;',
    );
  });

  it('(13) the retained classes are still never deleted by this RPC', () => {
    // The other half of the same rule: "delete the right things" is only half a contract.
    for (const t of [
      'karaoke_event_usage_segments',
      'timed_access_pass_grants',
      'timed_access_pass_audit',
      'karaoke_requests',
      'karaoke_rooms',
      'karaoke_accounts',
    ]) {
      expect(deleteRpc).not.toMatch(new RegExp(`delete\\s+from\\s+public\\.${t}\\b`, 'i'));
    }
  });
});

// ── §4.30 / §4.31 — recreation can never resurrect ───────────────────────────

describe('BUILD 26I §4.30/4.31 — a tombstone is never resurrected by a same-provider signup', () => {
  it('(14) the deletion RPC never clears deleted_at or returns an account to active', () => {
    expect(deleteRpc).not.toMatch(/deleted_at\s*=\s*null/i);
    expect(deleteRpc).not.toMatch(/account_status\s*=\s*'active'/i);
  });

  it('(15) carryover refuses to target the tombstone it read from', () => {
    expect(carryoverRpc).toMatch(
      /if v_tomb = p_new_account_id then[\s\S]{0,120}return jsonb_build_object\('outcome', 'no_tombstone'\)/,
    );
  });

  it('(16) carryover writes ONLY the carryover row — it never relinks or reactivates', () => {
    // The resurrection bug in one line: an UPDATE of karaoke_accounts or an INSERT into
    // karaoke_account_identities here would hand the old account back to the new signup.
    expect(carryoverRpc).not.toMatch(/update public\.karaoke_accounts/i);
    expect(carryoverRpc).not.toMatch(/insert into public\.karaoke_account_identities/i);
    expect(carryoverRpc).not.toMatch(/update public\.karaoke_account_identities/i);
    expect(carryoverRpc).not.toMatch(/update public\.karaoke_rooms/i);
    expect(carryoverRpc).not.toMatch(/update public\.timed_access_pass_grants/i);
    const inserts = [...carryoverRpc.matchAll(/insert into (public\.\w+)/gi)].map((m) => m[1]);
    expect(inserts).toEqual(['public.karaoke_free_window_carryover']);
  });

  it('(17) carryover restores ONLY current-window seconds and the burnt grace', () => {
    const insert = carryoverRpc.slice(
      carryoverRpc.indexOf('insert into public.karaoke_free_window_carryover'),
      carryoverRpc.indexOf("return jsonb_build_object('outcome', 'carried'"),
    );
    expect(insert).toMatch(/carried_used_seconds/);
    expect(insert).toMatch(/grace_consumed/);
    expect(insert).toMatch(/source_tombstone_id/);
    // Nothing that would constitute restored product state.
    for (const forbidden of ['room', 'logo', 'saved', 'pass', 'plan', 'entitlement']) {
      expect(insert.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('(18) the tombstone FK is RESTRICT everywhere, so the evidence cannot be deleted away', () => {
    const restricted = [
      'karaoke_identity_fingerprints',
      'karaoke_account_deletion_audit',
      'karaoke_provider_revocation_jobs',
      'karaoke_account_deletion_events',
    ];
    for (const t of restricted) {
      const block = sql.slice(sql.indexOf(`create table if not exists public.${t}`));
      const decl = block.slice(0, block.indexOf(');'));
      expect(decl).toMatch(/references public\.karaoke_accounts\(id\) on delete restrict/);
      expect(decl).not.toMatch(/references public\.karaoke_accounts\(id\) on delete cascade/);
    }
  });
});

// ── §4.33 / §4.35 — the ACTIVE paid pass ─────────────────────────────────────

describe('BUILD 26I §4.33/4.35 — ACTIVE timed-pass deletion', () => {
  it('(19) revokes an ACTIVE pass, not only the never-activated states', () => {
    const block = deleteRpc.slice(
      deleteRpc.indexOf('update public.timed_access_pass_grants'),
      deleteRpc.indexOf('select count(*) into v_passes'),
    );
    expect(block).toMatch(/status in \('AVAILABLE', 'SELECTED', 'ACTIVE'\)/);
    expect(block).toMatch(/set status = 'REVOKED', revoked_at = v_now/);
    expect(block).toMatch(/revoke_reason = 'account_deleted'/);
  });

  it('(20) the activation facts are RETAINED — a revoked-after-use pass is not rewritten', () => {
    const block = deleteRpc.slice(
      deleteRpc.indexOf('update public.timed_access_pass_grants'),
      deleteRpc.indexOf('select count(*) into v_passes'),
    );
    // Nulling these would erase what the customer actually received, which is the record
    // a refund decision is made from.
    expect(block).not.toMatch(/activated_at\s*=\s*null/i);
    expect(block).not.toMatch(/expires_at\s*=\s*null/i);
    expect(block).not.toMatch(/selected_at\s*=\s*null/i);
  });

  it('(21) the CHECK actually permits the revoked-after-use shape this produces', () => {
    // Without the BUILD 18C G5 relaxation the UPDATE above would abort the whole
    // transaction for exactly the accounts that paid — the ACTIVE-pass case.
    const chk = sql.slice(
      sql.indexOf("add constraint timed_pass_status_time_chk"),
      sql.indexOf('── 9. INDEX CORRECTIONS'),
    );
    expect(chk).toMatch(
      /when 'REVOKED'\s+then revoked_at is not null and \([\s\S]*?or \(activated_at is not null and expires_at is not null\)\)/,
    );
  });

  it('(22) every revocation is audited, one row per grant', () => {
    const block = deleteRpc.slice(
      deleteRpc.indexOf('update public.timed_access_pass_grants'),
      deleteRpc.indexOf('select count(*) into v_passes'),
    );
    expect(block).toMatch(/insert into public\.timed_access_pass_audit/);
    expect(block).toMatch(/'SYSTEM', 'account_deletion', 'REVOKED'/);
    expect(block).toMatch(/from g\b/); // one audit row per revoked grant, not a single summary
  });

  it('(23) retained pass evidence confers NO playback authority afterwards', () => {
    // The whole point of §4.35: the grant row survives for audit/refund, so playback must
    // key on ACTIVE + unexpired and never on "a grant exists".
    expect(beginSong).toMatch(
      /from public\.timed_access_pass_grants\s+where account_id=v_account and status='ACTIVE' and expires_at > v_now/,
    );
    const selection = beginSong.slice(
      beginSong.indexOf('select id, expires_at into v_active_pass'),
      beginSong.indexOf('if v_active_pass is not null then'),
    );
    expect(selection).not.toMatch(/REVOKED/);
    expect(selection).not.toMatch(/status\s*<>/);
  });

  it('(24) a retired room refuses playback before ownership is even resolved', () => {
    // Belt to the same braces: the rooms of a deleted account can start nothing at all.
    const guard = beginSong.slice(0, beginSong.indexOf('into v_account'));
    expect(guard).toMatch(
      /select status into v_room_status from public\.karaoke_rooms where id = p_room_id;[\s\S]{0,160}if v_room_status = 'retired' then return jsonb_build_object\('outcome','room_retired'\)/,
    );
  });
});

// ── DEFECT-26I-1 — the fingerprint must name the LATEST tombstone ────────────
//
// Found by running the §3 retention ledger against production, not by reading source:
// tombstone 98d3496f had no fingerprint pointing at it, because the second deletion of one
// Apple identity advanced last_deleted_at but left account_tombstone_id on the FIRST
// tombstone. karaoke_apply_free_window_carryover_v1 resolves the tombstone through that
// pointer, so from the second delete-and-recreate onward the intermediate account's
// consumed seconds — and the carryover it had itself inherited — became invisible, handing
// back a fresh FREE allowance every cycle. That is the F-5 hole, reopened.

describe('BUILD 26I DEFECT-1 — fingerprint tracks the most recent tombstone', () => {
  it('(25) the repair advances account_tombstone_id, not just last_deleted_at', () => {
    const block = deleteRpc.slice(
      deleteRpc.indexOf('insert into public.karaoke_identity_fingerprints'),
      deleteRpc.indexOf('delete from public.karaoke_account_identities'),
    );
    expect(block).toMatch(/on conflict \(fingerprint\) do update set[\s\S]*?last_deleted_at\s*=\s*excluded\.last_deleted_at/);
    expect(block).toMatch(/on conflict \(fingerprint\) do update set[\s\S]*?account_tombstone_id\s*=\s*excluded\.account_tombstone_id/);
  });

  it('(26) first_deleted_at is NOT advanced — the first deletion instant is history', () => {
    const block = deleteRpc.slice(
      deleteRpc.indexOf('insert into public.karaoke_identity_fingerprints'),
      deleteRpc.indexOf('delete from public.karaoke_account_identities'),
    );
    const onConflict = block.slice(block.indexOf('on conflict'));
    expect(onConflict).not.toMatch(/first_deleted_at\s*=/);
  });

  it('(27) the superseded BUILD 26E body is the one that froze the pointer', () => {
    // Pins the defect itself, so nobody "restores" the old clause believing it equivalent.
    const old = sql.slice(
      sql.indexOf('insert into public.karaoke_identity_fingerprints'),
      sql.indexOf('delete from public.karaoke_account_identities'),
    );
    expect(old).toMatch(/on conflict \(fingerprint\) do update set last_deleted_at = excluded\.last_deleted_at;/);
    expect(old).not.toMatch(/account_tombstone_id\s*=\s*excluded\.account_tombstone_id/);
  });

  it('(28) the repair re-issues the function with NO other behavioural change', () => {
    // The whole risk of `create or replace` on a 250-line function is an unnoticed second
    // edit. Compare the two bodies line by line; exactly the ON CONFLICT clause may differ.
    const bodyOf = (t: string) =>
      t.slice(
        t.indexOf('create or replace function public.karaoke_delete_account_v1'),
        t.indexOf('revoke all on function public.karaoke_delete_account_v1'),
      );
    const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
    const oldParts = norm(bodyOf(sql)).split(
      'on conflict (fingerprint) do update set last_deleted_at = excluded.last_deleted_at;',
    );
    const newParts = norm(bodyOf(repair)).split(
      'on conflict (fingerprint) do update set last_deleted_at = excluded.last_deleted_at, account_tombstone_id = excluded.account_tombstone_id;',
    );
    expect(oldParts).toHaveLength(2);
    expect(newParts).toHaveLength(2);
    expect(newParts[0]).toBe(oldParts[0]);
    expect(newParts[1]).toBe(oldParts[1]);
  });

  it('(29) the backfill repairs frozen pointers precisely and idempotently', () => {
    const backfill = repair.slice(repair.indexOf('update public.karaoke_identity_fingerprints f'));
    // Joined on the deletion instant, which is the only surviving link — the fingerprint
    // is one-way and the identities are gone, so nothing can be recomputed from it.
    expect(backfill).toMatch(/a\.deleted_at = f\.last_deleted_at/);
    expect(backfill).toMatch(/a\.account_status = 'deleted'/);
    // Idempotent: rows already correct are excluded, so a re-run is a no-op.
    expect(backfill).toMatch(/f\.account_tombstone_id <> a\.id/);
    // It must never invent or remove a fingerprint, only re-point one.
    expect(backfill).not.toMatch(/insert into public\.karaoke_identity_fingerprints/);
    expect(backfill).not.toMatch(/delete\s+from\s+public\.karaoke_identity_fingerprints/i);
  });

  it('(30) the repair touches nothing else in the deletion contract', () => {
    // No new table, no dropped constraint, no changed grant, no other function re-issued.
    expect(repair).not.toMatch(/create table/i);
    expect(repair).not.toMatch(/drop constraint/i);
    expect(repair).not.toMatch(/alter table/i);
    const fns = [...repair.matchAll(/create or replace function (public\.\w+)/gi)].map((m) => m[1]);
    expect(fns).toEqual(['public.karaoke_delete_account_v1']);
  });

  it('(31) the carryover chain now resolves the account the pointer names', () => {
    // The consumer side is unchanged and must stay unchanged: it was always correct GIVEN
    // a current pointer. Pinned so a future "fix" is not applied a second time here.
    expect(carryoverRpc).toMatch(
      /select account_tombstone_id into v_tomb\s+from public\.karaoke_identity_fingerprints where fingerprint = p_fingerprint;/,
    );
    expect(carryoverRpc).toMatch(/where account_id = v_tomb and c\.charged_window_start = v_ws|c\.account_id = v_tomb/);
  });

  it('(32) the repair leaves begin_song_v2 and the carryover RPC un-re-issued', () => {
    // Only ONE function may be replaced by a one-clause repair. Re-issuing begin_song_v2 or
    // the carryover RPC here would silently roll them back to whatever text was pasted.
    expect(repair).not.toMatch(/create or replace function public\.karaoke_begin_song_v2/);
    expect(repair).not.toMatch(/create or replace function public\.karaoke_apply_free_window_carryover_v1/);
    expect(repair).not.toMatch(/create or replace function public\.karaoke_free_minutes_entitlement_at_v2/);
  });
});
