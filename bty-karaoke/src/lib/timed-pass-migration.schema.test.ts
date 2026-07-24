// Timed Access Pass Foundation V1 (BUILD 17) — migration schema pins. Asserts the SQL
// actually implements the locked rules: account-scoped grants with fixed durations, the
// one-SELECTED + one-ACTIVE partial unique indexes, the append-only audit with an
// exactly-one-ACTIVATED backstop, the atomic pass-aware karaoke_begin_song (activation +
// FREE-block bypass + non-metered pass-covered segment), and that NO plan-authority table
// is mutated (§ non-negotiables). Pure static read — no DB.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260728120000_karaoke_timed_access_passes.sql'),
  'utf8',
);

describe('20260728120000_karaoke_timed_access_passes.sql', () => {
  it('binds grants to the canonical account (cascade), never a Room/Event/device', () => {
    expect(sql).toMatch(/create table if not exists public\.timed_access_pass_grants/);
    expect(sql).toMatch(/account_id\s+uuid not null references public\.karaoke_accounts\(id\) on delete cascade/);
  });

  it('allows only the three fixed pass types and pins duration to type', () => {
    expect(sql).toMatch(/check \(pass_type in \('ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS'\)\)/);
    expect(sql).toMatch(/pass_type = 'ONE_HOUR'\s+and duration_seconds = 3600/);
    expect(sql).toMatch(/pass_type = 'FOUR_HOURS'\s+and duration_seconds = 14400/);
    expect(sql).toMatch(/pass_type = 'TWENTY_FOUR_HOURS' and duration_seconds = 86400/);
  });

  it('constrains status to the five lifecycle states', () => {
    expect(sql).toMatch(/check \(status in \('AVAILABLE', 'SELECTED', 'ACTIVE', 'EXPIRED', 'REVOKED'\)\)/);
  });

  it('enforces at most ONE SELECTED and ONE ACTIVE pass per account (partial unique)', () => {
    expect(sql).toMatch(/timed_pass_one_selected_per_account_idx[\s\S]*?\(account_id\)[\s\S]*?where status = 'SELECTED'/);
    expect(sql).toMatch(/timed_pass_one_active_per_account_idx[\s\S]*?\(account_id\)[\s\S]*?where status = 'ACTIVE'/);
  });

  it('pins expires_at = activated_at + duration (no extension) and SELECTED has no activation', () => {
    expect(sql).toMatch(/expires_at = activated_at \+ make_interval\(secs => duration_seconds\)/);
    expect(sql).toMatch(/when 'SELECTED'\s+then selected_at is not null and activated_at is null/);
  });

  it('has an append-only audit with an exactly-one-ACTIVATED backstop', () => {
    expect(sql).toMatch(/create table if not exists public\.timed_access_pass_audit/);
    expect(sql).toMatch(/before update or delete on public\.timed_access_pass_audit/);
    expect(sql).toMatch(/timed_pass_audit_one_activation_idx[\s\S]*?\(pass_grant_id\)[\s\S]*?where action = 'ACTIVATED'/);
  });

  it('relaxes the metered CHECK to exclude pass-covered segments (behaviour-identical for old rows)', () => {
    expect(sql).toMatch(/add column if not exists metering_paused_by_pass boolean not null default false/);
    expect(sql).toMatch(/metered = \(plan_snapshot = 'FREE' and metering_paused_by_pass = false\)/);
  });

  it('defines the four RPCs restricted to service_role', () => {
    for (const fn of [
      'issue_timed_access_pass',
      'select_timed_access_pass',
      'revoke_timed_access_pass',
      'karaoke_timed_pass_state_at',
    ]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${fn}`));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*?to service_role`));
    }
  });

  it('issue blocks a PRO base account and select never sets activated_at', () => {
    expect(sql).toMatch(/v_plan = 'PRO' then\s*\n\s*return jsonb_build_object\('ok', false, 'error', 'account_is_pro'\)/);
    expect(sql).toMatch(/set status = 'SELECTED', selected_at = now\(\)/);
  });

  it('karaoke_begin_song activates the SELECTED pass in the SAME transaction and bypasses the FREE block', () => {
    expect(sql).toMatch(/create or replace function public\.karaoke_begin_song/);
    // The SELECTED pass is the activation candidate.
    expect(sql).toMatch(/status='SELECTED' for update limit 1/);
    // FREE 0:00 block is bypassed when a pass covers the start.
    expect(sql).toMatch(/if v_enf and v_plan='FREE' and not v_pass_covered then/);
    // Activation flips SELECTED -> ACTIVE with server time + fixed expiry, and one ACTIVATED audit.
    expect(sql).toMatch(/set status='ACTIVE', activated_at=v_now, expires_at=v_pass_expires/);
    expect(sql).toMatch(/'ACTIVATED', 'SELECTED', 'ACTIVE'/);
    // The pass-covered segment is written NON-metered (FREE meter paused).
    expect(sql).toMatch(/\(v_plan='FREE' and not v_pass_covered\), v_now, v_tz,/);
  });

  it('PRO owners never consume a pass', () => {
    expect(sql).toMatch(/if v_plan <> 'PRO' then/);
  });

  it('never mutates plan-authority or pilot tables (no second plan authority)', () => {
    expect(sql).not.toMatch(/insert into public\.karaoke_host_plan_assignments/);
    expect(sql).not.toMatch(/update public\.karaoke_host_plan_assignments/);
    expect(sql).not.toMatch(/change_karaoke_host_plan/);
    expect(sql).not.toMatch(/karaoke_pro_pilot/);
  });

  it('carries no billing surface — no price/sku/amount/product columns (§8 non-goals)', () => {
    // The non-goals are named in the header comment; what matters is that no billing
    // column or product identifier exists in the actual schema.
    expect(sql).not.toMatch(/\b(price|amount_cents|sku|product_id|store_kit|stripe_id|receipt)\b\s+(text|int|numeric|uuid|bigint)/i);
  });
});
