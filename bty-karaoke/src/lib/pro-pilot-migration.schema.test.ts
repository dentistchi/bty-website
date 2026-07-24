// PRO Pilot Request + Manager Approval V1 — migration schema pins. Asserts the SQL
// actually implements the rules the model test relies on: the request entity, the
// ONE-PENDING-per-account partial unique index, the append-only decision audit, the
// two service_role-only RPCs, the decide RPC's reuse of the EXISTING plan authority,
// and that the request/decision path touches NO Event/Queue table (§20).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260727120000_karaoke_pro_pilot_requests.sql'),
  'utf8',
);

describe('20260727120000_karaoke_pro_pilot_requests.sql', () => {
  it('creates the request entity bound to the canonical account (cascade), room as nullable context', () => {
    expect(sql).toMatch(/create table if not exists public\.karaoke_pro_pilot_requests/);
    expect(sql).toMatch(/account_id\s+uuid not null references public\.karaoke_accounts\(id\) on delete cascade/);
    expect(sql).toMatch(/room_id\s+uuid references public\.karaoke_rooms\(id\) on delete set null/);
  });

  it('constrains status to PENDING/APPROVED/DECLINED (no WITHDRAWN/EXPIRED/CANCELLED in V1)', () => {
    expect(sql).toMatch(/status\s+text not null default 'PENDING'/);
    expect(sql).toMatch(/check \(status in \('PENDING', 'APPROVED', 'DECLINED'\)\)/);
    expect(sql).not.toMatch(/WITHDRAWN|EXPIRED|CANCELLED/);
  });

  it('enforces at most ONE PENDING request per account via a partial unique index', () => {
    expect(sql).toMatch(/create unique index if not exists karaoke_pro_pilot_pending_unique_idx[\s\S]*?on public\.karaoke_pro_pilot_requests \(account_id\)[\s\S]*?where status = 'PENDING'/);
  });

  it('guards create replay with a unique request idempotency key', () => {
    expect(sql).toMatch(/karaoke_pro_pilot_request_idem_idx[\s\S]*?\(request_idempotency_key\)/);
  });

  it('has an append-only decision audit (trigger blocks update/delete)', () => {
    expect(sql).toMatch(/create table if not exists public\.karaoke_pro_pilot_request_audit/);
    expect(sql).toMatch(/before update or delete on public\.karaoke_pro_pilot_request_audit/);
    expect(sql).toMatch(/append-only/);
    expect(sql).toMatch(/karaoke_pro_pilot_audit_idem_idx[\s\S]*?\(decision_idempotency_key\)/);
  });

  it('defines both RPCs and restricts them to service_role', () => {
    expect(sql).toMatch(/create or replace function public\.create_karaoke_pro_pilot_request/);
    expect(sql).toMatch(/create or replace function public\.decide_karaoke_pro_pilot_request/);
    expect(sql).toMatch(/grant execute on function public\.create_karaoke_pro_pilot_request[\s\S]*?to service_role/);
    expect(sql).toMatch(/grant execute on function public\.decide_karaoke_pro_pilot_request[\s\S]*?to service_role/);
    expect(sql).toMatch(/revoke all on function public\.decide_karaoke_pro_pilot_request[\s\S]*?from public, anon, authenticated/);
  });

  it('the decide RPC reuses the EXISTING canonical plan authority (no second plan authority)', () => {
    expect(sql).toMatch(/public\.change_karaoke_host_plan\(/);
    // Approve derives a deterministic plan key from the decision key → idempotent replay.
    expect(sql).toMatch(/'propilot:' \|\| v_key/);
    // No new plan-assignment table is created here (it is only referenced by FK).
    expect(sql).not.toMatch(/create table[^;]*?public\.karaoke_host_plan_assignments\b/);
  });

  it('serializes per-account with an advisory xact lock (race-safe create + decide)', () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\('karaoke_pro_pilot:'/);
  });

  it('rejects an already-decided request (CAS) and a decline never changes the plan', () => {
    expect(sql).toMatch(/already_decided/);
    // decline branch marks DECLINED without calling the plan authority
    expect(sql).toMatch(/status = 'DECLINED'/);
  });

  it('(§20) the request/decision migration touches no Event or Queue table', () => {
    expect(sql).not.toMatch(/karaoke_events/);
    expect(sql).not.toMatch(/karaoke_requests\b/);
  });

  it('is copy-friendly (header comment present)', () => {
    expect(sql.startsWith('-- Copy-friendly')).toBe(true);
  });
});
