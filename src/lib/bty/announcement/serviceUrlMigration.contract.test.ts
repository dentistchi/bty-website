import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * SLICE A0.1 — what the migration must and must not do.
 *
 * These read the SQL as text rather than running it, because the claims worth guarding are about
 * what the file DOESN'T contain: no backfill, no invented endpoint, and no rewrite of an existing
 * run's coordinate. A file can be applied successfully and still be wrong in all three ways.
 */

const DIR = join(process.cwd(), "supabase/migrations");
const FILE = "20260907000000_bty_announcement_service_url_v1.sql";
const sql = readFileSync(join(DIR, FILE), "utf8");
/** Comments explain the rules; only executable text may be asserted against them. */
const code = sql
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("H — ordering and scope", () => {
  it("is the next version after the reconciled ledger, and the only new one", () => {
    const mine = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(mine.at(-1)).toBe(FILE);
    // The four the ledger was reconciled through must still be present and untouched by name.
    for (const v of ["20260903000000", "20260904000000", "20260905000000", "20260906000000"]) {
      expect(mine.some((f) => f.startsWith(v))).toBe(true);
    }
  });

  it("changes nothing that belongs to another slice", () => {
    for (const forbidden of [
      /drop\s+table/i,
      /delete\s+from/i,
      /alter\s+table\s+public\.bty_tracked_announcement_recipients/i,
      /\bresponse\b\s*=/i,
      /responded_at\s*=/i,
      /question_text\s*=/i,
      /handled_at\s*=/i,
      /handled_by_user_id\s*=/i,
      /saved_at/i,
      /closed_at\s*=/i,
      /bty_platform_admin_grants/i,
      /bty_action_captures/i,
    ]) {
      expect(code, String(forbidden)).not.toMatch(forbidden);
    }
  });
});

describe("B — the column", () => {
  it("is added nullable, with no default and no NOT NULL", () => {
    const alter = code.match(/alter table public\.bty_tracked_announcements[^;]*;/i)?.[0] ?? "";
    expect(alter).toMatch(/add column if not exists service_url text\s*;/i);
    // Scoped to the ALTER on purpose: `p_service_url text default null` in the function
    // signature is the DEFAULTED PARAMETER this slice depends on, and a looser pattern reads
    // it as a column default. It caught exactly that on first run.
    expect(alter).not.toMatch(/not null/i);
    expect(alter).not.toMatch(/default/i);
  });

  it("backfills nothing — no historical row is given a coordinate it never had", () => {
    expect(code).not.toMatch(/update\s+public\.bty_tracked_announcements\s+set\s+service_url/i);
  });

  it("hardcodes no endpoint anywhere, not even in prose", () => {
    // The whole file, comments included: a URL written down in a comment is the one a future
    // reader copies.
    expect(sql).not.toMatch(/https:\/\/smba\./i);
    expect(sql).not.toMatch(/trafficmanager/i);
  });
});

describe("D — the RPC contract", () => {
  it("adds p_service_url LAST and DEFAULTED, so the deployed 6-argument caller keeps working", () => {
    // This is what makes the migration safe to apply BEFORE the code ships. A required parameter
    // would take Track down for the whole window between apply and deploy.
    expect(code).toMatch(/p_recipient_oids text\[\],\s*\n\s*p_service_url text default null\s*\n\s*\)/);
  });

  it("retires the 6-argument form instead of leaving an overload pair", () => {
    expect(code).toMatch(/drop function if exists public\.bty_track_announcement\(uuid, uuid, text, text, text, text\[\]\);/);
    expect(code.match(/create or replace function public\.bty_track_announcement/g)).toHaveLength(1);
  });

  it("keeps service_role as the only executor", () => {
    expect(code).toMatch(/revoke all on function public\.bty_track_announcement\([^)]*\) from public, anon, authenticated;/);
    expect(code).toMatch(/grant execute on function public\.bty_track_announcement\([^)]*\) to service_role;/);
  });

  it("stores the coordinate ONLY on the insert", () => {
    expect(code).toMatch(/insert into public\.bty_tracked_announcements[\s\S]*?service_url\)/);
  });
});

describe("D — idempotency: a repeat Track must not re-point an existing run", () => {
  it("returns the existing announcement before any write, and updates no coordinate", () => {
    const existing = code.slice(code.indexOf("v_existing_id is not null"));
    const branch = existing.slice(0, existing.indexOf("insert into"));
    expect(branch).toMatch(/return query select v_existing_id, v_existing_count, true;\s*return;/);
    expect(branch).not.toMatch(/service_url/i);
  });

  it("the only UPDATE in the function is the recipient-count reconciliation", () => {
    const updates = code.match(/update\s+public\.\w+\s+set\s+\w+/gi) ?? [];
    expect(updates).toEqual(["update public.bty_tracked_announcements set resolved_count"]);
  });

  it("the existing owner+capture idempotency key is unchanged", () => {
    expect(code).toMatch(/where a\.owner_user_id = p_owner_user_id\s*\n\s*and a\.source_capture_id = p_source_capture_id;/);
  });
});

describe("E — the database is the last guard, not the only one", () => {
  it("normalises an empty coordinate to NULL so the column has one spelling for 'not observed'", () => {
    expect(code).toMatch(/v_service_url text := nullif\(btrim\(coalesce\(p_service_url, ''\)\), ''\);/);
  });

  it("refuses a non-https coordinate by nulling it, never by failing the Track", () => {
    expect(code).toMatch(/v_service_url !~\* '\^https:\/\//);
    expect(code).toMatch(/v_service_url := null;/);
    // No new refusal path: routing metadata must not be able to stop a Host tracking a message.
    const raises = code.match(/raise exception '(\w+)'/g) ?? [];
    expect(raises.sort()).toEqual([
      "raise exception 'invalid_framing'",
      "raise exception 'missing_identity'",
      "raise exception 'missing_source_context'",
      "raise exception 'zero_recipients'",
    ]);
  });

  it("carries no credential of any kind", () => {
    expect(sql).not.toMatch(/APP_PASSWORD|client_secret|bearer|password/i);
  });
});
