// Host Plan Foundation V1 — pins the migration DDL so the invariants that make the
// data model safe can't silently regress: additive+idempotent, the FREE/PRO
// allowlist, the ONE-active-per-account partial unique index, an honest status
// timeline, default-deny RLS, and an idempotent FREE backfill of existing accounts.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  fileURLToPath(
    new URL('../../supabase/migrations/20260722120000_karaoke_host_plan_assignments.sql', import.meta.url),
  ),
  'utf8',
);
const norm = sql.toLowerCase().replace(/\s+/g, ' ');

describe('20260722120000_karaoke_host_plan_assignments.sql', () => {
  it('is additive + idempotent (create table if not exists, no drops of prior tables)', () => {
    expect(norm).toContain('create table if not exists public.karaoke_host_plan_assignments');
    expect(norm).not.toMatch(/drop table (?!if exists)/); // only the documented rollback comment
  });

  it('binds the plan to the canonical ACCOUNT (not a Room) with cascade delete', () => {
    expect(norm).toContain('account_id uuid not null references public.karaoke_accounts(id) on delete cascade');
    expect(norm).not.toContain('room_id'); // a plan is never Room-scoped
  });

  it('(6) constrains plan_code to exactly FREE and PRO', () => {
    expect(norm).toContain("plan_code text not null check (plan_code in ('free', 'pro'))");
  });

  it('constrains source to the SYSTEM_DEFAULT / MANUAL / BILLING allowlist', () => {
    expect(norm).toContain("source in ('system_default', 'manual', 'billing')");
  });

  it('(5) enforces one ACTIVE assignment per account via a partial unique index', () => {
    expect(norm).toMatch(
      /create unique index if not exists \S+ on public\.karaoke_host_plan_assignments \(account_id\) where status = 'active'/,
    );
  });

  it('keeps the status timeline honest (active⇒no end, ended⇒has end)', () => {
    expect(norm).toContain("status = 'active' and ended_at is null");
    expect(norm).toContain("status = 'ended' and ended_at is not null");
  });

  it('is default-deny: RLS enabled + revoke from anon/authenticated', () => {
    expect(norm).toContain('enable row level security');
    expect(norm).toContain('revoke all on public.karaoke_host_plan_assignments from anon, authenticated');
  });

  it('(1)(2) backfills existing accounts with FREE, idempotently (only when no active exists)', () => {
    expect(norm).toContain("select a.id, 'free', 'system_default', 'active'");
    expect(norm).toContain('where not exists');
    expect(norm).toContain("p.status = 'active'");
    expect(norm).toContain('on conflict do nothing');
  });
});
