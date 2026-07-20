import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for Slice 3.1B-3D (authenticated assignment claim). Asserts the RPC
 * matches by the immutable user_id_snapshot only, locks the row, is idempotent + conflict-
 * safe, transitions assigned->completed, and touches no XP/identity/access.
 */
const PATH = join(process.cwd(), "supabase", "migrations", "20260723000000_foundry_assignment_claim_v1.sql");
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("foundry assignment-claim migration (schema-intent)", () => {
  it("matches ONLY by the immutable publish-time user_id_snapshot (never name/email/role)", () => {
    expect(SQL).toMatch(/where a\.event_id = p_event_id and a\.user_id_snapshot = p_auth_user_id and a\.status <> 'revoked'/i);
    for (const bad of ["display_name", "email", "job_family", "primary_role", "responsibility", "job_function"]) {
      expect(CODE).not.toMatch(new RegExp(`\\b${bad}\\b`, "i"));
    }
  });

  it("locks the assignment row to serialize concurrent claims", () => {
    expect(SQL).toMatch(/for update/i);
  });

  it("a missing match is NEUTRAL (no_matching_assignment), never an error or disclosure", () => {
    expect(CODE).toMatch(/if not found then result := 'no_matching_assignment'/i);
  });

  it("is idempotent for the same participant and conflict-safe against a different one", () => {
    expect(CODE).toMatch(/if v_row\.participant_id = p_participant_id then result := 'already_claimed'/i);
    expect(CODE).toMatch(/else result := 'claim_conflict'/i);
  });

  it("a fresh claim sets participant_id + claimed_at + completed_at and goes assigned->completed", () => {
    expect(SQL).toMatch(/set participant_id = p_participant_id, claimed_at = now\(\), completed_at = now\(\), status = 'completed'/i);
    expect(SQL).toMatch(/'complete', v_row\.status, 'completed'/i);
  });

  it("only the fresh-claim branch writes audit (idempotent/conflict paths return before it)", () => {
    // the audit INSERT must appear AFTER the already_claimed/conflict early-returns
    const insertIdx = RAW.indexOf("insert into public.foundry_event_assignment_audit");
    const alreadyIdx = RAW.indexOf("'already_claimed'");
    const conflictIdx = RAW.indexOf("'claim_conflict'");
    expect(insertIdx).toBeGreaterThan(alreadyIdx);
    expect(insertIdx).toBeGreaterThan(conflictIdx);
  });

  it("touches NO XP, participants, linked_user_id, identity, responsibilities, or access", () => {
    expect(CODE).not.toMatch(/\b(core_xp|weekly_xp|lifetime_xp|xp_awarded|arena_profiles)\b/i);
    expect(CODE).not.toMatch(/foundry_event_participants/i);
    expect(CODE).not.toMatch(/linked_user_id/i);
    expect(CODE).not.toMatch(/bty_org_membership_responsibilities/i);
    expect(CODE).not.toMatch(/foundry_host_grants/i);
    // never inserts/updates a second assignment or transfers
    expect(CODE).not.toMatch(/insert into public\.foundry_event_assignments/i);
  });

  it("is SECURITY DEFINER, pinned search_path, service-role only", () => {
    expect(SQL).toMatch(/security definer set search_path = pg_catalog, public/i);
    expect(SQL).toMatch(/revoke execute on function public\.bty_foundry_claim_assignment\(uuid, uuid, uuid\) from public, anon, authenticated/i);
    expect(SQL).toMatch(/grant execute on function public\.bty_foundry_claim_assignment\(uuid, uuid, uuid\) to service_role/i);
  });

  it("takes NO client-forgeable targeting parameter (only event, participant, auth user)", () => {
    expect(SQL).toMatch(/bty_foundry_claim_assignment\( p_event_id uuid, p_participant_id uuid, p_auth_user_id uuid \)/i);
    expect(SQL).not.toMatch(/p_assignment_id|p_membership_id|p_target/i);
  });

  it("is copy-friendly (LF header + trailing newline)", () => {
    expect(RAW.startsWith("-- Copy-friendly (LF, no trailing spaces). Select all to copy.")).toBe(true);
    expect(RAW.endsWith("\n")).toBe(true);
  });
});

/**
 * Slice 3.1B-3D fix (migration 20260724000000): the "no assignment for this user" branch
 * distinguishes an assigned event (wrong account) from an ordinary open-link room, so the
 * UI can stay silent on open-link and surface a neutral message only on an assigned event.
 */
describe("assignment-claim v2 — open-link vs wrong-account distinction", () => {
  const V2 = readFileSync(join(process.cwd(), "supabase", "migrations", "20260724000000_foundry_assignment_claim_v2.sql"), "utf8").replace(/\s+/g, " ");
  const V2CODE = readFileSync(join(process.cwd(), "supabase", "migrations", "20260724000000_foundry_assignment_claim_v2.sql"), "utf8").replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

  it("returns not_applicable for an open-link room, no_matching_assignment for an assigned event", () => {
    expect(V2).toMatch(/from public\.foundry_event_participation_mode m where m\.event_id = p_event_id and m\.mode = 'assigned_overlay'/i);
    expect(V2).toMatch(/case when v_is_assigned then 'no_matching_assignment' else 'not_applicable' end/i);
  });

  it("preserves the v1 contract: match by user_id_snapshot, lock, assigned->completed, service-role only", () => {
    expect(V2).toMatch(/where a\.event_id = p_event_id and a\.user_id_snapshot = p_auth_user_id and a\.status <> 'revoked' for update/i);
    expect(V2).toMatch(/set participant_id = p_participant_id, claimed_at = now\(\), completed_at = now\(\), status = 'completed'/i);
    expect(V2).toMatch(/security definer set search_path = pg_catalog, public/i);
    expect(V2).toMatch(/grant execute on function public\.bty_foundry_claim_assignment\(uuid, uuid, uuid\) to service_role/i);
    // still writes no XP / participant / identity
    expect(V2CODE).not.toMatch(/core_xp|linked_user_id|foundry_event_participants/i);
  });
});
