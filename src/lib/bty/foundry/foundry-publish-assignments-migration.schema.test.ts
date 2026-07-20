import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for Slice 3.1B-3C (publish-time assignment creation). Asserts the
 * atomic write RPC resolves audiences CANONICALLY (no legacy signal), derives org + user
 * server-side, blocks zero recipients, is idempotent, and is service-role only.
 */
const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260722000000_foundry_publish_assignments_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("foundry publish-assignments migration (schema-intent)", () => {
  it("resolves the four canonical audiences and NO legacy signal", () => {
    expect(SQL).toMatch(/p_audience_type = 'everyone'/i);
    expect(SQL).toMatch(/p_audience_type = 'leaders'/i);
    expect(SQL).toMatch(/'PARTNER', 'CLINICAL_DIRECTOR', 'TRAINER', 'TEAM_LEAD', 'PEOPLE_MANAGER'/i);
    expect(SQL).toMatch(/p_audience_type = 'job_group' and m\.job_family_key = p_audience_detail/i);
    expect(SQL).toMatch(/p_audience_type = 'specific_role' and m\.primary_role_key = p_audience_detail/i);
    // never consults any legacy leader signal
    for (const legacy of ["job_function", "is_leader_track", "leader_started_at", "is_lead", "certified_leader"]) {
      expect(CODE).not.toMatch(new RegExp(`\\b${legacy}\\b`, "i"));
    }
  });

  it("only ACTIVE memberships and ACTIVE responsibilities qualify", () => {
    expect(SQL).toMatch(/m\.status = 'active'/i);
    expect(SQL).toMatch(/r\.status = 'active'/i);
  });

  it("derives organization from the ACTOR, never from a client parameter", () => {
    expect(SQL).toMatch(/where om\.user_id = p_actor_user_id and om\.status = 'active' and om\.is_primary = true/i);
    // the functions take no organization_id / user-target / count parameter
    expect(SQL).not.toMatch(/p_organization_id uuid,\s*p_actor/i);
    expect(SQL).not.toMatch(/p_target_user_id|p_membership_ids|p_recipient/i);
  });

  it("derives user_id from the membership row (snapshot = derived value, not a parameter)", () => {
    expect(SQL).toMatch(/v_rec\.membership_id, v_rec\.user_id, v_rec\.membership_id, v_rec\.user_id/i);
  });

  it("blocks zero recipients — never a successful empty assigned publish", () => {
    expect(SQL).toMatch(/if v_count = 0 then raise exception 'zero_recipients'/i);
  });

  it("is idempotent: an existing snapshot short-circuits and writes nothing new", () => {
    expect(SQL).toMatch(/if exists \(select 1 from public\.foundry_event_audience_snapshot s where s\.event_id = p_event_id\)/i);
  });

  it("re-checks Host at the write boundary (defence in depth)", () => {
    expect(SQL).toMatch(/from public\.foundry_host_grants g where g\.user_id = p_actor_user_id and g\.status = 'active'/i);
    expect(SQL).toMatch(/raise exception 'not_a_host'/i);
  });

  it("writes assignment + audit + snapshot + mode, all inside one plpgsql function", () => {
    expect(SQL).toMatch(/insert into public\.foundry_event_assignments/i);
    expect(SQL).toMatch(/insert into public\.foundry_event_assignment_audit/i);
    expect(SQL).toMatch(/insert into public\.foundry_event_audience_snapshot/i);
    expect(SQL).toMatch(/insert into public\.foundry_event_participation_mode \(event_id, mode, set_by\) values \(p_event_id, 'assigned_overlay'/i);
    // status is 'assigned' with a null before-state (creation)
    expect(SQL).toMatch(/'assign', null, 'assigned'/i);
  });

  it("creates NO participant row at publish (assignment != participation)", () => {
    expect(CODE).not.toMatch(/insert into public\.foundry_event_participants/i);
  });

  it("copies no reflection/response/XP data into any assignment structure", () => {
    expect(CODE).not.toMatch(/response_text/i);
    expect(CODE).not.toMatch(/reflection/i);
    expect(CODE).not.toMatch(/\b(total_xp|weekly_xp|core_xp|xp_awarded)\b/i);
  });

  it("all functions are SECURITY DEFINER, pinned search_path, service-role only", () => {
    const defs = SQL.match(/security definer set search_path = pg_catalog, public/gi) ?? [];
    expect(defs.length).toBeGreaterThanOrEqual(3);
    for (const fn of [
      "bty_foundry_eligible_memberships",
      "bty_foundry_resolve_audience",
      "bty_foundry_publish_assignments",
    ]) {
      expect(SQL).toMatch(new RegExp(`revoke execute on function public\\.${fn}\\(`, "i"));
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role`, "i"));
    }
  });

  it("touches no existing Foundry table or behavior", () => {
    expect(CODE).not.toMatch(/alter table public\.foundry_events/i);
    expect(CODE).not.toMatch(/alter table public\.foundry_event_participants/i);
    expect(CODE).not.toMatch(/drop table/i);
  });

  it("is copy-friendly (LF header + trailing newline)", () => {
    expect(RAW.startsWith("-- Copy-friendly (LF, no trailing spaces). Select all to copy.")).toBe(true);
    expect(RAW.endsWith("\n")).toBe(true);
  });
});
