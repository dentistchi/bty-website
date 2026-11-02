/**
 * Explicit disposable PostgreSQL verification. No dotenv, app client, auth/session
 * API or Supabase endpoint is imported. --postgres accepts only literal loopback
 * port55473/database bty_healing_atomic_qa and refuses any preexisting app tables.
 * --pglite is one in-memory SQL session, never native concurrency evidence.
 *
 * Frozen oracle from old API/domain contracts and the parent's no-backfill rule:
 * ordered act1/2/3; duplicates remain409; exactly28 distinct train days; final act
 * +milestone atomic; ritual milestone+optionalStarter row atomic; healthy ritual
 * replay returns frozen stored values; historical partial state requires review.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";

type Row = Record<string, any>;
type Connection = { query(sql: string, args?: unknown[]): Promise<{ rows: Row[] }>; end(): Promise<void> };
type Driver = { kind: "native-postgresql" | "pglite-single-session"; connect(): Promise<Connection>; close(): Promise<void> };
const DB = "bty_healing_atomic_qa";
const ACT = "select public.bty_complete_healing_awakening_act($1::uuid,$2::integer) as result";
const RITUAL = "select public.bty_complete_second_awakening($1::uuid,$2::text) as result";
const POLICY = "healing-completion/v1";
const REVIEW = "HEALING_COMPLETION_REVIEW_REQUIRED";
const OLD = "2001-01-01T00:00:00Z";
const TABLES = ["public.user_healing_awakening_acts", "public.user_healing_milestones", "public.user_advanced_unlocks", "public.train_day_completions", "auth.users"];

export function validateHealingLocalTarget(value: string | undefined): URL {
  assert(value, "HEALING_ATOMIC_TEST_DATABASE_URL is required; no application URL fallback");
  const u = new URL(value);
  assert(["postgres:", "postgresql:"].includes(u.protocol));
  assert(["127.0.0.1", "[::1]"].includes(u.hostname), "Only literal loopback targets are accepted");
  assert.equal(u.port, "55473"); assert.equal(u.pathname, `/${DB}`);
  assert.equal(u.search, ""); assert.equal(u.hash, "");
  return u;
}
export function validateHealingServer(s: { db: string; host: string; port: number }, options: { containerService?: boolean; githubActions?: boolean } = {}) {
  const context = `connectedServer=${JSON.stringify(s)}`;
  assert.equal(s.db, DB, context); assert.equal(s.port, 55473, context);
  if (["127.0.0.1", "::1"].includes(s.host)) return;
  const p = s.host.split("."); const n = p.map(Number);
  const ipv4 = p.length === 4 && p.every(x => /^(0|[1-9][0-9]{0,2})$/.test(x)) && n.every(x => x <= 255);
  const privateIp = ipv4 && (n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168));
  assert(options.containerService === true && options.githubActions === true && privateIp, context);
}
async function nativeDriver(): Promise<Driver> {
  const u = validateHealingLocalTarget(process.env.HEALING_ATOMIC_TEST_DATABASE_URL);
  const { Client } = await import("pg");
  return { kind: "native-postgresql", async connect() {
    const c = new Client({ connectionString: u.toString(), application_name: DB, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
    try {
      await c.connect();
      const { rows } = await c.query("select current_database() as db, host(inet_server_addr()) as host, inet_server_port() as port");
      validateHealingServer(rows[0], { containerService: process.env.HEALING_ATOMIC_TEST_CONTAINER_SERVICE === "1", githubActions: process.env.GITHUB_ACTIONS === "true" });
      return { query: (sql, args) => c.query(sql, args), end: () => c.end() };
    } catch (e) { await c.end().catch(() => {}); throw e; }
  }, async close() {} };
}
async function pgliteDriver(): Promise<Driver> {
  const modulePath = process.env.HEALING_ATOMIC_PGLITE_MODULE;
  if (modulePath) assert(path.isAbsolute(modulePath));
  const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : "@electric-sql/pglite");
  const db = new PGlite(); await db.waitReady;
  const c: Connection = { async query(sql, args) {
    if (args) return db.query(sql, args);
    const results = await db.exec(sql); return results.at(-1) ?? { rows: [] };
  }, async end() {} };
  return { kind: "pglite-single-session", async connect() { return c; }, async close() { await db.close(); } };
}
const FIXTURE = `
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
-- Only the source query's used columns are modeled. Duplicate rows intentionally
-- remain possible so COUNT(DISTINCT day), not COUNT(*)/MAX(day), must govern.
create table public.train_day_completions(user_id uuid not null references auth.users(id), day integer not null);
alter table public.train_day_completions enable row level security;
grant usage on schema auth,public to anon,authenticated,service_role;
`;
async function reset(c: Connection) { await c.query(`truncate ${TABLES.join(",")} cascade`); }
async function seed(c: Connection, days = Array.from({ length: 28 }, (_, i) => i + 1)): Promise<string> {
  const user = randomUUID(); await c.query("insert into auth.users(id) values($1)", [user]);
  for (const day of days) await c.query("insert into public.train_day_completions(user_id,day) values($1,$2)", [user, day]);
  return user;
}
async function seedActs(c: Connection, user: string, acts: number[]) {
  for (const act of acts) await c.query("insert into public.user_healing_awakening_acts(user_id,act_id,completed_at) values($1,$2,$3)", [user, act, OLD]);
}
async function marker(c: Connection, user: string, completed: string | null, starter: string | null = null) {
  await c.query("insert into public.user_healing_milestones(user_id,second_awakening_completed_at,starter_unlock_granted) values($1,$2,$3)", [user, completed, starter]);
}
async function snap(c: Connection): Promise<Row> {
  const result: Row = {};
  for (const table of TABLES) result[table] = (await c.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${table} t`)).rows[0].rows;
  return result;
}
async function call(c: Connection, operation: "act" | "ritual", user: string | null, value: number | string | null): Promise<Row> {
  return (await c.query(operation === "act" ? ACT : RITUAL, [user, value])).rows[0].result;
}
async function service(c: Connection, op: "act" | "ritual", user: string | null, value: number | string | null): Promise<Row> {
  await c.query("set role service_role");
  try { return await call(c, op, user, value); } finally { await c.query("reset role"); }
}
function common(r: Row, operation: "act" | "ritual", user: string) {
  assert.equal(r.policyVersion, POLICY); assert.equal(r.operation, operation); assert.equal(r.userId, user);
  assert.equal(typeof r.idempotent, "boolean");
}
async function actsState(c: Connection, user: string, expected: number[], hasMarker = false) {
  const ids = (await c.query("select act_id from public.user_healing_awakening_acts where user_id=$1 order by act_id", [user])).rows.map(r => r.act_id);
  assert.deepEqual(ids, expected);
  const m = (await c.query("select to_jsonb(second_awakening_completed_at) as stamp from public.user_healing_milestones where user_id=$1", [user])).rows[0];
  assert.equal(Boolean(m?.stamp), hasMarker);
}
async function denyUnchanged(c: Connection, action: () => Promise<unknown>, message?: string) {
  const before = await snap(c);
  await assert.rejects(action, (e: any) => message ? e.message === message : true);
  assert.deepEqual(await snap(c), before);
}
async function waitLocked(c: Connection, pids: number[], expected: number): Promise<void> {
  for (let n = 0; n < 250; n++) {
    await c.query("select pg_stat_clear_snapshot()");
    const count = (await c.query("select count(*)::integer as n from pg_stat_activity where pid=any($1::integer[]) and wait_event_type='Lock'", [pids])).rows[0].n;
    if (count === expected) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail("Native contenders did not overlap at an observed lock");
}
async function main() {
  const args = process.argv.slice(2);
  assert.equal(Number(args.includes("--postgres")) + Number(args.includes("--pglite")), 1, "Choose exactly one explicit SQL driver");
  const migrationPath = args[args.indexOf("--migration") + 1];
  assert(args.includes("--migration") && migrationPath && path.isAbsolute(migrationPath));
  assert.match(path.basename(migrationPath), /^\d{14}_healing_awakening_atomic_completion\.sql$/);
  const migration = await readFile(migrationPath, "utf8");
  const driver = args.includes("--postgres") ? await nativeDriver() : await pgliteDriver();
  const c = await driver.connect();
  const evidence = { engine: driver.kind, engineVersion: "", fixture: "Minimal source-column schema and original Healing/Unlock table migrations; not the production migration stack", migration: path.basename(migrationPath), migrationSha256: createHash("sha256").update(migration).digest("hex"), checks: [] as string[], unrun: [] as string[] };
  const check = async (name: string, fn: () => Promise<void>) => { await fn(); evidence.checks.push(name); console.log(`PASS ${name}`); };
  try {
    evidence.engineVersion = (await c.query("select version() as version")).rows[0].version;
    const existing = (await c.query("select table_schema,table_name from information_schema.tables where table_schema in ('public','auth') and table_type='BASE TABLE'")).rows;
    assert.deepEqual(existing, [], "Disposable target must be empty; no existing application table is permitted");
    await c.query(FIXTURE);
    for (const relative of ["20260310010000_emotional_stats.sql", "20260311010000_user_healing_milestones.sql", "20260317120000_user_healing_awakening_acts.sql"]) {
      const source = await readFile(path.join(process.cwd(), "supabase/migrations", relative), "utf8");
      // The first migration also owns unrelated emotional-session/stat tables.
      // Keep the exact advanced-unlock DDL, index and RLS policies while excluding unrelated tables.
      const sql = relative.startsWith("20260310010000")
        ? source.slice(source.indexOf("create table if not exists public.user_advanced_unlocks"), source.indexOf("comment on table public.user_emotional_stats"))
        : source;
      assert(sql, `Missing original source DDL ${relative}`); await c.query(sql);
    }
    await c.query("grant all on all tables in schema public to service_role");
    await c.query("grant usage,select on all sequences in schema public to service_role");
    // Model preexisting broad client table grants so the migration must revoke
    // writes while preserving owner SELECT; unrelated unlock authority stays unchanged.
    await c.query("grant select,insert,update,delete,truncate,references,trigger on public.user_healing_awakening_acts,public.user_healing_milestones to anon,authenticated");
    await c.query("grant select,insert on public.user_advanced_unlocks to authenticated");
    await check("prepared additive migration applies twice without changing seeded rows", async () => {
      await seed(c); const before = await snap(c); await c.query(migration); await c.query(migration); assert.deepEqual(await snap(c), before);
    });
    await check("first act is recorded only for its user with a server timestamp", async () => {
      await reset(c); const u = await seed(c); const other = await seed(c);
      const r = await service(c, "act", u, 1); common(r, "act", u);
      assert.equal(r.actId, 1); assert.equal(r.idempotent, false); assert.deepEqual(r.completedActs, [1]);
      assert(Number.isFinite(Date.parse(r.actCompletedAt))); assert.equal(r.completedAt, null);
      await actsState(c, u, [1]); await actsState(c, other, []);
    });
    for (const [acts, id] of [[[], 2], [[], 3], [[1], 3]] as [number[], number][]) await check(`act ${id} refuses missing prerequisites ${JSON.stringify(acts)}`, async () => {
      await reset(c); const u = await seed(c); await seedActs(c, u, acts); await denyUnchanged(c, () => service(c, "act", u, id), "ACT_PREREQUISITE");
    });
    await check("ordered final act and milestone commit together", async () => {
      await reset(c); const u = await seed(c);
      await service(c, "act", u, 1); await service(c, "act", u, 2); const r = await service(c, "act", u, 3);
      common(r, "act", u); assert.deepEqual(r.completedActs, [1, 2, 3]); assert(Number.isFinite(Date.parse(r.completedAt)));
      await actsState(c, u, [1, 2, 3], true);
      const stamp = (await c.query("select to_jsonb(second_awakening_completed_at) as stamp from public.user_healing_milestones where user_id=$1", [u])).rows[0].stamp;
      assert.equal(r.completedAt, stamp);
    });
    for (const [ids, hasMarker] of [[[1], false], [[1, 2, 3], true]] as [number[], boolean][]) await check(`healthy duplicate act ${ids.at(-1)} remains409 without writes or eligibility regrant`, async () => {
      await reset(c); const u = await seed(c, []); await seedActs(c, u, ids); if (hasMarker) await marker(c, u, OLD);
      await denyUnchanged(c, () => service(c, "act", u, ids.at(-1)!), "ACT_ALREADY_COMPLETED");
    });
    for (const id of [null, 0, -1, 4]) await check(`invalid act ${id} fails before mutation`, async () => {
      await reset(c); const u = await seed(c); await denyUnchanged(c, () => service(c, "act", u, id));
    });
    for (const days of [[], Array.from({ length: 27 }, (_, i) => i + 1), Array.from({ length: 29 }, (_, i) => i + 1), [1, 2, 28], Array.from({ length: 28 }, () => 1)]) {
      await check(`act eligibility requires exactly28 DISTINCT days (${days.length}rows/${new Set(days).size}distinct)`, async () => {
        await reset(c); const u = await seed(c, days); await denyUnchanged(c, () => service(c, "act", u, 1), "NOT_ELIGIBLE");
      });
    }
    for (const days of [[], Array.from({ length: 27 }, (_, i) => i + 1), Array.from({ length: 29 }, (_, i) => i + 1)]) await check(`ritual refuses ${days.length} training days`, async () => {
      await reset(c); const u = await seed(c, days); await denyUnchanged(c, () => service(c, "ritual", u, "PRM"), "NOT_ELIGIBLE");
    });
    for (const starter of ["PRM", "SAG", null]) await check(`ritual atomically persists marker and ${starter ?? "no"} starter unlock`, async () => {
      await reset(c); const u = await seed(c); const r = await service(c, "ritual", u, starter);
      common(r, "ritual", u); assert.equal(r.idempotent, false); assert.equal(r.starterUnlockGranted, starter);
      assert(Number.isFinite(Date.parse(r.completedAt)));
      const m = (await c.query("select to_jsonb(second_awakening_completed_at) as stamp,starter_unlock_granted as starter from public.user_healing_milestones where user_id=$1", [u])).rows[0];
      assert.equal(r.completedAt, m.stamp); assert.equal(m.starter, starter);
      const rows = (await c.query("select advanced_stat_name from public.user_advanced_unlocks where user_id=$1", [u])).rows;
      assert.deepEqual(rows.map(x => x.advanced_stat_name), starter ? [starter] : []);
    });
    // Explicit parent policy correction: initial oracle expected a fresh completion
    // preserving this unlock. Unattributed old unlock+no marker is ambiguous, so
    // REVIEW+unchanged is required, never an inferred completion or timestamp reset.
    await check("preexisting requested starter without a marker requires review and preserves its timestamp", async () => {
      await reset(c); const u = await seed(c);
      await c.query("insert into public.user_advanced_unlocks(user_id,advanced_stat_name,unlocked_at) values($1,'PRM',$2)", [u, OLD]);
      await denyUnchanged(c, () => service(c, "ritual", u, "PRM"), REVIEW);
      const stamp = (await c.query("select unlocked_at from public.user_advanced_unlocks where user_id=$1", [u])).rows[0].unlocked_at;
      assert.equal(new Date(stamp).getTime(), Date.parse(OLD));
    });
    for (const initial of ["PRM", null]) await check(`ritual replay freezes stored ${initial ?? "no"} starter and completion time`, async () => {
      await reset(c); const u = await seed(c); const first = await service(c, "ritual", u, initial); const before = await snap(c);
      const retry = await service(c, "ritual", u, "SAG"); assert.deepEqual(retry, { ...first, idempotent: true }); assert.deepEqual(await snap(c), before);
    });
    await check("historical all-acts/no-marker refuses instead of inferring completion", async () => {
      await reset(c); const u = await seed(c); await seedActs(c, u, [1, 2, 3]);
      await denyUnchanged(c, () => service(c, "act", u, 3), REVIEW);
    });
    await check("historical marker/starter-without-unlock refuses instead of silently backfilling", async () => {
      await reset(c); const u = await seed(c); await marker(c, u, OLD, "PRM"); await denyUnchanged(c, () => service(c, "ritual", u, "PRM"), REVIEW);
    });
    await check("act mode also refuses a stored starter marker whose durable unlock is missing", async () => {
      await reset(c); const u = await seed(c); await seedActs(c, u, [1]); await marker(c, u, OLD, "PRM");
      await denyUnchanged(c, () => service(c, "act", u, 1), REVIEW);
    });
    for (const op of ["act", "ritual"] as const) await check(`${op} refuses a starter designation without a completion timestamp`, async () => {
      await reset(c); const u = await seed(c); await marker(c, u, null, "SAG");
      await c.query("insert into public.user_advanced_unlocks(user_id,advanced_stat_name,unlocked_at) values($1,'SAG',$2)", [u, OLD]);
      await denyUnchanged(c, () => service(c, op, u, op === "act" ? 1 : "SAG"), REVIEW);
    });
    await check("healthy ritual completion replays independently of an old non-prefix act history", async () => {
      await reset(c); const u = await seed(c, []); await seedActs(c, u, [2]); await marker(c, u, OLD, "SAG");
      await c.query("insert into public.user_advanced_unlocks(user_id,advanced_stat_name,unlocked_at) values($1,'SAG',$2)", [u, OLD]);
      const before = await snap(c); const r = await service(c, "ritual", u, "PRM");
      common(r, "ritual", u); assert.equal(r.idempotent, true); assert.equal(r.starterUnlockGranted, "SAG");
      assert.equal(Date.parse(r.completedAt), Date.parse(OLD)); assert.deepEqual(await snap(c), before);
    });
    await check("healthy historical null-starter marker replays without changing its timestamp", async () => {
      await reset(c); const u = await seed(c, []); await marker(c, u, OLD); const before = await snap(c); const r = await service(c, "ritual", u, "PRM");
      common(r, "ritual", u); assert.equal(r.idempotent, true); assert.equal(r.starterUnlockGranted, null); assert.equal(Date.parse(r.completedAt), Date.parse(OLD)); assert.deepEqual(await snap(c), before);
    });
    for (const ids of [[2], [1, 3]]) await check(`historical non-prefix ${ids.join(",")} refuses without repair`, async () => {
      await reset(c); const u = await seed(c); await seedActs(c, u, ids); await denyUnchanged(c, () => service(c, "act", u, 1), REVIEW);
    });
    await check("an existing empty milestone row can complete normally", async () => {
      await reset(c); const u = await seed(c); await marker(c, u, null); const r = await service(c, "ritual", u, "SAG"); assert.equal(r.idempotent, false); assert.equal(r.starterUnlockGranted, "SAG");
    });
    for (const value of ["INVALID", "", "PRM "]) await check(`invalid starter ${JSON.stringify(value)} refuses without writes`, async () => {
      await reset(c); const u = await seed(c); await denyUnchanged(c, () => service(c, "ritual", u, value));
    });
    await check("null or unknown users cannot create progress or unlocks", async () => {
      await reset(c); await denyUnchanged(c, () => service(c, "act", null, 1)); await denyUnchanged(c, () => service(c, "ritual", randomUUID(), "PRM"));
    });
    await c.query("create function public.healing_qa_fail() returns trigger language plpgsql as $$ begin raise exception using message='QA_INJECTED_FAILURE',errcode='P0001'; end $$");
    await c.query("create function public.healing_qa_suppress() returns trigger language plpgsql as $$ begin return null; end $$");
    for (const mode of ["error", "suppression"] as const) for (const [op, table, update] of [
      ["act", "user_healing_awakening_acts", false], ["act", "user_healing_milestones", false],
      ["ritual", "user_healing_milestones", false], ["ritual", "user_advanced_unlocks", false],
      ["ritual", "user_healing_milestones", true],
    ] as const) await check(`${op} ${mode} at ${table} ${update ? "update" : "insert"} rolls back all prior writes and can retry`, async () => {
      await reset(c); const u = await seed(c); if (op === "act") await seedActs(c, u, [1, 2]); if (update) await marker(c, u, null);
      const when = mode === "error" ? "after" : "before"; const fn = mode === "error" ? "healing_qa_fail" : "healing_qa_suppress";
      await c.query(`create trigger healing_qa_fault ${when} ${update ? "update" : "insert"} on public.${table} for each row execute function public.${fn}()`);
      try { await denyUnchanged(c, () => service(c, op, u, op === "act" ? 3 : "PRM")); }
      finally { await c.query(`drop trigger healing_qa_fault on public.${table}`); }
      await service(c, op, u, op === "act" ? 3 : "PRM");
      if (op === "act") await actsState(c, u, [1, 2, 3], true);
      else assert.equal((await c.query("select count(*)::integer as n from public.user_advanced_unlocks where user_id=$1", [u])).rows[0].n, 1);
    });
    await check("new RPCs are invoker with empty search_path and service-only execute", async () => {
      for (const name of ["bty_complete_healing_awakening_act", "bty_complete_second_awakening"]) {
        const p = (await c.query("select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname=$1", [name])).rows;
        assert.equal(p.length, 1); assert.equal(p[0].prosecdef, false);
        assert(p[0].proconfig.some((x: string) => x.startsWith("search_path=") && x.slice("search_path=".length).replaceAll('"', "") === ""));
        for (const role of ["anon", "authenticated", "service_role"]) assert.equal((await c.query("select has_function_privilege($1::name,$2::oid,'execute') as allowed", [role, p[0].oid])).rows[0].allowed, role === "service_role");
      }
      for (const table of ["user_healing_awakening_acts", "user_healing_milestones"]) {
        for (const role of ["anon", "authenticated"]) {
          assert.equal((await c.query("select has_table_privilege($1::name,$2::text,'select') as allowed", [role, `public.${table}`])).rows[0].allowed, true);
          for (const privilege of ["insert", "update", "delete", "truncate", "references", "trigger"])
            assert.equal((await c.query("select has_table_privilege($1::name,$2::text,$3::text) as allowed", [role, `public.${table}`, privilege])).rows[0].allowed, false);
        }
      }
      assert.equal((await c.query("select has_table_privilege('authenticated','public.user_advanced_unlocks','insert') as allowed")).rows[0].allowed, true);
      await reset(c); const u = await seed(c);
      for (const role of ["anon", "authenticated"]) {
        await c.query(`set role ${role}`);
        try { for (const op of ["act", "ritual"] as const) await assert.rejects(call(c, op, u, op === "act" ? 1 : "PRM"), (e: any) => e.code === "42501"); }
        finally { await c.query("reset role"); }
      }
    });
    await check("authenticated owner SELECT survives while direct completion writes stay denied", async () => {
      await reset(c); const u = await seed(c); const other = await seed(c);
      await service(c, "act", u, 1); await service(c, "act", other, 1);
      await service(c, "ritual", u, "PRM"); await marker(c, other, OLD);
      await c.query("select set_config('request.jwt.claim.sub',$1,false)", [u]);
      await c.query("set role authenticated");
      try {
        for (const table of ["user_healing_awakening_acts", "user_healing_milestones"]) {
          const rows = (await c.query(`select user_id from public.${table}`)).rows;
          assert.deepEqual(rows.map(r => r.user_id), [u]);
        }
        await assert.rejects(c.query("insert into public.user_healing_awakening_acts(user_id,act_id) values($1,2)", [u]), (e: any) => e.code === "42501");
        await assert.rejects(c.query("update public.user_healing_milestones set second_awakening_completed_at=now() where user_id=$1", [u]), (e: any) => e.code === "42501");
      } finally {
        await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub','',false)");
      }
    });
    if (driver.kind === "native-postgresql") {
      const GATE = 481920514;
      const installGate = async (table: string, user: string) => {
        await c.query(`create function public.healing_qa_gate() returns trigger language plpgsql as $$ begin if new.user_id='${user}'::uuid then perform pg_advisory_xact_lock(${GATE}); end if; return new; end $$`);
        await c.query(`create trigger healing_qa_gate before insert on public.${table} for each row execute function public.healing_qa_gate()`);
      };
      const removeGate = async (table: string) => { await c.query(`drop trigger healing_qa_gate on public.${table}`); await c.query("drop function public.healing_qa_gate()"); };
      const contenders = async (specs: { op: "act" | "ritual"; user: string; value: number | string | null }[], table: string) => {
        const clients: Connection[] = []; let installed = false;
        try {
          for (const _ of specs) clients.push(await driver.connect());
          const pids: number[] = [];
          for (const client of clients) { await client.query("set role service_role"); pids.push((await client.query("select pg_backend_pid() as pid")).rows[0].pid); }
          assert.equal(new Set(pids).size, specs.length, "Separate native backends are mandatory");
          await installGate(table, specs[0].user); installed = true; await c.query("begin"); await c.query(`select pg_advisory_xact_lock(${GATE})`);
          const launch = (i: number) => call(clients[i], specs[i].op, specs[i].user, specs[i].value).then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason }));
          const pending = [launch(0)]; await waitLocked(c, [pids[0]], 1);
          for (let i = 1; i < specs.length; i++) pending.push(launch(i));
          await waitLocked(c, pids, specs.length); await c.query("commit"); return await Promise.all(pending);
        } finally {
          await c.query("rollback").catch(() => {}); await Promise.allSettled(clients.map(x => x.end()));
          if (installed) await removeGate(table);
        }
      };
      await check("native eight duplicate final-act requests persist one act/milestone and retain409", async () => {
        await reset(c); const u = await seed(c); await seedActs(c, u, [1, 2]);
        const results = await contenders(Array.from({ length: 8 }, () => ({ op: "act", user: u, value: 3 })), "user_healing_awakening_acts");
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        for (const r of results) if (r.status === "rejected") assert.equal(r.reason.message, "ACT_ALREADY_COMPLETED");
        await actsState(c, u, [1, 2, 3], true);
      });
      await check("native eight ritual requests persist one marker/unlock and replay frozen acknowledgements", async () => {
        await reset(c); const u = await seed(c);
        const results = await contenders(Array.from({ length: 8 }, () => ({ op: "ritual", user: u, value: "PRM" })), "user_healing_milestones");
        assert(results.every(r => r.status === "fulfilled")); const values = results.map(r => (r as { status: "fulfilled"; value: Row }).value);
        assert.equal(values.filter(v => v.idempotent === false).length, 1); const first = values.find(v => !v.idempotent)!;
        values.filter(v => v.idempotent).forEach(v => assert.deepEqual(v, { ...first, idempotent: true }));
        assert.equal((await c.query("select count(*)::integer as n from public.user_advanced_unlocks where user_id=$1", [u])).rows[0].n, 1);
      });
      await check("native overlapping act2 then act3 preserve the ordered prefix and final milestone", async () => {
        await reset(c); const u = await seed(c); await seedActs(c, u, [1]);
        const results = await contenders([{ op: "act", user: u, value: 2 }, { op: "act", user: u, value: 3 }], "user_healing_awakening_acts");
        assert(results.every(r => r.status === "fulfilled")); await actsState(c, u, [1, 2, 3], true);
      });
      await check("native act-first cross-mode race preserves null-starter completion without inventing a grant", async () => {
        await reset(c); const u = await seed(c); await seedActs(c, u, [1, 2]);
        const results = await contenders([{ op: "act", user: u, value: 3 }, { op: "ritual", user: u, value: "PRM" }], "user_healing_milestones");
        assert(results.every(r => r.status === "fulfilled"));
        const ritual = (results[1] as { status: "fulfilled"; value: Row }).value;
        assert.equal(ritual.idempotent, true); assert.equal(ritual.starterUnlockGranted, null);
        await actsState(c, u, [1, 2, 3], true);
        assert.equal((await c.query("select count(*)::integer as n from public.user_advanced_unlocks where user_id=$1", [u])).rows[0].n, 0);
      });
      await check("native ritual-first cross-mode race retains the granted completion and refuses further acts", async () => {
        await reset(c); const u = await seed(c); await seedActs(c, u, [1, 2]);
        const results = await contenders([{ op: "ritual", user: u, value: "SAG" }, { op: "act", user: u, value: 3 }], "user_healing_milestones");
        assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected");
        if (results[1].status === "rejected") assert.equal(results[1].reason.message, "NOT_ELIGIBLE");
        await actsState(c, u, [1, 2], true);
        assert.equal((await c.query("select advanced_stat_name from public.user_advanced_unlocks where user_id=$1", [u])).rows[0].advanced_stat_name, "SAG");
      });
      await check("native one user's held completion does not block another user's completion", async () => {
        await reset(c); const u = await seed(c); const other = await seed(c);
        const clients: Connection[] = []; let installed = false;
        try {
          clients.push(await driver.connect()); clients.push(await driver.connect());
          const [first, second] = clients;
          await first.query("set role service_role"); await second.query("set role service_role");
          const p1 = (await first.query("select pg_backend_pid() as pid")).rows[0].pid;
          const p2 = (await second.query("select pg_backend_pid() as pid")).rows[0].pid; assert.notEqual(p1, p2);
          await installGate("user_healing_awakening_acts", u); installed = true; await c.query("begin"); await c.query(`select pg_advisory_xact_lock(${GATE})`);
          const pending = call(first, "act", u, 1).then(value => ({ value }), error => ({ error })); await waitLocked(c, [p1], 1);
          // The first transaction remains blocked until this distinct user's result returns.
          const r = await call(second, "act", other, 1); common(r, "act", other);
          await c.query("commit"); const done = await pending; assert(!("error" in done));
          await actsState(c, u, [1]); await actsState(c, other, [1]);
        } finally {
          await c.query("rollback").catch(() => {}); await Promise.allSettled(clients.map(client => client.end())); if (installed) await removeGate("user_healing_awakening_acts");
        }
      });
    } else evidence.unrun.push("Six native separate-backend, observed-lock race groups: duplicate final act, duplicate ritual, overlapping ordered acts, both cross-mode orders and independent-user progress. PGlite is one session; these were NOT executed.");
    console.log(JSON.stringify({ ...evidence, passed: evidence.checks.length }, null, 2));
  } finally { await c.end(); await driver.close(); }
}
if (process.argv[1] && path.basename(process.argv[1]) === "healing-atomic-postgres-qa.ts") main().catch(error => { console.error(error); process.exitCode = 1; });
