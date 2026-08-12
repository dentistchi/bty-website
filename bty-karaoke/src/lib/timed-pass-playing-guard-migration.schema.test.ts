// BUILD 26M-R3 — "no switching while a song is playing" migration pins.
//
// THE DEFECT THIS CLOSES, found on a physical device during the R2 gates: a song was PLAYING on
// the ACTIVE pass, the Host switched, and the pass was revoked with its ENTIRE residual moved to
// a pass that had not started. The account was left at ACTIVE = 0 while the music kept going, so
// the rest of that song consumed no entitlement at all. The carryover arithmetic was right; the
// permission to switch mid-song was not.
//
// Comments are STRIPPED before every assertion.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260814120000_karaoke_timed_pass_switch_playing_guard_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');
const sql = raw.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const body = (() => {
  const start = sql.indexOf('create or replace function public.switch_timed_access_pass');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('revoke all on function public.switch_timed_access_pass', start);
  return sql.slice(start, end === -1 ? undefined : end);
})();

describe('BUILD 26M-R3 — comment stripping is real', () => {
  it('prose cannot satisfy a DDL assertion', () => {
    expect(raw).toMatch(/entitlement gap/i);
    expect(sql).not.toMatch(/entitlement gap/i);
  });
});

describe('BUILD 26M-R3 — the guard is server-authoritative', () => {
  it('refuses the switch when any of the account’s rooms has a playing request', () => {
    expect(body).toMatch(/from public\.karaoke_requests r/);
    expect(body).toMatch(/where r\.status = 'playing'/);
    expect(body).toMatch(/public\.karaoke_room_owner_account\(r\.room_id\) = p_account_id/);
    expect(body).toMatch(/'song_playing'/);
  });

  it('resolves ownership through the canonical helper, not a hand-rolled join', () => {
    // A second copy of the ownership rule could drift from karaoke_room_owner_account and
    // silently stop matching the rooms the account actually owns.
    expect(body).toMatch(/karaoke_room_owner_account/);
    expect(body).not.toMatch(/karaoke_workspace_members/);
    expect(body).not.toMatch(/karaoke_room_ownership/);
  });

  it('names the blocking request so the refusal is diagnosable', () => {
    expect(body).toMatch(/'requestId', v_playing/);
  });
});

describe('BUILD 26M-R3 — a refusal mutates NOTHING', () => {
  it('the playing check runs before every write in the function', () => {
    const guardAt = body.indexOf("r.status = 'playing'");
    expect(guardAt).toBeGreaterThan(0);
    // Every UPDATE and INSERT must come after the guard. If any write preceded it, a refused
    // switch could still have expired a pass or written an audit row.
    for (const m of [...body.matchAll(/\b(update|insert into) public\./g)]) {
      expect(m.index, `write at ${m.index} precedes the playing guard`).toBeGreaterThan(guardAt);
    }
  });

  it('returns rather than raises — nothing was written, so there is nothing to roll back', () => {
    expect(body).toMatch(/return jsonb_build_object\('ok', false, 'error', 'song_playing'/);
  });
});

describe('BUILD 26M-R3 — a concurrent song start cannot slip past the guard', () => {
  it('takes karaoke_begin_song_v2’s account lock, not only the timed_pass key', () => {
    // Checking under the timed_pass key alone leaves a window where a start COMMITS between the
    // check and the revoke, reopening the exact gap being closed.
    expect(body).toMatch(/pg_advisory_xact_lock\(public\.karaoke_account_lock_key\(p_account_id\)\)/);
    expect(body).toMatch(/pg_advisory_xact_lock\(hashtext\('timed_pass:' \|\| p_account_id::text\)\)/);
  });

  it('acquires the account key FIRST, matching begin_song_v2’s ordering', () => {
    // begin_song_v2 takes account -> room; this takes account -> timed_pass. Both start with the
    // account key and nothing takes timed_pass before account, so no lock cycle exists.
    const acct = body.indexOf('karaoke_account_lock_key');
    const pass = body.indexOf("hashtext('timed_pass:'");
    expect(acct).toBeGreaterThan(0);
    expect(pass).toBeGreaterThan(acct);
  });
});

describe('BUILD 26M-R3 — carryover behaviour is untouched when nothing is playing', () => {
  it('still transfers an ACTIVE source at its remaining, without double counting', () => {
    expect(body).toMatch(
      /v_carried := greatest\(0, floor\(extract\(epoch from \(v_active\.expires_at - v_now\)\)\)::int\)/,
    );
    expect(body).not.toMatch(/v_active\.carryover_seconds/);
  });

  it('still arms without activating', () => {
    expect(body).not.toMatch(/set status\s*=\s*'ACTIVE'/);
    expect(body).toMatch(/set status = 'SELECTED', selected_at = v_now, carryover_seconds = v_carried/);
  });

  it('still assigns onto a target proven empty (MOVE, never accumulate)', () => {
    expect(body).toMatch(/where id = p_pass_grant_id and status = 'AVAILABLE' and carryover_seconds = 0/);
    expect(body).not.toMatch(/carryover_seconds\s*=\s*carryover_seconds\s*\+/);
  });

  it('still raises on a lost race so a half-applied switch cannot commit', () => {
    expect((body.match(/raise exception 'switch_conflict' using errcode = '40001'/g) ?? []).length)
      .toBeGreaterThanOrEqual(2);
  });
});

describe('BUILD 26M-R3 — deliberately narrow blast radius', () => {
  it('redefines ONLY the switch RPC', () => {
    const created = [...sql.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]);
    expect(created).toEqual(['switch_timed_access_pass']);
  });

  it('does NOT guard select_timed_access_pass — arming mid-song creates no gap', () => {
    // The ACTIVE pass stays ACTIVE, so the playing song stays covered. Forbidding it would remove
    // a harmless capability for no safety gain.
    expect(sql).not.toMatch(/create or replace function public\.select_timed_access_pass/);
  });

  it('changes no table, column, index or constraint, and deletes nothing', () => {
    expect(sql).not.toMatch(/alter table|create table|create (unique )?index|add constraint|drop constraint/i);
    expect(sql).not.toMatch(/\bdelete from\b|\btruncate\b/i);
  });

  it('does not touch the start authority or the commerce ledger', () => {
    expect(sql).not.toMatch(/create or replace function public\.karaoke_begin_song/);
    expect(sql).not.toMatch(/karaoke_apple_purchases|karaoke_product_catalog/i);
  });

  it('stays service_role only', () => {
    expect(sql).toContain('revoke all on function public.switch_timed_access_pass(uuid, uuid, text) from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.switch_timed_access_pass(uuid, uuid, text) to service_role');
  });
});
