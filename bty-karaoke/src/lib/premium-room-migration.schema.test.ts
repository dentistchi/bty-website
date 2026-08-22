// BUILD 26U-R1 — the Premium Room session-entitlement migration, pinned as a contract.
//
// Follows the repo's `*-migration.schema.test.ts` convention: the SQL is read as text and its
// structural guarantees are asserted, so a future edit that weakens one is caught in CI rather
// than at apply time. It complements — never replaces — the local apply, which is the only thing
// that proves the SQL actually runs.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const NAME = '20260822120000_karaoke_premium_room_session_entitlement_v1.sql';
const raw = readFileSync(`${DIR}${NAME}`, 'utf8');
/** Comment-stripped, so prose describing a rule cannot satisfy a scan for it. */
const sql = raw.replace(/^\s*--.*$/gm, '');

describe('ordering and additivity', () => {
  it('sorts after every migration that predates it', () => {
    // BUILD 26U-R2 added `20260823120000_karaoke_premium_room_rollout_v1.sql`, which must sort
    // AFTER this one — it drops and recreates this migration's session-start function, so
    // applying them out of order would leave the 5-argument signature in place.
    const all = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    const i = all.indexOf(NAME);
    expect(i).toBeGreaterThan(-1);
    expect(all.slice(0, i).every((f) => f < NAME)).toBe(true);
    expect(all[i + 1]).toBe('20260823120000_karaoke_premium_room_rollout_v1.sql');
  });

  it('drops nothing and alters no existing table', () => {
    expect(sql).not.toMatch(/\bdrop\s+table\b/i);
    expect(sql).not.toMatch(/\bdrop\s+column\b/i);
    expect(sql).not.toMatch(/\bdrop\s+constraint\b/i);
    expect(sql).not.toMatch(/\balter\s+table\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
  });

  it('is idempotent — every object is CREATE OR REPLACE', () => {
    const creates = sql.match(/create (or replace )?function/gi) ?? [];
    expect(creates.length).toBe(3);
    expect(creates.every((c) => /or replace/i.test(c))).toBe(true);
  });

  it('does not redefine karaoke_begin_song_v2 — E1 stays the current body', () => {
    expect(sql).not.toContain('karaoke_begin_song_v2');
  });

  it('touches no commerce contract data', () => {
    for (const t of ['karaoke_product_catalog', 'karaoke_apple_purchases', 'is_active',
                     'fulfil_apple_purchase', 'issue_timed_access_pass']) {
      expect(sql, `must not touch ${t}`).not.toContain(t);
    }
  });

  it('leaves the legacy metering structures alone', () => {
    for (const t of ['karaoke_usage_policy', 'karaoke_event_usage_segments', 'free_limit_seconds',
                     'lease_write_mode', 'karaoke_lease_rollout']) {
      expect(sql, `must not touch ${t}`).not.toContain(t);
    }
  });
});

describe('privilege posture matches every prior migration', () => {
  it('revokes from public/anon/authenticated and grants only to service_role', () => {
    const fns = [
      'karaoke_premium_room_entitlement_at(uuid, timestamptz)',
      'karaoke_room_premium_entitlement_at(uuid, timestamptz)',
      'karaoke_start_premium_room_session(uuid, text, text, text, text)',
    ];
    // Whitespace-normalised: these statements legitimately wrap across lines when the
    // signature is long, and a scan that cared about that would be measuring formatting.
    const flat = sql.replace(/\s+/g, ' ');
    for (const f of fns) {
      expect(flat, `${f} must be revoked from the browser roles`)
        .toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
      expect(flat, `${f} must be granted to service_role`)
        .toContain(`grant execute on function public.${f} to service_role;`);
    }
  });

  it('pins search_path on every function (no schema-hijack surface)', () => {
    const bodies = sql.match(/create or replace function[\s\S]*?\$\$/g) ?? [];
    expect(bodies.length).toBe(3);
    for (const b of bodies) expect(b).toContain('set search_path = public, pg_temp');
  });
});

describe('the read authority is genuinely read-only', () => {
  it('both entitlement readers are declared STABLE', () => {
    expect(sql).toContain('karaoke_premium_room_entitlement_at(\n  p_account_id uuid, p_as_of timestamptz\n) returns jsonb language plpgsql stable');
    expect(sql).toContain('karaoke_room_premium_entitlement_at(\n  p_room_id uuid, p_as_of timestamptz\n) returns jsonb language plpgsql stable');
  });

  it('a STABLE function cannot sweep — no write appears before the session-start function', () => {
    const startAt = sql.indexOf('create or replace function public.karaoke_start_premium_room_session');
    const readsOnly = sql.slice(0, startAt);
    for (const w of ['update public.', 'insert into public.', 'delete from public.']) {
      expect(readsOnly, `a read authority must not "${w}"`).not.toContain(w);
    }
  });

  it('an ARMED pass is reported as NOT entitled', () => {
    expect(sql).toContain("'source','SELECTED_PASS'");
    // The SELECTED branch must publish entitled=false. Assert it inside that branch only.
    const selBranch = sql.slice(sql.indexOf("'source','SELECTED_PASS'") - 200,
                                sql.indexOf("'source','SELECTED_PASS'") + 300);
    expect(selBranch).toContain("'entitled',false");
    expect(selBranch).toContain("'armable',true");
  });

  it('an ambiguous or absent plan falls back to FREE, never to PRO', () => {
    expect(sql).toContain("if not (v_plan_n = 1 and v_plan in ('FREE','PRO')) then v_plan := 'FREE'; end if;");
  });

  it('an unresolvable room owner fails closed', () => {
    expect(sql).toContain("'outcome','ownership_state_invalid','entitled',false");
  });
});

describe('the session-start transaction is concurrency-safe and fail-closed', () => {
  it('takes the ACCOUNT lock first, then the room — the same order as begin_song_v2', () => {
    const acct = sql.indexOf('pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account))');
    const room = sql.indexOf('pg_advisory_xact_lock(hashtext(p_room_id::text))');
    expect(acct).toBeGreaterThan(-1);
    expect(room).toBeGreaterThan(acct); // account BEFORE room ⇒ cannot deadlock against begin_song_v2
  });

  it('is idempotent: a live Event returns already_live and activates NOTHING', () => {
    expect(sql).toContain("jsonb_build_object('outcome','already_live','eventId',v_live_id,'activated',false)");
    const idem = sql.indexOf("'outcome','already_live'");
    const activate = sql.indexOf("set status = 'ACTIVE'");
    expect(idem).toBeLessThan(activate); // the early return precedes any activation
  });

  it('refuses BEFORE creating anything', () => {
    expect(sql.indexOf("'premium_room_required'")).toBeLessThan(
      sql.indexOf('insert into public.karaoke_events'),
    );
  });

  it('activates AFTER the Event insert, so a code collision cannot spend a pass', () => {
    expect(sql.indexOf("set status = 'ACTIVE'")).toBeGreaterThan(
      sql.indexOf('insert into public.karaoke_events'),
    );
  });

  it('a lost activation race RAISES (rolling back the Event) rather than returning', () => {
    expect(sql).toContain("raise exception 'premium_room_activation_conflict'");
    // A plpgsql `return` would COMMIT what was already written — the exact trap 26M-R2 hit.
    const act = sql.indexOf("set status = 'ACTIVE'");
    const window = sql.slice(act, act + 600);
    expect(window).toContain('if v_upd <> 1 then');
    expect(window).not.toMatch(/if v_upd <> 1 then\s*return/);
  });

  it('the expiry sweep is scoped to ACTIVE rows that are genuinely past expiry', () => {
    expect(sql).toContain("where account_id = v_account and status = 'ACTIVE' and expires_at <= v_now");
  });

  it('expires_at is exactly duration + carried residual — the constraint arithmetic', () => {
    expect(sql).toContain('v_now + make_interval(secs => v_sel_dur + v_sel_carry)');
  });

  it('a retired room and a missing room answer explicitly, never by falling through', () => {
    expect(sql).toContain("'outcome','room_not_found'");
    expect(sql).toContain("'outcome','room_retired'");
  });

  it('no media duration or request row is read anywhere in the transaction', () => {
    for (const t of ['karaoke_video_durations', 'karaoke_requests', 'youtube_video_id',
                     'duration_seconds from', 'v_dur']) {
      expect(sql, `must not read ${t}`).not.toContain(t);
    }
  });
});
