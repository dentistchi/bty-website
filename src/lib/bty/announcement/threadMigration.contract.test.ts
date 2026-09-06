import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * TRACK CONVERSATION V1 — what the migration must and must not do.
 *
 * ★ THIS FILE PINS THE TEXT. IT DOES NOT PROVE THE BEHAVIOUR.
 *
 * The behaviour is proven against a real PostgreSQL server in `threadPostgres.pg.test.ts`, which is
 * where the unread race, the reopen, the delete contract and the grants are actually executed. What
 * lives here is the complementary half: the shape of the thing being created, and — most of all —
 * the list of things this file is FORBIDDEN to touch, which no runtime test can express, because a
 * migration that quietly rewrote a neighbouring table would still pass its own tests.
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

  it("★ creates exactly its own two tables, and drops nothing", () => {
    const creates = [...code.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    expect(creates).toEqual(["bty_announcement_thread_messages", "bty_announcement_thread_message_reads"]);
    expect(code).not.toMatch(/drop table/i);
    expect(code).not.toMatch(/drop column/i);
    expect(code).not.toMatch(/drop constraint/i);
    expect(code).not.toMatch(/alter column/i);
    expect(code).not.toMatch(/disable row level security/i);
  });

  it("★ adds NO column to any existing table — the timestamp cursors are gone entirely", () => {
    /*
      R1 added `host_last_read_at` and `recipient_last_read_at`. They were unsound (see the header),
      and because production is verified through 20260911000000 with both ABSENT, they are removed
      rather than added-then-dropped. This migration now alters no existing table at all.
    */
    expect(code).not.toMatch(/alter table public\.\w+\s*\n?\s*add column/i);
    expect(code).not.toContain("host_last_read_at");
    expect(code).not.toContain("recipient_last_read_at");
  });

  it("★ NO HISTORICAL ROW IS TOUCHED — no backfill, and no guessed first message", () => {
    /*
      A thread that has no messages had no messages. There is nothing to reconstruct from a
      `question_text` written before this table existed, and inventing one would put a date and an
      author on something nobody said then.
    */
    const inserts = [...code.matchAll(/insert into public\.bty_announcement_thread_messages[\s\S]*?;/g)].map((m) => m[0]);
    // Exactly two: the post RPC's own write, and the QUESTION bridge. Both single-row.
    expect(inserts).toHaveLength(2);
    for (const ins of inserts) {
      expect(ins).toContain("values");
      expect(ins.toLowerCase()).not.toContain("select");
      expect(ins).not.toMatch(/\bfrom\b/i);
    }
    expect(code).not.toMatch(/delete from/i);
  });

  it("★ the ONLY writes to the recipient row are the disposition it already made and the reopen", () => {
    const updates = [...code.matchAll(/update public\.bty_tracked_announcement_recipients[\s\S]*?;/g)].map((m) => m[0]);
    expect(updates).toHaveLength(2);
    const has = (needle: string) => updates.filter((u) => u.includes(needle)).length;
    // 1. The disposition write, VERBATIM what 20260902 wrote apart from `now()` being hoisted into
    //    a local so the response and its first message share one instant.
    expect(has("set response = p_response, responded_at = v_now, question_text = v_q")).toBe(1);
    // 2. The reopen, and NOTHING else on that row.
    expect(has("set handled_at = null, handled_by_user_id = null")).toBe(1);
  });
});

/* ───────────────  B. WHAT THE REGRESSION CONTRACT FORBIDS  ─────────────── */

describe("B — it touches nothing it has no business in", () => {
  it("names no table it has no business in", () => {
    for (const forbidden of [
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

  it("★ rewrites no Track fact — binding, framing, notification, closure", () => {
    for (const bad of [
      // Assignment, not comparison: `r.user_id = p_user_id` in a WHERE clause is how the caller's
      // own row has always been FOUND, and that read is unchanged.
      /set[^;]*\buser_id\s*=/i,
      /set[^;]*\bbound_at\s*=/i,
      /set[^;]*\bhost_framing\s*=/i,
      /set[^;]*\bsource_capture_id\s*=/i,
      /set[^;]*\bnotified_at\s*=/i,
      /set[^;]*\bnotification_claim_token\s*=/i,
      /set[^;]*\bservice_url\s*=/i,
      /\bstatus\s*=\s*'closed'/i,
    ]) {
      expect(code, String(bad)).not.toMatch(bad);
    }
    // `resolved_count` IS written, but only by the denominator assertion 20260907 already had.
    const rc = [...code.matchAll(/set resolved_count[^;]*;/g)].map((m) => m[0]);
    expect(rc).toHaveLength(1);
    expect(rc[0]).toContain("resolved_count = v_count");
  });

  it("★ handled_at is CLEARED and never SET here — the explicit action keeps that authority", () => {
    // The reopen may only ever null it. Setting it remains bty_handle_announcement_recipient's job.
    const sets = [...code.matchAll(/set[^;]*\bhandled_at\s*=[^;]*/g)].map((m) => m[0]);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toContain("handled_at = null");
    expect(sets[0]).toContain("handled_by_user_id = null");
    expect(code).not.toMatch(/handled_at\s*=\s*(now\(\)|v_now|p_)/i);
  });

  it("★ leaves the notification and binding functions completely alone", () => {
    for (const fn of [
      "bty_bind_announcement_recipients",
      "bty_bind_announcement_recipients_for_user",
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
    for (const bad of ["preferred_username", "upn", "user_metadata", "full_name"]) {
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

  it("★ the author FK is SET NULL and the column is NULLABLE — the DDL and the comment agree", () => {
    /*
      R1 was internally contradictory: a comment saying cascade was "deliberately NOT used" over DDL
      that used cascade. Resolved toward the precedent this schema already set on
      bty_tracked_announcement_recipients.user_id: the account link goes, the words stay.
    */
    expect(table).toMatch(/author_user_id uuid references auth\.users \(id\) on delete set null/);
    expect(table).not.toMatch(/author_user_id uuid not null/);
    expect(table).not.toMatch(/author_user_id[^,]*on delete cascade/);
    // The role must outlive the account, or a deleted author breaks the unread rule.
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

  it("★ E — the read index is a TOTAL order, not created_at alone", () => {
    expect(code).toMatch(
      /bty_ann_thread_recipient_created_idx\s*\n?\s*on public\.bty_announcement_thread_messages \(recipient_id, created_at, id\)/,
    );
  });
});

/* ───────────────────────  D. UNREAD MODEL  ─────────────────────── */

describe("D — unread is per-message receipts, not a cursor", () => {
  const reads = code.slice(
    code.indexOf("create table if not exists public.bty_announcement_thread_message_reads"),
    code.indexOf("create index if not exists bty_ann_thread_reads_reader_idx"),
  );

  it("★ one receipt per (message, reader), as a primary key", () => {
    expect(reads).toMatch(/primary key \(message_id, reader_user_id\)/);
    expect(reads).toMatch(
      /message_id uuid not null\s*\n?\s*references public\.bty_announcement_thread_messages \(id\) on delete cascade/,
    );
    expect(reads).toMatch(/reader_user_id uuid not null references auth\.users \(id\) on delete cascade/);
  });

  it("★ receipts are written ONLY for the OPPOSITE party's messages in THIS thread", () => {
    const mark = fnBody("bty_mark_announcement_thread_read");
    expect(mark).toContain("v_other := case when v_role = 'HOST' then 'RECIPIENT' else 'HOST' end;");
    expect(mark).toMatch(/where m\.recipient_id = p_recipient_id\s*\n\s*and m\.author_role = v_other/);
    expect(mark).toContain("on conflict (message_id, reader_user_id) do nothing");
    // The reader is the CALLER, never a parameter naming somebody else.
    expect(mark).toContain("select m.id, p_actor_user_id");
  });

  it("★ marking read never handles anything", () => {
    const mark = fnBody("bty_mark_announcement_thread_read");
    expect(mark).not.toContain("handled_at");
    expect(mark).not.toContain("bty_tracked_announcement_recipients");
  });

  it("★ there is NO side parameter — the side follows from the derived role", () => {
    expect(code).toContain(
      "create or replace function public.bty_mark_announcement_thread_read(\n  p_recipient_id uuid,\n  p_actor_user_id uuid\n)",
    );
  });
});

/* ───────────────────────  E. APPEND-ONLY, STATED HONESTLY  ─────────────────────── */

describe("E — the append-only claim matches what is actually enforceable", () => {
  it("★ service_role holds SELECT and INSERT on BOTH tables, and nothing else", () => {
    for (const t of ["bty_announcement_thread_messages", "bty_announcement_thread_message_reads"]) {
      expect(code, t).toContain(`grant select, insert on public.${t} to service_role;`);
      const grants = [...code.matchAll(new RegExp(`grant [^;]*on public\\.${t}[^;]*;`, "g"))].map((m) => m[0]);
      expect(grants, t).toHaveLength(1);
      expect(grants[0], t).not.toMatch(/update|delete/i);
      expect(code, t).toContain(`revoke all on public.${t} from anon, public, authenticated;`);
      expect(code, t).toContain(`alter table public.${t} enable row level security;`);
    }
    expect(code).not.toMatch(/create policy/i);
  });

  it("★ no function in this file updates or deletes a message or a receipt", () => {
    for (const t of ["bty_announcement_thread_messages", "bty_announcement_thread_message_reads"]) {
      expect(code, t).not.toMatch(new RegExp(`update public\\.${t}`, "i"));
      expect(code, t).not.toMatch(new RegExp(`delete from public\\.${t}`, "i"));
    }
  });

  it("★ the file does NOT claim a future definer function is constrained by these grants", () => {
    /*
      R1 said a message "cannot be removed — not by a bug, not by a future service function, not by
      a direct call". A SECURITY DEFINER function owned by a superuser or the table owner runs with
      THAT role's privileges and is not bound by what service_role was granted, so the claim was
      false. The file must state the limit rather than assert it away.
    */
    expect(sql).toMatch(/NOT CLAIMED/);
    expect(sql).toMatch(/superuser|table owner/i);
    expect(sql).not.toMatch(/not by a future service function/i);
  });
});

/* ───────────────────────  F. AUTHORITY  ─────────────────────── */

describe("F — the role is derived by a join, and default-deny", () => {
  const resolve = fnBody("bty_resolve_announcement_thread_role");

  it("★ it JOINS the recipient to its announcement owner", () => {
    expect(resolve).toContain("join public.bty_tracked_announcements a on a.id = r.announcement_id");
    expect(resolve).toContain("if v_owner = p_actor_user_id then");
    expect(resolve).toContain("if v_recipient = p_actor_user_id then");
  });

  it("★ every other outcome is 'none' — a missing row and a wrong person are one answer", () => {
    expect(resolve.match(/select 'none'::text/g) ?? []).toHaveLength(3);
    expect(resolve).toContain("if not found then");
  });

  it("★ an UNBOUND recipient matches nobody — plain equality, never `is not distinct from`", () => {
    expect(resolve).not.toMatch(/is not distinct from/i);
  });

  it("every function is SECURITY DEFINER, search_path-pinned, and server-only", () => {
    for (const fn of [
      "bty_resolve_announcement_thread_role(uuid, uuid)",
      "bty_post_announcement_thread_message(uuid, uuid, text, text)",
      "bty_mark_announcement_thread_read(uuid, uuid)",
      "bty_respond_to_announcement(uuid, uuid, text, text)",
      "bty_track_announcement(uuid, uuid, text, text, text, text[], text)",
    ]) {
      expect(code, fn).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`);
      expect(code, fn).toContain(`grant execute on function public.${fn} to service_role;`);
    }
    expect((code.match(/security definer/g) ?? []).length).toBe(5);
    expect((code.match(/set search_path = pg_catalog, public/g) ?? []).length).toBe(5);
    expect((code.match(/#variable_conflict use_column/g) ?? []).length).toBe(5);
  });

  it("★ the writer takes NO role parameter, and writes the role it derived", () => {
    const post = fnBody("bty_post_announcement_thread_message");
    expect(code).toContain(
      "create or replace function public.bty_post_announcement_thread_message(\n  p_recipient_id uuid,\n  p_actor_user_id uuid,\n  p_body text,\n  p_client_message_id text\n)",
    );
    expect(post).toContain("select r.role into v_role");
    expect(post).toMatch(/values\s*\n?\s*\(p_recipient_id, p_actor_user_id, v_role, v_body, v_key\)/);
    expect(post).toContain("if v_role is null or v_role = 'none' then");
  });

  it("★ only a RECIPIENT message reopens, and a duplicate never does", () => {
    const post = fnBody("bty_post_announcement_thread_message");
    expect(post).toContain("if v_role = 'RECIPIENT' then");
    const dupes = [...post.matchAll(/select 'duplicate'::text[^;]*;/g)].map((m) => m[0]);
    expect(dupes.length).toBeGreaterThanOrEqual(2);
    for (const d of dupes) expect(d).toMatch(/,\s*false;$/);
  });
});

/* ───────────────────────  G. THE ATOMIC BRIDGE  ─────────────────────── */

describe("G — the first response and the first message are ONE transaction", () => {
  const respond = fnBody("bty_respond_to_announcement");

  it("★ the QUESTION text is inserted inside the same function that wrote the disposition", () => {
    expect(respond).toContain("update public.bty_tracked_announcement_recipients");
    expect(respond).toContain("if p_response = 'QUESTION' and v_q is not null then");
    expect(respond).toContain("insert into public.bty_announcement_thread_messages");
    expect(respond).toContain("v_now := now();");
    expect(respond).toMatch(/values\s*\n?\s*\(v_row\.id, p_user_id, 'RECIPIENT', v_q, v_now\)/);
  });

  it("★ ACKNOWLEDGED and HELP_NEEDED insert NOTHING — no message is fabricated", () => {
    expect((respond.match(/insert into public\.bty_announcement_thread_messages/g) ?? []).length).toBe(1);
    expect(code).not.toMatch(/I need help|도움이 필요/i);
  });

  it("★ the signature and every existing result string are UNCHANGED", () => {
    expect(code).toContain(
      "create or replace function public.bty_respond_to_announcement(\n  p_announcement_id uuid,\n  p_user_id uuid,\n  p_response text,\n  p_question_text text\n)",
    );
    expect(code).toContain("returns table (result text, response text, responded_at timestamptz)");
    for (const r of ["'invalid_response'", "'question_too_long'", "'not_a_recipient'", "'already_responded'", "'responded'"]) {
      expect(respond, r).toContain(r);
    }
  });

  it("★ write-once, the row lock, and the not-a-recipient masking all survive", () => {
    expect(respond).toContain("for update");
    expect(respond).toContain("if v_row.response is not null then");
    expect(respond).toContain("if not found then");
    expect(respond).toContain("question_text = v_q");
  });
});

/* ───────────────────────  H. SELF-RECIPIENT  ─────────────────────── */

describe("H — a Host can never be in their own audience", () => {
  const track = fnBody("bty_track_announcement");

  it("★ the owner's Entra oids are read from the canonical path and excluded", () => {
    expect(track).toContain("identity_data->'custom_claims'->>'oid'");
    expect(track).toContain("and i.provider = 'azure'");
    expect(track).toContain("and not (lower(btrim(o)) = any (v_owner_oids));");
    // The oid is NOT at the top level, and provider_id is the `sub`. A wrong path would fail
    // silently by excluding nobody.
    expect(track).not.toMatch(/identity_data->>'oid'/);
    expect(track).not.toContain("provider_id");
  });

  it("★ ALL of the owner's identities are excluded — array_agg, never a single pick", () => {
    expect(track).toContain("array_agg(lower(btrim(i.identity_data->'custom_claims'->>'oid')))");
    // No fail-closed refusal on >1: exclusion removes the union and never has to choose one.
    expect(track).not.toMatch(/array_length\(v_owner_oids/);
  });

  it("★ selecting only yourself hits the EXISTING zero_recipients refusal, unchanged", () => {
    expect(track).toContain("raise exception 'zero_recipients' using errcode = 'P0001'");
  });

  it("★ everything else about Track is untouched — signature, idempotency, dedupe, service_url", () => {
    expect(code).toContain(
      "create or replace function public.bty_track_announcement(\n  p_owner_user_id uuid,\n  p_source_capture_id uuid,\n  p_host_framing text,\n  p_tenant_id text,\n  p_conversation_id text,\n  p_recipient_oids text[],\n  p_service_url text default null\n)",
    );
    expect(code).toContain("returns table (announcement_id uuid, resolved_count integer, already_existed boolean)");
    expect(track).toContain("select array_agg(distinct lower(btrim(o)))");
    expect(track).toContain("where a.owner_user_id = p_owner_user_id");
    expect(track).toContain("and a.source_capture_id = p_source_capture_id");
    // The service_url https guard 20260907 added is still there, unweakened.
    expect(track).toContain("v_service_url !~* '^https://[a-z0-9.-]+(:[0-9]+)?(/|$)'");
  });

  it("★ the resolver still resolves ONE role deterministically for any legacy row", () => {
    // Owner-first is a defensive tie-break now, not a claim that a self-recipient is legitimate.
    const resolve = fnBody("bty_resolve_announcement_thread_role");
    expect(resolve.indexOf("'HOST'::text")).toBeLessThan(resolve.indexOf("'RECIPIENT'::text"));
    expect(sql).toMatch(/defensive tie-break/i);
  });
});
