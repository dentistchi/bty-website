import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the (unapplied) Foundry migration. A real Postgres is
 * not available in unit CI, so this asserts the DDL DECLARES the integrity rules
 * the Commander required — so a future edit can't silently drop them. Actual
 * constraint enforcement is verified against Postgres at apply time.
 */
const MIGRATION = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
  "20260714000000_foundry_event_rooms_v1.sql",
);
const SQL = readFileSync(MIGRATION, "utf8").replace(/\s+/g, " ");

describe("Foundry migration integrity (schema-intent)", () => {
  it("§1 participants expose unique(event_id, id) for the composite FK", () => {
    expect(SQL).toMatch(/unique\s*\(\s*event_id\s*,\s*id\s*\)/i);
  });

  it("§1 progress uses a COMPOSITE FK to participants(event_id, id) (cross-event guard)", () => {
    expect(SQL).toMatch(
      /foreign key\s*\(\s*event_id\s*,\s*participant_id\s*\)\s*references\s+public\.foundry_event_participants\s*\(\s*event_id\s*,\s*id\s*\)/i,
    );
  });

  it("§1 progress does NOT keep a standalone participant_id -> participants(id) FK", () => {
    expect(SQL).not.toMatch(/participant_id\s+uuid\s+not null\s+references\s+public\.foundry_event_participants/i);
  });

  it("§2 partial unique index on (event_id, linked_user_id) where linked_user_id is not null", () => {
    expect(SQL).toMatch(
      /unique index[^;]*foundry_event_training_progress\s*\(\s*event_id\s*,\s*linked_user_id\s*\)\s*where\s+linked_user_id\s+is\s+not\s+null/i,
    );
  });

  it("§6 completion CHECK requires video_completed_at AND a valid response", () => {
    expect(SQL).toMatch(
      /check\s*\(\s*completed_at is null or \(\s*video_completed_at is not null and response_text is not null and char_length\(btrim\(response_text\)\) between 1 and 1000\s*\)\s*\)/i,
    );
  });

  it("§5 atomic award RPC exists, is SECURITY DEFINER, and advisory-locks (user, day)", () => {
    expect(SQL).toMatch(/create or replace function public\.bty_foundry_award_daily_capped/i);
    expect(SQL).toMatch(/security definer/i);
    expect(SQL).toMatch(/pg_advisory_xact_lock/i);
  });

  it("§5 RPC execute is service_role only (revoked from anon/authenticated/public)", () => {
    expect(SQL).toMatch(
      /revoke all on function public\.bty_foundry_award_daily_capped[^;]*from public, anon, authenticated/i,
    );
    expect(SQL).toMatch(/grant execute on function public\.bty_foundry_award_daily_capped[^;]*to service_role/i);
  });

  it("progress table is service-role only (no authenticated grant)", () => {
    expect(SQL).not.toMatch(/grant select on public\.foundry_event_training_progress to authenticated/i);
  });
});
