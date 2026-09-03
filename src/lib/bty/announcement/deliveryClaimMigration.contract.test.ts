import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** SLICE A0.2R — what the claim migration must and must not do. */
const DIR = join(process.cwd(), "supabase/migrations");
const FILE = "20260909000000_bty_notification_delivery_claim_v1.sql";
const sql = readFileSync(join(DIR, FILE), "utf8");
const code = sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
const fnBody = (name: string) => {
  const i = code.indexOf(`create or replace function public.${name}`);
  const rest = code.slice(i);
  return rest.slice(0, rest.indexOf("$$;") + 3);
};

describe("N — additive, and 20260908 is untouched", () => {
  it("sorts immediately after the live A0.2 migration", () => {
    const all = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(all).toContain(FILE);
    expect(all.filter((f) => f < FILE).at(-1)).toBe("20260908000000_bty_teams_proactive_notification_v1.sql");
  });

  it("does not edit, rename or replay any earlier migration", () => {
    const prior = readFileSync(join(DIR, "20260908000000_bty_teams_proactive_notification_v1.sql"), "utf8");
    // The live file still says what it said when it was applied.
    expect(prior).toContain("create table if not exists public.bty_teams_conversation_refs");
    expect(prior).toContain("add column if not exists notified_at timestamptz");
    expect(prior).not.toContain("notification_claim_token");
    expect(code).not.toMatch(/supabase_migrations|migration repair/i);
  });

  it("touches nothing owned by closure, capture, Track or identity", () => {
    for (const bad of [
      /drop table/i, /delete from/i, /\bresponse\b\s*=/i, /responded_at\s*=/i, /question_text\s*=/i,
      /handled_at\s*=/i, /handled_by_user_id\s*=/i, /\buser_id\s*=/i, /bound_at\s*=/i,
      /service_url\s*=\s*'/i, /host_framing\s*=/i, /source_capture_id\s*=/i,
      /bty_action_captures/i, /bty_track_announcement\s*\(/i,
    ]) {
      expect(code, String(bad)).not.toMatch(bad);
    }
  });

  it("hardcodes no endpoint and carries no credential", () => {
    expect(sql).not.toMatch(/https:\/\/smba\.|trafficmanager/i);
    expect(sql).not.toMatch(/APP_PASSWORD|client_secret|bearer/i);
  });
});

describe("C — the three columns and the three rules", () => {
  it("adds exactly the three claim columns, all nullable", () => {
    const alter = code.match(/alter table public\.bty_tracked_announcement_recipients\s*\n\s*add column[^;]*;/i)?.[0] ?? "";
    for (const c of ["notification_claim_token uuid", "notification_claim_expires_at timestamptz", "notification_send_started_at timestamptz"]) {
      expect(alter).toContain(c);
    }
    expect(alter).not.toMatch(/not null|default/i);
  });

  it("pairs token and expiry", () => {
    expect(code).toMatch(/check \(\(notification_claim_token is null\) = \(notification_claim_expires_at is null\)\)/);
  });

  it("forbids a send in progress on behalf of nobody", () => {
    expect(code).toMatch(/check \(notification_send_started_at is null or notification_claim_token is not null\)/);
  });

  it("makes notified_at terminal — no lease may survive it", () => {
    const chk = code.match(/bty_tracked_recip_notified_is_terminal_check[\s\S]*?\);/)?.[0] ?? "";
    expect(chk).toContain("notification_claim_token is null");
    expect(chk).toContain("notification_claim_expires_at is null");
    expect(chk).toContain("notification_send_started_at is null");
  });
});

describe("D — the lease length lives in exactly one place", () => {
  it("is a function, and 120 seconds appears once", () => {
    expect(code).toMatch(/create or replace function public\.bty_notification_claim_ttl\(\)/);
    expect(code.match(/interval '120 seconds'/g) ?? []).toHaveLength(1);
    // The expiry is COMPUTED from that function rather than from a repeated literal — the
    // timestamp it is added to is a local (`v_now`), so the assertion pins the addend, not the name.
    expect(code).toMatch(/notification_claim_expires_at = \w+ \+ public\.bty_notification_claim_ttl\(\)/);
  });
});

describe("E — begin is the only place a claim is born", () => {
  const fn = () => fnBody("bty_begin_recipient_notification");

  it("generates the token server-side and accepts none from a caller", () => {
    expect(code).toMatch(/create or replace function public\.bty_begin_recipient_notification\(\s*p_recipient_id uuid,\s*p_owner_user_id uuid\s*\)/);
    expect(fn()).toMatch(/v_new := gen_random_uuid\(\)/);
  });

  it("locks the row and answers a wrong owner exactly like a missing one", () => {
    expect(fn()).toMatch(/for update of r/);
    expect(fn()).toMatch(/v_owner is distinct from p_owner_user_id/);
    expect((fn().match(/'not_found'::text/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("returns every state the route must tell apart", () => {
    for (const r of ["not_found", "already_notified", "no_service_url", "in_progress", "delivery_unknown", "ok"]) {
      expect(fn(), r).toContain(`'${r}'::text`);
    }
  });

  it("an expired lease is reclaimable ONLY when no send had begun", () => {
    // The ordering is the rule: the in_progress check runs first, then the send-started check,
    // and only code that passed BOTH reaches the claim write.
    const b = fn();
    expect(b.indexOf("'in_progress'")).toBeLessThan(b.indexOf("'delivery_unknown'"));
    expect(b.indexOf("'delivery_unknown'")).toBeLessThan(b.indexOf("v_new := gen_random_uuid()"));
    expect(b).toMatch(/if v_claim is not null and v_started is not null then/);
  });
});

describe("F/G/H — mark, confirm, release", () => {
  it("mark requires a live matching claim and refuses to run twice", () => {
    const fn = fnBody("bty_mark_recipient_notification_sending");
    for (const r of ["already_notified", "claim_mismatch", "claim_expired", "already_sending", "sending"]) {
      expect(fn, r).toContain(`'${r}'::text`);
    }
    expect(fn).toMatch(/set notification_send_started_at = v_now/);
  });

  it("confirm requires BOTH a matching claim and evidence a send began", () => {
    const fn = fnBody("bty_confirm_recipient_notification");
    expect(fn).toMatch(/v_claim is distinct from p_claim_token/);
    expect(fn).toContain("'send_not_started'::text");
    // Success clears the lease entirely — the terminal representation is notified_at alone.
    expect(fn).toMatch(/set notified_at = v_now,\s*\n\s*notification_claim_token = null,\s*\n\s*notification_claim_expires_at = null,\s*\n\s*notification_send_started_at = null/);
  });

  it("release may only touch the claim it owns", () => {
    const fn = fnBody("bty_release_recipient_notification_claim");
    expect(fn).toMatch(/v_claim is distinct from p_claim_token/);
    expect(fn).toContain("'claim_mismatch'::text");
    expect(fn).not.toMatch(/set notified_at/);
  });

  it("the token-less confirm from 20260908 is removed, so nothing can bypass the claim", () => {
    expect(code).toMatch(/drop function if exists public\.bty_confirm_recipient_notification\(uuid\);/);
  });
});

describe("security", () => {
  it("every function is service_role-only", () => {
    for (const fn of [
      "bty_notification_claim_ttl\\(\\)",
      "bty_begin_recipient_notification\\(uuid, uuid\\)",
      "bty_mark_recipient_notification_sending\\(uuid, uuid\\)",
      "bty_confirm_recipient_notification\\(uuid, uuid\\)",
      "bty_release_recipient_notification_claim\\(uuid, uuid\\)",
    ]) {
      expect(code).toMatch(new RegExp(`revoke all on function public\\.${fn} from public, anon, authenticated;`));
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${fn} to service_role;`));
    }
  });

  it("the four claim functions are SECURITY DEFINER with a pinned search_path", () => {
    expect(code.match(/security definer/g) ?? []).toHaveLength(4);
    expect(code.match(/set search_path = public, pg_temp/g) ?? []).toHaveLength(4);
  });
});
