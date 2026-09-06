import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * TRACK CONVERSATION V1 — what the migration must and must not do.
 *
 * The SQL cannot be executed here, so what is held is the CONTRACT: the shape of the thing being
 * created, the grants that make it append-only, the join that makes authority server-derived, and —
 * most of all — the list of things this file is forbidden to touch.
 */

const DIR = join(process.cwd(), "supabase/migrations");
const FILE = "20260912000000_bty_announcement_thread_v1.sql";
const sql = readFileSync(join(DIR, FILE), "utf8");
/** Comments stripped: a promise written in prose is not a promise the database keeps. */
const code = sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
const fnBody = (name: string) => {
  const i = code.indexOf(`create or replace function public.${name}`);
  expect(i, `${name} must exist`).toBeGreaterThan(-1);
  const rest = code.slice(i);
  return rest.slice(0, rest.indexOf("$$;") + 3);
};

/* ───────────────────────  A. ADDITIVE, AND LAST  ─────────────────────── */

describe("A — additive, ordered last, and it rewrites no history", () => {
  it("sorts after every migration that already exists", () => {
    const all = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(all).toContain(FILE);
    expect(all.at(-1)).toBe(FILE);
  });

  it("does not edit, rename or replay any earlier migration", () => {
    const a1 = readFileSync(join(DIR, "20260902000000_bty_tracked_announcements_v1.sql"), "utf8");
    expect(a1).toContain("create table if not exists public.bty_tracked_announcement_recipients");
    expect(a1).not.toContain("bty_announcement_thread_messages");
    expect(code).not.toMatch(/supabase_migrations|migration repair/i);
  });

  it("★ creates no table but its own, and drops nothing", () => {
    const creates = [...code.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    expect(creates).toEqual(["bty_announcement_thread_messages"]);
    expect(code).not.toMatch(/drop table/i);
    expect(code).not.toMatch(/drop column/i);
    expect(code).not.toMatch(/drop constraint/i);
    expect(code).not.toMatch(/alter column/i);
    expect(code).not.toMatch(/disable row level security/i);
  });

  it("★ NO HISTORICAL ROW IS TOUCHED — no backfill, and no guessed first message", () => {
    /*
      A thread that has no messages had no messages. There is nothing to reconstruct from a
      `question_text` written before this table existed, and inventing one would put a date and an
      author on something nobody said then.

      A backfill would have to be a set-valued INSERT ... SELECT, or a bare INSERT outside a
      function body. Both are absent: the only INSERT into the message table sits inside
      `bty_respond_to_announcement`, guarded by the QUESTION branch, and writes ONE row for the
      person who is answering right now.
    */
    const inserts = [...code.matchAll(/insert into public\.bty_announcement_thread_messages[\s\S]*?;/g)].map((m) => m[0]);
    // Exactly two: the post RPC's own write, and the QUESTION bridge. Both single-row.
    expect(inserts).toHaveLength(2);
    for (const ins of inserts) {
      // A row-by-row VALUES, never a set-valued SELECT. One person, one message, right now.
      expect(ins).toContain("values");
      expect(ins.toLowerCase()).not.toContain("select");
      expect(ins).not.toMatch(/\bfrom\b/i);
    }
    expect(code).not.toMatch(/delete from/i);
  });

  it("★ the ONLY writes to the recipient row are the disposition it already made and the two cursors", () => {
    const updates = [...code.matchAll(/update public\.bty_tracked_announcement_recipients[\s\S]*?;/g)].map((m) => m[0]);
    expect(updates).toHaveLength(3);
    const has = (needle: string) => updates.filter((u) => u.includes(needle)).length;
    // 1. The disposition write, VERBATIM what 20260902 wrote apart from `now()` being hoisted into
    //    a local so the response and its first message share one instant.
    expect(has("set response = p_response, responded_at = v_now, question_text = v_q")).toBe(1);
    // 2-3. This slice's own two columns, and only ever the caller's own side.
    expect(has("set host_last_read_at = greatest")).toBe(1);
    expect(has("set recipient_last_read_at = greatest")).toBe(1);
  });
});

/* ───────────────  B. WHAT THE REGRESSION CONTRACT FORBIDS  ─────────────── */

describe("B — it touches nothing owned by Track, capture, identity, XP or notification", () => {
  it("names no table it has no business in", () => {
    for (const forbidden of [
      "bty_action_captures",
      "bty_action_contracts",
      "core_xp_ledger",
      "bty_teams_conversation_refs",
      "bty_platform_admin_grants",
      "bty_org_action_review_authority",
      "arena_profiles",
      "training_progress",
      "foundry_event_participants",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("★ rewrites no Track fact — binding, denominator, framing, notification, closure", () => {
    for (const bad of [
      // Assignment, not comparison: `r.user_id = p_user_id` in a WHERE clause is how the caller's
      // own row has always been FOUND, and that read is unchanged.
      /set[^;]*\buser_id\s*=/i,
      /set[^;]*\bbound_at\s*=/i,
      /set[^;]*\bresolved_count\s*=/i,
      /set[^;]*\bhost_framing\s*=/i,
      /set[^;]*\bsource_capture_id\s*=/i,
      /set[^;]*\bnotified_at\s*=/i,
      /set[^;]*\bnotification_claim_token\s*=/i,
      /service_url\s*=\s*'/i,
      /set[^;]*\bhandled_at\s*=/i,
      /set[^;]*\bhandled_by_user_id\s*=/i,
      /\bstatus\s*=\s*'closed'/i,
    ]) {
      expect(code, String(bad)).not.toMatch(bad);
    }
  });

  it("★ leaves the existing notification and binding functions completely alone", () => {
    for (const fn of [
      "bty_track_announcement",
      "bty_bind_announcement_recipients",
      "bty_handle_announcement_recipient",
      "bty_begin_recipient_notification",
      "bty_confirm_recipient_notification",
      "bty_mark_recipient_notification_sending",
      "bty_begin_teams_conversation_creation",
    ]) {
      expect(code, fn).not.toContain(`create or replace function public.${fn}`);
    }
  });

  it("★ PLATFORM ADMIN IS NOT A PARTY — no admin authority is consulted anywhere", () => {
    expect(code).not.toMatch(/admin/i);
    expect(code).not.toMatch(/BTY_ADMIN_EMAILS/);
  });

  it("carries no credential and no endpoint", () => {
    expect(sql).not.toMatch(/https:\/\/smba\.|trafficmanager|APP_PASSWORD|client_secret|bearer/i);
  });

  it("★ never reaches for an email, a UPN or a display name as identity", () => {
    for (const bad of ["preferred_username", "@", "upn", "user_metadata"]) {
      expect(code.toLowerCase(), bad).not.toContain(bad.toLowerCase());
    }
  });
});

/* ───────────────────────  C. THE PRIVACY UNIT  ─────────────────────── */

describe("C — the conversation unit is a RECIPIENT, structurally", () => {
  const table = code.slice(
    code.indexOf("create table if not exists public.bty_announcement_thread_messages"),
    code.indexOf("create unique index if not exists bty_ann_thread_client_key_unique"),
  );

  it("★ the FK is the recipient row, and it is NOT NULL", () => {
    expect(table).toMatch(
      /recipient_id uuid not null\s*\n?\s*references public\.bty_tracked_announcement_recipients \(id\) on delete cascade/,
    );
  });

  it("★ there is NO announcement column — a query cannot widen to one by forgetting a filter", () => {
    expect(table).not.toContain("announcement_id");
  });

  it("carries a real author id and a derived role, both NOT NULL", () => {
    expect(table).toMatch(/author_user_id uuid not null references auth\.users \(id\)/);
    expect(table).toContain("author_role text not null");
    expect(code).toMatch(/check \(author_role in \('HOST', 'RECIPIENT'\)\)/);
  });

  it("★ the body bound is the product's existing 1..1000", () => {
    expect(code).toMatch(/check \(char_length\(btrim\(body\)\) between 1 and 1000\)/);
  });

  it("the idempotency key is scoped under (recipient, author) and is partial", () => {
    const idx = code.slice(code.indexOf("create unique index if not exists bty_ann_thread_client_key_unique"));
    expect(idx).toContain("(recipient_id, author_user_id, client_message_id)");
    expect(idx.slice(0, idx.indexOf(";"))).toContain("where client_message_id is not null");
  });
});

/* ───────────────────────  D. APPEND-ONLY  ─────────────────────── */

describe("D — append-only is a GRANT, not a convention", () => {
  it("★ service_role holds SELECT and INSERT, and nothing else", () => {
    expect(code).toContain("grant select, insert on public.bty_announcement_thread_messages to service_role;");
    const grants = [...code.matchAll(/grant [^;]*on public\.bty_announcement_thread_messages[^;]*;/g)].map((m) => m[0]);
    expect(grants).toHaveLength(1);
    expect(grants[0]).not.toMatch(/update|delete/i);
  });

  it("clients are denied outright and RLS is enabled, exactly like the tables it hangs off", () => {
    expect(code).toContain("revoke all on public.bty_announcement_thread_messages from anon, public, authenticated;");
    expect(code).toContain("alter table public.bty_announcement_thread_messages enable row level security;");
    // No broad policy is created to compensate.
    expect(code).not.toMatch(/create policy/i);
  });

  it("★ no function anywhere in this file updates or deletes a message", () => {
    expect(code).not.toMatch(/update public\.bty_announcement_thread_messages/i);
    expect(code).not.toMatch(/delete from public\.bty_announcement_thread_messages/i);
  });
});

/* ───────────────────────  E. AUTHORITY  ─────────────────────── */

describe("E — the role is derived by a join, and default-deny", () => {
  const resolve = fnBody("bty_resolve_announcement_thread_role");

  it("★ it JOINS the recipient to its announcement owner", () => {
    expect(resolve).toContain("join public.bty_tracked_announcements a on a.id = r.announcement_id");
    expect(resolve).toContain("if v_owner = p_actor_user_id then");
    expect(resolve).toContain("if v_recipient = p_actor_user_id then");
  });

  it("★ every other outcome is 'none' — a missing row and a wrong person are one answer", () => {
    // Three refusal paths: a null argument, a row that does not exist, and a person who is
    // neither the owner nor the bound recipient. All three say the same word.
    expect(resolve.match(/select 'none'::text/g) ?? []).toHaveLength(3);
    expect(resolve).toContain("if not found then");
  });

  it("★ an UNBOUND recipient matches nobody — plain equality, never `is not distinct from`", () => {
    // `is not distinct from` would let a NULL actor match a NULL user_id and take over a row
    // frozen for someone who has never opened BTY.
    expect(resolve).not.toMatch(/is not distinct from/i);
  });

  it("is SECURITY DEFINER, search_path-pinned, and reachable only from the server path", () => {
    for (const fn of [
      "bty_resolve_announcement_thread_role(uuid, uuid)",
      "bty_post_announcement_thread_message(uuid, uuid, text, text)",
      "bty_mark_announcement_thread_read(uuid, uuid)",
    ]) {
      expect(code, fn).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`);
      expect(code, fn).toContain(`grant execute on function public.${fn} to service_role;`);
    }
    expect((code.match(/security definer/g) ?? []).length).toBe(4);
    expect((code.match(/set search_path = pg_catalog, public/g) ?? []).length).toBe(4);
  });

  it("★ the writer takes NO role parameter, and writes the role it derived", () => {
    const post = fnBody("bty_post_announcement_thread_message");
    // The signature is (recipient, actor, body, nonce). There is no role in it.
    expect(code).toContain(
      "create or replace function public.bty_post_announcement_thread_message(\n  p_recipient_id uuid,\n  p_actor_user_id uuid,\n  p_body text,\n  p_client_message_id text\n)",
    );
    expect(post).toContain("select r.role into v_role");
    expect(post).toMatch(/values\s*\n?\s*\(p_recipient_id, p_actor_user_id, v_role, v_body, v_key\)/);
    expect(post).toContain("if v_role is null or v_role = 'none' then");
  });

  it("★ neither party can mark the other read — there is no side parameter", () => {
    expect(code).toContain(
      "create or replace function public.bty_mark_announcement_thread_read(\n  p_recipient_id uuid,\n  p_actor_user_id uuid\n)",
    );
    const mark = fnBody("bty_mark_announcement_thread_read");
    expect(mark).toContain("if v_role = 'HOST' then");
    expect(mark).toContain("set host_last_read_at = greatest");
    expect(mark).toContain("set recipient_last_read_at = greatest");
  });
});

/* ───────────────────────  F. THE READ CURSORS  ─────────────────────── */

describe("F — two nullable cursors, and nothing else added to the recipient row", () => {
  it("adds exactly the two columns, both nullable and both without a default", () => {
    const alter =
      code.match(/alter table public\.bty_tracked_announcement_recipients\s*\n\s*add column[^;]*;/i)?.[0] ?? "";
    expect(alter).toContain("add column if not exists host_last_read_at timestamptz");
    expect(alter).toContain("add column if not exists recipient_last_read_at timestamptz");
    expect(alter).not.toMatch(/not null|default/i);
    // NULL is "never opened", which is what every existing row correctly is on the day this ships.
  });

  it("★ they are the ONLY structural change to that table", () => {
    const alters = [...code.matchAll(/alter table public\.bty_tracked_announcement_recipients[^;]*;/g)].map((m) => m[0]);
    expect(alters).toHaveLength(1);
  });
});

/* ───────────────────────  G. THE ATOMIC BRIDGE  ─────────────────────── */

describe("G — the first response and the first message are ONE transaction", () => {
  const respond = fnBody("bty_respond_to_announcement");

  it("★ the QUESTION text is inserted inside the same function that wrote the disposition", () => {
    expect(respond).toContain("update public.bty_tracked_announcement_recipients");
    expect(respond).toContain("if p_response = 'QUESTION' and v_q is not null then");
    expect(respond).toContain("insert into public.bty_announcement_thread_messages");
    // The response and its first message share one instant, because they are one act.
    expect(respond).toContain("v_now := now();");
    expect(respond).toMatch(/values\s*\n?\s*\(v_row\.id, p_user_id, 'RECIPIENT', v_q, v_now\)/);
  });

  it("★ ACKNOWLEDGED and HELP_NEEDED insert NOTHING — no message is fabricated", () => {
    const inserts = (respond.match(/insert into public\.bty_announcement_thread_messages/g) ?? []).length;
    expect(inserts).toBe(1);
    // The single insert is guarded by the QUESTION branch above, so neither other response can
    // reach it, and no literal help text exists anywhere in the file to be written.
    expect(code).not.toMatch(/I need help|도움이 필요/i);
  });

  it("★ the signature and every existing result string are UNCHANGED", () => {
    expect(code).toContain(
      "create or replace function public.bty_respond_to_announcement(\n  p_announcement_id uuid,\n  p_user_id uuid,\n  p_response text,\n  p_question_text text\n)",
    );
    expect(code).toContain("returns table (result text, response text, responded_at timestamptz)");
    for (const r of [
      "'invalid_response'",
      "'question_too_long'",
      "'not_a_recipient'",
      "'already_responded'",
      "'responded'",
    ]) {
      expect(respond, r).toContain(r);
    }
  });

  it("★ write-once, the row lock, and the not-a-recipient masking all survive", () => {
    expect(respond).toContain("for update");
    expect(respond).toContain("if v_row.response is not null then");
    expect(respond).toContain("if not found then");
    // The disposition column is still written: the thread is a continuation, not a replacement.
    expect(respond).toContain("question_text = v_q");
  });

  it("★ text still belongs to QUESTION alone", () => {
    expect(respond).toContain("if p_response <> 'QUESTION' then");
    expect(respond).toContain("v_q := null;");
  });
});
