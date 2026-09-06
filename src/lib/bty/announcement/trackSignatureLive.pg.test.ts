import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `bty_track_announcement` — PROVEN AGAINST THE **LIVE** SIGNATURE, NOT THE REPO'S.
 *
 * ★ THE CLASS OF BUG THIS EXISTS TO CATCH, AND WHY EVERY OTHER TEST MISSED IT.
 *
 * `create or replace function` matches on the IDENTITY ARGUMENT LIST. Change one parameter's
 * POSITION and PostgreSQL does not replace anything — it creates a SECOND OVERLOAD. Both overloads
 * then accept the same NAMED arguments PostgREST sends, so the next Track call is ambiguous and
 * fails in production.
 *
 * Repo migration 20260907 declares  (..., p_recipient_oids text[], p_service_url text default null)
 * PRODUCTION actually carries       (..., p_service_url text, p_recipient_oids text[])
 *
 * The repository's migration history and the live database have DIVERGED. `threadPostgres.pg.test.ts`
 * builds its schema from the migration FILES, so it faithfully reproduces the repo's history and is
 * structurally incapable of seeing this. This file therefore builds the **production** shape first,
 * then applies 20260912 on top — which is the only arrangement in which the real deployment is
 * being tested.
 *
 * Run: BTY_PG_TEST_URL="postgresql://postgres@/db?host=/tmp/pg&port=55433" npx vitest run <this file>
 */

const URL = process.env.BTY_PG_TEST_URL ?? "";
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(MIGRATIONS, f), "utf8");

/** The exact identity PRODUCTION reports for this function. */
const LIVE_IDENTITY = "uuid, uuid, text, text, text, text, text[]";
/** What the repo's own history would have produced — the wrong one. */
const REPO_IDENTITY = "uuid, uuid, text, text, text, text[], text";

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
 * PRODUCTION'S function, in production's parameter order.
 *
 * The BODY here is deliberately minimal — this stands in for whatever production actually runs, and
 * what is under test is the SIGNATURE it presents and whether 20260912 replaces or duplicates it.
 * 20260912 overwrites this body entirely on a successful apply.
 */
const LIVE_TRACK_FN = `
create or replace function public.bty_track_announcement(
  p_owner_user_id uuid,
  p_source_capture_id uuid,
  p_host_framing text,
  p_tenant_id text,
  p_conversation_id text,
  p_service_url text,
  p_recipient_oids text[]
)
returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
begin
  return query select null::uuid, 0, false;
end;
$fn$;
revoke all on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) to service_role;
`;

/** Everything before 20260912 — but WITHOUT the repo's wrong-order track function. */
async function buildProductionShape(c: Client) {
  await c.query(BOOTSTRAP);
  await c.query(read("20260902000000_bty_tracked_announcements_v1.sql"));
  await c.query(read("20260906000000_bty_announcement_recipient_handled_v1.sql"));
  await c.query(read("20260907000000_bty_announcement_service_url_v1.sql"));
  // 20260907 just created the REPO-ordered function. Production does not have that one — it has
  // the other order. Drop the repo artefact and install production's, reproducing the divergence.
  await c.query(`drop function if exists public.bty_track_announcement(${REPO_IDENTITY});`);
  await c.query(LIVE_TRACK_FN);
  await c.query(read("20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql"));
}

const overloads = async (c: Client): Promise<string[]> => {
  const { rows } = await c.query(
    // Argument TYPES — the identity `create or replace` actually matches on.
    // `pg_get_function_identity_arguments` would include parameter names.
    `select array_to_string(array(select format_type(t, null) from unnest(p.proargtypes) as t), ', ') as ident
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'bty_track_announcement'
      order by p.oid`,
  );
  return rows.map((r) => r.ident as string);
};

let c: Client;

beforeAll(async () => {
  if (!URL) return;
  c = new Client({ connectionString: URL });
  await c.connect();
  await c.query("drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;");
  await buildProductionShape(c);
}, 60_000);

afterAll(async () => {
  await c?.end();
});

const pg = describe.runIf(!!URL);

pg("★ A — the production shape is what we start from", () => {
  it("exactly one overload, in PRODUCTION's order, before 20260912", async () => {
    expect(await overloads(c)).toEqual([LIVE_IDENTITY]);
  });

  it("★ and it is NOT the order the repo's own migration history produces", () => {
    const repo = read("20260907000000_bty_announcement_service_url_v1.sql");
    expect(repo).toContain("p_recipient_oids text[],\n  p_service_url text default null");
    expect(LIVE_IDENTITY).not.toBe(REPO_IDENTITY);
  });
});

pg("★ B — 20260912 REPLACES the live function; it does not add an overload", () => {
  it("applies cleanly onto the production shape", async () => {
    await c.query(read("20260912000000_bty_announcement_thread_v1.sql"));
  });

  it("★ 1+2 — still exactly ONE overload, with the live identity arguments", async () => {
    const got = await overloads(c);
    expect(got).toHaveLength(1);
    expect(got[0]).toBe(LIVE_IDENTITY);
  });

  it("★ 12 — no second PostgREST-callable shape exists to be ambiguous between", async () => {
    // Ambiguity is exactly "more than one candidate accepting the same named arguments".
    const { rows } = await c.query(
      `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`,
    );
    expect(rows[0].n).toBe(1);
  });

  it("★ 3 — the return shape is unchanged", async () => {
    const { rows } = await c.query(
      `select pg_get_function_result(p.oid) as res
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`,
    );
    expect(rows[0].res).toBe("TABLE(announcement_id uuid, resolved_count integer, already_existed boolean)");
  });

  it("★ 4+5 — SECURITY DEFINER and search_path are unchanged", async () => {
    const { rows } = await c.query(
      `select p.prosecdef, p.proconfig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`,
    );
    expect(rows[0].prosecdef).toBe(true);
    expect(rows[0].proconfig).toEqual(["search_path=pg_catalog, public"]);
  });

  it("★ 6+7 — service_role may execute; anon and authenticated may not", async () => {
    const { rows } = await c.query(
      `select has_function_privilege('service_role', p.oid, 'EXECUTE') as svc,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`,
    );
    expect(rows[0].svc).toBe(true);
    expect(rows[0].anon).toBe(false);
    expect(rows[0].auth).toBe(false);
  });

  it("★ p_service_url carries NO default — the live arity is preserved exactly", async () => {
    const { rows } = await c.query(
      `select p.pronargdefaults as ndefaults
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='bty_track_announcement'`,
    );
    // A default on p_service_url would make (uuid,uuid,text,text,text,text) callable too — a second
    // PostgREST-visible shape, which is the thing being prevented.
    expect(rows[0].ndefaults).toBe(0);
  });
});

/* ─────────── behaviour, called the way PostgREST calls it: by NAME ─────────── */

pg("★ C — behaviour through the replaced function, called by NAMED arguments", () => {
  const OWNER_OID = "aaaaaaaa-0000-0000-0000-00000000aaaa";
  const OTHER_OID = "bbbbbbbb-0000-0000-0000-00000000bbbb";

  async function host(oid: string | null) {
    const [{ id: user }] = (await c.query("insert into auth.users default values returning id")).rows;
    if (oid) {
      await c.query(
        `insert into auth.identities (user_id, provider, identity_data)
         values ($1,'azure', jsonb_build_object('custom_claims', jsonb_build_object('tid','t1','oid',$2::text)))`,
        [user, oid],
      );
    }
    const [{ id: cap }] = (
      await c.query("insert into public.bty_action_captures (user_id) values ($1) returning id", [user])
    ).rows;
    return { user, cap };
  }

  /** NAMED arguments, in a DELIBERATELY SHUFFLED order — exactly how PostgREST resolves a call. */
  const trackByName = (owner: string, cap: string, oids: string[], serviceUrl: string | null = null) =>
    c.query(
      `select * from public.bty_track_announcement(
         p_recipient_oids := $3,
         p_service_url := $4,
         p_owner_user_id := $1,
         p_host_framing := 'framing',
         p_source_capture_id := $2,
         p_conversation_id := 'c1',
         p_tenant_id := 't1')`,
      [owner, cap, oids, serviceUrl],
    );

  it("★ 9 — an ordinary Track works, resolved by name with no ambiguity", async () => {
    const { user, cap } = await host(OWNER_OID);
    const r = await trackByName(user, cap, [OTHER_OID]);
    expect(r.rows[0].resolved_count).toBe(1);
    expect(r.rows[0].already_existed).toBe(false);
    expect(r.rows[0].announcement_id).toBeTruthy();
  });

  it("★ 8 — the self-recipient exclusion still works", async () => {
    const { user, cap } = await host(OWNER_OID);
    const r = await trackByName(user, cap, [OWNER_OID, OTHER_OID]);
    expect(r.rows[0].resolved_count).toBe(1);
    const oids = await c.query(
      "select aad_object_id from public.bty_tracked_announcement_recipients where announcement_id=$1",
      [r.rows[0].announcement_id],
    );
    expect(oids.rows.map((x) => x.aad_object_id)).toEqual([OTHER_OID]);
  });

  it("★ 8 — a Host who picked only themselves is refused, fail closed", async () => {
    const { user, cap } = await host(OWNER_OID);
    await expect(trackByName(user, cap, [OWNER_OID])).rejects.toThrow(/zero_recipients/);
  });

  it("★ 10 — service_url is stored from its NEW position, and validated exactly as before", async () => {
    const a = await host(OWNER_OID);
    await trackByName(a.user, a.cap, [OTHER_OID], "https://smba.example.net/amer/");
    const okRow = await c.query(
      "select service_url from public.bty_tracked_announcements where owner_user_id=$1",
      [a.user],
    );
    expect(okRow.rows[0].service_url).toBe("https://smba.example.net/amer/");

    // A non-https value is still nulled rather than refusing the Track.
    const b = await host(OWNER_OID);
    await trackByName(b.user, b.cap, [OTHER_OID], "ftp://nope/");
    const badRow = await c.query(
      "select service_url from public.bty_tracked_announcements where owner_user_id=$1",
      [b.user],
    );
    expect(badRow.rows[0].service_url).toBeNull();

    // Empty string still normalises to NULL.
    const d = await host(OWNER_OID);
    await trackByName(d.user, d.cap, [OTHER_OID], "");
    const emptyRow = await c.query(
      "select service_url from public.bty_tracked_announcements where owner_user_id=$1",
      [d.user],
    );
    expect(emptyRow.rows[0].service_url).toBeNull();
  });

  it("★ 11 — the idempotent re-Track still returns the existing run and does NOT re-point service_url", async () => {
    const { user, cap } = await host(OWNER_OID);
    const first = await trackByName(user, cap, [OTHER_OID], "https://smba.example.net/amer/");
    const again = await trackByName(user, cap, [OTHER_OID], "https://smba.example.net/emea/");
    expect(again.rows[0].already_existed).toBe(true);
    expect(again.rows[0].announcement_id).toBe(first.rows[0].announcement_id);
    const row = await c.query("select service_url from public.bty_tracked_announcements where id=$1", [
      first.rows[0].announcement_id,
    ]);
    expect(row.rows[0].service_url, "a repeat Track must not move a coordinate").toBe(
      "https://smba.example.net/amer/",
    );
  });

  it("dedupe, GUID validation and the denominator are all unchanged", async () => {
    const { user, cap } = await host(OWNER_OID);
    const r = await trackByName(user, cap, [OTHER_OID, OTHER_OID.toUpperCase(), "not-a-guid", ""]);
    expect(r.rows[0].resolved_count).toBe(1);
    const n = await c.query(
      "select count(*)::int as n from public.bty_tracked_announcement_recipients where announcement_id=$1",
      [r.rows[0].announcement_id],
    );
    expect(n.rows[0].n, "the denominator is the row count that committed").toBe(1);
  });

  it("a Host with no Microsoft identity is unaffected", async () => {
    const { user, cap } = await host(null);
    const r = await trackByName(user, cap, [OWNER_OID, OTHER_OID]);
    expect(r.rows[0].resolved_count).toBe(2);
  });
});

/* ─────────── the gate itself: it must REFUSE, and change nothing ─────────── */

pg("★ D — the fail-closed gate refuses rather than creating an overload", () => {
  /** A throwaway database whose track function is the REPO order, i.e. the divergent case. */
  async function withRepoShape<T>(fn: (c2: Client) => Promise<T>): Promise<T> {
    const admin = new Client({ connectionString: URL });
    await admin.connect();
    await admin.query("drop database if exists btygate");
    await admin.query("create database btygate");
    await admin.end();

    const c2 = new Client({ connectionString: URL.replace(/\/[^/?]+\?/, "/btygate?") });
    await c2.connect();
    try {
      await c2.query(BOOTSTRAP);
      await c2.query(read("20260902000000_bty_tracked_announcements_v1.sql"));
      await c2.query(read("20260906000000_bty_announcement_recipient_handled_v1.sql"));
      // 20260907 leaves the REPO-ordered function in place. No drop, no live-shape install.
      await c2.query(read("20260907000000_bty_announcement_service_url_v1.sql"));
      await c2.query(read("20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql"));
      return await fn(c2);
    } finally {
      await c2.end();
    }
  }

  it("★ applying 20260912 against the WRONG live signature RAISES, and creates no second overload", async () => {
    await withRepoShape(async (c2) => {
      expect(await overloads(c2)).toEqual([REPO_IDENTITY]);

      await expect(c2.query(read("20260912000000_bty_announcement_thread_v1.sql"))).rejects.toThrow(
        /live signature mismatch/i,
      );

      // ★ THE POINT. Without the gate this would now be TWO overloads and Track would be ambiguous.
      expect(await overloads(c2), "no overload may be added, and none dropped").toEqual([REPO_IDENTITY]);
    });
  }, 60_000);

  it("★ the refusal names what it found, so a person can reconcile rather than guess", async () => {
    await withRepoShape(async (c2) => {
      let msg = "";
      let detail = "";
      let hint = "";
      try {
        await c2.query(read("20260912000000_bty_announcement_thread_v1.sql"));
      } catch (e) {
        const err = e as { message?: string; detail?: string; hint?: string };
        msg = err.message ?? "";
        detail = err.detail ?? "";
        hint = err.hint ?? "";
      }
      expect(msg).toMatch(/refusing to create a second overload/i);
      expect(detail).toContain(LIVE_IDENTITY);
      expect(detail).toContain(REPO_IDENTITY);
      expect(hint).toMatch(/do NOT drop an overload blindly/i);
    }, );
  }, 60_000);

  it("★ the gate is RE-ENTRANT — a second apply onto the correct shape still passes", async () => {
    await c.query(read("20260912000000_bty_announcement_thread_v1.sql"));
    expect(await overloads(c)).toEqual([LIVE_IDENTITY]);
  });
});
