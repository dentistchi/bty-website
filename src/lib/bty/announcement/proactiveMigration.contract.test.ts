import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** SLICE A0.2 — what the migration must and must not do, read as text. */
const DIR = join(process.cwd(), "supabase/migrations");
const FILE = "20260908000000_bty_teams_proactive_notification_v1.sql";
const sql = readFileSync(join(DIR, FILE), "utf8");
const code = sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");

describe("ordering and scope", () => {
  it("sorts immediately after the service_url migration", () => {
    const all = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    // Deliberately an ORDER claim, not a "newest file" claim: the latter fails on the next
    // slice's migration, which is unrelated work. See the same correction in the A0.1 guard.
    expect(all).toContain(FILE);
    expect(all.filter((f) => f < FILE).at(-1)).toBe("20260907000000_bty_announcement_service_url_v1.sql");
    for (const v of ["20260903000000", "20260904000000", "20260905000000", "20260906000000", "20260907000000"]) {
      expect(all.some((f) => f.startsWith(v))).toBe(true);
    }
  });

  it("touches nothing that belongs to closure, capture or admin", () => {
    for (const forbidden of [
      /drop table/i, /delete from/i, /\bresponse\b\s*=/i, /responded_at\s*=/i,
      /question_text\s*=/i, /handled_at\s*=/i, /saved_at/i, /user_id\s*=/i,
      /bty_action_captures/i, /bty_platform_admin_grants/i, /insert into auth\./i,
    ]) {
      expect(code, String(forbidden)).not.toMatch(forbidden);
    }
  });

  it("hardcodes no routing endpoint and carries no credential", () => {
    expect(sql).not.toMatch(/https:\/\/smba\.|trafficmanager/i);
    expect(sql).not.toMatch(/APP_PASSWORD|client_secret|bearer/i);
  });
});

describe("D — conversation references", () => {
  it("is keyed ONLY by the trusted identity pair", () => {
    expect(code).toMatch(/unique \(tenant_id, aad_object_id\)/i);
    // Scoped to the CREATE TABLE. `comment on` is an executable statement whose text says
    // "never email, UPN or display name" — checking the whole file read that promise as a
    // violation of itself. The claim worth guarding is that no such COLUMN exists.
    const table = code.match(/create table if not exists public\.bty_teams_conversation_refs[\s\S]*?\n\);/i)?.[0] ?? "";
    expect(table).toBeTruthy();
    for (const bad of [/\bemail\b/i, /\bupn\b/i, /display_name/i, /\bname\b/i]) {
      expect(table, String(bad)).not.toMatch(bad);
    }
  });

  it("stores the routing URL beside the conversation, both NOT NULL", () => {
    expect(code).toMatch(/service_url text not null/i);
    expect(code).toMatch(/conversation_id text not null/i);
  });

  it("is server-only: RLS on, no policy, no client grant", () => {
    expect(code).toMatch(/alter table public\.bty_teams_conversation_refs enable row level security/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).toMatch(/revoke all on table public\.bty_teams_conversation_refs from public, anon, authenticated/i);
  });
});

describe("D/H — notified_at", () => {
  it("is one nullable column with no default and no backfill", () => {
    const alter = code.match(/alter table public\.bty_tracked_announcement_recipients[^;]*;/i)?.[0] ?? "";
    expect(alter).toMatch(/add column if not exists notified_at timestamptz\s*;/i);
    expect(alter).not.toMatch(/not null|default/i);
    // Exactly ONE statement ever writes this column. Which one, and that it is conditional, is
    // asserted next — an earlier attempt to spell "no backfill" as a regex matched that
    // legitimate write instead.
    expect(code.match(/set notified_at =/g) ?? []).toHaveLength(1);
  });

  it("is written ONLY conditionally, so a repeat confirm cannot move it", () => {
    const fn = code.slice(code.indexOf("bty_confirm_recipient_notification"));
    expect(fn).toMatch(/set notified_at = v_now\s*\n\s*where id = p_recipient_id\s*\n\s*and notified_at is null;/);
  });

  it("is never cleared by anything in this file", () => {
    expect(code).not.toMatch(/notified_at\s*=\s*null/i);
  });
});

describe("D — the read that gates a send", () => {
  it("locks the row and verifies ownership by joining the announcement owner", () => {
    const fn = code.slice(code.indexOf("bty_begin_recipient_notification"), code.indexOf("bty_confirm_recipient_notification"));
    expect(fn).toMatch(/join public\.bty_tracked_announcements a on a\.id = r\.announcement_id/);
    expect(fn).toMatch(/for update of r/);
    expect(fn).toMatch(/v_owner is distinct from p_owner_user_id/);
    // A non-owner and a missing row must be indistinguishable from outside.
    expect((fn.match(/'not_found'::text/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("refuses an announcement with no stored coordinate", () => {
    expect(code).toMatch(/'no_service_url'::text/);
  });
});

describe("security", () => {
  it("every new function is service_role-only", () => {
    for (const fn of [
      "bty_begin_recipient_notification\\(uuid, uuid\\)",
      "bty_confirm_recipient_notification\\(uuid\\)",
      "bty_upsert_teams_conversation_ref\\(text, text, text, text\\)",
    ]) {
      expect(code).toMatch(new RegExp(`revoke all on function public\\.${fn} from public, anon, authenticated;`));
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${fn} to service_role;`));
    }
  });

  it("every new function is SECURITY DEFINER with a pinned search_path", () => {
    const defs = code.match(/security definer/g) ?? [];
    expect(defs).toHaveLength(3);
    expect((code.match(/set search_path = public, pg_temp/g) ?? [])).toHaveLength(3);
  });
});

describe("I — the superseded Track contract is retired here, not by editing 20260907", () => {
  it("drops the 6-argument form", () => {
    expect(code).toMatch(/drop function if exists public\.bty_track_announcement\(uuid, uuid, text, text, text, text\[\]\);/);
  });

  it("does not re-create or alter the 7-argument form", () => {
    expect(code).not.toMatch(/create or replace function public\.bty_track_announcement/);
  });

  it("20260907 is left exactly as applied", () => {
    const prior = readFileSync(join(DIR, "20260907000000_bty_announcement_service_url_v1.sql"), "utf8");
    expect(prior).toContain("p_service_url text default null");
    expect(prior).not.toContain("notified_at");
  });
});
