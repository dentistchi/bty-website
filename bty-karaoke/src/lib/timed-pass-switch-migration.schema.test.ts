// BUILD 26M — Timed Pass Continuation / Switching V1 migration pins.
//
// Asserts the SQL implements Model B as ratified rather than describing it: the switch ARMS but
// never ACTIVATES, it forfeits the residual without rewriting activation history, both
// transitions live in one transaction, eligibility never branches on how the pass was obtained,
// and the start authority is left completely alone.
//
// Comments are STRIPPED before every assertion — a migration that promised "never activates" in
// prose while writing status='ACTIVE' in DDL would otherwise pass.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260812120000_karaoke_timed_pass_switch_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');
const sql = raw
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');

/** The body of switch_timed_access_pass, where every invariant below must actually hold. */
const switchBody = (() => {
  const start = sql.indexOf('create or replace function public.switch_timed_access_pass');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('revoke all on function public.switch_timed_access_pass', start);
  return sql.slice(start, end === -1 ? undefined : end);
})();

describe('BUILD 26M — comment stripping is real', () => {
  it('prose can never satisfy a DDL assertion', () => {
    expect(raw).toMatch(/Selection never starts a clock/);
    expect(sql).not.toMatch(/Selection never starts a clock/);
  });
});

describe('BUILD 26M — the switch ARMS but never ACTIVATES', () => {
  it('sets the target to SELECTED', () => {
    expect(switchBody).toMatch(/set status = 'SELECTED', selected_at = v_now/);
  });

  it("NEVER writes status='ACTIVE' anywhere in the switch", () => {
    // The whole no-silent-timer-start guarantee. If this ever fails, a dropdown tap spends an hour.
    expect(switchBody).not.toMatch(/status\s*=\s*'ACTIVE'\s*,/);
    expect(switchBody).not.toMatch(/set status\s*=\s*'ACTIVE'/);
  });

  it('never writes activated_at or expires_at on the target', () => {
    expect(switchBody).not.toMatch(/set[\s\S]{0,120}activated_at\s*=\s*v_now/);
    expect(switchBody).not.toMatch(/expires_at\s*=\s*v_now\s*\+/);
  });

  it('only arms a pass that is currently AVAILABLE', () => {
    expect(switchBody).toMatch(/where id = p_pass_grant_id and status = 'AVAILABLE'/);
  });
});

describe('BUILD 26M — one ACTIVE pass, always', () => {
  it('revokes the running pass rather than leaving two ACTIVE rows', () => {
    expect(switchBody).toMatch(/set status = 'REVOKED', revoked_at = v_now, revoke_reason = 'switched_pass'/);
    expect(switchBody).toMatch(/where id = v_active\.id and status = 'ACTIVE'/);
  });

  it('selects the running pass by the same server-time validity rule the resolver uses', () => {
    expect(switchBody).toMatch(/status = 'ACTIVE' and expires_at > v_now/);
  });

  it('expires an already-past-window ACTIVE pass instead of calling it revoked', () => {
    // Recording a pass that merely ran out as "switched_pass" would libel it and would make the
    // forfeited-seconds figure a lie.
    expect(switchBody).toMatch(/set status = 'EXPIRED', expired_at = v_now[\s\S]{0,200}?status = 'ACTIVE' and expires_at <= v_now/);
  });

  it('reverts any other armed pass, so one-SELECTED never relies on the index raising', () => {
    expect(switchBody).toMatch(/status = 'SELECTED' and id <> p_pass_grant_id for update/);
    expect(switchBody).toMatch(/set status = 'AVAILABLE', selected_at = null/);
  });
});

describe('BUILD 26M — residual is forfeited, history is not rewritten', () => {
  it('retains activated_at and expires_at on the forfeited pass', () => {
    const revoke = switchBody.slice(switchBody.indexOf("set status = 'REVOKED'"));
    const stmt = revoke.slice(0, revoke.indexOf(';'));
    expect(stmt).not.toMatch(/activated_at\s*=\s*null/);
    expect(stmt).not.toMatch(/expires_at\s*=\s*null/);
  });

  it('reports the forfeited seconds from server time, clamped at zero', () => {
    expect(switchBody).toMatch(/v_forfeited\s*:=\s*greatest\(0, floor\(extract\(epoch from \(v_active\.expires_at - v_now\)\)\)::int\)/);
  });

  it('never adds the forfeited residual to the incoming pass', () => {
    // BUILD 18C §3: one song must be covered entirely by ONE pass. Concatenation is the exact
    // thing that would make a 2:01 remnant plus a fresh hour look like coverage it is not.
    expect(switchBody).not.toMatch(/v_forfeited[\s\S]{0,80}duration_seconds/);
    expect(switchBody).not.toMatch(/duration_seconds\s*\+\s*v_forfeited/);
  });
});

describe('BUILD 26M — atomicity and concurrency', () => {
  it('takes the SAME per-account advisory lock the rest of the pass lifecycle uses', () => {
    expect(switchBody).toMatch(/pg_advisory_xact_lock\(hashtext\('timed_pass:' \|\| p_account_id::text\)\)/);
  });

  it('both transitions live in ONE function body, so neither can land alone', () => {
    // One plpgsql body is one transaction. There must be exactly one function doing both halves,
    // never a pair the caller could invoke separately.
    const revokeIdx = switchBody.indexOf("set status = 'REVOKED'");
    const armIdx = switchBody.indexOf("set status = 'SELECTED', selected_at = v_now");
    expect(revokeIdx).toBeGreaterThan(0);
    expect(armIdx).toBeGreaterThan(revokeIdx);
  });

  it('refuses rather than half-completing when a row moves under it', () => {
    expect((switchBody.match(/switch_conflict/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((switchBody.match(/get diagnostics v_upd = row_count/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('scopes the target to the account, so another Host’s pass is simply not found', () => {
    expect(switchBody).toMatch(/where id = p_pass_grant_id and account_id = p_account_id for update/);
    expect(switchBody).toMatch(/'pass_not_found'/);
  });
});

describe('BUILD 26M — ineligible and stale targets', () => {
  it('refuses any target that is not AVAILABLE', () => {
    expect(switchBody).toMatch(/if v_target\.status <> 'AVAILABLE' then[\s\S]{0,160}'not_switchable'/);
  });

  it('treats an already-armed target as a settled replay, writing nothing', () => {
    expect(switchBody).toMatch(/if v_target\.status = 'SELECTED' then[\s\S]{0,260}'changed', false/);
  });
});

describe('BUILD 26M — source neutrality (BUILD 26L compatibility)', () => {
  it('never branches eligibility on source_type / is_paid / apple_purchase_id', () => {
    // A PAID grant must travel the identical state machine as a MANUAL_PROMOTIONAL one.
    expect(switchBody).not.toMatch(/source_type/);
    expect(switchBody).not.toMatch(/is_paid/);
    expect(switchBody).not.toMatch(/apple_purchase_id/);
    expect(switchBody).not.toMatch(/MANUAL_PROMOTIONAL|'PAID'/);
  });

  it('the candidate count is equally source-blind', () => {
    const counter = sql.slice(sql.indexOf('create or replace function public.karaoke_timed_pass_switch_candidates'));
    const body = counter.slice(0, counter.indexOf('revoke all'));
    expect(body).toMatch(/status = 'AVAILABLE'/);
    expect(body).not.toMatch(/source_type|is_paid/);
  });

  it('does not touch the commerce ledger at all', () => {
    expect(sql).not.toMatch(/karaoke_apple_purchases|karaoke_product_catalog|storekit/i);
  });
});

describe('BUILD 26M — the start authority is left alone', () => {
  it('does not redefine karaoke_begin_song_v2 or any admission function', () => {
    expect(sql).not.toMatch(/karaoke_begin_song/);
    expect(sql).not.toMatch(/karaoke_free_minutes_entitlement/);
  });

  it('redefines only the two new functions', () => {
    const created = [...sql.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]).sort();
    expect(created).toEqual(['karaoke_timed_pass_switch_candidates', 'switch_timed_access_pass']);
  });

  it('changes no table, column, index or constraint', () => {
    expect(sql).not.toMatch(/alter table/i);
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/create (unique )?index/i);
    expect(sql).not.toMatch(/drop constraint|add constraint/i);
  });

  it('deletes nothing, ever', () => {
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
  });
});

describe('BUILD 26M — privileges fail closed', () => {
  it('both functions are service_role only', () => {
    for (const fn of ['switch_timed_access_pass(uuid, uuid, text)', 'karaoke_timed_pass_switch_candidates(uuid)']) {
      expect(sql).toContain(`revoke all on function public.${fn} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${fn} to service_role`);
    }
  });

  it('grants execute to no client role', () => {
    expect(sql).not.toMatch(/grant execute[^;]*to [^;]*(anon|authenticated)/);
  });
});

describe('BUILD 26M — the switch is audited on both sides', () => {
  it('writes a HOST-attributed audit row for each transition', () => {
    const inserts = (switchBody.match(/insert into public\.timed_access_pass_audit/g) ?? []).length;
    expect(inserts).toBeGreaterThanOrEqual(3); // EXPIRED sweep + REVOKED + SELECTED (+ DESELECTED)
    expect(switchBody).toMatch(/'HOST', 'host_switch', 'REVOKED', 'ACTIVE', 'REVOKED'/);
    expect(switchBody).toMatch(/'HOST', 'host_switch', 'SELECTED', 'AVAILABLE', 'SELECTED'/);
  });

  it('records the forfeit in the audit metadata, not only in the response', () => {
    expect(switchBody).toMatch(/'forfeitedSeconds', v_forfeited/);
  });
});
