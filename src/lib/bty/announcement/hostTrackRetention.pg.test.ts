import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ★ DELETING AN ACCOUNT MUST NOT DELETE OTHER PEOPLE'S HISTORY.
 *
 * 20260914 made deleting a RECIPIENT preserve everything. Deleting the HOST still erased the
 * announcement, every recipient, every response and every conversation — for everybody. That
 * asymmetry was never decided; it was the default behaviour of an FK clause.
 *
 * ★ AND THE OBVIOUS FIX DOES NOTHING. There are TWO paths from the Host's account to the same rows,
 * and repairing only `owner_user_id` leaves the second one intact. The first test below is that
 * measurement, pinned, so nobody can "simplify" this migration back into a no-op.
 *
 * Run: BTY_PG_TEST_URL="postgresql://postgres@/postgres?host=/tmp/pg&port=55433" npx vitest run <this file>
 */

const URL = process.env.BTY_PG_TEST_URL ?? "";
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(MIGRATIONS, f), "utf8");

const CANONICAL = "uuid, uuid, text, text, text, text, text[]";
const RETENTION = "20260915000000_bty_host_track_history_retention_v1.sql";

const BOOTSTRAP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  identity_data jsonb not null default '{}'::jsonb
);
create table if not exists public.bty_action_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preview_text text,
  source_url text
);
`;

/** History, then the production shape 20260912 expects, then everything applied since. */
const ADOPT_PRODUCTION_SHAPE = `
drop function if exists public.bty_track_announcement(uuid, uuid, text, text, text, text[], text);
create or replace function public.bty_track_announcement(
  p_owner_user_id uuid, p_source_capture_id uuid, p_host_framing text, p_tenant_id text,
  p_conversation_id text, p_service_url text, p_recipient_oids text[]
) returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql security definer set search_path = pg_catalog, public
as $fn$ begin return query select null::uuid, 0, false; end; $fn$;
revoke all on function public.bty_track_announcement(${CANONICAL}) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(${CANONICAL}) to service_role;
`;

const APPLIED = [
  BOOTSTRAP,
  read("20260902000000_bty_tracked_announcements_v1.sql"),
  read("20260906000000_bty_announcement_recipient_handled_v1.sql"),
  read("20260907000000_bty_announcement_service_url_v1.sql"),
  read("20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql"),
  ADOPT_PRODUCTION_SHAPE,
  read("20260912000000_bty_announcement_thread_v1.sql"),
  read("20260913000000_bty_today_dismissal_v1.sql"),
  read("20260914000000_bty_identity_integrity_reconciliation_v1.sql"),
];

let admin: Pool;
let reachable = false;
let n = 0;

async function db(extra: string[] = []): Promise<Pool> {
  const name = `hret_${Date.now().toString(36)}_${n++}`;
  await admin.query(`create database ${name}`);
  const p = new Pool({ connectionString: URL.replace("/postgres?", `/${name}?`), max: 4 });
  const c = await p.connect();
  try {
    for (const s of [...APPLIED, ...extra]) await c.query(s);
  } finally {
    c.release();
  }
  return p;
}
const withRetention = () => db([read(RETENTION)]);

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";

/** A Host, a bound recipient who asked a QUESTION, a Host reply, and one read receipt. */
async function scenario(p: Pool) {
  const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
  const person = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
  const cap = (await p.query(
    `insert into public.bty_action_captures (user_id, preview_text, source_url)
     values ($1,'msg','https://teams.microsoft.com/x') returning id`, [host])).rows[0].id;
  const cols = await p.query(
    `select 1 from information_schema.columns where table_name='bty_tracked_announcements' and column_name='owner_user_id_snapshot'`);
  const ann = (await p.query(
    cols.rowCount
      ? `insert into public.bty_tracked_announcements (owner_user_id, owner_user_id_snapshot, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
         values ($1,$1,$2,'please read',$3,'cv',1) returning id`
      : `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
         values ($1,$2,'please read',$3,'cv',1) returning id`,
    [host, cap, TID])).rows[0].id;
  const rec = (await p.query(
    `insert into public.bty_tracked_announcement_recipients
       (announcement_id, tenant_id, aad_object_id, user_id, bound_at, response, responded_at, question_text)
     values ($1,$2,$3,$4, now(),'QUESTION', now(),'why?') returning id`, [ann, TID, OID, person])).rows[0].id;
  const mine = (await p.query(
    `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
     values ($1,$2,'RECIPIENT','why?') returning id`, [rec, person])).rows[0].id;
  const reply = (await p.query(
    `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
     values ($1,$2,'HOST','because') returning id`, [rec, host])).rows[0].id;
  // the HOST has read the recipient's message; the recipient has NOT read the reply
  await p.query(`insert into public.bty_announcement_thread_message_reads (message_id, reader_user_id) values ($1,$2)`, [mine, host]);
  return { host, person, cap, ann, rec, mine, reply };
}

const count = async (p: Pool, t: string, where = "true", args: unknown[] = []) =>
  Number((await p.query(`select count(*)::int n from public.${t} where ${where}`, args)).rows[0].n);

beforeAll(async () => {
  if (!URL) return;
  try {
    admin = new Pool({ connectionString: URL, max: 4 });
    await admin.query("select 1");
    reachable = true;
  } catch { reachable = false; }
});
afterAll(async () => { await admin?.end().catch(() => {}); });

const t = (name: string, fn: () => Promise<void>) =>
  it(name, async () => { if (!reachable) return; await fn(); });

// ---------------------------------------------------------------------------
describe("★ the measurement that shaped this migration", () => {
  t("★ TODAY: deleting the Host erases the announcement, recipients and the whole conversation", async () => {
    const p = await db();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    expect(await count(p, "bty_tracked_announcements")).toBe(0);
    expect(await count(p, "bty_tracked_announcement_recipients")).toBe(0);
    expect(await count(p, "bty_announcement_thread_messages")).toBe(0);
    await p.end();
  });

  t("★ AND REPAIRING ONLY owner_user_id CHANGES NOTHING — the capture path erases it anyway", async () => {
    const p = await db([
      `alter table public.bty_tracked_announcements alter column owner_user_id drop not null;
       alter table public.bty_tracked_announcements drop constraint bty_tracked_announcements_owner_user_id_fkey;
       alter table public.bty_tracked_announcements add constraint bty_tracked_announcements_owner_user_id_fkey
         foreign key (owner_user_id) references auth.users(id) on delete set null;`,
    ]);
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    expect(await count(p, "bty_tracked_announcements"), "still erased, via captures").toBe(0);
    expect(await count(p, "bty_announcement_thread_messages")).toBe(0);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ HOST DELETE — after the repair", () => {
  t("★ the account deletes, and every piece of other people's history survives", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);

    const a = (await p.query(`select * from public.bty_tracked_announcements where id=$1`, [s.ann])).rows[0];
    expect(a, "the announcement survives").toBeTruthy();
    expect(a.owner_user_id, "authority is gone").toBeNull();
    expect(a.source_capture_id, "the source link is detached").toBeNull();
    expect(a.owner_user_id_snapshot, "★ who created it is still recorded").toBe(s.host);
    expect(a.host_framing, "the Host's own words survive").toBe("please read");

    expect(await count(p, "bty_action_captures"), "the Host's private capture goes with them").toBe(0);

    const r = (await p.query(`select * from public.bty_tracked_announcement_recipients where id=$1`, [s.rec])).rows[0];
    expect(r.user_id, "the recipient is still bound to their own account").toBe(s.person);
    expect(r.response).toBe("QUESTION");
    expect(r.question_text).toBe("why?");

    const msgs = (await p.query(
      `select author_role, author_user_id, body from public.bty_announcement_thread_messages
        where recipient_id=$1 order by created_at`, [s.rec])).rows;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].author_user_id, "the recipient's own authorship is untouched").toBe(s.person);
    expect(msgs[1].author_user_id, "the deleted Host's link goes, per the existing contract").toBeNull();
    expect(msgs.map((m) => m.author_role), "which side spoke is still known").toEqual(["RECIPIENT", "HOST"]);
    expect(msgs[1].body, "★ words already sent stay readable").toBe("because");

    expect(await count(p, "bty_announcement_thread_message_reads"), "the Host's own receipts go").toBe(0);
    await p.end();
  });

  t("a recipient's receipt on a surviving message is untouched by the Host's deletion", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`insert into public.bty_announcement_thread_message_reads (message_id, reader_user_id) values ($1,$2)`,
      [s.reply, s.person]);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    expect(await count(p, "bty_announcement_thread_message_reads", "reader_user_id=$1", [s.person])).toBe(1);
    await p.end();
  });

  t("no orphan violates any constraint — the surviving rows are all still valid", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    // touching every row re-checks every CHECK and FK on it
    await p.query(`update public.bty_tracked_announcements set host_framing = host_framing`);
    await p.query(`update public.bty_tracked_announcement_recipients set response = response`);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ SNAPSHOT — backfilled, written on creation, and immutable", () => {
  t("★ existing rows are backfilled, and the column is NOT NULL with no FK", async () => {
    const p = await db();
    const s = await scenario(p);            // created BEFORE the migration
    await p.query(read(RETENTION));
    const a = (await p.query(`select owner_user_id_snapshot from public.bty_tracked_announcements where id=$1`, [s.ann])).rows[0];
    expect(a.owner_user_id_snapshot).toBe(s.host);
    const col = (await p.query(
      `select attnotnull from pg_attribute where attrelid='public.bty_tracked_announcements'::regclass
        and attname='owner_user_id_snapshot'`)).rows[0];
    expect(col.attnotnull, "NOT NULL").toBe(true);
    const fks = (await p.query(
      `select count(*)::int n from pg_constraint c
        where c.conrelid='public.bty_tracked_announcements'::regclass and c.contype='f'
          and c.conkey = array[(select attnum from pg_attribute
                                 where attrelid=c.conrelid and attname='owner_user_id_snapshot')]`)).rows[0].n;
    expect(fks, "★ NO foreign key — it must outlive the account").toBe(0);
    await p.end();
  });

  t("★ INSERT may establish it; UPDATE may NOT alter it", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await expect(
      p.query(`update public.bty_tracked_announcements set owner_user_id_snapshot=$1 where id=$2`, [s.person, s.ann]),
    ).rejects.toThrow(/immutable/i);
    await expect(
      p.query(`update public.bty_tracked_announcements set owner_user_id_snapshot=null where id=$1`, [s.ann]),
    ).rejects.toThrow(/immutable|null value/i);
    // an update that merely carries the column along unchanged is fine
    await p.query(`update public.bty_tracked_announcements set status='closed', closed_at=now(),
                     owner_user_id_snapshot=owner_user_id_snapshot where id=$1`, [s.ann]);
    expect((await p.query(`select owner_user_id_snapshot from public.bty_tracked_announcements where id=$1`, [s.ann])).rows[0]
      .owner_user_id_snapshot).toBe(s.host);
    await p.end();
  });

  t("★ even a SECURITY DEFINER writer cannot change it — the trigger binds every writer", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`create function public.evil(a uuid, u uuid) returns void language plpgsql security definer as $f$
                     begin update public.bty_tracked_announcements set owner_user_id_snapshot=u where id=a; end $f$;`);
    await expect(p.query(`select public.evil($1,$2)`, [s.ann, s.person])).rejects.toThrow(/immutable/i);
    await p.end();
  });

  t("★ and it GRANTS NOTHING — the snapshot never makes anybody Host", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    // the recipient asks, using the snapshot value as if it were an identity
    const role = (await p.query(`select role from public.bty_resolve_announcement_thread_role($1,$2)`,
      [s.rec, s.person])).rows[0].role;
    expect(role, "the recipient is still exactly a recipient").toBe("RECIPIENT");
    const handled = (await p.query(`select result from public.bty_handle_announcement_recipient($1,$2,true)`,
      [s.rec, s.person])).rows[0].result;
    expect(handled, "nobody can handle a Track with no Host").toBe("not_found");
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ NO HOST, NO NEW WORDS — reading is untouched", () => {
  async function orphaned() {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    return { p, s };
  }

  t("★ a new thread message is refused with host_unavailable", async () => {
    const { p, s } = await orphaned();
    const r = (await p.query(`select result, message_id from public.bty_post_announcement_thread_message($1,$2,$3,null)`,
      [s.rec, s.person, "anyone there?"])).rows[0];
    expect(r.result).toBe("host_unavailable");
    expect(r.message_id).toBeNull();
    expect(await count(p, "bty_announcement_thread_messages", "recipient_id=$1", [s.rec]), "nothing was written").toBe(2);
    await p.end();
  });

  t("★ a first response is refused with the SAME domain fact", async () => {
    const p = await withRetention();
    const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const person = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [host])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, owner_user_id_snapshot, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$1,$2,'x',$3,'c',1) returning id`, [host, cap, TID])).rows[0].id;
    await p.query(
      `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id, user_id, bound_at)
       values ($1,$2,$3,$4, now())`, [ann, TID, OID, person]);
    await p.query(`delete from auth.users where id=$1`, [host]);
    const r = (await p.query(`select result from public.bty_respond_to_announcement($1,$2,'ACKNOWLEDGED',null)`,
      [ann, person])).rows[0];
    expect(r.result).toBe("host_unavailable");
    expect(await count(p, "bty_tracked_announcement_recipients", "response is not null")).toBe(0);
    await p.end();
  });

  t("★ NON-PROBEABLE: a stranger still gets not_found / not_a_recipient, never host_unavailable", async () => {
    const { p, s } = await orphaned();
    const stranger = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    expect((await p.query(`select result from public.bty_post_announcement_thread_message($1,$2,'hi',null)`,
      [s.rec, stranger])).rows[0].result).toBe("not_found");
    expect((await p.query(`select result from public.bty_respond_to_announcement($1,$2,'ACKNOWLEDGED',null)`,
      [s.ann, stranger])).rows[0].result).toBe("not_a_recipient");
    await p.end();
  });

  t("★ READING IS UNAFFECTED — the reply the Host already sent is still there and still markable read", async () => {
    const { p, s } = await orphaned();
    const rows = (await p.query(
      `select body, author_role from public.bty_announcement_thread_messages where recipient_id=$1 order by created_at`,
      [s.rec])).rows;
    expect(rows.map((r) => r.body)).toEqual(["why?", "because"]);
    const marked = (await p.query(`select * from public.bty_mark_announcement_thread_read($1,$2)`, [s.rec, s.person])).rows[0];
    expect(marked, "marking read still works").toBeTruthy();
    expect(await count(p, "bty_announcement_thread_message_reads", "reader_user_id=$1", [s.person])).toBeGreaterThan(0);
    await p.end();
  });

  t("a LIVE Track is completely unaffected — response and reply both still work", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    const posted = (await p.query(`select result from public.bty_post_announcement_thread_message($1,$2,'still talking',null)`,
      [s.rec, s.person])).rows[0].result;
    expect(posted).toBe("posted");
    const r2 = (await p.query(`select result from public.bty_post_announcement_thread_message($1,$2,'and again',null)`,
      [s.rec, s.host])).rows[0].result;
    expect(r2).toBe("posted");
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ CAPTURE — it may die; the Track may not", () => {
  t("★ deliberate capture deletion while the Host still exists detaches, and nothing else", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from public.bty_action_captures where id=$1`, [s.cap]);
    const a = (await p.query(`select * from public.bty_tracked_announcements where id=$1`, [s.ann])).rows[0];
    expect(a, "the Track survives").toBeTruthy();
    expect(a.source_capture_id).toBeNull();
    expect(a.owner_user_id, "★ the Host keeps their authority").toBe(s.host);
    expect(await count(p, "bty_announcement_thread_messages", "recipient_id=$1", [s.rec])).toBe(2);
    // and the Host can still act
    expect((await p.query(`select result from public.bty_handle_announcement_recipient($1,$2,true)`,
      [s.rec, s.host])).rows[0].result).toBe("handled");
    await p.end();
  });

  t("★ service_role can no longer delete a capture, and FK cascades still can", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    const c = await p.connect();
    try {
      await c.query("set role service_role");
      await expect(c.query(`delete from public.bty_action_captures where id=$1`, [s.cap])).rejects.toThrow(/permission denied/i);
      for (const ok of ["SELECT", "INSERT", "UPDATE"]) {
        expect((await c.query(`select has_table_privilege('service_role','public.bty_action_captures',$1) ok`, [ok])).rows[0].ok, ok).toBe(true);
      }
      for (const no of ["DELETE", "TRUNCATE"]) {
        expect((await c.query(`select has_table_privilege('service_role','public.bty_action_captures',$1) ok`, [no])).rows[0].ok, no).toBe(false);
      }
      await c.query("reset role");
    } finally { c.release(); }
    // the cascade from auth.users still removes it — that is the product contract
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    expect(await count(p, "bty_action_captures")).toBe(0);
    expect(await count(p, "bty_tracked_announcements"), "★ but not the Track").toBe(1);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ UNIQUE / IDEMPOTENCY", () => {
  t("★ a live Host still cannot create two runs from one capture — idempotency is unchanged", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await expect(p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, owner_user_id_snapshot, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$1,$2,'again',$3,'c',1)`, [s.host, s.cap, TID])).rejects.toThrow(/bty_tracked_ann_owner_source_unique/);
    await p.end();
  });

  t("★ orphaned rows carry (NULL, NULL) and do not collide with each other", async () => {
    const p = await withRetention();
    for (let i = 0; i < 2; i++) {
      const s = await scenario(p);
      await p.query(`delete from auth.users where id=$1`, [s.host]);
    }
    expect(await count(p, "bty_tracked_announcements", "owner_user_id is null and source_capture_id is null")).toBe(2);
    await p.end();
  });

  t("★ a deleted Host cannot create anything — the RPC needs an identity that no longer exists", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    const r = await p.query(
      `select * from public.bty_track_announcement($1,$2,'x',$3,'c',null,array[$4]::text[])`,
      [s.host, s.cap, TID, OID]).catch((e: Error) => e);
    expect(r instanceof Error ? r.message : "", "no identity, no Track").toMatch(/missing_identity|invalid_framing|violates/i);
    await p.end();
  });

  t("★ deleting a capture does not let a live Host duplicate the run from a NEW capture", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from public.bty_action_captures where id=$1`, [s.cap]);
    const cap2 = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [s.host])).rows[0].id;
    // A different capture is a different source, so a second run is legitimate and NOT a duplicate.
    await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, owner_user_id_snapshot, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$1,$2,'new run',$3,'c',1)`, [s.host, cap2, TID]);
    expect(await count(p, "bty_tracked_announcements")).toBe(2);
    // and the detached historical row still cannot be re-created against a NULL source
    expect(await count(p, "bty_tracked_announcements", "source_capture_id is null")).toBe(1);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ TODAY", () => {
  t("★ the Host's own card disappears; the recipient's does not", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    // The Host list query, exactly as the service issues it.
    expect(await count(p, "bty_tracked_announcements", "owner_user_id = $1", [s.host])).toBe(0);
    // The recipient list, scoped by their binding — still one row.
    expect(await count(p, "bty_tracked_announcement_recipients", "user_id = $1", [s.person])).toBe(1);
    await p.end();
  });

  t("★ the activity version does NOT decrease when the Host is deleted", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    const version = async () => Number((await p.query(
      `select (select count(*) from public.bty_announcement_thread_messages m
                where m.recipient_id=r.id and m.author_role='HOST') as v
         from public.bty_tracked_announcement_recipients r where r.id=$1`, [s.rec])).rows[0].v);
    const before = await version();
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    expect(await version(), "★ a surviving card's count never falls").toBe(before);
    await p.end();
  });

  t("★ a dismissed orphan stays dismissed — no resurface loop", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`insert into public.bty_today_dismissals (user_id, item_kind, item_id, dismissed_activity_version)
                   values ($1,'track_recipient',$2,1)`, [s.person, s.rec]);
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    expect(await count(p, "bty_today_dismissals"), "the dismissal row survives").toBe(1);
    // no new HOST message can ever arrive, so the count is frozen and the hide holds
    expect((await p.query(`select result from public.bty_post_announcement_thread_message($1,$2,'x',null)`,
      [s.rec, s.person])).rows[0].result).toBe("host_unavailable");
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ REGRESSION — 20260914's guarantees still hold", () => {
  t("exactly one Track overload, still service_role-only, still no defaults", async () => {
    const p = await withRetention();
    const rows = (await p.query(
      `select array_to_string(array(select format_type(t,null) from unnest(p.proargtypes) t), ', ') ident,
              p.prosecdef, p.proconfig, p.pronargdefaults, pg_get_function_result(p.oid) result,
              has_function_privilege('service_role', p.oid, 'EXECUTE') svc,
              has_function_privilege('anon', p.oid, 'EXECUTE') anon
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].ident).toBe(CANONICAL);
    expect(rows[0].prosecdef).toBe(true);
    expect(rows[0].proconfig).toEqual(["search_path=pg_catalog, public"]);
    expect(rows[0].pronargdefaults).toBe(0);
    expect(rows[0].result).toBe("TABLE(announcement_id uuid, resolved_count integer, already_existed boolean)");
    expect(rows[0].svc).toBe(true);
    expect(rows[0].anon).toBe(false);
    await p.end();
  });

  t("recipient deletion still preserves everything (20260914), now alongside Host retention", async () => {
    const p = await withRetention();
    const s = await scenario(p);
    await p.query(`delete from auth.users where id=$1`, [s.person]);
    const r = (await p.query(`select * from public.bty_tracked_announcement_recipients where id=$1`, [s.rec])).rows[0];
    expect(r.user_id).toBeNull();
    expect(r.bound_at).not.toBeNull();
    expect(r.response).toBe("QUESTION");
    expect(await count(p, "bty_tracked_announcements")).toBe(1);
    await p.end();
  });

  t("Track evidence tables still refuse a service_role DELETE", async () => {
    const p = await withRetention();
    const c = await p.connect();
    try {
      await c.query("set role service_role");
      await expect(c.query(`delete from public.bty_tracked_announcements`)).rejects.toThrow(/permission denied/i);
      await expect(c.query(`delete from public.bty_announcement_thread_messages`)).rejects.toThrow(/permission denied/i);
      await c.query("reset role");
    } finally { c.release(); }
    await p.end();
  });
});
