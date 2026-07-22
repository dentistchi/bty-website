// PRO Pilot Assignment + Plan Lifecycle V1 — pins the migration DDL so the invariants
// that make the change path safe can't silently regress: additive+idempotent, an
// append-only audit table (UPDATE/DELETE blocked), a mandatory non-empty reason, a
// unique idempotency key, default-deny RLS, and an atomic RPC that ends+inserts+
// audits in one transaction, serialized per account, service_role-only.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  fileURLToPath(
    new URL('../../supabase/migrations/20260723120000_karaoke_host_plan_change_rpc.sql', import.meta.url),
  ),
  'utf8',
);
const norm = sql.toLowerCase().replace(/\s+/g, ' ');
// The executable DDL only, with `-- ...` comment lines stripped, so the privacy
// assertions check the actual schema rather than the header's prose (which legitimately
// says "never stores a token / OAuth credential / provider subject / email").
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join(' ')
  .toLowerCase()
  .replace(/\s+/g, ' ');

describe('20260723120000_karaoke_host_plan_change_rpc.sql', () => {
  it('is additive + idempotent (create table/function if not exists / or replace, no destructive drops)', () => {
    expect(norm).toContain('create table if not exists public.karaoke_host_plan_assignment_audit');
    expect(norm).toContain('create or replace function public.change_karaoke_host_plan');
    expect(norm).not.toMatch(/drop table (?!if exists)/); // only the documented rollback comment
  });

  it('binds the audit to the canonical ACCOUNT (not a Room) with cascade delete', () => {
    expect(norm).toContain('account_id uuid not null references public.karaoke_accounts(id) on delete cascade');
  });

  it('records the full before/after of a change', () => {
    expect(norm).toContain('previous_plan');
    expect(norm).toContain('new_plan text not null');
    expect(norm).toContain('previous_assignment_id');
    expect(norm).toContain('new_assignment_id uuid not null');
  });

  it('requires a non-empty reason (audit is never silent about why)', () => {
    expect(norm).toContain('reason text not null check (length(btrim(reason)) > 0)');
  });

  it('constrains audit plan codes to FREE/PRO and source to the allowlist', () => {
    expect(norm).toContain("new_plan text not null check (new_plan in ('free', 'pro'))");
    expect(norm).toContain("check (source in ('system_default', 'manual', 'billing'))");
  });

  it('makes the idempotency key unique (replay-safe backstop)', () => {
    expect(norm).toMatch(
      /create unique index if not exists \S+ on public\.karaoke_host_plan_assignment_audit \(idempotency_key\)/,
    );
  });

  it('enforces APPEND-ONLY: a trigger blocks UPDATE and DELETE on the audit table', () => {
    expect(norm).toContain('before update or delete on public.karaoke_host_plan_assignment_audit');
    expect(norm).toContain('append-only');
    expect(norm).toContain('raise exception');
  });

  it('is default-deny: RLS enabled + revoke from anon/authenticated', () => {
    expect(norm).toContain('enable row level security');
    expect(norm).toContain('revoke all on public.karaoke_host_plan_assignment_audit from anon, authenticated');
  });

  it('the RPC is atomic: ends current + inserts new active + inserts one audit row', () => {
    expect(norm).toContain("update public.karaoke_host_plan_assignments set status = 'ended', ended_at = now()");
    expect(norm).toContain('insert into public.karaoke_host_plan_assignments');
    expect(norm).toContain('insert into public.karaoke_host_plan_assignment_audit');
  });

  it('serializes concurrent changes per account with an advisory xact lock', () => {
    expect(norm).toContain("pg_advisory_xact_lock(hashtext('karaoke_host_plan:' || p_account_id::text))");
  });

  it('locks the current active assignment for update (no read/modify race)', () => {
    expect(norm).toMatch(/where account_id = p_account_id and status = 'active' for update/);
  });

  it('same-plan request is a no-op that writes nothing', () => {
    expect(norm).toContain("v_active.id is not null and v_active.plan_code = p_plan_code");
    expect(norm).toContain("'changed', false");
  });

  it('replays a known idempotency key without writing', () => {
    expect(norm).toContain('where idempotency_key = v_key');
    expect(norm).toContain("'replayed', true");
  });

  it('rejects an unknown account without leaking (existence check only)', () => {
    expect(norm).toContain('select 1 from public.karaoke_accounts where id = p_account_id');
    expect(norm).toContain("'account_not_found'");
  });

  it('is service_role-only: revoked from public/anon/authenticated, executable by service_role', () => {
    expect(norm).toContain('revoke all on function public.change_karaoke_host_plan');
    expect(norm).toContain('from public, anon, authenticated');
    expect(norm).toContain('grant execute on function public.change_karaoke_host_plan');
    expect(norm).toContain('to service_role');
  });

  it('never stores a token, provider subject, or email in the audit DDL', () => {
    expect(code).not.toContain('provider_subject');
    expect(code).not.toContain('oauth');
    expect(code).not.toMatch(/\bemail\b/);
    expect(code).not.toMatch(/\btoken\b/);
  });
});
