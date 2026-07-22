import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice 3.1B-3K HOTFIX — schema-intent guard for the submit-RPC plpgsql ambiguity fix.
 *
 * The live defect was PostgreSQL 42702 ("column reference \"status\" is ambiguous"): the OUT params
 * status/outcome collided with the same-named table columns referenced unqualified in the plpgsql
 * body, so every valid-outcome submit failed BEFORE any write. This guard asserts the fix migration
 * resolves the ambiguity (via `#variable_conflict use_column`) while keeping the RPC signature +
 * return shape (result, status, outcome) unchanged so the deployed Worker needs no change.
 *
 * NOTE (coverage gap this documents): the unit suite MOCKS the RPC, so it cannot execute plpgsql —
 * a real-Postgres integration harness would be needed to catch 42702 directly. This schema-intent
 * guard + the live read-only RPC probe (real-id + wrong-owner → 'not_owner' instead of 42702) are the
 * available regression signals.
 */
const RAW = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260729000000_foundry_submit_followup_ambiguity_fix_v1.sql"),
  "utf8",
);
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").toLowerCase();

describe("submit-followup ambiguity fix (schema-intent)", () => {
  it("create-or-replaces the submit RPC (no drop → signature preserved)", () => {
    expect(CODE).toMatch(/create or replace function public\.bty_foundry_submit_followup\(/);
    expect(CODE).not.toMatch(/drop function/); // no signature change → Worker unchanged
  });

  it("adds the #variable_conflict use_column directive that resolves the 42702 ambiguity", () => {
    // directive comment must survive (it is plpgsql syntax, not a SQL comment — kept in RAW)
    expect(RAW).toMatch(/#variable_conflict use_column/);
  });

  it("keeps the return shape (result, status, outcome) unchanged", () => {
    expect(CODE).toMatch(/returns table \(result text, status text, outcome text\)/);
  });

  it("preserves first-response-wins / idempotent-unchanged / never-overwrite semantics", () => {
    expect(CODE).toMatch(/'already_responded'/); // conflicting second outcome rejected
    expect(CODE).toMatch(/'unchanged'/); // identical resubmission idempotent
    expect(CODE).toMatch(/for update/); // row-locked transition
    expect(CODE).toMatch(/user_id_snapshot is distinct from p_auth_user_id/); // owner-verified
  });

  it("still never touches completion / XP / assignment / shared understanding", () => {
    expect(CODE).not.toMatch(/foundry_event_training_progress/);
    expect(CODE).not.toMatch(/foundry_event_assignments/);
    expect(CODE).not.toMatch(/xp_awarded_at|core_xp|weekly_xp/);
  });

  it("remains service_role-only with a fixed search_path", () => {
    expect(CODE).toMatch(/security definer/);
    expect(CODE).toMatch(/set search_path = pg_catalog, public/);
    expect(CODE).toMatch(/grant execute on function public\.bty_foundry_submit_followup\(uuid, uuid, text\)\s*to service_role/);
  });
});
