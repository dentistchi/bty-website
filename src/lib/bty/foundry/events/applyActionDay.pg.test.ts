/**
 * APPLY ACTION DAY V1 — the migration against real PostgreSQL (localhost only).
 * Run with BTY_PG_TEST_URL=postgresql://postgres@127.0.0.1:<port>/postgres
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.BTY_PG_TEST_URL ?? "";
const read = (f: string) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");
const WINDOWS = "20260823000000_foundry_participant_apply_windows_v1.sql";
const ACTION_DAY = "20260929000000_foundry_apply_action_day_v1.sql";
const name = `apply_action_day_${process.pid}`;
let root: Pool; let db: Pool;

const PREREQ = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.foundry_events (id uuid primary key default gen_random_uuid());
create table public.foundry_event_training_progress (id uuid primary key default gen_random_uuid());
create table public.foundry_event_assignments (id uuid primary key default gen_random_uuid());`;

const OLD_ARGS = "p_event_id=>$1,p_progress_id=>$2,p_assignment_id=>null,p_organization_id=>null,p_user_id_snapshot=>$3,p_source_training_title=>'T',p_apply_days=>7,p_completed_at=>now(),p_timezone_snapshot=>'America/Los_Angeles',p_completion_bty_day=>$4::date,p_due_bty_day=>$5::date,p_due_at=>now()";

async function fixture() {
  const ev = (await db.query("insert into public.foundry_events default values returning id")).rows[0].id;
  const pr = (await db.query("insert into public.foundry_event_training_progress default values returning id")).rows[0].id;
  return { ev, pr, user: (await db.query("select gen_random_uuid() id")).rows[0].id };
}
const materialize = (f: { ev: string; pr: string; user: string }, action: string | null, c = "2026-09-24", d = "2026-10-01") =>
  db.query(`select result from public.bty_foundry_materialize_apply_window(${OLD_ARGS}${action === undefined ? "" : ",p_action_bty_day=>$6::date"})`, [f.ev, f.pr, f.user, c, d, action]);
const snapshot = async () =>
  (await db.query("select to_jsonb(w) - 'action_bty_day' j from public.foundry_participant_apply_windows w order by id")).rows.map((r) => r.j);

describe.runIf(!!URL)("APPLY ACTION DAY V1 migration (real PostgreSQL)", () => {
  let legacyBefore: unknown[] = [];
  beforeAll(async () => {
    const url = new globalThis.URL(URL);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local PostgreSQL only");
    root = new Pool({ connectionString: URL });
    await root.query(`create database ${name}`);
    url.pathname = `/${name}`;
    db = new Pool({ connectionString: url.toString(), max: 4 });
    await db.query(PREREQ);
    await db.query(read(WINDOWS));
    // Legacy rows created by the PRE-V1 twelve-argument RPC.
    for (const [c, d] of [["2026-09-21", "2026-09-28"], ["2026-09-22", "2026-09-29"], ["2026-09-23", "2026-09-30"]]) {
      const f = await fixture();
      await db.query(`select * from public.bty_foundry_materialize_apply_window(${OLD_ARGS})`, [f.ev, f.pr, f.user, c, d]);
    }
    legacyBefore = await snapshot();
    await db.query(read(ACTION_DAY));
    await db.query(read(ACTION_DAY)); // 18. re-runnable
  }, 60000);
  afterAll(async () => { await db?.end(); if (root) { await root.query(`drop database ${name}`); await root.end(); } });

  it("16/17. existing rows: action_bty_day NULL, every other column byte-identical", async () => {
    expect((await snapshot()).slice(0, 3)).toEqual(legacyBefore);
    expect(legacyBefore).toHaveLength(3);
    expect(Number((await db.query("select count(*) n from public.foundry_participant_apply_windows where action_bty_day is not null")).rows[0].n)).toBe(0);
  });

  it("stores a valid chosen day atomically with the window", async () => {
    const f = await fixture();
    expect((await materialize(f, "2026-09-25")).rows[0].result).toBe("created");
    expect((await db.query("select action_bty_day::text d from public.foundry_participant_apply_windows where progress_id=$1", [f.pr])).rows[0].d).toBe("2026-09-25");
  });

  it("5/6. before completion, the due day and after are refused by the RPC — and nothing is written", async () => {
    for (const bad of ["2026-09-23", "2026-10-01", "2026-10-02"]) {
      const f = await fixture();
      await expect(materialize(f, bad)).rejects.toThrow(/invalid_action_day/);
      expect(Number((await db.query("select count(*) n from public.foundry_participant_apply_windows where progress_id=$1", [f.pr])).rows[0].n)).toBe(0);
    }
  });

  it("the table CHECK refuses an out-of-window day even outside the RPC", async () => {
    const f = await fixture();
    await materialize(f, null);
    await expect(db.query("update public.foundry_participant_apply_windows set action_bty_day='2026-10-01' where progress_id=$1", [f.pr])).rejects.toThrow(/foundry_apply_window_action_day_check/);
  });

  it("idempotent: a repeat materialize is 'exists' and never rewrites the stored day", async () => {
    const f = await fixture();
    await materialize(f, "2026-09-25");
    expect((await materialize(f, "2026-09-28")).rows[0].result).toBe("exists");
    expect((await db.query("select action_bty_day::text d from public.foundry_participant_apply_windows where progress_id=$1", [f.pr])).rows[0].d).toBe("2026-09-25");
  });

  it("a PRE-V1 caller (twelve named arguments) still resolves to the one function, storing NULL", async () => {
    const f = await fixture();
    expect((await db.query(`select result from public.bty_foundry_materialize_apply_window(${OLD_ARGS})`, [f.ev, f.pr, f.user, "2026-09-24", "2026-10-01"])).rows[0].result).toBe("created");
    expect((await db.query("select action_bty_day from public.foundry_participant_apply_windows where progress_id=$1", [f.pr])).rows[0].action_bty_day).toBeNull();
  });

  it("the owner-scoped list returns action_bty_day", async () => {
    const f = await fixture();
    await materialize(f, "2026-09-26");
    const rows = (await db.query("select action_bty_day::text d from public.bty_foundry_list_my_apply_windows($1)", [f.user])).rows;
    expect(rows).toEqual([{ d: "2026-09-26" }]);
  });

  it("19/20. exactly one shape per function, SECURITY DEFINER, pinned search_path, service_role-only EXECUTE", async () => {
    const r = (await db.query(`select p.proname, count(*)::int n, bool_and(p.prosecdef) definer,
        bool_and(p.proconfig @> array['search_path=pg_catalog, public']) path,
        bool_or(has_function_privilege('anon',p.oid,'execute')) anon,
        bool_or(has_function_privilege('authenticated',p.oid,'execute')) auth,
        bool_and(has_function_privilege('service_role',p.oid,'execute')) svc
      from pg_proc p join pg_namespace s on s.oid=p.pronamespace
      where s.nspname='public' and p.proname in ('bty_foundry_materialize_apply_window','bty_foundry_list_my_apply_windows')
      group by p.proname order by p.proname`)).rows;
    expect(r).toEqual([
      { proname: "bty_foundry_list_my_apply_windows", n: 1, definer: true, path: true, anon: false, auth: false, svc: true },
      { proname: "bty_foundry_materialize_apply_window", n: 1, definer: true, path: true, anon: false, auth: false, svc: true },
    ]);
    const args = (await db.query("select pg_get_function_identity_arguments('public.bty_foundry_materialize_apply_window'::regproc) a")).rows[0].a;
    expect(args).toMatch(/p_due_at timestamp with time zone, p_action_bty_day date$/);
  });

  it("15. no row is ever deleted by the migration", async () => {
    expect(Number((await db.query("select count(*) n from public.foundry_participant_apply_windows")).rows[0].n)).toBeGreaterThanOrEqual(3);
  });
});
