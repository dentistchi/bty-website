/**
 * Disposable local SQL verification. Never reads application env files or connects
 * to Supabase. Run explicitly with one of:
 *   tsx scripts/legacy-xp-postgres-qa.ts --pglite --migration /absolute/migration.sql
 *   LEGACY_XP_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55473/bty_legacy_xp_atomic_qa \
 *     tsx scripts/legacy-xp-postgres-qa.ts --postgres --migration /absolute/migration.sql
 *
 * Native mode requires a newly created, empty disposable database at that exact
 * loopback address, port and name. It refuses existing application tables. The
 * PGlite package may be installed outside the repo and supplied as an absolute
 * LEGACY_XP_PGLITE_MODULE path. PGlite NEVER counts as concurrency evidence.
 * GitHub Actions may explicitly set LEGACY_XP_TEST_CONTAINER_SERVICE=1 to
 * accept a server-side RFC1918 Docker bridge address. The client still connects
 * only to the exact literal loopback URL; public server addresses remain denied.
 *
 * Frozen oracle (before reading the new RPC implementation): choice increments
 * legacy profile lifetime/weekly and run total only; beginner awards 30 global
 * weekly XP and the existing TS seasonal-to-Core conversion only. A failed
 * statement leaves every table unchanged. Same canonical input replays the
 * original receipt; changed canonical input conflicts. No historical repair.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { SUB_NAMES } from "../src/domain/constants";
import { seasonalToCoreConversion } from "../src/domain/rules/xp";
import { tierFromCoreXp, codeIndexFromTier, subTierGroupFromTier } from "../src/domain/rules/level-tier";

type Row = Record<string, any>;
type Connection = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
};
type Driver = {
  kind: "native-postgresql" | "pglite-single-session";
  connect(): Promise<Connection>;
  close(): Promise<void>;
};
type Seed = { userId: string; runId: string; scenarioId: string };
const DB_NAME = "bty_legacy_xp_atomic_qa";
const APPLICATION_NAME = DB_NAME;
const CHOICE_SQL = "select public.bty_record_legacy_choice_reward($1::uuid,$2::uuid,$3::text,$4::text,$5::integer,$6::integer,$7::jsonb,$8::jsonb) as result";
const BEGINNER_SQL = "select public.bty_complete_beginner_reward($1::uuid,$2::uuid,$3::text,$4::jsonb,$5::integer,$6::jsonb) as result";
const RESPONSES = Object.freeze({ emotionIndex: 1, riskIndex: 1, integrityIndex: 1, decisionIndex: 2, reflectionText: "QA reflection" });
const FEEDBACK = Object.freeze({ band: "intentional", label: "QA label", message: "QA feedback" });
const TABLES = ["public.arena_reward_receipts", "public.arena_events", "public.arena_runs", "public.arena_profiles", "public.weekly_xp", "auth.users"];

export function validateLocalTarget(value: string | undefined): URL {
  assert(value, "LEGACY_XP_TEST_DATABASE_URL is required; no application URL fallback exists");
  const url = new URL(value);
  assert(["postgres:", "postgresql:"].includes(url.protocol), "PostgreSQL protocol required");
  assert(["127.0.0.1", "[::1]"].includes(url.hostname), "Only literal loopback targets are allowed");
  assert.equal(url.port, "55473", "Only the task-specific local port 55473 is allowed");
  assert.equal(url.pathname, `/${DB_NAME}`, "Only the disposable task database is allowed");
  assert.equal(url.search, "", "Connection URL options are forbidden");
  assert.equal(url.hash, "", "Connection URL fragments are forbidden");
  return url;
}

export function validateConnectedServer(server: { db: string; host: string; port: number },
  options: { containerService?: boolean; githubActions?: boolean } = {}) {
  const context = `connectedServer=${JSON.stringify({ db: server.db, host: server.host, port: server.port })}`;
  assert.equal(server.db, DB_NAME, `Unexpected disposable database; ${context}`);
  assert.equal(server.port, 55473, `Unexpected disposable server port; ${context}`);
  if (["127.0.0.1", "::1"].includes(server.host)) return;
  const parts = server.host.split(".");
  const octets = parts.map(Number);
  const ipv4 = parts.length === 4 && parts.every(part => /^(0|[1-9][0-9]{0,2})$/.test(part))
    && octets.every(octet => octet <= 255);
  const privateBridge = ipv4 && (octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168));
  assert(options.containerService === true && options.githubActions === true && privateBridge,
    `Server must be loopback, or an explicitly opted-in GitHub Actions RFC1918 container service; ${context}`);
}

/** Existing TS behavior, independently sourced from applySeasonalXpToCore. */
export function legacyCoreOracle(core: number, buffer: number, renamed = false, subName: string | null = "QA existing") {
  const { coreGain, fractionalBuffer } = seasonalToCoreConversion(30, core);
  const carried = buffer + fractionalBuffer;
  const gain = coreGain + Math.floor(carried);
  const after = core + gain;
  const tier = tierFromCoreXp(after);
  const code = codeIndexFromTier(tier);
  const defaults = SUB_NAMES[code];
  return { core: after, buffer: carried - Math.floor(carried), gain, tier, code,
    stage: Math.min(7, Math.floor(after / 100) + 1), hidden: after >= 700,
    subName: renamed || defaults == null ? subName : defaults[subTierGroupFromTier(tier)] };
}

async function nativeDriver(value: string | undefined): Promise<Driver> {
  const url = validateLocalTarget(value);
  const { Client } = await import("pg");
  return { kind: "native-postgresql", async connect() {
    const client = new Client({ connectionString: url.toString(), application_name: APPLICATION_NAME,
      connectionTimeoutMillis: 5000, statement_timeout: 15000 });
    try {
      await client.connect();
      // Explicit inet::text retains /32 or /128. host(inet) supplies the plain
      // address required by the strict guard without broadening accepted input.
      const { rows } = await client.query("select current_database() as db, host(inet_server_addr()) as host, inet_server_port() as port");
      // Docker port publishing retains a private container address on the
      // server side; this never changes the mandatory client URL guard above.
      validateConnectedServer(rows[0], {
        containerService: process.env.LEGACY_XP_TEST_CONTAINER_SERVICE === "1",
        githubActions: process.env.GITHUB_ACTIONS === "true",
      });
      return { query: (sql, params) => client.query(sql, params), end: () => client.end() };
    } catch (error) {
      await client.end().catch(() => {});
      throw error;
    }
  }, async close() {} };
}

async function pgliteDriver(): Promise<Driver> {
  const modulePath = process.env.LEGACY_XP_PGLITE_MODULE;
  if (modulePath) assert(path.isAbsolute(modulePath), "PGlite module path must be absolute");
  const moduleName = modulePath ? pathToFileURL(modulePath).href : "@electric-sql/pglite";
  const { PGlite } = await import(moduleName);
  const db = new PGlite(); // In-memory, one session. No TCP connection exists.
  await db.waitReady;
  const client: Connection = { async query(sql, params) {
    if (params) return db.query(sql, params);
    const results = await db.exec(sql);
    return results[results.length - 1] ?? { rows: [] };
  }, async end() {} };
  return { kind: "pglite-single-session", async connect() { return client; }, async close() { await db.close(); } };
}

const FIXTURE_SQL = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.arena_profiles (
 user_id uuid primary key references auth.users(id), lifetime_xp int not null default 0,
 weekly_xp int not null default 0, core_xp_total int not null default 0,
 core_xp_buffer numeric not null default 0, tier int not null default 0,
 code_index int not null default 0, sub_name text, sub_name_renamed_in_code boolean not null default false,
 stage int not null default 1, code_hidden boolean not null default false,
 updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.arena_runs (
 run_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 scenario_id text not null, status text not null default 'IN_PROGRESS',
 run_type text not null default 'scenario', total_xp int not null default 0,
 current_step int not null default 1, reached_step_2_at timestamptz,
 completed_at timestamptz, beginner_maturity_score int
);
create table public.arena_events (
 event_id uuid primary key default gen_random_uuid(), run_id uuid not null references public.arena_runs(run_id),
 user_id uuid not null references auth.users(id), step int not null, event_type text not null,
 scenario_id text not null, choice_id text, follow_up_index int, xp int not null default 0,
 deltas jsonb, meta jsonb, created_at timestamptz not null default now()
);
-- docs/supabase/001_weekly_xp.sql, not the incompatible historical NOT NULL variant.
create table public.weekly_xp (
 id bigserial primary key, user_id uuid not null references auth.users(id), league_id uuid,
 xp_total integer not null default 0, updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create unique index weekly_xp_user_null_league_uq on public.weekly_xp(user_id) where league_id is null;
create unique index weekly_xp_user_league_uq on public.weekly_xp(user_id,league_id) where league_id is not null;
alter table public.arena_profiles enable row level security;
alter table public.arena_runs enable row level security;
alter table public.arena_events enable row level security;
alter table public.weekly_xp enable row level security;
grant usage on schema public,auth to anon,authenticated,service_role;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
-- Supabase commonly grants broad default privileges to service_role. A new
-- receipt table must explicitly remove inherited UPDATE/DELETE/TRUNCATE rights.
alter default privileges in schema public grant all on tables to service_role;
`;

async function snapshot(c: Connection) {
  const result: Record<string, unknown> = {};
  for (const table of TABLES) result[table] = (await c.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as value from ${table} t`)).rows[0].value;
  return result;
}
async function reset(c: Connection) {
  await c.query(`truncate ${TABLES.join(",")} restart identity cascade`);
}
async function seed(c: Connection, type = "scenario", profile = true, sameUser?: string): Promise<Seed> {
  const userId = sameUser ?? randomUUID();
  const runId = randomUUID();
  const scenarioId = type === "beginner" ? "beginner-qa" : "legacy-qa";
  await c.query("insert into auth.users(id) values($1) on conflict do nothing", [userId]);
  if (profile) await c.query("insert into public.arena_profiles(user_id,lifetime_xp,weekly_xp,core_xp_total,core_xp_buffer,sub_name) values($1,11,7,199,$2,'QA existing') on conflict do nothing", [userId, 2 / 3]);
  await c.query("insert into public.arena_runs(run_id,user_id,scenario_id,run_type) values($1,$2,$3,$4)", [runId, userId, scenarioId, type]);
  return { userId, runId, scenarioId };
}
function choiceParams(s: Seed, changes: Row = {}) {
  return [changes.userId ?? s.userId, changes.runId ?? s.runId, changes.scenarioId ?? s.scenarioId,
    changes.choiceId ?? "choice-a", changes.step ?? 2, changes.xp ?? 82,
    JSON.stringify(changes.deltas ?? { trust: 2 }), JSON.stringify(changes.meta ?? { qa: true })];
}
function beginnerParams(s: Seed, changes: Row = {}) {
  return [changes.userId ?? s.userId, changes.runId ?? s.runId, changes.scenarioId ?? s.scenarioId,
    JSON.stringify(changes.responses ?? RESPONSES), changes.score ?? 17, JSON.stringify(changes.feedback ?? FEEDBACK)];
}
async function call(c: Connection, kind: "choice" | "beginner", s: Seed, changes: Row = {}) {
  return (await c.query(kind === "choice" ? CHOICE_SQL : BEGINNER_SQL,
    kind === "choice" ? choiceParams(s, changes) : beginnerParams(s, changes))).rows[0].result;
}
async function serviceCall(c: Connection, kind: "choice" | "beginner", s: Seed, changes: Row = {}) {
  await c.query("set role service_role");
  try { return await call(c, kind, s, changes); } finally { await c.query("reset role"); }
}
async function rejection(c: Connection, kind: "choice" | "beginner", s: Seed, code: string, changes: Row = {}) {
  const before = await snapshot(c);
  await assert.rejects(serviceCall(c, kind, s, changes), (error: any) => error.message === code, code);
  assert.deepEqual(await snapshot(c), before, `${code} must not write`);
}
function replayOf(original: Row, replay: Row) {
  assert.equal(original.replayed, false);
  assert.deepEqual(replay, { ...original, replayed: true });
}
async function assertChoiceState(c: Connection, s: Seed) {
  const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.userId])).rows[0];
  const r = (await c.query("select * from public.arena_runs where run_id=$1", [s.runId])).rows[0];
  assert.equal(p.lifetime_xp, 93); assert.equal(p.weekly_xp, 89);
  assert.equal(p.core_xp_total, 199); assert.equal(Number(p.core_xp_buffer), 2 / 3);
  assert.equal(r.total_xp, 82); assert.equal(r.current_step, 2); assert(r.reached_step_2_at);
  assert.equal((await c.query("select count(*)::int as n from public.weekly_xp")).rows[0].n, 0);
  assert.equal((await c.query("select count(*)::int as n from public.arena_events")).rows[0].n, 1);
  assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, 1);
}
async function assertBeginnerState(c: Connection, s: Seed, core = 199, buffer = 2 / 3) {
  const expected = legacyCoreOracle(core, buffer);
  const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.userId])).rows[0];
  const r = (await c.query("select * from public.arena_runs where run_id=$1", [s.runId])).rows[0];
  assert.equal(p.lifetime_xp, 11); assert.equal(p.weekly_xp, 7);
  assert.equal(p.core_xp_total, expected.core); assert.equal(Number(p.core_xp_buffer), expected.buffer);
  assert.equal(p.tier, expected.tier); assert.equal(p.code_index, expected.code);
  assert.equal(p.stage, expected.stage); assert.equal(p.code_hidden, expected.hidden); assert.equal(p.sub_name, expected.subName);
  assert.equal(r.total_xp, 0); assert.equal(r.status, "DONE"); assert(r.completed_at); assert.equal(r.beginner_maturity_score, 17);
  assert.equal((await c.query("select xp_total from public.weekly_xp where user_id=$1 and league_id is null", [s.userId])).rows[0].xp_total, 30);
  const events = (await c.query("select * from public.arena_events where run_id=$1", [s.runId])).rows;
  assert.equal(events.length, 1); assert.equal(events[0].event_type, "BEGINNER_REFLECTION");
  assert.deepEqual(events[0].meta, { reflectionText: RESPONSES.reflectionText });
  assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, 1);
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.includes("--postgres") !== args.includes("--pglite"), "Select exactly --postgres or --pglite; nothing runs implicitly");
  const migrationIndex = args.indexOf("--migration");
  assert(migrationIndex >= 0 && args[migrationIndex + 1], "Pass the prepared migration explicitly with --migration");
  const migrationPath = path.resolve(args[migrationIndex + 1]);
  const migration = await readFile(migrationPath, "utf8");
  const root = process.cwd();
  const driver = args.includes("--postgres") ? await nativeDriver(process.env.LEGACY_XP_TEST_DATABASE_URL) : await pgliteDriver();
  const c = await driver.connect();
  const evidence: { engine: string; engineVersion: string; fixture: string; checks: string[]; unrun: string[] } = {
    engine: driver.kind, engineVersion: (await c.query("select version() as version")).rows[0].version,
    fixture: "Isolated source-column subset plus actual existing increment functions; not the full Supabase migration stack",
    checks: [], unrun: [],
  };
  const check = async (name: string, work: () => Promise<void>) => { await work(); evidence.checks.push(name); console.log(`PASS ${name}`); };
  try {
    const existing = await c.query("select table_schema,table_name from information_schema.tables where table_schema in ('public','auth') and table_type='BASE TABLE'");
    assert.equal(existing.rows.length, 0, "Refusing a database with existing public/auth tables; create a fresh disposable database");
    await c.query(FIXTURE_SQL);
    // Keep the old increment implementations, rather than mocks of their effects.
    const oldArena = await readFile(path.join(root, "supabase/migrations/20260222_000001_arena_core.sql"), "utf8");
    await c.query(oldArena.slice(oldArena.indexOf("create or replace function public.increment_arena_xp")));
    await c.query(await readFile(path.join(root, "supabase/migrations/20260518000000_increment_weekly_xp_rpc.sql"), "utf8"));
    await c.query(await readFile(path.join(root, "supabase/migrations/20261030175508_restrict_xp_writes_to_server.sql"), "utf8"));
    await check("prepared migration applies twice", async () => { await c.query(migration); await c.query(migration); });

    await check("zero-XP Step 1 choice is receipted without progress or XP fabrication", async () => {
      await reset(c); const s = await seed(c);
      const first = await serviceCall(c, "choice", s, { step: 1, xp: 0 });
      replayOf(first, await serviceCall(c, "choice", s, { step: 1, xp: 82 }));
      const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.userId])).rows[0];
      const r = (await c.query("select * from public.arena_runs where run_id=$1", [s.runId])).rows[0];
      assert.equal(p.lifetime_xp, 11); assert.equal(p.weekly_xp, 7); assert.equal(p.core_xp_total, 199);
      assert.equal(r.total_xp, 0); assert.equal(r.current_step, 1); assert.equal(r.reached_step_2_at, null);
      assert.equal((await c.query("select count(*)::int as n from public.arena_events")).rows[0].n, 1);
      assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, 1);
    });

    await check("choice commits once; retries freeze original result even after derived catalog/meta changes", async () => {
      await reset(c); const s = await seed(c);
      const first = await serviceCall(c, "choice", s);
      assert.equal(first.xp, 82); assert.equal(first.kind, "legacy_choice");
      const after = await snapshot(c);
      replayOf(first, await serviceCall(c, "choice", s, { xp: 0, deltas: { trust: -7 }, meta: { catalog: "changed" } }));
      assert.deepEqual(await snapshot(c), after); await assertChoiceState(c, s);
      await c.query("update public.arena_runs set status='DONE' where run_id=$1", [s.runId]);
      const done = await snapshot(c);
      replayOf(first, await serviceCall(c, "choice", s));
      assert.deepEqual(await snapshot(c), done, "A committed receipt replays before lifecycle rejection");
      await rejection(c, "choice", s, "REWARD_INPUT_CONFLICT", { choiceId: "choice-b" });
      await rejection(c, "choice", s, "REWARD_INPUT_CONFLICT", { step: 3 });
    });
    await check("beginner commits once; retry and lost-response replay preserve stored score/feedback", async () => {
      await reset(c); const s = await seed(c, "beginner");
      const first = await serviceCall(c, "beginner", s);
      assert.equal(first.seasonalXp, 30); assert.equal(first.kind, "beginner_completion");
      const after = await snapshot(c);
      // The first result is discarded by a caller whose response was lost after commit.
      replayOf(first, await serviceCall(c, "beginner", s, { score: 1, feedback: { band: "aware", label: "Changed", message: "Changed feedback" } }));
      assert.deepEqual(await snapshot(c), after); await assertBeginnerState(c, s);
      await rejection(c, "beginner", s, "REWARD_INPUT_CONFLICT", { responses: { ...RESPONSES, reflectionText: "different" } });
    });
    for (const kind of ["choice", "beginner"] as const) await check(`${kind} receipt prevents a second reward kind after run metadata changes`, async () => {
      await reset(c); const s = await seed(c, kind === "choice" ? "scenario" : "beginner");
      await serviceCall(c, kind, s);
      const otherKind = kind === "choice" ? "beginner" : "choice";
      const changed = { ...s, scenarioId: otherKind === "choice" ? "legacy-qa" : "beginner-qa" };
      await c.query("update public.arena_runs set run_type=$2,scenario_id=$3,status='IN_PROGRESS' where run_id=$1", [s.runId, otherKind === "choice" ? "scenario" : "beginner", changed.scenarioId]);
      await rejection(c, otherKind, changed, "REWARD_INPUT_CONFLICT");
    });
    for (const replacement of ["same business", "other kind", "other owner"] as const)
      await check(`deleted run recreated with same UUID and ${replacement} cannot award twice`, async () => {
        await reset(c); const s = await seed(c);
        const original = await serviceCall(c, "choice", s);
        await c.query("delete from public.arena_events where run_id=$1", [s.runId]);
        await c.query("delete from public.arena_runs where run_id=$1", [s.runId]);
        const replaced = { ...s, userId: replacement === "other owner" ? randomUUID() : s.userId,
          scenarioId: replacement === "other kind" ? "beginner-qa" : s.scenarioId };
        await c.query("insert into auth.users(id) values($1) on conflict do nothing", [replaced.userId]);
        await c.query("insert into public.arena_runs(run_id,user_id,scenario_id,run_type) values($1,$2,$3,$4)",
          [replaced.runId, replaced.userId, replaced.scenarioId, replacement === "other kind" ? "beginner" : "scenario"]);
        if (replacement === "same business") {
          const before = await snapshot(c);
          replayOf(original, await serviceCall(c, "choice", replaced));
          assert.deepEqual(await snapshot(c), before);
        } else await rejection(c, replacement === "other kind" ? "beginner" : "choice", replaced, "REWARD_INPUT_CONFLICT");
      });
    for (const kind of ["choice", "beginner"] as const) {
      await check(`${kind} rejects owner, scenario, type and inactive status without writes`, async () => {
        await reset(c); const s = await seed(c, kind === "choice" ? "scenario" : "beginner");
        await rejection(c, kind, s, "REWARD_RUN_NOT_FOUND", { userId: randomUUID() });
        await rejection(c, kind, s, "REWARD_RUN_NOT_FOUND", { runId: randomUUID() });
        await rejection(c, kind, s, "RUN_SCENARIO_MISMATCH", { scenarioId: "different-scenario" });
        await c.query("update public.arena_runs set run_type=$2 where run_id=$1", [s.runId, kind === "choice" ? "beginner" : "scenario"]);
        await rejection(c, kind, s, kind === "choice" ? "INVALID_REWARD_INPUT" : "NOT_BEGINNER_RUN");
        await c.query("update public.arena_runs set run_type=$2,status='ABANDONED' where run_id=$1", [s.runId, kind === "choice" ? "scenario" : "beginner"]);
        await rejection(c, kind, s, "RUN_NOT_ACTIVE");
      });
      await check(`${kind} refuses historical evidence without a new receipt`, async () => {
        await reset(c); const s = await seed(c, kind === "choice" ? "scenario" : "beginner");
        await c.query("insert into public.arena_events(run_id,user_id,step,event_type,scenario_id) values($1,$2,1,$3,$4)", [s.runId, s.userId, kind === "choice" ? "CHOICE_CONFIRMED" : "BEGINNER_REFLECTION", s.scenarioId]);
        await rejection(c, kind, s, "LEGACY_REWARD_REVIEW_REQUIRED");
        if (kind === "beginner") {
          await c.query("delete from public.arena_events where run_id=$1", [s.runId]);
          await c.query("update public.arena_runs set status='DONE',beginner_maturity_score=17 where run_id=$1", [s.runId]);
          await rejection(c, kind, s, "LEGACY_REWARD_REVIEW_REQUIRED");
        }
      });
    }

    const stages = [
      ["choice", "arena_profiles", "insert", false], ["choice", "arena_events", "insert", true],
      ["choice", "arena_profiles", "update", true], ["choice", "arena_runs", "update", true],
      ["choice", "arena_reward_receipts", "insert", true],
      ["beginner", "arena_profiles", "insert", false], ["beginner", "weekly_xp", "insert", true],
      ["beginner", "arena_profiles", "update", true], ["beginner", "arena_runs", "update", true],
      ["beginner", "arena_events", "insert", true], ["beginner", "arena_reward_receipts", "insert", true],
    ] as const;
    await c.query("create function public.qa_injected_failure() returns trigger language plpgsql as $$ begin raise exception 'QA_INJECTED_FAILURE'; end $$");
    for (const [kind, table, operation, hasProfile] of stages) await check(`${kind} rollback after ${table} ${operation}; retry awards exactly once`, async () => {
      await reset(c); const s = await seed(c, kind === "choice" ? "scenario" : "beginner", hasProfile);
      const before = await snapshot(c);
      await c.query(`create trigger qa_fail_stage after ${operation} on public.${table} for each row execute function public.qa_injected_failure()`);
      try { await assert.rejects(serviceCall(c, kind, s), (e: any) => e.message === "QA_INJECTED_FAILURE"); }
      finally { await c.query(`drop trigger qa_fail_stage on public.${table}`); }
      assert.deepEqual(await snapshot(c), before, "Every write preceding the fault rolls back");
      const first = await serviceCall(c, kind, s); replayOf(first, await serviceCall(c, kind, s));
      if (hasProfile) {
        if (kind === "choice") await assertChoiceState(c, s); else await assertBeginnerState(c, s);
      } else {
        const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.userId])).rows[0];
        assert.equal(p.core_xp_total, 0);
        assert.equal(Number(p.core_xp_buffer), kind === "beginner" ? 30 / 45 : 0);
        assert.equal(p.lifetime_xp, kind === "choice" ? 82 : 0);
        assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, 1);
      }
    });
    await check("beginner rollback after existing weekly row update", async () => {
      await reset(c); const s = await seed(c, "beginner");
      await c.query("insert into public.weekly_xp(user_id,xp_total) values($1,13)", [s.userId]);
      const before = await snapshot(c);
      await c.query("create trigger qa_fail_stage after update on public.weekly_xp for each row execute function public.qa_injected_failure()");
      try { await assert.rejects(serviceCall(c, "beginner", s), (e: any) => e.message === "QA_INJECTED_FAILURE"); }
      finally { await c.query("drop trigger qa_fail_stage on public.weekly_xp"); }
      assert.deepEqual(await snapshot(c), before);
      await serviceCall(c, "beginner", s);
      assert.equal((await c.query("select xp_total from public.weekly_xp where user_id=$1", [s.userId])).rows[0].xp_total, 43);
    });

    await c.query("create function public.qa_suppress_write() returns trigger language plpgsql as $$ begin return null; end $$");
    const suppressedStages = [
      ["choice", "arena_profiles", "insert", false, "", "INVALID_REWARD_INPUT"],
      ["choice", "arena_events", "insert", true, "", "REWARD_WRITE_FAILED"],
      ["choice", "arena_profiles", "update", true, "when (new.lifetime_xp is distinct from old.lifetime_xp)", "REWARD_WRITE_FAILED"],
      ["choice", "arena_runs", "update", true, "when (new.total_xp is distinct from old.total_xp)", "REWARD_WRITE_FAILED"],
      ["choice", "arena_reward_receipts", "insert", true, "", "REWARD_WRITE_FAILED"],
      ["beginner", "arena_profiles", "insert", false, "", "INVALID_REWARD_INPUT"],
      ["beginner", "weekly_xp", "insert", true, "", "REWARD_WRITE_FAILED"],
      ["beginner", "arena_profiles", "update", true, "", "REWARD_WRITE_FAILED"],
      ["beginner", "arena_runs", "update", true, "", "REWARD_WRITE_FAILED"],
      ["beginner", "arena_events", "insert", true, "", "REWARD_WRITE_FAILED"],
      ["beginner", "arena_reward_receipts", "insert", true, "", "REWARD_WRITE_FAILED"],
    ] as const;
    for (const [kind, table, operation, hasProfile, when, code] of suppressedStages)
      await check(`${kind} suppressed ${table} ${operation} fails closed and rolls back`, async () => {
        await reset(c); const s = await seed(c, kind === "choice" ? "scenario" : "beginner", hasProfile);
        const before = await snapshot(c);
        await c.query(`create trigger qa_suppress_stage before ${operation} on public.${table} for each row ${when} execute function public.qa_suppress_write()`);
        try { await assert.rejects(serviceCall(c, kind, s), (e: any) => e.message === code); }
        finally { await c.query(`drop trigger qa_suppress_stage on public.${table}`); }
        assert.deepEqual(await snapshot(c), before);
        const first = await serviceCall(c, kind, s); replayOf(first, await serviceCall(c, kind, s));
        assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, 1);
      });

    await check("beginner null/empty reflections stay null while each distinct run receives one award", async () => {
      await reset(c); const s = await seed(c, "beginner");
      for (const reflectionText of [null, ""]) {
        const next = await seed(c, "beginner", true, s.userId);
        await serviceCall(c, "beginner", next, { responses: { ...RESPONSES, reflectionText } });
        assert.equal((await c.query("select meta from public.arena_events where run_id=$1", [next.runId])).rows[0].meta, null);
      }
      assert.equal((await c.query("select xp_total from public.weekly_xp where user_id=$1", [s.userId])).rows[0].xp_total, 60);
      assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, 2);
    });

    await check("beginner carries a stored buffer above one into Core with the exact frozen receipt", async () => {
      await reset(c); const s = await seed(c, "beginner");
      await c.query("update public.arena_profiles set core_xp_total=0,core_xp_buffer=1.1 where user_id=$1", [s.userId]);
      const first = await serviceCall(c, "beginner", s);
      assert.equal(first.coreBefore, 0); assert.equal(first.coreBufferBefore, 1.1);
      assert.equal(first.coreGain, 1); assert.equal(first.coreAfter, 1);
      assert.equal(first.coreBufferAfter, 0.7666666666666666);
      await assertBeginnerState(c, s, 0, 1.1);
      const before = await snapshot(c);
      replayOf(first, await serviceCall(c, "beginner", s));
      assert.deepEqual(await snapshot(c), before);
    });

    await c.query("set extra_float_digits=-15");
    for (const core of [0, 44, 45, 199, 200, 249, 499, 999, 6999, 7000]) {
      for (const buffer of [0, 1 / 3, 2 / 3, 0.999]) {
        for (const renamed of [false, true]) await check(`Core parity core=${core} buffer=${buffer} renamed=${renamed}`, async () => {
          await reset(c); const s = await seed(c, "beginner");
          await c.query("update public.arena_profiles set core_xp_total=$2,core_xp_buffer=$3,sub_name_renamed_in_code=$4 where user_id=$1", [s.userId, core, buffer, renamed]);
          const expected = legacyCoreOracle(core, buffer, renamed);
          const first = await serviceCall(c, "beginner", s);
          const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.userId])).rows[0];
          assert.equal(p.core_xp_total, expected.core); assert.equal(Number(p.core_xp_buffer), expected.buffer);
          assert.equal(p.tier, expected.tier); assert.equal(p.code_index, expected.code);
          assert.equal(p.stage, expected.stage); assert.equal(p.code_hidden, expected.hidden); assert.equal(p.sub_name, expected.subName);
          assert.equal(first.coreBefore, core); assert.equal(first.coreAfter, expected.core);
          assert.equal(first.coreBufferBefore, buffer); assert.equal(first.coreBufferAfter, expected.buffer); assert.equal(first.coreGain, expected.gain);
        });
      }
    }
    await c.query("reset extra_float_digits");
    await check("anon/authenticated cannot execute either new RPC or read receipts; service_role can execute", async () => {
      await reset(c); const s = await seed(c); const b = await seed(c, "beginner");
      for (const role of ["anon", "authenticated"]) {
        await c.query(`set role ${role}`);
        try {
          for (const [sql, params] of [[CHOICE_SQL, choiceParams(s)], [BEGINNER_SQL, beginnerParams(b)]] as const)
            await assert.rejects(c.query(sql, params), (e: any) => e.code === "42501");
          await assert.rejects(c.query("select public.increment_arena_xp($1::uuid,$2::uuid,82)", [s.userId, s.runId]), (e: any) => e.code === "42501");
          await assert.rejects(c.query("select public.increment_weekly_xp($1::uuid,null::uuid,30)", [b.userId]), (e: any) => e.code === "42501");
          await assert.rejects(c.query("select * from public.arena_reward_receipts"), (e: any) => e.code === "42501");
        } finally { await c.query("reset role"); }
      }
      await serviceCall(c, "choice", s); await serviceCall(c, "beginner", b);
      await c.query("set role service_role");
      try {
        assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, 2);
        await assert.rejects(c.query("update public.arena_reward_receipts set result='{}'::jsonb"), (e: any) => e.code === "42501");
        await assert.rejects(c.query("delete from public.arena_reward_receipts"), (e: any) => e.code === "42501");
        await assert.rejects(c.query("truncate public.arena_reward_receipts"), (e: any) => e.code === "42501");
      } finally { await c.query("reset role"); }
    });

    if (driver.kind === "native-postgresql") {
      // Every contender uses a distinct backend, and all must be observed waiting
      // on a real row lock before release. Promise concurrency alone is insufficient.
      const race = async (specs: { kind: "choice" | "beginner"; seed: Seed; changes?: Row }[], table: "arena_runs" | "arena_profiles", id: string) => {
        const clients: Connection[] = [];
        try {
          // Acquisition is outside the contention window. Record every successful
          // connection before opening the next so a later failure can close all.
          for (const _ of specs) clients.push(await driver.connect());
          const pids: number[] = [];
          for (const client of clients) { await client.query("set role service_role"); pids.push((await client.query("select pg_backend_pid() as pid")).rows[0].pid); }
          assert.equal(new Set(pids).size, specs.length, "Every contender must have its own native backend");
          await c.query("begin");
          await c.query(`select 1 from public.${table} where ${table === "arena_runs" ? "run_id" : "user_id"}=$1 for update`, [id]);
          const pending = clients.map((client, i) => call(client, specs[i].kind, specs[i].seed, specs[i].changes));
          // Attach handlers immediately so an early error is never unhandled.
          const settled = Promise.allSettled(pending);
          let blocked = 0;
          for (let i = 0; i < 250 && blocked < clients.length; i++) {
            await c.query("select pg_stat_clear_snapshot()");
            blocked = (await c.query("select count(*)::int as n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'", [pids])).rows[0].n;
            if (blocked < clients.length) await new Promise(resolve => setTimeout(resolve, 20));
          }
          await c.query("commit");
          assert.equal(blocked, clients.length, "All independent backends must overlap at the gated row lock");
          return await settled;
        } finally {
          try { await c.query("rollback"); }
          finally { await Promise.allSettled(clients.map(client => client.end())); }
        }
      };
      for (const kind of ["choice", "beginner"] as const) await check(`native separate-connection duplicate ${kind} race awards once`, async () => {
        await reset(c); const s = await seed(c, kind === "choice" ? "scenario" : "beginner");
        const results = await race(Array.from({ length: 8 }, () => ({ kind, seed: s })), "arena_runs", s.runId);
        assert(results.every(result => result.status === "fulfilled"));
        const values = results.map(result => (result as PromiseFulfilledResult<Row>).value);
        const original = values.find(value => value.replayed === false); assert(original);
        assert.equal(values.filter(value => value.replayed === false).length, 1);
        values.filter(value => value.replayed).forEach(value => replayOf(original, value));
        if (kind === "choice") await assertChoiceState(c, s); else await assertBeginnerState(c, s);
      });
      await check("native differing canonical choice payload race has exactly one winner", async () => {
        await reset(c); const s = await seed(c);
        const results = await race([{ kind: "choice", seed: s }, { kind: "choice", seed: s, changes: { choiceId: "choice-b" } }], "arena_runs", s.runId);
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult;
        assert.equal(rejected.reason.message, "REWARD_INPUT_CONFLICT"); await assertChoiceState(c, s);
      });
      await check("native same-user different-run beginner race preserves every Core buffer and weekly increment", async () => {
        await reset(c); const s = await seed(c, "beginner"); const seeds = [s];
        for (let i = 0; i < 5; i++) seeds.push(await seed(c, "beginner", true, s.userId));
        const results = await race(seeds.map(seed => ({ kind: "beginner", seed })), "arena_profiles", s.userId);
        assert(results.every(r => r.status === "fulfilled"));
        let expected = { core: 199, buffer: 2 / 3 };
        for (const _ of seeds) expected = legacyCoreOracle(expected.core, expected.buffer);
        const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.userId])).rows[0];
        assert.equal(p.core_xp_total, expected.core); assert.equal(Number(p.core_xp_buffer), expected.buffer);
        assert.equal((await c.query("select xp_total from public.weekly_xp where user_id=$1", [s.userId])).rows[0].xp_total, seeds.length * 30);
        assert.equal((await c.query("select count(*)::int as n from public.arena_reward_receipts")).rows[0].n, seeds.length);
      });
    } else evidence.unrun.push("Native independent-backend duplicate choice/beginner races, differing-payload race and same-user cross-run Core/weekly lost-update races. PGlite has one session; these checks were NOT executed.");
    console.log(JSON.stringify({ ...evidence, passed: evidence.checks.length, migration: path.basename(migrationPath) }, null, 2));
  } finally { await c.end(); await driver.close(); }
}

if (process.argv[1] && path.basename(process.argv[1]) === "legacy-xp-postgres-qa.ts")
  main().catch(error => { console.error(error); process.exitCode = 1; });
