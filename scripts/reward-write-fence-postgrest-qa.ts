/**
 * Real PostgREST verification of the reward write cutover. A disposable PostgreSQL
 * database (literal loopback URL, port 55491, database bty_reward_fence_rest, empty)
 * receives the production schema subset exported read-only from pg_catalog
 * (scripts/qa/reward-fence-prod-schema.sql: no table rows, no user data), the
 * production auth helpers and PostgREST DDL-watch event triggers. PostgREST runs as a
 * child process; a loopback proxy maps /rest/v1 to it so the application's own
 * supabase-js clients and server helpers are exercised unchanged. JWTs are signed with
 * a per-run random secret; no Supabase project, credential or app environment is used.
 *
 *   REWARD_FENCE_REST_DATABASE_URL=postgresql://postgres@127.0.0.1:55491/bty_reward_fence_rest \
 *   POSTGREST_BIN=/abs/postgrest node --import tsx scripts/reward-write-fence-postgrest-qa.ts --json /abs/out.json
 *
 * Every check in EXPECTED_CHECKS must execute exactly once or the run fails.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildApplyBundle, readCutoverSources } from "./reward-write-fence-cutover.mjs";
import { validateFenceServer } from "./reward-write-fence-postgres-qa-target";

type Row = Record<string, any>;
const DB = "bty_reward_fence_rest";
const PORT = "55491";
const REST_PORT = 55492, ADMIN_PORT = 55493, PROXY_PORT = 55494;
const AUTHENTICATOR_PASSWORD = "reward-fence-disposable-only";
const LEGACY_SCENARIO = "patient_refuses_treatment_001";
const CANONICAL_SCENARIO = "INCIDENT-01-OWN-01";
const EXPECTED_CHECKS = [
  "production schema subset loads under PostgREST 14.5 with production auth helpers and DDL watch triggers",
  "before cutover: app helpers report storage unavailable and never fall back to split writes",
  "before cutover: the previous release's split writes succeed through PostgREST",
  "cutover applies while PostgREST serves; the DDL watch trigger reloads the schema cache without restart",
  "fenced previous-release writes through PostgREST fail at commit and persist nothing",
  "Healing user-JWT writes are refused through PostgREST",
  "receipt tables and atomic RPCs are closed to anon and authenticated and open to service_role",
  "app legacy reward helpers through supabase-js: award, frozen replay, conflict and review-required",
  "app Healing and Foundry helpers through supabase-js commit atomically and replay",
  "weekly quest through supabase-js: five concurrent HTTP claims pay +15 once; ineligible and invalid weeks write nothing",
  "unchanged writers through PostgREST keep working",
  "production arena_profiles triggers coexist with atomic RPC updates",
];

// Observed read-only from production (pg_get_functiondef) on 2026-11-01.
const BOOTSTRAP_SQL = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end $$;
alter role authenticator password '${AUTHENTICATOR_PASSWORD}';
grant anon, authenticated, service_role to authenticator;
create schema extensions;
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists pgcrypto schema extensions;
create schema auth; create table auth.users(id uuid primary key);
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $function$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$function$;
create function auth.role() returns text language sql stable as $function$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$function$;
create function auth.jwt() returns jsonb language sql stable as $function$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$function$;
create function extensions.pgrst_ddl_watch() returns event_trigger language plpgsql set search_path to '' as $function$
declare cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands() loop
    if cmd.command_tag in ('CREATE SCHEMA', 'ALTER SCHEMA', 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE',
      'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE', 'CREATE VIEW', 'ALTER VIEW', 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW',
      'CREATE FUNCTION', 'ALTER FUNCTION', 'CREATE TRIGGER', 'CREATE TYPE', 'ALTER TYPE', 'CREATE RULE', 'COMMENT')
      and cmd.schema_name is distinct from 'pg_temp' then
      notify pgrst, 'reload schema';
    end if;
  end loop;
end; $function$;
create function extensions.pgrst_drop_watch() returns event_trigger language plpgsql set search_path to '' as $function$
declare obj record;
begin
  for obj in select * from pg_event_trigger_dropped_objects() loop
    if obj.object_type in ('schema', 'table', 'foreign table', 'view', 'materialized view', 'function', 'trigger', 'type', 'rule')
      and obj.is_temporary is false then
      notify pgrst, 'reload schema';
    end if;
  end loop;
end; $function$;
create event trigger pgrst_ddl_watch on ddl_command_end execute procedure extensions.pgrst_ddl_watch();
create event trigger pgrst_drop_watch on sql_drop execute procedure extensions.pgrst_drop_watch();
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key, statements text[], name text, created_by text, idempotency_key text, rollback text[]);
`;

export function validateRestTarget(value: string | undefined): URL {
  assert(value, "REWARD_FENCE_REST_DATABASE_URL is required; no application URL fallback exists");
  const u = new URL(value);
  assert(["postgres:", "postgresql:"].includes(u.protocol));
  assert(["127.0.0.1", "[::1]"].includes(u.hostname), "Only literal loopback targets are accepted");
  assert.equal(u.port, PORT); assert.equal(u.pathname, `/${DB}`);
  assert.equal(u.search, ""); assert.equal(u.hash, "");
  return u;
}

const b64 = (value: Buffer | string) => Buffer.from(value).toString("base64url");
function signJwt(secret: string, claims: Row): string {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
}

async function waitFor(fn: () => Promise<boolean>, ms: number, what: string) {
  const start = Date.now();
  while (Date.now() - start < ms) { if (await fn().catch(() => false)) return Date.now() - start; await new Promise(r => setTimeout(r, 100)); }
  assert.fail(`timed out waiting for ${what}`);
}

function startProxy(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/";
    const upstream = http.request({ host: "127.0.0.1", port: REST_PORT, path: url, method: req.method, headers: req.headers }, up => {
      res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  return new Promise(resolve => server.listen(PROXY_PORT, "127.0.0.1", () => resolve(server)));
}

async function main() {
  const jsonIndex = process.argv.indexOf("--json");
  const jsonOut = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : undefined;
  if (jsonOut) assert(path.isAbsolute(jsonOut), "Absolute --json path required");
  const url = validateRestTarget(process.env.REWARD_FENCE_REST_DATABASE_URL);
  const bin = process.env.POSTGREST_BIN; assert(bin && path.isAbsolute(bin), "POSTGREST_BIN must be an absolute path");
  const { Client } = await import("pg");
  const pg = new Client({ connectionString: url.toString(), application_name: "reward-fence-rest" });
  await pg.connect();
  const server = (await pg.query("select current_database() db, host(inet_server_addr()) host, inet_server_port() port")).rows[0];
  validateFenceServer(server, { containerService: process.env.REWARD_FENCE_TEST_CONTAINER_SERVICE === "1", githubActions: process.env.GITHUB_ACTIONS === "true" }, DB);
  const q = async (sql: string, args?: unknown[]) => (await pg.query(sql, args)).rows;
  const count = async (sql: string, args?: unknown[]) => Number((await q(sql, args))[0].n);

  const secret = randomBytes(32).toString("hex");
  const serviceKey = signJwt(secret, { role: "service_role", iss: "reward-fence-qa" });
  const anonKey = signJwt(secret, { role: "anon", iss: "reward-fence-qa" });
  const userJwt = (sub: string) => signJwt(secret, { role: "authenticated", aud: "authenticated", sub, iss: "reward-fence-qa" });
  const base = `http://127.0.0.1:${PROXY_PORT}`;
  // The app's getSupabaseAdmin() reads these; they point only at the loopback proxy.
  process.env.SUPABASE_URL = base; process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  const admin = createClient(base, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(base, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const asUser = (sub: string) => createClient(base, anonKey, { auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${userJwt(sub)}` } } });

  const { recordLegacyChoiceReward, completeBeginnerReward } = await import("../src/lib/bty/arena/legacyRewards.server");
  const { claimWeeklyReflectionQuest } = await import("../src/lib/bty/arena/weeklyQuestReward.server");
  const { completeAtomicAct, completeAtomicRitual } = await import("../src/lib/bty/healing/healingCompletion.server");
  const { awardFoundryCoreAtomic } = await import("../src/lib/bty/foundry/events/foundryXpAtomic.server");
  const { getWeekStartUTC } = await import("../src/lib/bty/arena/weeklyQuest");

  const schemaPath = path.resolve("scripts/qa/reward-fence-prod-schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  const sources = readCutoverSources(process.cwd());
  const bundle = buildApplyBundle(sources) as string;
  const evidence: Row = { engine: "postgrest+postgresql", startedAt: new Date().toISOString(), expectedChecks: EXPECTED_CHECKS, checks: [] as Row[],
    schemaSha256: createHash("sha256").update(schema).digest("hex"), bundleSha256: createHash("sha256").update(bundle).digest("hex") };
  const check = async (name: string, fn: () => Promise<Row | void>) => {
    assert(EXPECTED_CHECKS.includes(name), `unlisted check: ${name}`);
    assert(!evidence.checks.some((x: Row) => x.name === name), `duplicate check: ${name}`);
    const detail = await fn(); evidence.checks.push({ name, ...(detail ?? {}) }); console.log(`PASS ${name}`);
  };
  let postgrest: ChildProcess | undefined; let proxy: http.Server | undefined; let restLog = "";
  try {
    assert.equal(await count("select count(*) n from information_schema.tables where table_schema in ('public','auth','extensions','supabase_migrations')"), 0, "Refuse a nonempty database");
    await pg.query(BOOTSTRAP_SQL);
    await pg.query(schema);
    postgrest = spawn(bin, [], { stdio: ["ignore", "pipe", "pipe"], env: {
      PATH: process.env.PATH ?? "", DYLD_LIBRARY_PATH: process.env.DYLD_LIBRARY_PATH ?? "",
      PGRST_DB_URI: `postgres://authenticator:${AUTHENTICATOR_PASSWORD}@${url.hostname}:${url.port}/${DB}`,
      PGRST_DB_SCHEMAS: "public", PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions", PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: secret, PGRST_SERVER_HOST: "127.0.0.1", PGRST_SERVER_PORT: String(REST_PORT),
      PGRST_ADMIN_SERVER_PORT: String(ADMIN_PORT), PGRST_DB_CHANNEL_ENABLED: "true", PGRST_DB_MAX_ROWS: "1000", PGRST_LOG_LEVEL: "error",
    } });
    postgrest.stdout?.on("data", d => { restLog += d; }); postgrest.stderr?.on("data", d => { restLog += d; });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${ADMIN_PORT}/ready`)).status === 200, 30000, "PostgREST ready");
    proxy = await startProxy();
    const week = getWeekStartUTC();

    const seedUser = async () => { const u = randomUUID(); await q("insert into auth.users(id) values($1)", [u]);
      await q("insert into public.arena_profiles(user_id,lifetime_xp,weekly_xp,core_xp_total,core_xp_buffer,sub_name) values($1,11,7,199,$2,'Spark')", [u, 2 / 3]); return u; };
    const seedRun = async (user: string, type = "scenario", scenario = type === "beginner" ? "beginner-qa" : LEGACY_SCENARIO) =>
      (await q("insert into public.arena_runs(user_id,scenario_id,run_type) values($1,$2,$3) returning run_id", [user, scenario, type]))[0].run_id as string;
    const seedFoundry = async (user: string) => {
      const owner = randomUUID(), event = randomUUID(), participant = randomUUID(), progress = randomUUID();
      await q("insert into auth.users(id) values($1)", [owner]);
      await q("insert into public.foundry_events(id, owner_user_id, title) values($1,$2,'QA training')", [event, owner]);
      await q("insert into public.foundry_event_participants(id,event_id,user_id,display_name,participant_session_token_hash) values($1,$2,$3,'QA participant',$4)",
        [participant, event, user, randomBytes(32).toString("hex")]);
      await q(`insert into public.foundry_event_training_progress(id,event_id,participant_id,video_completed_at,response_text,completed_at,linked_user_id)
        values($1,$2,$3,now(),'QA completion',now(),$4)`, [progress, event, participant, user]);
      return { event, progress };
    };
    const day = (await q("select date_trunc('day',now())::text s,(date_trunc('day',now())+interval '1 day')::text e"))[0];

    await check("production schema subset loads under PostgREST 14.5 with production auth helpers and DDL watch triggers", async () => {
      const root = await (await fetch(`${base}/rest/v1/`, { headers: { Authorization: `Bearer ${serviceKey}` } })).json();
      assert.equal(root.info.version, "14.5");
      assert.equal(await count("select count(*) n from pg_event_trigger where evtname in ('pgrst_ddl_watch','pgrst_drop_watch')"), 2);
      return { postgrestVersion: root.info.version, exposedPaths: Object.keys(root.paths).length };
    });

    const hist = { user: await seedUser() } as Row;
    hist.run = await seedRun(hist.user);
    await check("before cutover: app helpers report storage unavailable and never fall back to split writes", async () => {
      const before = await count("select count(*) n from public.arena_events");
      const choice = await recordLegacyChoiceReward(admin, { userId: hist.user, runId: hist.run, scenarioId: LEGACY_SCENARIO, choiceId: "choice-a", step: 2, xp: 82, deltas: {}, meta: {} });
      const quest = await claimWeeklyReflectionQuest(admin, { userId: hist.user, weekStart: week });
      const act = await completeAtomicAct(hist.user, 1);
      assert.deepEqual(choice, { ok: false, status: 503, error: "XP_STORAGE_UNAVAILABLE" });
      assert.deepEqual(quest, { ok: false, error: "QUEST_STORAGE_UNAVAILABLE" });
      assert.deepEqual(act, { ok: false, status: 503, error: "HEALING_STORAGE_UNAVAILABLE" });
      assert.equal(await count("select count(*) n from public.arena_events"), before);
    });
    await check("before cutover: the previous release's split writes succeed through PostgREST", async () => {
      const user = asUser(hist.user);
      const ev = await user.from("arena_events").insert({ run_id: hist.run, user_id: hist.user, step: 2, event_type: "CHOICE_CONFIRMED", scenario_id: LEGACY_SCENARIO, choice_id: "choice-a", xp: 82 });
      assert.equal(ev.error, null, JSON.stringify(ev.error));
      const xp = await admin.rpc("increment_arena_xp", { p_user_id: hist.user, p_run_id: hist.run, p_xp: 82 });
      assert.equal(xp.error, null, JSON.stringify(xp.error));
      const act = await user.from("user_healing_awakening_acts").insert({ user_id: hist.user, act_id: 1 });
      assert.equal(act.error, null, JSON.stringify(act.error));
      hist.foundry = await seedFoundry(hist.user);
      const led = await admin.rpc("bty_foundry_award_daily_capped", { p_user_id: hist.user, p_event_id: hist.foundry.event, p_source_id: hist.foundry.progress, p_xp: 10, p_day_start: day.s, p_day_end: day.e, p_max_per_day: 3 });
      assert.equal(led.data, "awarded", JSON.stringify(led));
      return { runTotalXp: (await q("select total_xp from public.arena_runs where run_id=$1", [hist.run]))[0].total_xp };
    });
    await check("cutover applies while PostgREST serves; the DDL watch trigger reloads the schema cache without restart", async () => {
      const started = Date.now();
      await pg.query(bundle);
      const probe = await seedUser(); const run = await seedRun(probe);
      const ms = await waitFor(async () => (await recordLegacyChoiceReward(admin, { userId: probe, runId: run, scenarioId: LEGACY_SCENARIO,
        choiceId: "choice-a", step: 2, xp: 82, deltas: {}, meta: {} })).ok, 15000, "schema cache reload");
      assert.equal(postgrest!.exitCode, null, "PostgREST must keep running");
      return { reloadVisibleWithinMs: ms, cutoverMs: Date.now() - started };
    });
    await check("fenced previous-release writes through PostgREST fail at commit and persist nothing", async () => {
      const u = await seedUser(); const run = await seedRun(u); const beginner = await seedRun(u, "beginner"); const f = await seedFoundry(u);
      const user = asUser(u); const before = await count("select count(*) n from public.arena_events where user_id=$1", [u]);
      const results: Row = {};
      results.minimal = await user.from("arena_events").insert({ run_id: run, user_id: u, step: 2, event_type: "CHOICE_CONFIRMED", scenario_id: LEGACY_SCENARIO, choice_id: "choice-a", xp: 82 });
      results.representation = await user.from("arena_events").insert({ run_id: run, user_id: u, step: 2, event_type: "CHOICE_CONFIRMED", scenario_id: LEGACY_SCENARIO, choice_id: "choice-a", xp: 82 }).select();
      results.beginnerDone = await user.from("arena_runs").update({ status: "DONE", completed_at: new Date().toISOString(), beginner_maturity_score: 17 }).eq("run_id", beginner).eq("status", "IN_PROGRESS").select("run_id").maybeSingle();
      results.foundryLedger = await admin.rpc("bty_foundry_award_daily_capped", { p_user_id: u, p_event_id: f.event, p_source_id: f.progress, p_xp: 10, p_day_start: day.s, p_day_end: day.e, p_max_per_day: 3 });
      results.foundryMarker = await admin.from("foundry_event_training_progress").update({ linked_user_id: u, xp_awarded_at: new Date().toISOString() }).eq("id", f.progress).is("xp_awarded_at", null);
      const summary: Row = {};
      for (const [k, r] of Object.entries(results)) {
        assert(r.error, `${k} unexpectedly succeeded`);
        assert.equal(r.error.code, "P0001", `${k}: ${JSON.stringify(r.error)}`); assert.equal(r.error.message, "REWARD_WRITE_FENCED");
        summary[k] = { status: r.status, code: r.error.code, message: r.error.message, detail: r.error.details };
      }
      assert.equal(await count("select count(*) n from public.arena_events where user_id=$1", [u]), before);
      assert.equal(await count("select count(*) n from public.arena_runs where run_id=$1 and status='DONE'", [beginner]), 0);
      assert.equal(await count("select count(*) n from public.core_xp_ledger where source_id=$1", [f.progress]), 0);
      return summary;
    });
    await check("Healing user-JWT writes are refused through PostgREST", async () => {
      const u = await seedUser(); const user = asUser(u);
      const act = await user.from("user_healing_awakening_acts").insert({ user_id: u, act_id: 1 });
      const ms = await user.from("user_healing_milestones").upsert({ user_id: u, second_awakening_completed_at: new Date().toISOString() });
      for (const r of [act, ms]) { assert(r.error); assert.equal(r.error.code, "42501", JSON.stringify(r.error)); }
      assert.equal(await count("select count(*) n from public.user_healing_awakening_acts where user_id=$1", [u]), 0);
      return { act: { status: act.status, code: act.error!.code }, milestone: { status: ms.status, code: ms.error!.code } };
    });
    await check("receipt tables and atomic RPCs are closed to anon and authenticated and open to service_role", async () => {
      const u = await seedUser(); const user = asUser(u); const out: Row = {};
      for (const table of ["arena_reward_receipts", "foundry_xp_reward_receipts", "foundry_completion_claim_receipts"]) {
        for (const [who, client] of [["anon", anon], ["authenticated", user]] as const) {
          const r = await client.from(table).select("*").limit(1); assert(r.error, `${who} read ${table}`); assert.equal(r.error.code, "42501"); out[`${who}:${table}`] = r.status;
        }
        assert.equal((await admin.from(table).select("*").limit(1)).error, null);
      }
      for (const [fn, args] of [["bty_record_legacy_choice_reward", { p_user_id: u, p_run_id: randomUUID(), p_scenario_id: LEGACY_SCENARIO, p_choice_id: "a", p_step: 2, p_xp: 1, p_deltas: {}, p_meta: {} }],
        ["bty_claim_weekly_reflection_quest", { p_user_id: u, p_week_start: week }], ["bty_complete_healing_awakening_act", { p_user_id: u, p_act_id: 1 }]] as const) {
        const r = await user.rpc(fn, args); assert(r.error, `authenticated executed ${fn}`); assert.equal(r.error.code, "42501"); out[`authenticated:${fn}`] = r.status;
      }
      return out;
    });
    await check("app legacy reward helpers through supabase-js: award, frozen replay, conflict and review-required", async () => {
      const u = await seedUser(); const run = await seedRun(u); const b = await seedRun(u, "beginner");
      const input = { userId: u, runId: run, scenarioId: LEGACY_SCENARIO, choiceId: "choice-a", step: 2, xp: 82, deltas: { trust: 2 }, meta: { qa: true } };
      const first = await recordLegacyChoiceReward(admin, input); const replay = await recordLegacyChoiceReward(admin, input);
      assert(first.ok && replay.ok); assert.equal(first.receipt.replayed, false); assert.equal(replay.receipt.replayed, true);
      assert.deepEqual(await recordLegacyChoiceReward(admin, { ...input, choiceId: "choice-b" }), { ok: false, status: 409, error: "REWARD_INPUT_CONFLICT" });
      assert.deepEqual(await recordLegacyChoiceReward(admin, { ...input, userId: hist.user, runId: hist.run }), { ok: false, status: 409, error: "LEGACY_REWARD_REVIEW_REQUIRED" });
      const beginner = await completeBeginnerReward(admin, { userId: u, runId: b, scenarioId: "beginner-qa",
        responses: { emotionIndex: 1, riskIndex: 1, integrityIndex: 1, decisionIndex: 2, reflectionText: "QA" } as never, score: 17,
        feedback: { band: "intentional", label: "QA", message: "QA" } as never });
      assert(beginner.ok, JSON.stringify(beginner));
      assert.equal((await q("select total_xp from public.arena_runs where run_id=$1", [run]))[0].total_xp, 82);
      return { choiceReceipt: first.receipt.receiptId, beginnerSeasonalXp: beginner.receipt.seasonalXp };
    });
    await check("app Healing and Foundry helpers through supabase-js commit atomically and replay", async () => {
      const u = await seedUser(); await q("insert into public.train_day_completions(user_id, day) select $1, g from generate_series(1,28) g", [u]).catch(async () => {
        // Production train_day_completions has more columns; fall back to its required shape.
        const cols = await q("select column_name from information_schema.columns where table_schema='public' and table_name='train_day_completions' and is_nullable='NO' and column_default is null");
        throw new Error(`train_day_completions requires ${cols.map(c => c.column_name).join(",")}`);
      });
      for (const act of [1, 2, 3]) { const r = await completeAtomicAct(u, act); assert(r.ok, JSON.stringify(r)); }
      assert.deepEqual(await completeAtomicAct(u, 3), { ok: false, status: 409, error: "ACT_ALREADY_COMPLETED" });
      const ritualUser = await seedUser(); await q("insert into public.train_day_completions(user_id, day) select $1, g from generate_series(1,28) g", [ritualUser]);
      const ritual = await completeAtomicRitual(ritualUser, "SAG"); const again = await completeAtomicRitual(ritualUser, "SAG");
      assert(ritual.ok && again.ok); assert.equal(ritual.value.idempotent, false); assert.equal(again.value.idempotent, true);
      const f = await seedFoundry(u);
      const award = await awardFoundryCoreAtomic(admin, { userId: u, eventId: f.event, progressId: f.progress, start: day.s, end: day.e });
      const replay = await awardFoundryCoreAtomic(admin, { userId: u, eventId: f.event, progressId: f.progress, start: day.s, end: day.e });
      assert.equal(award, "awarded"); assert.equal(replay, "already_awarded");
      assert.equal(await awardFoundryCoreAtomic(admin, { userId: hist.user, eventId: hist.foundry.event, progressId: hist.foundry.progress, start: day.s, end: day.e }), "review_required");
      return { foundry: [award, replay] };
    });
    await check("weekly quest through supabase-js: five concurrent HTTP claims pay +15 once; ineligible and invalid weeks write nothing", async () => {
      const u = await seedUser(); const run = await seedRun(u);
      for (let i = 0; i < 3; i++) await q("insert into public.arena_events(run_id,user_id,step,event_type,scenario_id) values($1,$2,5,'REFLECTION_SELECTED',$3)", [run, u, LEGACY_SCENARIO]);
      const before = await count("select coalesce(sum(xp_total),0) n from public.weekly_xp where user_id=$1", [u]);
      const results = await Promise.all([1, 2, 3, 4, 5].map(() => claimWeeklyReflectionQuest(admin, { userId: u, weekStart: week })));
      const outcomes = results.map(r => { assert(r.ok, JSON.stringify(r)); return r.claim.outcome; }).sort();
      assert.deepEqual(outcomes, ["already_claimed", "already_claimed", "already_claimed", "already_claimed", "awarded"]);
      assert.equal(await count("select coalesce(sum(xp_total),0) n from public.weekly_xp where user_id=$1", [u]) - before, 15);
      const few = await seedUser();
      assert.deepEqual(await claimWeeklyReflectionQuest(admin, { userId: few, weekStart: week }), { ok: true, claim: { outcome: "not_eligible", weekStart: week } });
      const tuesday = new Date(Date.parse(`${week}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
      assert.deepEqual(await claimWeeklyReflectionQuest(admin, { userId: u, weekStart: tuesday }), { ok: false, error: "QUEST_AWARD_FAILED" });
      assert.equal(await count("select count(*) n from public.arena_weekly_quest_claims where user_id=$1", [u]), 1);
      return { outcomes };
    });
    await check("unchanged writers through PostgREST keep working", async () => {
      const u = await seedUser(); const user = asUser(u); const canon = await seedRun(u, "scenario", CANONICAL_SCENARIO); const scen = await seedRun(u);
      const results = {
        canonicalChoice: await user.from("arena_events").insert({ run_id: canon, user_id: u, step: 2, event_type: "CHOICE_CONFIRMED", scenario_id: CANONICAL_SCENARIO, choice_id: "x", xp: 10, meta: { binding: "v1" } }),
        canonicalXp: await admin.rpc("increment_arena_xp", { p_user_id: u, p_run_id: canon, p_xp: 10 }),
        freeResponse: await user.from("arena_events").insert({ run_id: scen, user_id: u, step: 2, event_type: "FREE_RESPONSE", scenario_id: LEGACY_SCENARIO, xp: 25 }),
        organicUnlock: await user.from("user_advanced_unlocks").insert({ user_id: u, advanced_stat_name: "EL" }),
        weeklyXp: await admin.rpc("increment_weekly_xp", { p_user_id: u, p_league_id: null, p_delta: 5 }),
        labLedger: await admin.from("core_xp_ledger").insert({ user_id: u, delta_xp: 5, source_type: "LAB", source_id: randomUUID() }),
      };
      const statuses: Row = {};
      for (const [k, r] of Object.entries(results)) { assert.equal(r.error, null, `${k}: ${JSON.stringify(r.error)}`); statuses[k] = r.status; }
      return statuses;
    });
    await check("production arena_profiles triggers coexist with atomic RPC updates", async () => {
      const triggers = (await q("select tgname from pg_trigger where tgrelid='public.arena_profiles'::regclass and not tgisinternal order by 1")).map(r => r.tgname);
      assert(triggers.includes("trg_arena_profiles_updated_at") && triggers.includes("trg_enforce_avatar_character_lock"), JSON.stringify(triggers));
      const u = await seedUser(); await q("update public.arena_profiles set updated_at = now() - interval '1 day' where user_id=$1", [u]);
      const run = await seedRun(u);
      const r = await recordLegacyChoiceReward(admin, { userId: u, runId: run, scenarioId: LEGACY_SCENARIO, choiceId: "choice-a", step: 2, xp: 82, deltas: {}, meta: {} });
      assert(r.ok, JSON.stringify(r));
      assert.equal(await count("select count(*) n from public.arena_profiles where user_id=$1 and updated_at > now() - interval '1 minute'", [u]), 1);
      return { triggers };
    });

    const executed = evidence.checks.map((x: Row) => x.name);
    evidence.unrun = EXPECTED_CHECKS.filter(name => !executed.includes(name));
    assert.deepEqual(executed, EXPECTED_CHECKS, "every expected check body must execute exactly once, in order");
    evidence.result = "pass";
  } catch (error) {
    evidence.result = "fail"; evidence.error = (error as Error).stack ?? String(error); evidence.postgrestLog = restLog.slice(-4000); throw error;
  } finally {
    evidence.finishedAt = new Date().toISOString();
    if (jsonOut) await writeFile(jsonOut, JSON.stringify(evidence, null, 2));
    proxy?.close(); postgrest?.kill("SIGTERM"); await pg.end().catch(() => {});
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
