/**
 * Independent Foundry +10 Core transaction oracle, frozen before reading the new SQL.
 * Disposable local fixtures only; no application env or Supabase client is imported.
 */
import assert from "node:assert/strict";
import { SUB_NAMES } from "../src/domain/constants";
import { tierFromCoreXp, codeIndexFromTier, subTierGroupFromTier } from "../src/domain/rules/level-tier";

export const FOUNDRY_AWARD_ORACLE = Object.freeze({ coreGain: 10, maximumPerDay: 3,
  weeklyGain: 0, bufferGain: 0, ownerAward: false,
  cases: ["duplicate receipt", "one event per user", "one source globally", "daily cap",
    "wrong user/event/completion", "owner exclusion", "legacy ledger without receipt",
    "legacy award marker without receipt", "rollback at every required write", "suppressed writes",
    "claim identity/expiry/conflict", "claim partial failure rollback and retry",
    "service-only ACL", "native duplicate/cap/different-day profile races"] as const,
});
const DB_NAME = "bty_foundry_xp_atomic_qa";
export function validateFoundryLocalTarget(value: string | undefined): URL {
  assert(value, "FOUNDRY_XP_TEST_DATABASE_URL is required; application URL fallback is forbidden");
  const url = new URL(value);
  assert(["postgres:", "postgresql:"].includes(url.protocol));
  assert(["127.0.0.1", "[::1]"].includes(url.hostname), "Literal loopback only");
  assert.equal(url.port, "55473"); assert.equal(url.pathname, `/${DB_NAME}`);
  assert.equal(url.search, ""); assert.equal(url.hash, "");
  return url;
}
export function validateFoundryConnectedServer(server: { db: string; host: string; port: number },
  options: { containerService?: boolean; githubActions?: boolean } = {}) {
  const detail = `connectedServer=${JSON.stringify(server)}`;
  assert.equal(server.db, DB_NAME, detail); assert.equal(server.port, 55473, detail);
  if (["127.0.0.1", "::1"].includes(server.host)) return;
  const parts = server.host.split("."); const octets = parts.map(Number);
  const privateIP = parts.length === 4 && parts.every(p => /^(0|[1-9][0-9]{0,2})$/.test(p))
    && octets.every(p => p <= 255) && (octets[0] === 10 || octets[0] === 192 && octets[1] === 168
      || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
  assert(options.containerService === true && options.githubActions === true && privateIP, detail);
}
/** Existing applyDirectCoreXp semantics for a present profile, independent of SQL. */
export function foundryCoreOracle(core: number, renamed = false, currentName: string | null = "QA name") {
  const total = Math.max(0, core) + FOUNDRY_AWARD_ORACLE.coreGain;
  const tier = tierFromCoreXp(total); const code = codeIndexFromTier(tier);
  return { core: total, gain: 10, tier, code, stage: Math.min(7, Math.floor(total / 100) + 1),
    hidden: total >= 700,
    subName: renamed || SUB_NAMES[code] == null ? currentName : SUB_NAMES[code]![subTierGroupFromTier(tier)] };
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID, randomBytes, createHash } from "node:crypto";
type Row = Record<string, any>;
type Connection = { query(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>; end(): Promise<void> };
type Driver = { kind: "native-postgresql" | "pglite-single-session"; connect(): Promise<Connection>; close(): Promise<void> };
type Seed = { user: string; owner: string; event: string; participant: string; progress: string; org: string; assignment: string | null; hash: string };
const AWARD_SQL = "select public.bty_foundry_award_core_atomic($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,$5::timestamptz) as result";
const CLAIM_SQL = "select public.bty_foundry_redeem_completion_claim_atomic($1::text,$2::uuid,$3::text,$4::text,$5::uuid,$6::uuid,$7::integer,$8::date,$9::date,$10::timestamptz,$11::integer,$12::date,$13::date,$14::timestamptz,$15::integer,$16::boolean,$17::timestamptz,$18::timestamptz) as result";
const TABLES = ["public.foundry_completion_claim_receipts", "public.foundry_xp_reward_receipts", "public.foundry_participant_followup_audit", "public.foundry_participant_followups", "public.foundry_participant_apply_windows", "public.foundry_event_assignment_audit", "public.foundry_event_assignments", "public.foundry_event_participation_mode", "public.core_xp_ledger", "public.foundry_event_training_progress", "public.foundry_event_participants", "public.foundry_events", "public.arena_profiles", "public.weekly_xp", "public.bty_org_memberships", "public.bty_organizations", "auth.users"];
let day: { start: string; end: string; date: string; dueDate: string; dueAt: string };

async function driverFor(native: boolean): Promise<Driver> {
  if (native) {
    const url = validateFoundryLocalTarget(process.env.FOUNDRY_XP_TEST_DATABASE_URL);
    const { Client } = await import("pg");
    return { kind: "native-postgresql", async connect() {
      const client = new Client({ connectionString: url.toString(), application_name: DB_NAME, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
      try {
        await client.connect();
        const { rows } = await client.query("select current_database() as db, host(inet_server_addr()) as host, inet_server_port() as port");
        validateFoundryConnectedServer(rows[0], { containerService: process.env.FOUNDRY_XP_TEST_CONTAINER_SERVICE === "1", githubActions: process.env.GITHUB_ACTIONS === "true" });
        return { query: (sql, params) => client.query(sql, params), end: () => client.end() };
      } catch (e) { await client.end().catch(() => {}); throw e; }
    }, async close() {} };
  }
  const modulePath = process.env.FOUNDRY_XP_PGLITE_MODULE;
  if (modulePath) assert(path.isAbsolute(modulePath));
  const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : "@electric-sql/pglite");
  const db = new PGlite(); await db.waitReady;
  const client: Connection = { async query(sql, params) {
    if (params?.length) return db.query(sql, params);
    const result = await db.exec(sql); return result[result.length - 1] ?? { rows: [] };
  }, async end() {} };
  return { kind: "pglite-single-session", async connect() { return client; }, async close() { await db.close(); } };
}
const BASE_SQL = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.arena_profiles(user_id uuid primary key references auth.users(id),lifetime_xp int not null default 0,weekly_xp int not null default 0,core_xp_total int not null default 0,core_xp_buffer numeric not null default 0,tier int not null default 0,code_index int not null default 0,sub_name text,sub_name_renamed_in_code boolean not null default false,stage int not null default 1,code_hidden boolean not null default false,updated_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.weekly_xp(user_id uuid primary key references auth.users(id),xp_total integer not null default 0);
create table public.bty_organizations(id uuid primary key);
create table public.bty_org_memberships(id uuid primary key);
create table public.foundry_events(id uuid primary key,owner_user_id uuid not null references auth.users(id),status text not null default 'active');
create table public.foundry_event_participants(id uuid primary key,event_id uuid not null references public.foundry_events(id),user_id uuid references auth.users(id),unique(event_id,id));
`;
const SOURCES: { file: string; table?: string; fn?: string }[] = [
  { file: "20260302000000_arena_ledgers_memberships_snapshots.sql", table: "core_xp_ledger" },
  { file: "20260714000000_foundry_event_rooms_v1.sql", table: "foundry_event_training_progress" },
  ...["foundry_event_participation_mode", "foundry_event_assignments", "foundry_event_assignment_audit"].map(table => ({ file: "20260721000000_foundry_assignment_foundation_v1.sql", table })),
  ...["foundry_participant_followups", "foundry_participant_followup_audit"].map(table => ({ file: "20260728000000_foundry_participant_followups_v1.sql", table })),
  { file: "20260823000000_foundry_participant_apply_windows_v1.sql", table: "foundry_participant_apply_windows" },
  { file: "20260714000000_foundry_event_rooms_v1.sql", fn: "bty_foundry_award_daily_capped" },
  { file: "20260724000000_foundry_assignment_claim_v2.sql", fn: "bty_foundry_claim_assignment" },
  { file: "20260728000000_foundry_participant_followups_v1.sql", fn: "bty_foundry_materialize_followup" },
  { file: "20260929000000_foundry_apply_action_day_v1.sql", fn: "bty_foundry_materialize_apply_window" },
  { file: "20260827000000_foundry_deferred_completion_claim_v1.sql", fn: "bty_foundry_redeem_completion_claim" },
];
async function bootstrap(c: Connection) {
  assert.equal((await c.query("select count(*)::int as n from information_schema.tables where table_schema in ('public','auth')")).rows[0].n, 0, "Refuse nonempty application/test database");
  await c.query("set timezone='UTC'"); await c.query(BASE_SQL);
  const provenance: Row[] = [];
  for (const spec of SOURCES) {
    const file = path.resolve("supabase/migrations", spec.file); const source = await readFile(file, "utf8");
    const start = source.indexOf(`create ${spec.table ? "table if not exists" : "or replace function"} public.${spec.table ?? spec.fn}`);
    assert(start >= 0, `Actual source definition missing ${file}`);
    const endToken = spec.table ? "\n);" : "\n$$;";
    const end = source.indexOf(endToken, start); assert(end > start, "Definition terminator missing");
    const sql = source.slice(start, end + endToken.length);
    await c.query(sql);
    provenance.push({ file: spec.file, name: spec.table ?? spec.fn, kind: spec.table ? "table" : "function", sha256: createHash("sha256").update(sql).digest("hex") });
  }
  await c.query(`alter table public.foundry_event_training_progress add column claim_secret_hash text,add column claim_secret_expires_at timestamptz,add column claim_consumed_at timestamptz;
    alter table public.foundry_participant_apply_windows add column action_bty_day date;
    create unique index core_xp_ledger_source_idempotent_uq on public.core_xp_ledger(source_type,source_id) where source_id is not null;
    create unique index core_xp_ledger_user_source_uq on public.core_xp_ledger(user_id,source_type,source_id) where source_id is not null;
    create unique index foundry_progress_active_claim_hash_uidx on public.foundry_event_training_progress(claim_secret_hash) where claim_secret_hash is not null and claim_consumed_at is null;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant all on all tables in schema public to service_role;grant usage,select on all sequences in schema public to service_role;
    revoke execute on all functions in schema public from public,anon,authenticated;
    grant execute on all functions in schema public to service_role;
    alter default privileges in schema public grant all on tables to service_role;`);
  for (const table of ["arena_profiles", "weekly_xp", ...SOURCES.filter(s => s.table).map(s => s.table!)]) await c.query(`alter table public.${table} enable row level security`);
  const time = (await c.query("select date_trunc('day',now())::text as start,(date_trunc('day',now())+interval '1 day')::text as end,current_date::text as date,(current_date+7)::text as due_date,(date_trunc('day',now())+interval '7 days')::text as due_at")).rows[0];
  day = { start: time.start, end: time.end, date: time.date, dueDate: time.due_date, dueAt: time.due_at };
  return provenance;
}
async function snapshot(c: Connection) {
  const result: Row = {}; for (const table of TABLES) result[table] = (await c.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as value from ${table} t`)).rows[0].value; return result;
}
async function reset(c: Connection) { await c.query(`truncate ${TABLES.join(",")} restart identity cascade`); }
async function seed(c: Connection, options: { user?: string; event?: string; claim?: boolean; ownerIsUser?: boolean; profile?: boolean } = {}): Promise<Seed> {
  const user = options.user ?? randomUUID(); let owner = options.ownerIsUser ? user : randomUUID(); const event = options.event ?? randomUUID();
  const participant = randomUUID(), progress = randomUUID(), org = randomUUID(), hash = randomBytes(32).toString("hex");
  await c.query("insert into auth.users(id) values($1),($2) on conflict do nothing", [user, owner]);
  if (options.event) owner = (await c.query("select owner_user_id from public.foundry_events where id=$1", [event])).rows[0].owner_user_id;
  else await c.query("insert into public.foundry_events(id,owner_user_id) values($1,$2)", [event, owner]);
  if (options.profile !== false) await c.query("insert into public.arena_profiles(user_id,lifetime_xp,weekly_xp,core_xp_total,core_xp_buffer,tier,sub_name,stage) values($1,11,7,199,$2,19,'QA name',2) on conflict do nothing", [user, 2 / 3]);
  await c.query("insert into public.weekly_xp(user_id,xp_total) values($1,13) on conflict do nothing", [user]);
  await c.query("insert into public.foundry_event_participants(id,event_id,user_id) values($1,$2,$3)", [participant, event, options.claim ? null : user]);
  await c.query("insert into public.foundry_event_training_progress(id,event_id,participant_id,video_completed_at,response_text,completed_at,linked_user_id,claim_secret_hash,claim_secret_expires_at) values($1,$2,$3,now(),'QA completion',now(),$4,$5,now()+interval '1 day')", [progress, event, participant, options.claim ? null : user, options.claim ? hash : null]);
  let assignment: string | null = null;
  if (options.claim) {
    assignment = randomUUID(); const membership = randomUUID();
    await c.query("insert into public.bty_organizations(id) values($1)", [org]); await c.query("insert into public.bty_org_memberships(id) values($1)", [membership]);
    await c.query("insert into public.foundry_event_participation_mode(event_id,mode) values($1,'assigned_overlay')", [event]);
    await c.query("insert into public.foundry_event_assignments(id,event_id,organization_id,membership_id,user_id,membership_id_snapshot,user_id_snapshot,assigned_by_snapshot) values($1,$2,$3,$4,$5,$4,$5,$6)", [assignment, event, org, membership, user, owner]);
  }
  return { user, owner, event, participant, progress, org, assignment, hash };
}
function awardParams(s: Seed, over: Row = {}) { return [over.user ?? s.user, over.event ?? s.event, over.progress ?? s.progress, Object.hasOwn(over, "start") ? over.start : day.start, Object.hasOwn(over, "end") ? over.end : day.end]; }
function claimParams(s: Seed, over: Row = {}) { return [over.hash ?? s.hash, over.user ?? s.user, "UTC", "QA training", s.assignment, s.org,
  7, day.date, day.dueDate, day.dueAt, 7, day.date, day.dueDate, day.dueAt, over.xp ?? 10, over.eligible ?? true, day.start, day.end]; }
async function call(c: Connection, kind: "award" | "claim", s: Seed, over: Row = {}): Promise<Row> {
  return (await c.query(kind === "award" ? AWARD_SQL : CLAIM_SQL, kind === "award" ? awardParams(s, over) : claimParams(s, over))).rows[0].result;
}
async function serviceCall(c: Connection, kind: "award" | "claim", s: Seed, over: Row = {}) {
  await c.query("set role service_role"); try { return await call(c, kind, s, over); } finally { await c.query("reset role"); }
}
async function assertAward(c: Connection, s: Seed, core = 199, buffer = 2 / 3, renamed = false) {
  const expected = foundryCoreOracle(core, renamed); const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.user])).rows[0];
  assert.equal(p.core_xp_total, expected.core); assert.equal(Number(p.core_xp_buffer), buffer); assert.equal(p.weekly_xp, 7); assert.equal(p.lifetime_xp, 11);
  assert.equal(p.tier, expected.tier); assert.equal(p.code_index, expected.code); assert.equal(p.stage, expected.stage); assert.equal(p.code_hidden, expected.hidden); assert.equal(p.sub_name, expected.subName);
  assert.equal((await c.query("select xp_total from public.weekly_xp where user_id=$1", [s.user])).rows[0].xp_total, 13);
  assert.equal((await c.query("select count(*)::int as n from public.core_xp_ledger where source_id=$1 and source_type='foundry_training_completion' and user_id=$2 and delta_xp=10", [s.progress, s.user])).rows[0].n, 1);
  const progress = (await c.query("select * from public.foundry_event_training_progress where id=$1", [s.progress])).rows[0];
  assert(progress.xp_awarded_at); assert.equal(progress.linked_user_id, s.user);
}
function assertReplay(first: Row, next: Row, kind: "award" | "claim" = "award") {
  assert.deepEqual(next, { ...first, ...(kind === "award" ? { outcome: "already_awarded" } : {}), replayed: true });
}
async function assertClaim(c: Connection, s: Seed) {
  await assertAward(c, s);
  const p = (await c.query("select * from public.foundry_event_training_progress where id=$1", [s.progress])).rows[0]; assert(p.claim_consumed_at); assert.equal(p.linked_user_id, s.user);
  const a = (await c.query("select * from public.foundry_event_assignments where id=$1", [s.assignment])).rows[0]; assert.equal(a.participant_id, s.participant); assert.equal(a.status, "completed");
  for (const table of ["foundry_event_assignment_audit", "foundry_participant_followups", "foundry_participant_followup_audit", "foundry_participant_apply_windows", "foundry_completion_claim_receipts"]) assert.equal((await c.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 1, table);
}

export async function main() {
  const native = process.argv.includes("--postgres"), embedded = process.argv.includes("--pglite"); assert(native !== embedded, "Select exactly one explicit SQL engine");
  const index = process.argv.indexOf("--migration"); assert(index >= 0 && process.argv[index + 1]);
  const migrationPath = process.argv[index + 1]!; assert(path.isAbsolute(migrationPath), "Explicit absolute migration path required");
  assert.equal(path.basename(migrationPath), "20261101001020_foundry_core_atomic_rewards.sql");
  const migration = await readFile(migrationPath, "utf8");
  const driver = await driverFor(native); const c = await driver.connect();
  const evidence: Row = { engine: driver.kind, migration: path.basename(migrationPath), migrationSha256: createHash("sha256").update(migration).digest("hex"),
    fixture: "Isolated current-column subset plus unchanged original ledger/claim/assignment/followup/apply-window SQL bodies; not a production database", checks: [], unrun: [] };
  const check = async (name: string, fn: () => Promise<void>) => { await fn(); evidence.checks.push(name); console.error(`PASS ${name}`); };
  try {
    evidence.engineVersion = (await c.query("select version() as version")).rows[0].version;
    evidence.originalDefinitions = await bootstrap(c);
    await check("prepared migration applies twice without changing original functions", async () => {
      const names = SOURCES.filter(s => s.fn).map(s => s.fn);
      const defs = async () => (await c.query("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[]) order by p.proname", [names])).rows;
      const original = await defs(); assert.equal(original.length, names.length);
      await c.query(migration); await c.query(migration); assert.deepEqual(await defs(), original);
    });
    await check("fixed +10 Core and one ledger/marker/receipt commit; frozen replay mutates nothing", async () => {
      await reset(c); const s = await seed(c); const first = await serviceCall(c, "award", s);
      assert.equal(first.policyVersion, "foundry-core-atomic/v1"); assert.equal(first.outcome, "awarded"); assert.equal(first.deltaXp, 10);
      assert.equal(first.coreBefore, 199); assert.equal(first.coreAfter, 209); assert.equal(first.replayed, false); assert.equal(first.requestedProgressId, s.progress);
      await assertAward(c, s); const before = await snapshot(c); assertReplay(first, await serviceCall(c, "award", s)); assert.deepEqual(await snapshot(c), before);
      await c.query("update public.arena_profiles set core_xp_total=999 where user_id=$1", [s.user]); const later = await snapshot(c);
      assertReplay(first, await serviceCall(c, "award", s, { start: null, end: null })); assert.deepEqual(await snapshot(c), later);
    });
    await check("same-user second participant cannot earn this event twice", async () => {
      await reset(c); const s = await seed(c); const first = await serviceCall(c, "award", s);
      const second = await seed(c, { user: s.user, event: s.event }); const before = await snapshot(c);
      assert.deepEqual(await serviceCall(c, "award", second), { ...first, requestedProgressId: second.progress, outcome: "event_already_awarded", replayed: true });
      assert.deepEqual(await snapshot(c), before);
    });
    await check("retained reward receipt prevents a deleted progress UUID earning under a different event", async () => {
      await reset(c); const s = await seed(c); await serviceCall(c, "award", s);
      await c.query("delete from public.foundry_event_training_progress where id=$1", [s.progress]);
      const another = await seed(c, { user: s.user });
      await c.query("update public.foundry_event_training_progress set id=$2 where id=$1", [another.progress, s.progress]);
      another.progress = s.progress; const before = await snapshot(c);
      await assert.rejects(serviceCall(c, "award", another), (e: Row) => e.message === "FOUNDRY_XP_ACCOUNT_CONFLICT");
      assert.deepEqual(await snapshot(c), before);
    });
    await check("retained event receipt survives its original progress deletion", async () => {
      await reset(c); const s = await seed(c); const first = await serviceCall(c, "award", s);
      await c.query("delete from public.foundry_event_training_progress where id=$1", [s.progress]);
      const second = await seed(c, { user: s.user, event: s.event }); const before = await snapshot(c);
      assert.deepEqual(await serviceCall(c, "award", second), { ...first, requestedProgressId: second.progress, outcome: "event_already_awarded", replayed: true });
      assert.deepEqual(await snapshot(c), before);
    });
    await check("owner receives no reward or fabricated paid marker", async () => {
      await reset(c); const s = await seed(c, { ownerIsUser: true }); const before = await snapshot(c);
      assert.equal((await serviceCall(c, "award", s)).outcome, "owner_ineligible"); assert.deepEqual(await snapshot(c), before);
    });
    await check("earned receipt replays after the learner becomes the event owner", async () => {
      await reset(c); const s = await seed(c); const first = await serviceCall(c, "award", s);
      await c.query("update public.foundry_events set owner_user_id=$2 where id=$1", [s.event, s.user]);
      const before = await snapshot(c); assertReplay(first, await serviceCall(c, "award", s)); assert.deepEqual(await snapshot(c), before);
    });
    await check("retained event receipt replays to a new progress after owner transfer", async () => {
      await reset(c); const s = await seed(c); const first = await serviceCall(c, "award", s);
      await c.query("delete from public.foundry_event_training_progress where id=$1", [s.progress]);
      await c.query("update public.foundry_events set owner_user_id=$2 where id=$1", [s.event, s.user]);
      const second = await seed(c, { user: s.user, event: s.event }); const before = await snapshot(c);
      assert.deepEqual(await serviceCall(c, "award", second), { ...first, requestedProgressId: second.progress, outcome: "event_already_awarded", replayed: true });
      assert.deepEqual(await snapshot(c), before);
    });
    await check("day cap preserves exactly three +10 awards and no fourth stamp", async () => {
      await reset(c); const s = await seed(c); const seeds = [s]; for (let i = 0; i < 3; i++) seeds.push(await seed(c, { user: s.user }));
      for (const next of seeds.slice(0, 3)) assert.equal((await serviceCall(c, "award", next)).outcome, "awarded");
      const before = await snapshot(c); assert.equal((await serviceCall(c, "award", seeds[3]!)).outcome, "daily_limit"); assert.deepEqual(await snapshot(c), before);
      assert.equal((await c.query("select core_xp_total from public.arena_profiles where user_id=$1", [s.user])).rows[0].core_xp_total, 229);
      assert.equal((await c.query("select count(*)::int as n from public.foundry_xp_reward_receipts")).rows[0].n, 3);
    });
    for (const mode of ["wrong-user", "wrong-event", "incomplete", "anonymous-unlinked"] as const) await check(`${mode} cannot award or mutate rows`, async () => {
      await reset(c); const s = await seed(c, { claim: mode === "anonymous-unlinked" }); const over: Row = {};
      if (mode === "wrong-user") over.user = s.owner;
      if (mode === "wrong-event") over.event = randomUUID();
      if (mode === "incomplete") await c.query("update public.foundry_event_training_progress set completed_at=null where id=$1", [s.progress]);
      const before = await snapshot(c), code = mode === "wrong-event" ? "FOUNDRY_XP_SOURCE_MISMATCH" : mode === "incomplete" ? "FOUNDRY_XP_NOT_COMPLETED" : "FOUNDRY_XP_ACCOUNT_CONFLICT";
      await assert.rejects(serviceCall(c, "award", s, over), (e: Row) => e.message === code); assert.deepEqual(await snapshot(c), before);
    });
    for (const mode of ["ledger", "marker", "other-user-ledger"] as const) await check(`legacy ${mode} without receipt is review-required, never guessed paid`, async () => {
      await reset(c); const s = await seed(c);
      if (mode === "marker") await c.query("update public.foundry_event_training_progress set xp_awarded_at=now() where id=$1", [s.progress]);
      else await c.query("insert into public.core_xp_ledger(user_id,delta_xp,source_type,source_id) values($1,10,'foundry_training_completion',$2)", [mode === "other-user-ledger" ? s.owner : s.user, s.progress]);
      const before = await snapshot(c); await assert.rejects(serviceCall(c, "award", s), (e: Row) => e.message === "FOUNDRY_XP_REVIEW_REQUIRED"); assert.deepEqual(await snapshot(c), before);
    });
    for (const values of [{ start: null }, { end: null }, { start: day.end }, { end: day.start }, { start: "infinity" }, { start: "2000-01-01T00:00:00Z" }]) await check(`invalid fresh day window fails closed ${JSON.stringify(values)}`, async () => {
      await reset(c); const s = await seed(c); const before = await snapshot(c);
      await assert.rejects(serviceCall(c, "award", s, values), (e: Row) => e.message === "FOUNDRY_XP_INVALID_INPUT"); assert.deepEqual(await snapshot(c), before);
    });
    await check("missing profile is created and canonically projects its first +10 Core", async () => {
      await reset(c); const s = await seed(c, { profile: false }); const result = await serviceCall(c, "award", s);
      assert.equal(result.coreBefore, 0); assert.equal(result.coreAfter, 10);
      const p = (await c.query("select * from public.arena_profiles where user_id=$1", [s.user])).rows[0];
      assert.equal(p.core_xp_total, 10); assert.equal(p.tier, 1); assert.equal(Number(p.core_xp_buffer), 0); assert.equal(p.weekly_xp, 0); assert.equal(p.lifetime_xp, 0);
    });
    for (const core of [0, 199, 249, 699, 999, 2499, 6999, 7000]) for (const renamed of [false, true]) await check(`Core projection parity ${core}, renamed=${renamed}`, async () => {
      await reset(c); const s = await seed(c); await c.query("update public.arena_profiles set core_xp_total=$2,sub_name_renamed_in_code=$3 where user_id=$1", [s.user, core, renamed]);
      await serviceCall(c, "award", s); await assertAward(c, s, core, 2 / 3, renamed);
    });
    await check("one transaction claims assignment/followup/apply/identity and Core; replay writes nothing", async () => {
      await reset(c); const s = await seed(c, { claim: true }); const first = await serviceCall(c, "claim", s);
      assert.equal(first.policyVersion, "foundry-claim-atomic/v1"); assert.equal(first.progressId, s.progress); assert.equal(first.eventId, s.event);
      assert.equal(first.replayed, false); assert.equal(first.xp.outcome, "awarded"); await assertClaim(c, s);
      const before = await snapshot(c); assertReplay(first, await serviceCall(c, "claim", s), "claim"); assert.deepEqual(await snapshot(c), before);
    });
    await check("same-account second anonymous session preserves a previously claimed assignment", async () => {
      await reset(c); const first = await seed(c, { claim: true }); await serviceCall(c, "claim", first);
      const second = await seed(c, { user: first.user, event: first.event }); second.assignment = first.assignment; second.org = first.org;
      await c.query("update public.foundry_event_participants set user_id=null where id=$1", [second.participant]);
      await c.query("update public.foundry_event_training_progress set linked_user_id=null,claim_secret_hash=$2,claim_secret_expires_at=now()+interval '1 day' where id=$1", [second.progress, second.hash]);
      const original = (await c.query("select * from public.foundry_event_assignments where id=$1", [first.assignment])).rows;
      const result = await serviceCall(c, "claim", second); assert.equal(result.xp.outcome, "event_already_awarded");
      assert.deepEqual((await c.query("select * from public.foundry_event_assignments where id=$1", [first.assignment])).rows, original);
      assert.equal((await c.query("select core_xp_total from public.arena_profiles where user_id=$1", [first.user])).rows[0].core_xp_total, 209);
      assert.equal((await c.query("select linked_user_id from public.foundry_event_training_progress where id=$1", [second.progress])).rows[0].linked_user_id, first.user);
    });
    await check("replay uses the original claim expiry even if the mutable progress expiry is extended", async () => {
      await reset(c); const s = await seed(c, { claim: true }); await serviceCall(c, "claim", s);
      await c.query("update public.foundry_completion_claim_receipts set expires_at=now()-interval '1 second' where claim_hash=$1", [s.hash]);
      await c.query("update public.foundry_event_training_progress set claim_secret_expires_at=now()+interval '30 days' where id=$1", [s.progress]);
      const before = await snapshot(c); assert.equal((await serviceCall(c, "claim", s)).outcome, "invalid"); assert.deepEqual(await snapshot(c), before);
    });
    for (const mode of ["wrong-user-after-claim", "expired", "participant-conflict", "linked-without-receipt", "malformed-hash", "wrong-xp"] as const) await check(`claim ${mode} refuses without mutation`, async () => {
      await reset(c); const s = await seed(c, { claim: true }); const over: Row = {};
      if (mode === "wrong-user-after-claim") { await serviceCall(c, "claim", s); over.user = s.owner; }
      if (mode === "expired") await c.query("update public.foundry_event_training_progress set claim_secret_expires_at=now()-interval '1 minute' where id=$1", [s.progress]);
      if (mode === "participant-conflict") await c.query("update public.foundry_event_participants set user_id=$2 where id=$1", [s.participant, s.owner]);
      if (mode === "linked-without-receipt") await c.query("update public.foundry_event_training_progress set linked_user_id=$2 where id=$1", [s.progress, s.user]);
      if (mode === "malformed-hash") over.hash = "bad";
      if (mode === "wrong-xp") over.xp = 999;
      const before = await snapshot(c); assert.equal((await serviceCall(c, "claim", s, over)).outcome, "invalid"); assert.deepEqual(await snapshot(c), before);
    });
    await check("historical award evidence rolls the entire tentative claim back", async () => {
      await reset(c); const s = await seed(c, { claim: true });
      await c.query("insert into public.core_xp_ledger(user_id,delta_xp,source_type,source_id) values($1,10,'foundry_training_completion',$2)", [s.user, s.progress]);
      const before = await snapshot(c); await assert.rejects(serviceCall(c, "claim", s), (e: Row) => e.message === "FOUNDRY_XP_REVIEW_REQUIRED"); assert.deepEqual(await snapshot(c), before);
    });
    await c.query("create function public.qa_fault() returns trigger language plpgsql as $$ begin raise exception 'QA_SQL_FAULT'; end $$; create function public.qa_suppress() returns trigger language plpgsql as $$ begin return null; end $$");
    const stages: { kind: "award" | "claim"; table: string; operation: "insert" | "update"; when?: string; profile?: boolean }[] = [
      { kind: "award", table: "arena_profiles", operation: "insert", profile: false },
      { kind: "award", table: "core_xp_ledger", operation: "insert" }, { kind: "award", table: "arena_profiles", operation: "update" },
      { kind: "award", table: "foundry_event_training_progress", operation: "update" }, { kind: "award", table: "foundry_xp_reward_receipts", operation: "insert" },
      { kind: "claim", table: "foundry_event_training_progress", operation: "update", when: "when(old.linked_user_id is null and new.linked_user_id is not null)" },
      { kind: "claim", table: "foundry_event_assignments", operation: "update" }, { kind: "claim", table: "foundry_event_assignment_audit", operation: "insert" },
      { kind: "claim", table: "foundry_participant_followups", operation: "insert" }, { kind: "claim", table: "foundry_participant_followup_audit", operation: "insert" },
      { kind: "claim", table: "foundry_participant_apply_windows", operation: "insert" },
      { kind: "claim", table: "foundry_event_training_progress", operation: "update", when: "when(old.claim_consumed_at is null and new.claim_consumed_at is not null)" },
      { kind: "claim", table: "core_xp_ledger", operation: "insert" }, { kind: "claim", table: "arena_profiles", operation: "update" },
      { kind: "claim", table: "foundry_xp_reward_receipts", operation: "insert" }, { kind: "claim", table: "foundry_completion_claim_receipts", operation: "insert" },
    ];
    for (const suppressed of [false, true]) for (const stage of stages) await check(`${stage.kind} ${suppressed ? "suppressed" : "faulted"} ${stage.table}/${stage.operation}/${stage.when ?? "all"} rolls back and retries`, async () => {
      await reset(c); const s = await seed(c, { claim: stage.kind === "claim", profile: stage.profile }); const before = await snapshot(c);
      await c.query(`create trigger qa_stage ${suppressed ? "before" : "after"} ${stage.operation} on public.${stage.table} for each row ${stage.when ?? ""} execute function public.${suppressed ? "qa_suppress" : "qa_fault"}()`);
      try { await assert.rejects(serviceCall(c, stage.kind, s), (e: Row) => e.message === (suppressed ? "FOUNDRY_XP_WRITE_FAILED" : "QA_SQL_FAULT")); }
      finally { await c.query(`drop trigger qa_stage on public.${stage.table}`); }
      assert.deepEqual(await snapshot(c), before);
      const first = await serviceCall(c, stage.kind, s); assert.equal(stage.kind === "claim" ? first.xp.outcome : first.outcome, "awarded");
      if (stage.kind === "claim") await assertClaim(c, s); else if (stage.profile !== false) await assertAward(c, s);
      const paid = await snapshot(c); assertReplay(first, await serviceCall(c, stage.kind, s), stage.kind); assert.deepEqual(await snapshot(c), paid);
    });
    await c.query(`create function public.qa_profile_drift() returns trigger language plpgsql as $$ begin
      if TG_ARGV[0]='core_xp_buffer' then NEW.core_xp_buffer:=OLD.core_xp_buffer+1;
      elsif TG_ARGV[0]='weekly_xp' then NEW.weekly_xp:=OLD.weekly_xp+1;
      else NEW.lifetime_xp:=OLD.lifetime_xp+1; end if; return NEW; end $$`);
    for (const field of ["core_xp_buffer", "weekly_xp", "lifetime_xp"]) await check(`protected profile ${field} drift rolls the whole award back`, async () => {
      await reset(c); const s = await seed(c); const before = await snapshot(c);
      await c.query(`create trigger qa_drift before update on public.arena_profiles for each row execute function public.qa_profile_drift('${field}')`);
      try { await assert.rejects(serviceCall(c, "award", s), (e: Row) => e.message === "FOUNDRY_XP_WRITE_FAILED"); }
      finally { await c.query("drop trigger qa_drift on public.arena_profiles"); }
      assert.deepEqual(await snapshot(c), before);
      await serviceCall(c, "award", s); await assertAward(c, s);
    });
    await check("client roles cannot call either new RPC/read receipts; service can append/read only", async () => {
      await reset(c); const s = await seed(c); const claim = await seed(c, { claim: true });
      for (const role of ["anon", "authenticated"]) {
        await c.query(`set role ${role}`); try {
          await assert.rejects(call(c, "award", s), (e: Row) => e.code === "42501");
          await assert.rejects(call(c, "claim", claim), (e: Row) => e.code === "42501");
          for (const table of ["foundry_xp_reward_receipts", "foundry_completion_claim_receipts"]) await assert.rejects(c.query(`select * from public.${table}`), (e: Row) => e.code === "42501");
        } finally { await c.query("reset role"); }
      }
      await serviceCall(c, "award", s); await serviceCall(c, "claim", claim);
      await c.query("set role service_role"); try {
        for (const table of ["foundry_xp_reward_receipts", "foundry_completion_claim_receipts"]) {
          assert.equal((await c.query(`select count(*)::int as n from public.${table}`)).rows[0].n > 0, true);
          for (const sql of [`update public.${table} set result='{}'::jsonb`, `delete from public.${table}`, `truncate public.${table}`]) await assert.rejects(c.query(sql), (e: Row) => e.code === "42501");
        }
      } finally { await c.query("reset role"); }
    });
    if (driver.kind === "native-postgresql") {
      const race = async (specs: { kind: "award" | "claim"; seed: Seed; over?: Row }[], table: "arena_profiles" | "foundry_event_training_progress", id: string) => {
        const clients: Connection[] = [];
        try {
          for (const _ of specs) clients.push(await driver.connect());
          const pids: number[] = []; for (const client of clients) { await client.query("set role service_role"); pids.push((await client.query("select pg_backend_pid() as pid")).rows[0].pid); }
          assert.equal(new Set(pids).size, specs.length);
          await c.query("begin"); await c.query(`select 1 from public.${table} where ${table === "arena_profiles" ? "user_id" : "id"}=$1 for update`, [id]);
          const pending = Promise.allSettled(clients.map((client, i) => call(client, specs[i]!.kind, specs[i]!.seed, specs[i]!.over)));
          let blocked = 0; for (let i = 0; i < 250 && blocked < clients.length; i++) {
            await c.query("select pg_stat_clear_snapshot()"); blocked = (await c.query("select count(*)::int as n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'", [pids])).rows[0].n;
            if (blocked < clients.length) await new Promise(resolve => setTimeout(resolve, 20));
          }
          await c.query("commit"); assert.equal(blocked, specs.length, "All distinct backends must be observed waiting on SQL locks while the gated row is held");
          return await pending;
        } finally { try { await c.query("rollback"); } finally { await Promise.allSettled(clients.map(client => client.end())); } }
      };
      for (const kind of ["award", "claim"] as const) await check(`native duplicate ${kind} race commits one receipt and one Core increment`, async () => {
        await reset(c); const s = await seed(c, { claim: kind === "claim" }); const settled = await race(Array.from({ length: 8 }, () => ({ kind, seed: s })), "foundry_event_training_progress", s.progress);
        assert(settled.every(r => r.status === "fulfilled")); const results = settled.map(r => (r as PromiseFulfilledResult<Row>).value);
        assert.equal(results.filter(r => r.replayed === false).length, 1);
        const winner = results.find(r => r.replayed === false)!;
        results.filter(r => r !== winner).forEach(result => assertReplay(winner, result, kind));
        if (kind === "claim") await assertClaim(c, s); else await assertAward(c, s);
        assert.equal((await c.query("select count(*)::int as n from public.foundry_xp_reward_receipts")).rows[0].n, 1);
      });
      await check("native different-participant same-event race still awards the event once", async () => {
        await reset(c); const s = await seed(c); const seeds = [s];
        for (let i = 0; i < 7; i++) seeds.push(await seed(c, { user: s.user, event: s.event }));
        const settled = await race(seeds.map(seed => ({ kind: "award", seed })), "arena_profiles", s.user);
        assert(settled.every(r => r.status === "fulfilled")); const values = settled.map(r => (r as PromiseFulfilledResult<Row>).value);
        assert.equal(values.filter(r => r.outcome === "awarded").length, 1);
        assert.equal(values.filter(r => r.outcome === "event_already_awarded").length, 7);
        const paid = values.find(r => r.outcome === "awarded")!;
        values.forEach((value, i) => {
          if (value !== paid) assert.deepEqual(value, { ...paid, requestedProgressId: seeds[i]!.progress, outcome: "event_already_awarded", replayed: true });
        });
        await assertAward(c, seeds.find(s => s.progress === paid.awardedProgressId)!);
        assert.equal((await c.query("select count(*)::int as n from public.foundry_xp_reward_receipts")).rows[0].n, 1);
      });
      await check("native eight-event daily cap race awards exactly three, never loses Core", async () => {
        await reset(c); const s = await seed(c); const seeds = [s]; for (let i = 0; i < 7; i++) seeds.push(await seed(c, { user: s.user }));
        const settled = await race(seeds.map(seed => ({ kind: "award", seed })), "arena_profiles", s.user); assert(settled.every(r => r.status === "fulfilled"));
        const values = settled.map(r => (r as PromiseFulfilledResult<Row>).value); assert.equal(values.filter(r => r.outcome === "awarded").length, 3); assert.equal(values.filter(r => r.outcome === "daily_limit").length, 5);
        assert.equal((await c.query("select core_xp_total from public.arena_profiles where user_id=$1", [s.user])).rows[0].core_xp_total, 229);
        assert.equal((await c.query("select count(*)::int as n from public.core_xp_ledger")).rows[0].n, 3);
        assert.equal((await c.query("select count(*)::int as n from public.foundry_xp_reward_receipts")).rows[0].n, 3);
        assert.equal((await c.query("select count(*)::int as n from public.foundry_event_training_progress where xp_awarded_at is not null")).rows[0].n, 3);
        const profile = (await c.query("select weekly_xp,lifetime_xp,core_xp_buffer from public.arena_profiles where user_id=$1", [s.user])).rows[0];
        assert.equal(profile.weekly_xp, 7); assert.equal(profile.lifetime_xp, 11); assert.equal(Number(profile.core_xp_buffer), 2 / 3);
        assert.equal((await c.query("select xp_total from public.weekly_xp where user_id=$1", [s.user])).rows[0].xp_total, 13);
      });
      await check("native different-day advisory keys still serialize the same Core profile", async () => {
        await reset(c); const s = await seed(c); const second = await seed(c, { user: s.user });
        const previous = (await c.query("select ($1::timestamptz-interval '1 hour')::text as start", [day.start])).rows[0].start;
        const settled = await race([{ kind: "award", seed: s }, { kind: "award", seed: second, over: { start: previous } }], "arena_profiles", s.user);
        assert(settled.every(r => r.status === "fulfilled"));
        assert.equal((await c.query("select core_xp_total from public.arena_profiles where user_id=$1", [s.user])).rows[0].core_xp_total, 219);
        for (const table of ["core_xp_ledger", "foundry_xp_reward_receipts"]) assert.equal((await c.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 2);
        assert.equal((await c.query("select count(*)::int as n from public.foundry_event_training_progress where xp_awarded_at is not null")).rows[0].n, 2);
        const profile = (await c.query("select weekly_xp,lifetime_xp,core_xp_buffer from public.arena_profiles where user_id=$1", [s.user])).rows[0];
        assert.equal(profile.weekly_xp, 7); assert.equal(profile.lifetime_xp, 11); assert.equal(Number(profile.core_xp_buffer), 2 / 3);
      });
    } else evidence.unrun.push("Native distinct-backend duplicate award/claim, same-event different-participant race, eight-event cap race and different-day Core-profile race are not executed by single-session PGlite.");
    console.log(JSON.stringify({ ...evidence, passed: evidence.checks.length }, null, 2));
  } finally { await c.end(); await driver.close(); }
}
if (process.argv[1] && path.basename(process.argv[1]) === "foundry-xp-postgres-qa.ts") main().catch(e => { console.error(e); process.exitCode = 1; });
