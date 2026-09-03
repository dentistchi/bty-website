import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** SLICE A0.2R2 — what the conversation-lease migration must and must not do. */
const DIR = join(process.cwd(), "supabase/migrations");
const FILE = "20260910000000_bty_teams_conversation_creation_claim_v1.sql";
const sql = readFileSync(join(DIR, FILE), "utf8");
const code = sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
const fnBody = (name: string) => {
  const rest = code.slice(code.indexOf(`create or replace function public.${name}`));
  return rest.slice(0, rest.indexOf("$$;") + 3);
};

describe("A — ordering, and the two earlier migrations are untouched", () => {
  it("sorts immediately after the delivery-claim migration", () => {
    const all = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(all).toContain(FILE);
    expect(all.filter((f) => f < FILE).at(-1)).toBe("20260909000000_bty_notification_delivery_claim_v1.sql");
  });

  it("does not edit 20260908 or 20260909", () => {
    const p8 = readFileSync(join(DIR, "20260908000000_bty_teams_proactive_notification_v1.sql"), "utf8");
    const p9 = readFileSync(join(DIR, "20260909000000_bty_notification_delivery_claim_v1.sql"), "utf8");
    expect(p8).not.toContain("creation_claims");
    expect(p9).not.toContain("creation_claims");
    expect(p9).toContain("interval '120 seconds'");
    expect(code).not.toMatch(/supabase_migrations|migration repair/i);
  });

  it("changes nothing owned by closure, capture, Track or identity", () => {
    for (const bad of [
      /drop table/i, /\bresponse\b\s*=/i, /responded_at\s*=/i, /question_text\s*=/i,
      /handled_at\s*=/i, /handled_by_user_id\s*=/i, /\buser_id\s*=/i, /bound_at\s*=/i,
      /host_framing\s*=/i, /source_capture_id\s*=/i, /bty_action_captures/i, /bty_track_announcement\s*\(/i,
      /update public\.bty_tracked_announcements\b/i,
    ]) {
      expect(code, String(bad)).not.toMatch(bad);
    }
  });

  it("hardcodes no endpoint and carries no credential", () => {
    expect(sql).not.toMatch(/https:\/\/smba\.|trafficmanager|APP_PASSWORD|client_secret/i);
  });
});

describe("B/C — coordination is a SEPARATE table from confirmed reality", () => {
  it("creates the claim table keyed on the person, with no identity leakage", () => {
    const t = code.match(/create table if not exists public\.bty_teams_conversation_creation_claims[\s\S]*?\n\);/i)?.[0] ?? "";
    expect(t).toBeTruthy();
    expect(t).toMatch(/primary key \(tenant_id, aad_object_id\)/i);
    for (const bad of [/\bemail\b/i, /\bupn\b/i, /display_name/i, /\buser_id\b/i, /announcement_id/i]) {
      expect(t, String(bad)).not.toMatch(bad);
    }
    expect(t).toMatch(/claim_token uuid not null/i);
    expect(t).toMatch(/claim_expires_at timestamptz not null/i);
    expect(t).toMatch(/service_url text not null/i);
    // NULL until the outbound POST is imminent.
    expect(t).toMatch(/create_started_at timestamptz(?!\s+not null)/i);
  });

  it("NEVER weakens the confirmed-reference table", () => {
    // conversation_id stays NOT NULL, and no placeholder row may be written there.
    expect(code).not.toMatch(/alter table public\.bty_teams_conversation_refs/i);
    expect(code).not.toMatch(/conversation_id\s+drop not null/i);
    // The only writer of a reference is the confirm function.
    const inserts = code.match(/insert into public\.bty_teams_conversation_refs/g) ?? [];
    expect(inserts).toHaveLength(1);
    expect(fnBody("bty_confirm_teams_conversation_created")).toContain("insert into public.bty_teams_conversation_refs");
  });

  it("is server-only: RLS on, no policy, no client grant", () => {
    expect(code).toMatch(/alter table public\.bty_teams_conversation_creation_claims enable row level security/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).toMatch(/revoke all on table public\.bty_teams_conversation_creation_claims from public, anon, authenticated/i);
  });

  it("retires the blind upsert, so nothing can write a reference without a claim behind it", () => {
    expect(code).toMatch(/drop function if exists public\.bty_upsert_teams_conversation_ref\(text, text, text, text\);/);
  });
});

describe("D — the lease length is defined once, in the whole schema", () => {
  it("delegates rather than restating 120", () => {
    expect(code).not.toMatch(/interval '120/);
    expect(fnBody("bty_conversation_creation_claim_ttl")).toContain("public.bty_notification_claim_ttl()");
    expect(code).toMatch(/\+ public\.bty_conversation_creation_claim_ttl\(\)/);
  });
});

describe("E/F/G/H — the four states of creating one thread", () => {
  it("begin checks CONFIRMED reality first, and returns the pair from that row", () => {
    const fn = fnBody("bty_begin_teams_conversation_creation");
    expect(fn.indexOf("bty_teams_conversation_refs")).toBeLessThan(fn.indexOf("creation_claims"));
    expect(fn).toMatch(/'already_exists'::text, null::uuid, v_ref_url, v_ref_conv/);
    for (const r of ["already_exists", "in_progress", "conversation_creation_unknown", "ok", "invalid_identity"]) {
      expect(fn, r).toContain(`'${r}'::text`);
    }
    expect(fn).toMatch(/gen_random_uuid\(\)/);
    expect(fn).toMatch(/for update/);
  });

  it("an expired claim is reclaimable ONLY when creation never began", () => {
    const fn = fnBody("bty_begin_teams_conversation_creation");
    expect(fn.indexOf("'in_progress'")).toBeLessThan(fn.indexOf("'conversation_creation_unknown'"));
    expect(fn).toMatch(/if v_started is not null then/);
  });

  it("mark refuses when a confirmed ref appeared meanwhile", () => {
    const fn = fnBody("bty_mark_teams_conversation_creating");
    for (const r of ["already_exists", "claim_mismatch", "claim_expired", "already_creating", "creating"]) {
      expect(fn, r).toContain(`'${r}'::text`);
    }
    expect(fn).toMatch(/set create_started_at = v_now/);
  });

  it("confirm requires a matching claim AND that creation had begun, and writes both halves", () => {
    const fn = fnBody("bty_confirm_teams_conversation_created");
    expect(fn).toContain("'create_not_started'::text");
    expect(fn).toContain("'invalid_conversation'::text");
    expect(fn).toMatch(/v_token is distinct from p_claim_token/);
    // Record reality and drop coordination together.
    expect(fn).toMatch(/delete from public\.bty_teams_conversation_creation_claims/);
    // An existing ref short-circuits BEFORE any write: a stale token cannot overwrite reality.
    expect(fn.indexOf("'already_exists'")).toBeLessThan(fn.indexOf("insert into public.bty_teams_conversation_refs"));
  });

  it("release may only remove the claim it owns, and touches no reference", () => {
    const fn = fnBody("bty_release_teams_conversation_creation_claim");
    expect(fn).toMatch(/v_token is distinct from p_claim_token/);
    expect(fn).not.toMatch(/bty_teams_conversation_refs/);
  });
});

describe("I — the routing pair repair", () => {
  const fn = () => fnBody("bty_begin_recipient_notification");

  it("returns BOTH halves from the confirmed reference when one exists", () => {
    expect(fn()).toMatch(/select c\.service_url, c\.conversation_id into v_ref_url, v_ref_conv/);
    expect(fn()).toMatch(/if v_ref_conv is not null then[\s\S]*?v_ref_url, v_framing, v_ref_conv/);
  });

  it("falls back to the announcement's coordinate ONLY when creating a new thread", () => {
    expect(fn()).toMatch(/v_ann_url, v_framing, null::text/);
  });

  it("still refuses a historical announcement, so applying this cannot make 6cfccb92 notifiable", () => {
    // The no_service_url test stays on the ANNOUNCEMENT. Loosening it to "a ref exists" would be
    // a product decision, not a repair.
    expect(fn()).toMatch(/if coalesce\(btrim\(v_ann_url\), ''\) = '' then\s*\n\s*return query select 'no_service_url'/);
  });
});

describe("security", () => {
  it("every function is service_role-only", () => {
    for (const f of [
      "bty_conversation_creation_claim_ttl\\(\\)",
      "bty_begin_teams_conversation_creation\\(text, text, text\\)",
      "bty_mark_teams_conversation_creating\\(text, text, uuid\\)",
      "bty_confirm_teams_conversation_created\\(text, text, uuid, text, text\\)",
      "bty_release_teams_conversation_creation_claim\\(text, text, uuid\\)",
      "bty_begin_recipient_notification\\(uuid, uuid\\)",
    ]) {
      expect(code).toMatch(new RegExp(`revoke all on function public\\.${f} from public, anon, authenticated;`));
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${f} to service_role;`));
    }
  });

  it("every claim function is SECURITY DEFINER with a pinned search_path", () => {
    expect(code.match(/security definer/g) ?? []).toHaveLength(5);
    expect(code.match(/set search_path = public, pg_temp/g) ?? []).toHaveLength(5);
  });
});
