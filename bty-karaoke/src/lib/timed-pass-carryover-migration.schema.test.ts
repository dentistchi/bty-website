// BUILD 26M-R2 — Timed Pass Residual Carryover V1 migration pins.
//
// Residual forfeiture was WITHDRAWN after physical use. These assertions pin the replacement:
// the residual is transferred, exactly once, by MOVE and never by accumulation; the canonical
// product duration is untouched; the arming step still starts no clock; and the repaired expiry
// CHECK is what makes an activation path that ignores the carry fail closed instead of silently
// shortening a Host's window.
//
// Comments are STRIPPED before every assertion.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260813120000_karaoke_timed_pass_carryover_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');
const sql = raw.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

function fnBody(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}`);
  expect(start, `${name} declaration`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf(`revoke all on function public.${name}`, start);
  return sql.slice(start, end === -1 ? undefined : end);
}

describe('BUILD 26M-R2 — comment stripping is real', () => {
  it('prose cannot satisfy a DDL assertion', () => {
    expect(raw).toMatch(/MOVE SEMANTICS, NEVER COPY/);
    expect(sql).not.toMatch(/MOVE SEMANTICS, NEVER COPY/);
  });
});

describe('BUILD 26M-R2 — the carryover field', () => {
  it('adds carryover_seconds, defaulted to 0 so every existing row is unaffected', () => {
    expect(sql).toMatch(/add column if not exists carryover_seconds int not null default 0/);
  });

  it('forbids negative carry', () => {
    expect(sql).toMatch(/timed_pass_carryover_nonneg_chk check \(carryover_seconds >= 0\)/);
  });

  it('an AVAILABLE pass may never hold live value — this is what makes transfer a MOVE', () => {
    expect(sql).toMatch(
      /timed_pass_available_no_carry_chk\s+check \(status <> 'AVAILABLE' or carryover_seconds = 0\)/,
    );
  });
});

describe('BUILD 26M-R2 — the expiry CHECK is the enforcement', () => {
  it('the window is base duration PLUS carryover', () => {
    expect(sql).toMatch(
      /add constraint timed_pass_expiry_math_chk check \([\s\S]*?expires_at = activated_at \+ make_interval\(secs => duration_seconds \+ carryover_seconds\)/,
    );
  });

  it('does NOT touch the canonical product duration constraint', () => {
    // The ruling is explicit: base duration stays canonical. Inflating duration_seconds to carry
    // value would also make the product catalog and the grant disagree about what "1 hour" means.
    expect(sql).not.toMatch(/timed_pass_duration_matches_type/);
  });

  it('never rewrites duration_seconds anywhere', () => {
    expect(sql).not.toMatch(/set[^;]*duration_seconds\s*=/);
  });
});

describe('BUILD 26M-R2 — switch transfers, and transfers once', () => {
  const body = () => fnBody('switch_timed_access_pass');

  it('takes an ACTIVE source at its REMAINING, not remaining + its own carry', () => {
    // expires_at already embodies base + prior carry; adding carryover_seconds again double counts.
    expect(body()).toMatch(
      /v_carried := greatest\(0, floor\(extract\(epoch from \(v_active\.expires_at - v_now\)\)\)::int\)/,
    );
    expect(body()).not.toMatch(/v_active\.carryover_seconds/);
  });

  it('takes an armed source at its carry only — never its untouched base duration', () => {
    expect(body()).toMatch(/v_carried := v_prev\.carryover_seconds/);
    expect(body()).not.toMatch(/v_carried\s*:=[^;]*v_prev\.duration_seconds/);
  });

  it('ASSIGNS onto a target proven empty — there is no accumulation rule', () => {
    expect(body()).toMatch(/carryover_seconds = v_carried/);
    // The forbidden shape: target.carryover += source.
    expect(body()).not.toMatch(/carryover_seconds\s*=\s*carryover_seconds\s*\+/);
    expect(body()).not.toMatch(/v_carried\s*:=\s*v_carried\s*\+/);
  });

  it('guards the arm on the target still being AVAILABLE with zero carry', () => {
    expect(body()).toMatch(
      /where id = p_pass_grant_id and status = 'AVAILABLE' and carryover_seconds = 0/,
    );
  });

  it('zeroes the source it took the carry from (MOVE, not COPY)', () => {
    expect(body()).toMatch(/set status = 'AVAILABLE', selected_at = null, carryover_seconds = 0/);
  });

  it('refuses rather than guessing when two carry sources could exist at once', () => {
    expect(body()).toMatch(/carry_source_ambiguous/);
  });

  it('still ARMS without ACTIVATING — no clock is started by a switch', () => {
    expect(body()).not.toMatch(/set status\s*=\s*'ACTIVE'/);
    expect(body()).not.toMatch(/activated_at\s*=\s*v_now/);
  });

  it('a replay writes nothing, so a retry cannot transfer twice', () => {
    expect(body()).toMatch(/if v_target\.status = 'SELECTED' then[\s\S]{0,300}'changed', false/);
  });

  it('raises rather than returns on a lost race, so a half-applied switch cannot commit', () => {
    expect((body().match(/raise exception 'switch_conflict' using errcode = '40001'/g) ?? []).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('publishes both the carried figure and the resulting total', () => {
    expect(body()).toMatch(/'carriedSeconds', v_carried/);
    expect(body()).toMatch(/'effectiveWindowSeconds', v_target\.duration_seconds \+ v_carried/);
  });
});

describe('BUILD 26M-R2 — H1: the ordinary select path must not strand a carry', () => {
  const body = () => fnBody('select_timed_access_pass');

  it('moves the previously armed pass’s carry to the newly armed one', () => {
    expect(body()).toMatch(/v_carried := v_prev\.carryover_seconds/);
    expect(body()).toMatch(/set status = 'AVAILABLE', selected_at = null, carryover_seconds = 0/);
    expect(body()).toMatch(/set status = 'SELECTED', selected_at = now\(\), carryover_seconds = v_carried/);
  });

  it('guards its arm the same way, so select cannot double-credit either', () => {
    expect(body()).toMatch(/where id = p_pass_grant_id and status = 'AVAILABLE' and carryover_seconds = 0/);
  });

  it('starts no clock', () => {
    expect(body()).not.toMatch(/set status\s*=\s*'ACTIVE'/);
    expect(body()).not.toMatch(/activated_at\s*=/);
  });
});

describe('BUILD 26M-R2 — activation mints base + carry', () => {
  const body = () => fnBody('karaoke_begin_song_v2');

  it('reads the armed pass’s carry alongside its duration', () => {
    expect(body()).toMatch(/select id, duration_seconds, carryover_seconds into v_sel_pass, v_sel_dur, v_sel_carry/);
  });

  it('mints the window as duration + carryover', () => {
    expect(body()).toMatch(
      /v_pass_expires := v_now \+ make_interval\(secs => v_sel_dur \+ coalesce\(v_sel_carry, 0\)\)/,
    );
  });

  it('still refuses a song the window cannot cover — carry is not an admission bypass', () => {
    expect(body()).toMatch(/if v_song_end > v_pass_expires then/);
    expect(body()).toMatch(/'pass_insufficient'/);
  });

  it('still activates only on a committed waiting->playing transition', () => {
    expect(body()).toMatch(/update public\.karaoke_requests set status='playing'/);
    expect(body()).toMatch(/if v_activate then[\s\S]{0,200}set status='ACTIVE'/);
  });
});

describe('BUILD 26M-R2 — the state projection publishes a TOTAL', () => {
  const body = () => fnBody('karaoke_timed_pass_state_at');

  it('publishes the armed pass’s effective window so no client does arithmetic', () => {
    expect(body()).toMatch(/'effectiveWindowSeconds', v_selected\.duration_seconds \+ v_selected\.carryover_seconds/);
  });

  it('publishes carryover on both the active and the armed pass', () => {
    expect((body().match(/'carryoverSeconds'/g) ?? []).length).toBe(2);
  });

  it('active remaining still derives from expires_at, so it is total by construction', () => {
    expect(body()).toMatch(/greatest\(0, floor\(extract\(epoch from \(v_active\.expires_at - p_as_of\)\)\)::int\)/);
  });
});

describe('BUILD 26M-R2 — source neutrality and blast radius', () => {
  it('never branches on how a pass was obtained', () => {
    for (const fn of ['switch_timed_access_pass', 'select_timed_access_pass']) {
      expect(fnBody(fn)).not.toMatch(/source_type|is_paid|apple_purchase_id/);
    }
  });

  it('does not touch the commerce ledger or the one-ACTIVE index', () => {
    expect(sql).not.toMatch(/karaoke_apple_purchases|karaoke_product_catalog/i);
    expect(sql).not.toMatch(/timed_pass_one_active_per_account_idx/);
  });

  it('deletes nothing and drops no table or index', () => {
    expect(sql).not.toMatch(/\bdelete from\b|\btruncate\b|drop table|drop index/i);
  });

  it('leaves the legacy karaoke_begin_song alone (it fails closed via the CHECK)', () => {
    expect(sql).not.toMatch(/create or replace function public\.karaoke_begin_song\(/);
  });

  it('keeps every repaired function service_role only', () => {
    for (const fn of [
      'switch_timed_access_pass(uuid, uuid, text)',
      'select_timed_access_pass(uuid, uuid, text)',
      'karaoke_begin_song_v2(uuid, uuid, text)',
      'karaoke_timed_pass_state_at(uuid, timestamptz)',
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${fn} to service_role`);
    }
  });
});
