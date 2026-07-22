import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice 3.1B-3K — schema-intent guard for the follow-up obligation migration. Additive: a new
 * per-participant obligation table + append-only audit + three service-role SECURITY DEFINER RPCs.
 * RLS default-deny, explicit constraints, idempotency, and NO private text columns.
 */
const RAW = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260728000000_foundry_participant_followups_v1.sql"),
  "utf8",
);
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").toLowerCase();

describe("foundry-participant-followups migration (schema-intent)", () => {
  it("test 1 — creates the obligation + audit tables (idempotent)", () => {
    expect(CODE).toMatch(/create table if not exists public\.foundry_participant_followups/);
    expect(CODE).toMatch(/create table if not exists public\.foundry_participant_followup_audit/);
  });

  it("has the required obligation columns", () => {
    for (const col of [
      "organization_id",
      "event_id",
      "progress_id",
      "assignment_id",
      "user_id_snapshot uuid not null",
      "source_training_title text not null",
      "follow_up_days integer not null",
      "completed_at timestamptz not null",
      "timezone_snapshot text not null",
      "completion_bty_day date not null",
      "due_bty_day date not null",
      "due_at timestamptz not null",
      "status text not null default 'pending'",
      "outcome text",
      "responded_at timestamptz",
    ]) {
      expect(CODE).toContain(col);
    }
  });

  it("test 2/3 — RLS enabled + default-deny direct access on BOTH tables", () => {
    expect(CODE).toMatch(/alter table public\.foundry_participant_followups enable row level security/);
    expect(CODE).toMatch(/alter table public\.foundry_participant_followup_audit enable row level security/);
    expect(CODE).toMatch(/revoke all on public\.foundry_participant_followups from anon, public, authenticated/);
    expect(CODE).toMatch(/revoke all on public\.foundry_participant_followup_audit from anon, public, authenticated/);
    // No client-role policy widens access; writes go only through SECURITY DEFINER RPCs.
    expect(CODE).not.toMatch(/create policy[^;]*on public\.foundry_participant_followups/);
  });

  it("test 4 — constraints enforce follow_up_days, status/outcome consistency, responded_at", () => {
    expect(CODE).toMatch(/check \(follow_up_days in \(7, 30\)\)/);
    expect(CODE).toMatch(/check \(status in \('pending', 'responded'\)\)/);
    // outcome exists iff RESPONDED and only from the allowed set
    expect(CODE).toMatch(/status = 'pending' and outcome is null/);
    expect(CODE).toMatch(/status = 'responded' and outcome in \('applied', 'partly_applied', 'not_yet', 'blocked'\)/);
    // responded_at exists iff RESPONDED
    expect(CODE).toMatch(/status = 'pending' and responded_at is null/);
    expect(CODE).toMatch(/status = 'responded' and responded_at is not null/);
  });

  it("test 5 — UNIQUE(progress_id, follow_up_days) idempotency constraint", () => {
    expect(CODE).toMatch(/unique \(progress_id, follow_up_days\)/);
  });

  it("test 6 — audit is append-only: revoked, RLS on, event-type constrained, no update/delete grants", () => {
    expect(CODE).toMatch(/check \(event_type in \('created', 'responded'\)\)/);
    // no grant of update/delete on the audit table to any role
    expect(CODE).not.toMatch(/grant (update|delete)[^;]*foundry_participant_followup_audit/);
  });

  it("test 51 — the obligation table stores NO private text (no reflection / shared / note / free text)", () => {
    expect(CODE).not.toMatch(/response_text/);
    expect(CODE).not.toMatch(/shared_understanding_response/);
    expect(CODE).not.toMatch(/reflection/);
    expect(CODE).not.toMatch(/\bnote\b/);
  });

  it("defines the three service-role SECURITY DEFINER RPCs with a fixed search_path", () => {
    for (const fn of [
      "bty_foundry_materialize_followup",
      "bty_foundry_submit_followup",
      "bty_foundry_get_my_followup",
    ]) {
      expect(CODE).toContain(`function public.${fn}`);
      expect(CODE).toMatch(new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`));
    }
    expect(CODE).toMatch(/security definer/);
    expect(CODE).toMatch(/set search_path = pg_catalog, public/);
  });

  it("materialize is idempotent (ON CONFLICT DO NOTHING) and audits only a fresh insert (CREATED)", () => {
    expect(CODE).toMatch(/on conflict \(progress_id, follow_up_days\) do nothing/);
    expect(CODE).toMatch(/'created'/);
  });

  it("submit locks the row, verifies owner, and never overwrites a prior outcome", () => {
    expect(CODE).toMatch(/for update/);
    expect(CODE).toMatch(/user_id_snapshot is distinct from p_auth_user_id/);
    expect(CODE).toMatch(/'already_responded'/); // conflicting second outcome is rejected, not overwritten
  });

  it("submit/materialize NEVER touch completion, XP, assignment, or shared understanding", () => {
    // The RPC bodies must not write to any of these tables.
    expect(CODE).not.toMatch(/update public\.foundry_event_training_progress/);
    expect(CODE).not.toMatch(/update public\.foundry_event_assignments/);
    expect(CODE).not.toMatch(/xp_awarded_at|core_xp|weekly_xp/);
  });

  it("documents a rollback", () => {
    expect(RAW).toMatch(/drop table if exists public\.foundry_participant_followups/i);
    expect(RAW).toMatch(/drop function if exists public\.bty_foundry_submit_followup/i);
  });
});
