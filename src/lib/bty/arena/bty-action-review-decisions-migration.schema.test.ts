import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DDL-text guard for the Action Review Decisions V1 migration (Slice 3.1B-3N-5C).
 * Mirrors the authority-migration schema test: asserts the migration's INTENT as string
 * literals so a silent removal of a safety property is caught. It does NOT execute SQL —
 * runtime plpgsql behavior is proven by the service tests + Commander device gates.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260731000000_bty_action_review_decisions_v1.sql"),
  "utf8",
);

describe("20260731000000 action review decisions migration", () => {
  it("is copy-friendly and single-transaction", () => {
    expect(SQL.startsWith("-- Copy-friendly")).toBe(true);
    expect(SQL).toContain("begin;");
    expect(SQL).toContain("commit;");
  });

  it("Level: atomic per-run sentinel index + transactional increment RPC", () => {
    expect(SQL).toContain("create unique index if not exists arena_events_run_level_verified_uq");
    expect(SQL).toContain("where (event_type = 'RUN_LEVEL_VERIFIED_APPLIED')");
    expect(SQL).toContain("function public.bty_apply_run_level_verified(");
    // Sentinel claim and increment are in one function transaction (ON CONFLICT DO NOTHING).
    expect(SQL).toContain("on conflict (user_id, run_id) where (event_type = 'RUN_LEVEL_VERIFIED_APPLIED')");
    expect(SQL).toContain("get diagnostics v_inserted = row_count");
  });

  it("AIR: method-independent canonical identity (event_kind, not method)", () => {
    expect(SQL).toContain("add column if not exists event_kind text");
    expect(SQL).toContain("create unique index if not exists le_verification_log_contract_verified_uq");
    expect(SQL).toContain("where (event_kind = 'ACTION_CONTRACT_VERIFIED' and contract_id is not null)");
    // Must NOT key on verify method (QR and Host Approve are different methods, same effect).
    expect(SQL).not.toContain("(activation_id, method)");
  });

  it("contract projection fields + 500-char note check", () => {
    expect(SQL).toContain("add column if not exists revision_note text");
    expect(SQL).toContain("add column if not exists reviewed_at timestamptz");
    expect(SQL).toContain("bty_action_contracts_revision_note_check");
    expect(SQL).toContain("char_length(revision_note) <= 500");
  });

  it("append-only decision audit with immutability trigger + service_role SELECT-only", () => {
    expect(SQL).toContain("create table if not exists public.bty_action_review_decision_audit");
    expect(SQL).toContain("reviewer_membership_id_snapshot uuid not null");
    expect(SQL).toContain("learner_membership_id_snapshot uuid not null");
    expect(SQL).toContain("organization_id_snapshot uuid not null");
    expect(SQL).toContain("previous_status text not null");
    expect(SQL).toContain("resulting_status text not null");
    expect(SQL).toContain("bty_action_review_decision_audit_immutable_trg");
    expect(SQL).toContain("before update or delete on public.bty_action_review_decision_audit");
    expect(SQL).toContain("grant select on public.bty_action_review_decision_audit to service_role");
  });

  it("review RPC: atomic authority recheck + CAS from the reviewable state only + audit", () => {
    expect(SQL).toContain("function public.bty_resolve_action_review(");
    expect(SQL).toContain("security definer");
    // CAS transitions ONLY from submitted + verified_at NULL + reviewable mode.
    expect(SQL).toContain("and c.status = 'submitted'");
    expect(SQL).toContain("and c.verified_at is null");
    expect(SQL).toContain("and c.verification_mode in ('hybrid', 'link')");
    // Approve sets verified_at/completed_at; request_revision sets rejected + note.
    expect(SQL).toContain("set status = 'approved'");
    expect(SQL).toContain("set status = 'rejected'");
    // Ambiguity fails closed; zero-row CAS returns stale.
    expect(SQL).toContain("stale_reason := 'ambiguous_authority'");
    expect(SQL).toContain("stale_reason := 'already_resolved'");
    // Membership ids are derived from DB truth (edge join), never client input.
    expect(SQL).toContain("rm.user_id = p_actor_user_id");
    expect(SQL).toContain("lm.user_id = v_learner_user");
  });

  it("both RPCs are service_role-only EXECUTE", () => {
    expect(SQL).toContain("grant execute on function public.bty_apply_run_level_verified(uuid, text)\n  to service_role");
    expect(SQL).toContain("grant execute on function public.bty_resolve_action_review(uuid, uuid, text, text)\n  to service_role");
    expect(SQL).toContain("revoke execute on function public.bty_resolve_action_review(uuid, uuid, text, text)\n  from public, anon, authenticated");
  });
});
