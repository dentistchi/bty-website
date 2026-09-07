import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ★ HIDING A FINISHED TRAINING FROM MY HISTORY MUST NOT TOUCH ANYBODY ELSE'S.
 *
 * A closed session is SHARED — it has participants and their progress. So personal cleanup lives in
 * its own table with no way to reach what it hides, and these tests hold that against real
 * PostgreSQL: the session survives, the participants survive, another Host's view is unaffected,
 * and there is no DELETE anywhere in the path.
 *
 * Run: BTY_PG_TEST_URL="postgresql://postgres@/postgres?host=/tmp/pg&port=55433" npx vitest run <this file>
 */

const URL = process.env.BTY_PG_TEST_URL ?? "";
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(MIGRATIONS, f), "utf8");
const DISMISSAL = "20260917000000_bty_foundry_event_history_dismissal_v1.sql";

const BOOTSTRAP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
-- The two shared tables this must never touch, in their real shape.
create table if not exists public.foundry_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint foundry_events_status_check check (status in ('open','closed'))
);
create table if not exists public.foundry_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events(id) on delete cascade,
  display_name text not null,
  status text not null default 'joined'
);
`;

let admin: Pool;
let reachable = false;
let n = 0;

async function db(extra: string[] = []): Promise<Pool> {
  const name = `fhd_${Date.now().toString(36)}_${n++}`;
  await admin.query(`create database ${name}`);
  const p = new Pool({ connectionString: URL.replace("/postgres?", `/${name}?`), max: 4 });
  const c = await p.connect();
  try { for (const s of [BOOTSTRAP, ...extra]) await c.query(s); } finally { c.release(); }
  return p;
}
const applied = () => db([read(DISMISSAL)]);

async function session(p: Pool, status: "open" | "closed" = "closed") {
  const owner = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
  const ev = (await p.query(
    `insert into public.foundry_events (owner_user_id, title, status, closed_at)
     values ($1,'Consent conversation',$2, case when $2='closed' then now() else null end) returning id`,
    [owner, status])).rows[0].id;
  await p.query(`insert into public.foundry_event_participants (event_id, display_name) values ($1,'Ana'),($1,'Bo')`, [ev]);
  return { owner, ev };
}

/** The service's write, as SQL: owner + closed checked first, then an idempotent insert. */
async function dismiss(p: Pool, user: string, ev: string): Promise<"changed" | "already" | "not_found" | "not_closed"> {
  const own = await p.query(`select status from public.foundry_events where id=$1 and owner_user_id=$2`, [ev, user]);
  if (own.rowCount === 0) return "not_found";
  if (own.rows[0].status !== "closed") return "not_closed";
  try {
    await p.query(`insert into public.bty_foundry_event_history_dismissals (user_id, event_id) values ($1,$2)`, [user, ev]);
    return "changed";
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return "already";
    throw e;
  }
}
const visibleHistory = async (p: Pool, user: string) =>
  (await p.query(
    `select e.id from public.foundry_events e
      where e.owner_user_id=$1 and e.status='closed'
        and not exists (select 1 from public.bty_foundry_event_history_dismissals d
                         where d.user_id=$1 and d.event_id=e.id)
      order by e.closed_at desc`, [user])).rows.map((r) => r.id);

beforeAll(async () => {
  if (!URL) return;
  try { admin = new Pool({ connectionString: URL, max: 4 }); await admin.query("select 1"); reachable = true; }
  catch { reachable = false; }
});
afterAll(async () => { await admin?.end().catch(() => {}); });
const t = (name: string, fn: () => Promise<void>) =>
  it(name, async () => { if (!reachable) return; await fn(); });

describe("★ the migration is additive and narrow", () => {
  t("it creates ONE table, touches no existing row, and grants no DELETE", async () => {
    const p = await db();
    const s = await session(p);
    const before = (await p.query(`select * from public.foundry_events where id=$1`, [s.ev])).rows[0];
    const parts = (await p.query(`select count(*)::int n from public.foundry_event_participants`)).rows[0].n;

    await p.query(read(DISMISSAL));

    const after = (await p.query(`select * from public.foundry_events where id=$1`, [s.ev])).rows[0];
    for (const k of Object.keys(before)) expect(after[k], k).toEqual(before[k]);
    expect((await p.query(`select count(*)::int n from public.foundry_event_participants`)).rows[0].n).toBe(parts);

    const priv = async (what: string) =>
      (await p.query(`select has_table_privilege('service_role','public.bty_foundry_event_history_dismissals',$1) ok`, [what])).rows[0].ok;
    expect(await priv("SELECT")).toBe(true);
    expect(await priv("INSERT")).toBe(true);
    expect(await priv("UPDATE"), "★ nothing to update — the row IS the fact").toBe(false);
    expect(await priv("DELETE"), "★ no Restore in V1, so no DELETE lying around").toBe(false);
    expect(await priv("TRUNCATE")).toBe(false);
    for (const role of ["anon", "authenticated"]) {
      expect((await p.query(`select has_table_privilege($1,'public.bty_foundry_event_history_dismissals','SELECT') ok`, [role])).rows[0].ok, role).toBe(false);
    }
    await p.end();
  });

  t("re-entrant, and RLS is on", async () => {
    const p = await applied();
    await p.query(read(DISMISSAL));
    await p.query(read(DISMISSAL));
    expect((await p.query(
      `select relrowsecurity from pg_class where oid='public.bty_foundry_event_history_dismissals'::regclass`)).rows[0].relrowsecurity).toBe(true);
    await p.end();
  });

  t("★ it does NOT reuse bty_today_dismissals — separate table, separate contract", async () => {
    /*
      Asserted on STATEMENTS, not on the word. The file deliberately NAMES that table inside a
      column comment, to record why its contract was not borrowed — a guard that fired on the
      explanation would be objecting to the reasoning it exists to protect.
    */
    const sql = read(DISMISSAL)
      .replace(/^\s*--.*$/gm, "")
      .replace(/'(?:[^']|'')*'/g, "''"); // strip SQL string literals (the comments live there)
    for (const stmt of [/from\s+public\.bty_today_dismissals/i, /into\s+public\.bty_today_dismissals/i,
                        /update\s+public\.bty_today_dismissals/i, /alter\s+table\s+public\.bty_today_dismissals/i]) {
      expect(sql, String(stmt)).not.toMatch(stmt);
    }
    // and it declares no activity-version column of its own
    expect(sql).not.toMatch(/activity_version/);
    expect(sql, "the only columns it creates").toMatch(/user_id uuid[\s\S]*event_id uuid[\s\S]*dismissed_at timestamptz/);
  });
});

describe("★ 10-21 — Remove hides, and hides only", () => {
  t("★ 12-15. a closed session leaves MY history; the session and participants survive", async () => {
    const p = await applied();
    const s = await session(p, "closed");
    expect(await visibleHistory(p, s.owner)).toEqual([s.ev]);

    expect(await dismiss(p, s.owner, s.ev)).toBe("changed");

    expect(await visibleHistory(p, s.owner), "★ 18. gone from my history").toEqual([]);
    const ev = (await p.query(`select * from public.foundry_events where id=$1`, [s.ev])).rows[0];
    expect(ev, "★ 13. the session row survives").toBeTruthy();
    expect(ev.status, "and its status is NOT mutated").toBe("closed");
    expect((await p.query(`select count(*)::int n from public.foundry_event_participants where event_id=$1`, [s.ev])).rows[0].n,
      "★ 14. participants survive").toBe(2);
    await p.end();
  });

  t("★ 11. an OPEN session cannot be removed", async () => {
    const p = await applied();
    const s = await session(p, "open");
    expect(await dismiss(p, s.owner, s.ev)).toBe("not_closed");
    expect((await p.query(`select count(*)::int n from public.bty_foundry_event_history_dismissals`)).rows[0].n).toBe(0);
    await p.end();
  });

  t("★ 17. a duplicate Remove is idempotent and writes no second row", async () => {
    const p = await applied();
    const s = await session(p);
    expect(await dismiss(p, s.owner, s.ev)).toBe("changed");
    expect(await dismiss(p, s.owner, s.ev)).toBe("already");
    expect((await p.query(`select count(*)::int n from public.bty_foundry_event_history_dismissals`)).rows[0].n).toBe(1);
    await p.end();
  });

  t("★ 16+20. a stranger cannot dismiss, and another Host's history is untouched", async () => {
    const p = await applied();
    const mine = await session(p);
    const theirs = await session(p);
    const stranger = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;

    expect(await dismiss(p, stranger, mine.ev), "not theirs ⇒ indistinguishable from absent").toBe("not_found");
    expect(await dismiss(p, theirs.owner, mine.ev), "another Host cannot reach my session").toBe("not_found");

    await dismiss(p, mine.ev === theirs.ev ? theirs.owner : mine.owner, mine.ev);
    expect(await visibleHistory(p, mine.owner)).toEqual([]);
    expect(await visibleHistory(p, theirs.owner), "★ their history is exactly as it was").toEqual([theirs.ev]);
    await p.end();
  });

  t("★ 8. no resurface: it stays hidden with nothing to bring it back", async () => {
    const p = await applied();
    const s = await session(p);
    await dismiss(p, s.owner, s.ev);
    // Nothing can happen on a closed session; even adding a participant row does not un-hide it.
    await p.query(`insert into public.foundry_event_participants (event_id, display_name) values ($1,'Late')`, [s.ev]);
    expect(await visibleHistory(p, s.owner)).toEqual([]);
    await p.end();
  });

  t("★ 21. it writes NOTHING outside its own table", async () => {
    const p = await applied();
    const s = await session(p);
    const evBefore = (await p.query(`select * from public.foundry_events where id=$1`, [s.ev])).rows[0];
    const pBefore = (await p.query(`select * from public.foundry_event_participants where event_id=$1 order by display_name`, [s.ev])).rows;
    await dismiss(p, s.owner, s.ev);
    expect((await p.query(`select * from public.foundry_events where id=$1`, [s.ev])).rows[0]).toEqual(evBefore);
    expect((await p.query(`select * from public.foundry_event_participants where event_id=$1 order by display_name`, [s.ev])).rows).toEqual(pBefore);
    await p.end();
  });

  t("deleting the session takes its dismissals with it — a hide for nothing is noise", async () => {
    const p = await applied();
    const s = await session(p);
    await dismiss(p, s.owner, s.ev);
    await p.query(`delete from public.foundry_events where id=$1`, [s.ev]);
    expect((await p.query(`select count(*)::int n from public.bty_foundry_event_history_dismissals`)).rows[0].n).toBe(0);
    await p.end();
  });
});
