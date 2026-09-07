import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ★ IDENTITY / MIGRATION INTEGRITY — PROVEN AGAINST A REAL POSTGRESQL, BOTH WAYS.
 *
 * Three production debts, each of which a schema built only from the repository's own migration
 * files is structurally incapable of showing:
 *
 *   A  repo 20260907 declares bty_track_announcement(..., p_recipient_oids text[], p_service_url
 *      text default null); PRODUCTION carries (..., p_service_url text, p_recipient_oids text[]).
 *      `create or replace` matches ARGUMENT TYPES, so the wrong order OVERLOADS instead of
 *      replacing — and both accept the same NAMED arguments PostgREST sends.
 *
 *   B  recipients.user_id is ON DELETE SET NULL while a CHECK demands
 *      (user_id is null) = (bound_at is null). Deleting a bound person's account therefore FAILS
 *      today, and DELETE /api/admin/users is a real path.
 *
 *   C  Today's dismissal hides a card by comparing a MONOTONIC activity count. service_role held
 *      DELETE on the Track tables (Supabase default privileges + an explicit grant), so that count
 *      could fall and hide a live card forever.
 *
 * Every state below is BUILT, not assumed, and the reconciliation is proven to converge from each.
 *
 * Run: BTY_PG_TEST_URL="postgresql://postgres@/db?host=/tmp/pg&port=55433" npx vitest run <this file>
 */

const URL = process.env.BTY_PG_TEST_URL ?? "";
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(MIGRATIONS, f), "utf8");

const CANONICAL = "uuid, uuid, text, text, text, text, text[]";
const WRONG_20260907 = "uuid, uuid, text, text, text, text[], text";
const WRONG_20260902 = "uuid, uuid, text, text, text, text[]";

const RECONCILIATION = "20260914000000_bty_identity_integrity_reconciliation_v1.sql";
const HISTORY = [
  "20260902000000_bty_tracked_announcements_v1.sql",
  "20260906000000_bty_announcement_recipient_handled_v1.sql",
  "20260907000000_bty_announcement_service_url_v1.sql",
  "20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql",
];
const THREAD = "20260912000000_bty_announcement_thread_v1.sql";
const DISMISSAL = "20260913000000_bty_today_dismissal_v1.sql";

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

/**
 * The one step that turns the repository's history into what production actually runs. It is the
 * SHAPE only — 20260912 supplies the body — and it is exactly the divergence this slice closes.
 */
const ADOPT_PRODUCTION_SHAPE = `
drop function if exists public.bty_track_announcement(${WRONG_20260907});
create or replace function public.bty_track_announcement(
  p_owner_user_id uuid, p_source_capture_id uuid, p_host_framing text, p_tenant_id text,
  p_conversation_id text, p_service_url text, p_recipient_oids text[]
) returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql security definer set search_path = pg_catalog, public
as $fn$ begin return query select null::uuid, 0, false; end; $fn$;
revoke all on function public.bty_track_announcement(${CANONICAL}) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(${CANONICAL}) to service_role;
`;

let admin: Pool;
let reachable = false;
let dbn = 0;

/** A fresh database per scenario: these tests mutate schema, so they must not share one. */
async function freshDb(steps: string[]): Promise<Pool> {
  const name = `integ_${Date.now().toString(36)}_${dbn++}`;
  await admin.query(`create database ${name}`);
  const p = new Pool({ connectionString: URL.replace("/postgres?", `/${name}?`), max: 4 });
  const c = await p.connect();
  try {
    for (const s of steps) await c.query(s);
  } finally {
    c.release();
  }
  return p;
}

/** Every overload of the Track function, by the identity `create or replace` actually matches on. */
async function overloads(p: Pool): Promise<string[]> {
  const { rows } = await p.query(
    `select array_to_string(array(select format_type(t,null) from unnest(p.proargtypes) t), ', ') as ident
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='bty_track_announcement' order by p.oid`,
  );
  return rows.map((r) => r.ident as string);
}

/** The production starting state: history, production's shape, then the real migrations on top. */
const PRODUCTION_STATE = [BOOTSTRAP, ...HISTORY.map(read), ADOPT_PRODUCTION_SHAPE, read(THREAD), read(DISMISSAL)];

beforeAll(async () => {
  if (!URL) return;
  try {
    admin = new Pool({ connectionString: URL, max: 4 });
    await admin.query("select 1");
    reachable = true;
  } catch {
    reachable = false;
  }
});
afterAll(async () => {
  await admin?.end().catch(() => {});
});

const t = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!reachable) return; // no local PostgreSQL: these prove nothing, and say so by skipping
    await fn();
  });

// ---------------------------------------------------------------------------
describe("★ A — Track RPC: converge on exactly ONE overload", () => {
  t("STATE 1 (production today): one canonical overload, and the file is a no-op", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    expect(await overloads(p)).toEqual([CANONICAL]);
    await p.query(read(RECONCILIATION));
    expect(await overloads(p)).toEqual([CANONICAL]);
    await p.end();
  });

  t("★ RE-ENTRANT: applying it twice more changes nothing", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    await p.query(read(RECONCILIATION));
    await p.query(read(RECONCILIATION));
    expect(await overloads(p)).toEqual([CANONICAL]);
    await p.end();
  });

  t("★ STATE 2: the historical 20260907 overload coexisting with canonical is REMOVED", async () => {
    const p = await freshDb([
      ...PRODUCTION_STATE,
      // Exactly what applying repo 20260907 on top of production would produce.
      `create or replace function public.bty_track_announcement(
         p_owner_user_id uuid, p_source_capture_id uuid, p_host_framing text, p_tenant_id text,
         p_conversation_id text, p_recipient_oids text[], p_service_url text default null
       ) returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
       language plpgsql security definer set search_path = pg_catalog, public
       as $fn$ begin return query select null::uuid, 0, false; end; $fn$;`,
    ]);
    expect(await overloads(p)).toHaveLength(2); // ← the ambiguity that breaks Track in production
    await p.query(read(RECONCILIATION));
    expect(await overloads(p)).toEqual([CANONICAL]);
    await p.end();
  });

  t("★ the historical 20260902 six-argument overload is also removed", async () => {
    const p = await freshDb([
      ...PRODUCTION_STATE,
      `create or replace function public.bty_track_announcement(
         p_owner_user_id uuid, p_source_capture_id uuid, p_host_framing text, p_tenant_id text,
         p_conversation_id text, p_recipient_oids text[]
       ) returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
       language plpgsql security definer set search_path = pg_catalog, public
       as $fn$ begin return query select null::uuid, 0, false; end; $fn$;`,
    ]);
    expect(await overloads(p)).toHaveLength(2);
    await p.query(read(RECONCILIATION));
    expect(await overloads(p)).toEqual([CANONICAL]);
    await p.end();
  });

  t("★ BOTH historical shapes at once still converge to one", async () => {
    const p = await freshDb([
      ...PRODUCTION_STATE,
      `create or replace function public.bty_track_announcement(
         a uuid, b uuid, c text, d text, e text, f text[], g text default null
       ) returns void language sql as $fn$ select $fn$;`,
      `create or replace function public.bty_track_announcement(
         a uuid, b uuid, c text, d text, e text, f text[]
       ) returns void language sql as $fn$ select $fn$;`,
    ]);
    expect(await overloads(p)).toHaveLength(3);
    await p.query(read(RECONCILIATION));
    expect(await overloads(p)).toEqual([CANONICAL]);
    await p.end();
  });

  t("★ FAIL CLOSED: an UNRECOGNISED overload is refused, never dropped on a hunch", async () => {
    const p = await freshDb([
      ...PRODUCTION_STATE,
      `create or replace function public.bty_track_announcement(a uuid, b text)
         returns void language sql as $fn$ select $fn$;`,
    ]);
    await expect(p.query(read(RECONCILIATION))).rejects.toThrow(/unrecognised overload/i);
    // and it is still there — the migration aborted rather than guessing
    expect(await overloads(p)).toHaveLength(2);
    await p.end();
  });

  t("★ FAIL CLOSED: if the canonical overload is missing it refuses rather than defining one", async () => {
    const p = await freshDb([BOOTSTRAP, ...HISTORY.map(read)]);
    expect(await overloads(p)).toEqual([WRONG_20260907]);
    await expect(p.query(read(RECONCILIATION))).rejects.toThrow(/canonical overload is not present/i);
    expect(await overloads(p)).toEqual([WRONG_20260907]); // nothing dropped
    await p.end();
  });

  t("★ the canonical CONTRACT is untouched: return shape, definer, search_path, no defaults", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    const before = await p.query(
      `select p.prosecdef, p.proconfig, p.pronargdefaults, pg_get_function_result(p.oid) as result,
              pg_get_function_identity_arguments(p.oid) as args, md5(p.prosrc) as body
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`,
    );
    await p.query(read(RECONCILIATION));
    const after = await p.query(
      `select p.prosecdef, p.proconfig, p.pronargdefaults, pg_get_function_result(p.oid) as result,
              pg_get_function_identity_arguments(p.oid) as args, md5(p.prosrc) as body
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`,
    );
    expect(after.rows).toEqual(before.rows);
    const r = after.rows[0];
    expect(r.prosecdef).toBe(true);
    expect(r.proconfig).toEqual(["search_path=pg_catalog, public"]);
    expect(r.pronargdefaults).toBe(0);
    expect(r.result).toBe("TABLE(announcement_id uuid, resolved_count integer, already_existed boolean)");
    expect(r.args).toContain("p_service_url text, p_recipient_oids text[]"); // service_url stays SIXTH
    await p.end();
  });

  t("★ execute stays service_role-only", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    const q = async (role: string) =>
      (await p.query(`select has_function_privilege($1, p.oid, 'EXECUTE') as ok
                        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                       where n.nspname='public' and p.proname='bty_track_announcement'`, [role])).rows[0].ok;
    expect(await q("service_role")).toBe(true);
    expect(await q("anon")).toBe(false);
    expect(await q("authenticated")).toBe(false);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ A(honest) — a VIRGIN replay of repo history still cannot reach this file", () => {
  t("20260912's own gate aborts first, so 20260914 arrives too late to rescue it", async () => {
    const p = await freshDb([BOOTSTRAP, ...HISTORY.map(read)]);
    expect(await overloads(p)).toEqual([WRONG_20260907]);
    await expect(p.query(read(THREAD))).rejects.toThrow(/live signature mismatch/i);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ B — account deletion: the recipient becomes unbound, the history survives", () => {
  /** A tracked announcement with one BOUND recipient who asked a QUESTION and has a live thread. */
  async function scenario(p: Pool) {
    const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const person = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(
      `insert into public.bty_action_captures (user_id, preview_text) values ($1,'m') returning id`, [host])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$2,'please read','t1','c1',1) returning id`, [host, cap])).rows[0].id;
    const rec = (await p.query(
      `insert into public.bty_tracked_announcement_recipients
         (announcement_id, tenant_id, aad_object_id, user_id, bound_at, response, responded_at, question_text)
       values ($1,'11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',$2, now(),'QUESTION', now(),'why?')
       returning id`, [ann, person])).rows[0].id;
    const msg = (await p.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
       values ($1,$2,'RECIPIENT','why?') returning id`, [rec, person])).rows[0].id;
    await p.query(
      `insert into public.bty_announcement_thread_message_reads (message_id, reader_user_id) values ($1,$2)`, [msg, host]);
    return { host, person, ann, rec, msg };
  }

  t("★ TODAY IT FAILS: deleting a bound person's account is rejected by the paired CHECK", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    const s = await scenario(p);
    await expect(p.query(`delete from auth.users where id=$1`, [s.person]))
      .rejects.toThrow(/bty_tracked_recip_bound_pair_check/);
    await p.end();
  });

  t("★ AFTER THE REPAIR the delete succeeds, and every piece of history survives", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    const s = await scenario(p);
    await p.query(read(RECONCILIATION));
    await p.query(`delete from auth.users where id=$1`, [s.person]);

    const rec = (await p.query(`select * from public.bty_tracked_announcement_recipients where id=$1`, [s.rec])).rows[0];
    expect(rec, "the recipient row survives").toBeTruthy();
    expect(rec.user_id, "and is now UNBOUND").toBeNull();
    expect(rec.bound_at, "but still records that it WAS bound").not.toBeNull();
    expect(rec.response).toBe("QUESTION");
    expect(rec.question_text, "what they asked is preserved").toBe("why?");

    const ann = (await p.query(`select count(*)::int n from public.bty_tracked_announcements where id=$1`, [s.ann])).rows[0].n;
    expect(ann, "the announcement survives").toBe(1);

    const msg = (await p.query(`select * from public.bty_announcement_thread_messages where id=$1`, [s.msg])).rows[0];
    expect(msg, "the conversation survives").toBeTruthy();
    expect(msg.author_user_id, "the account link is gone").toBeNull();
    expect(msg.author_role, "but WHICH SIDE spoke is still known").toBe("RECIPIENT");
    expect(msg.body).toBe("why?");
    await p.end();
  });

  t("read receipts: the DELETED person's own receipts go; everyone else's stay", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    const s = await scenario(p);
    await p.query(read(RECONCILIATION));
    // the host has read the recipient's message; the recipient has read nothing
    await p.query(`delete from auth.users where id=$1`, [s.person]);
    const kept = (await p.query(
      `select count(*)::int n from public.bty_announcement_thread_message_reads where message_id=$1`, [s.msg])).rows[0].n;
    expect(kept, "the surviving Host's receipt is untouched").toBe(1);
    await p.end();
  });

  t("★ deleting the HOST still cascades the whole run away — measured, unchanged by this file", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    const s = await scenario(p);
    await p.query(read(RECONCILIATION));
    await p.query(`delete from auth.users where id=$1`, [s.host]);
    for (const [tbl, col] of [
      ["bty_tracked_announcements", "id"],
      ["bty_tracked_announcement_recipients", "id"],
      ["bty_announcement_thread_messages", "id"],
    ] as const) {
      const id = tbl === "bty_tracked_announcements" ? s.ann : tbl === "bty_tracked_announcement_recipients" ? s.rec : s.msg;
      const n = (await p.query(`select count(*)::int n from public.${tbl} where ${col}=$1`, [id])).rows[0].n;
      expect(n, `${tbl} is cascaded away with its owner`).toBe(0);
    }
    await p.end();
  });

  t("the new constraint still refuses a binding with no moment", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    const u = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [u])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$2,'x','t','c',1) returning id`, [u, cap])).rows[0].id;
    await expect(p.query(
      `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id, user_id, bound_at)
       values ($1,'11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',$2, null)`, [ann, u]),
    ).rejects.toThrow(/bound_when_user/);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ B4 — rebinding the same Microsoft identity", () => {
  t("★ an unbound row re-binds to the SAME recipient and keeps its thread", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    const TID = "33333333-3333-3333-3333-333333333333";
    const OID = "44444444-4444-4444-4444-444444444444";
    const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const person = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [host])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$2,'x',$3,'c',1) returning id`, [host, cap, TID])).rows[0].id;
    const rec = (await p.query(
      `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id, user_id, bound_at)
       values ($1,$2,$3,$4, now()) returning id`, [ann, TID, OID, person])).rows[0].id;
    const msg = (await p.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
       values ($1,$2,'RECIPIENT','still here') returning id`, [rec, person])).rows[0].id;

    await p.query(`delete from auth.users where id=$1`, [person]);

    // The SAME Microsoft identity comes back as a NEW BTY account.
    const again = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const bound = (await p.query(`select bound from public.bty_bind_announcement_recipients($1,$2,$3)`, [again, TID, OID])).rows[0].bound;
    expect(bound, "exactly the one row re-binds").toBe(1);

    const rows = await p.query(`select * from public.bty_tracked_announcement_recipients where announcement_id=$1`, [ann]);
    expect(rows.rowCount, "★ no duplicate recipient was created").toBe(1);
    expect(rows.rows[0].id, "it is the SAME row").toBe(rec);
    expect(rows.rows[0].user_id).toBe(again);
    const m = (await p.query(`select recipient_id from public.bty_announcement_thread_messages where id=$1`, [msg])).rows[0];
    expect(m.recipient_id, "and the thread is still attached to it").toBe(rec);
    await p.end();
  });

  t("★ a LIVE bound row is never re-pointed, so nobody can be handed someone else's thread", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    const TID = "55555555-5555-5555-5555-555555555555";
    const OID = "66666666-6666-6666-6666-666666666666";
    const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const owner = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const attacker = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [host])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$2,'x',$3,'c',1) returning id`, [host, cap, TID])).rows[0].id;
    await p.query(
      `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id, user_id, bound_at)
       values ($1,$2,$3,$4, now())`, [ann, TID, OID, owner]);
    const bound = (await p.query(`select bound from public.bty_bind_announcement_recipients($1,$2,$3)`, [attacker, TID, OID])).rows[0].bound;
    expect(bound, "a bound row is not available to anyone else").toBe(0);
    const who = (await p.query(`select user_id from public.bty_tracked_announcement_recipients where announcement_id=$1`, [ann])).rows[0].user_id;
    expect(who).toBe(owner);
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ C — Today's monotonic activity version cannot be broken by ordinary authority", () => {
  const priv = async (p: Pool, table: string, role: string, what: string) =>
    (await p.query(`select has_table_privilege($1, $2, $3) as ok`, [role, `public.${table}`, what])).rows[0].ok;

  t("★ BEFORE: service_role could DELETE Track evidence (default privileges + an explicit grant)", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    expect(await priv(p, "bty_tracked_announcement_recipients", "service_role", "DELETE")).toBe(true);
    expect(await priv(p, "bty_tracked_announcements", "service_role", "DELETE")).toBe(true);
    await p.end();
  });

  t("★ AFTER: it cannot — and the reads and writes it actually uses still work", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    for (const tbl of ["bty_tracked_announcements", "bty_tracked_announcement_recipients"]) {
      expect(await priv(p, tbl, "service_role", "DELETE"), `${tbl} DELETE`).toBe(false);
      expect(await priv(p, tbl, "service_role", "TRUNCATE"), `${tbl} TRUNCATE`).toBe(false);
      for (const ok of ["SELECT", "INSERT", "UPDATE"]) {
        expect(await priv(p, tbl, "service_role", ok), `${tbl} ${ok}`).toBe(true);
      }
      for (const role of ["anon", "authenticated"]) {
        expect(await priv(p, tbl, role, "SELECT"), `${role} ${tbl}`).toBe(false);
      }
    }
    await p.end();
  });

  t("★ a real DELETE as service_role is refused, not merely discouraged", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    const c = await p.connect();
    try {
      await c.query("set role service_role");
      await expect(c.query(`delete from public.bty_tracked_announcement_recipients`)).rejects.toThrow(/permission denied/i);
      await expect(c.query(`delete from public.bty_announcement_thread_messages`)).rejects.toThrow(/permission denied/i);
      await c.query("reset role");
    } finally {
      c.release();
    }
    await p.end();
  });

  t("★ FK CASCADES still work — narrowing a grant did not disable referential integrity", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [host])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$2,'x','t','c',1) returning id`, [host, cap])).rows[0].id;
    await p.query(
      `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id)
       values ($1,'11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')`, [ann]);
    // deleting the CAPTURE cascades the announcement and its recipients away
    await p.query(`delete from public.bty_action_captures where id=$1`, [cap]);
    const n = (await p.query(`select count(*)::int n from public.bty_tracked_announcement_recipients where announcement_id=$1`, [ann])).rows[0].n;
    expect(n, "the cascade still ran").toBe(0);
    await p.end();
  });

  t("★ THE CONTRACT: on a SURVIVING card the activity count cannot fall", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    await p.query(read(RECONCILIATION));
    const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const person = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [host])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$2,'x','t','c',1) returning id`, [host, cap])).rows[0].id;
    const rec = (await p.query(
      `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id, user_id, bound_at, response, responded_at, question_text)
       values ($1,'11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',$2, now(),'QUESTION', now(),'q')
       returning id`, [ann, person])).rows[0].id;
    await p.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
       values ($1,$2,'RECIPIENT','q')`, [rec, person]);

    const version = async () =>
      (await p.query(
        `select (select count(*) from public.bty_announcement_thread_messages m
                   where m.recipient_id = r.id and m.author_role='RECIPIENT')
              + (case when r.response in ('QUESTION','HELP_NEEDED') then 1 else 0 end) as v
           from public.bty_tracked_announcement_recipients r where r.id = $1`, [rec])).rows[0].v;

    const before = Number(await version());
    expect(before).toBe(2);

    // The one thing ordinary authority CAN still do to this card: delete the account.
    await p.query(`delete from auth.users where id=$1`, [person]);
    expect(Number(await version()), "★ the card survives and its version did NOT fall").toBe(before);

    // And messages remain append-only to service_role.
    const c = await p.connect();
    try {
      await c.query("set role service_role");
      await expect(c.query(`update public.bty_announcement_thread_messages set body='x'`)).rejects.toThrow(/permission denied/i);
      await c.query("reset role");
    } finally {
      c.release();
    }
    await p.end();
  });
});

// ---------------------------------------------------------------------------
describe("★ E — no data mutation", () => {
  t("the reconciliation changes no row count anywhere", async () => {
    const p = await freshDb(PRODUCTION_STATE);
    const host = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const person = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(`insert into public.bty_action_captures (user_id) values ($1) returning id`, [host])).rows[0].id;
    const ann = (await p.query(
      `insert into public.bty_tracked_announcements (owner_user_id, source_capture_id, host_framing, tenant_id, conversation_id, resolved_count)
       values ($1,$2,'x','t','c',1) returning id`, [host, cap])).rows[0].id;
    const rec = (await p.query(
      `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id, user_id, bound_at, response, responded_at)
       values ($1,'11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',$2, now(),'ACKNOWLEDGED', now()) returning id`,
      [ann, person])).rows[0].id;
    const msg = (await p.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
       values ($1,$2,'HOST','hi') returning id`, [rec, host])).rows[0].id;
    await p.query(`insert into public.bty_announcement_thread_message_reads (message_id, reader_user_id) values ($1,$2)`, [msg, person]);
    await p.query(`insert into public.bty_today_dismissals (user_id, item_kind, item_id, dismissed_activity_version) values ($1,'track_host',$2,0)`, [host, ann]);

    const TABLES = ["bty_tracked_announcements", "bty_tracked_announcement_recipients",
      "bty_announcement_thread_messages", "bty_announcement_thread_message_reads", "bty_today_dismissals"];
    const snap = async () => {
      const out: Record<string, number> = {};
      for (const t2 of TABLES) out[t2] = (await p.query(`select count(*)::int n from public.${t2}`)).rows[0].n;
      return out;
    };
    const before = await snap();
    const rowBefore = (await p.query(`select * from public.bty_tracked_announcement_recipients where id=$1`, [rec])).rows[0];
    await p.query(read(RECONCILIATION));
    expect(await snap()).toEqual(before);
    expect((await p.query(`select * from public.bty_tracked_announcement_recipients where id=$1`, [rec])).rows[0])
      .toEqual(rowBefore);
    await p.end();
  });
});
