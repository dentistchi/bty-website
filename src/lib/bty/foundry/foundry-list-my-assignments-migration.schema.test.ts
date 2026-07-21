import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for Slice 3.1B-3E (learner assignment READ path). Asserts the RPC
 * returns ONLY the caller's own assigned|completed assignments for assigned_overlay events,
 * scoped by the immutable user_id_snapshot, exposes no other-recipient/reflection/audit data,
 * writes nothing, and is service-role only.
 */
const PATH = join(process.cwd(), "supabase", "migrations", "20260725000000_foundry_list_my_assignments_v1.sql");
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("foundry list-my-assignments migration (schema-intent)", () => {
  it("scopes rows to the caller's OWN immutable user_id_snapshot (never name/email/role/membership)", () => {
    expect(SQL).toMatch(/where a\.user_id_snapshot = p_auth_user_id/i);
    for (const bad of ["display_name", "email", "job_family", "primary_role", "responsibility", "job_function", "membership_id_snapshot"]) {
      expect(CODE).not.toMatch(new RegExp(`\\b${bad}\\b`, "i"));
    }
  });

  it("returns ONLY the honest states assigned|completed (revoked + claimed are hidden)", () => {
    expect(SQL).toMatch(/and a\.status in \('assigned', 'completed'\)/i);
    expect(CODE).not.toMatch(/'revoked'/i);
    expect(CODE).not.toMatch(/'claimed'/i);
  });

  it("surfaces ONLY assigned_overlay events, so an OPEN_LINK room can never appear as required", () => {
    expect(SQL).toMatch(/join public\.foundry_event_participation_mode m on m\.event_id = a\.event_id and m\.mode = 'assigned_overlay'/i);
  });

  it("exposes only the learner's own title + join_version (no summary column, none invented)", () => {
    expect(SQL).toMatch(/e\.title as title/i);
    expect(SQL).toMatch(/e\.join_version as join_version/i);
    expect(CODE).not.toMatch(/\bsummary\b/i);
  });

  it("reads NO other-recipient identity, reflection/response body, audience count, or audit actor", () => {
    expect(CODE).not.toMatch(/foundry_event_audience_snapshot/i);
    expect(CODE).not.toMatch(/foundry_event_assignment_audit/i);
    expect(CODE).not.toMatch(/foundry_event_participants/i);
    expect(CODE).not.toMatch(/\b(reflection|response_text|resolved_count|changed_by)\b/i);
  });

  it("WRITES nothing — pure read (no insert/update/delete, no XP/identity/access)", () => {
    expect(CODE).not.toMatch(/\binsert\s+into\b/i);
    expect(CODE).not.toMatch(/\bupdate\s+public\./i);
    expect(CODE).not.toMatch(/\bdelete\s+from\b/i);
    expect(CODE).not.toMatch(/\b(core_xp|weekly_xp|lifetime_xp)\b/i);
    expect(CODE).not.toMatch(/foundry_host_grants/i);
    expect(CODE).not.toMatch(/bty_org_membership_responsibilities/i);
  });

  it("is a STABLE SECURITY DEFINER function, pinned search_path, service-role only", () => {
    expect(SQL).toMatch(/language sql stable security definer set search_path = pg_catalog, public/i);
    expect(SQL).toMatch(/revoke execute on function public\.bty_foundry_list_my_assignments\(uuid\) from public, anon, authenticated/i);
    expect(SQL).toMatch(/grant execute on function public\.bty_foundry_list_my_assignments\(uuid\) to service_role/i);
  });

  it("takes ONLY the server-derived auth user — no client-forgeable targeting parameter", () => {
    expect(SQL).toMatch(/bty_foundry_list_my_assignments\( p_auth_user_id uuid \)/i);
    expect(SQL).not.toMatch(/p_user_id|p_membership_id|p_target|p_assignment_id|p_event_id/i);
  });

  it("is copy-friendly (LF header + trailing newline)", () => {
    expect(RAW.startsWith("-- Copy-friendly (LF, no trailing spaces). Select all to copy.")).toBe(true);
    expect(RAW.endsWith("\n")).toBe(true);
  });
});
