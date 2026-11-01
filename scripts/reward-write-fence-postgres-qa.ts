/**
 * Native PostgreSQL verification of the reward write cutover. No dotenv, app
 * client, auth/session API or Supabase endpoint is imported. The target must be
 * a literal loopback URL, port 55491, database bty_reward_fence_qa, and empty. A
 * GitHub Actions service container reports its private bridge address; that is
 * accepted only with REWARD_FENCE_TEST_CONTAINER_SERVICE=1 and GITHUB_ACTIONS=true.
 * Every check in EXPECTED_CHECKS must execute exactly once or the run fails.
 *
 *   REWARD_FENCE_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55491/bty_reward_fence_qa \
 *     node --import tsx scripts/reward-write-fence-postgres-qa.ts --json /abs/result.json
 *
 * Old-release writes are replayed as the exact PostgREST-equivalent SQL each old
 * route issued, under its real role (authenticated + JWT sub, or service_role),
 * one autocommit statement per HTTP call. The cutover is the bundle produced by
 * scripts/reward-write-fence-cutover.mjs, applied while other sessions hold or
 * later resume old writes. Representative schema: production column/constraint
 * shapes for fenced tables, production-identical old function bodies (md5 pinned
 * below), original repository DDL for the remaining Foundry/Healing tables. It is
 * not the complete production schema, PostgREST or a Worker.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApplyBundle, buildRecoveryBundle, readCutoverSources, FENCE_TRIGGERS } from "./reward-write-fence-cutover.mjs";
import { SCENARIOS } from "../src/lib/bty/scenario/legacy/bundledScenarios";
import { SUB_NAMES, codeIndexFromTier, seasonalToCoreConversion, subTierGroupFromTier, tierFromCoreXp } from "../src/lib/bty/arena/codes";
import { getWeekStartUTC } from "../src/lib/bty/arena/weeklyQuest";
import { validateFenceServer } from "./reward-write-fence-postgres-qa-target";

type Row = Record<string, any>;
type Client = { query(sql: string, args?: unknown[]): Promise<{ rows: Row[] }>; end(): Promise<void>; processID?: number };
const DB = "bty_reward_fence_qa";
const PORT = "55491";
const LEGACY_SCENARIO = "patient_refuses_treatment_001";
const CANONICAL_SCENARIO = "INCIDENT-01-OWN-01";
const RESPONSES = { emotionIndex: 1, riskIndex: 1, integrityIndex: 1, decisionIndex: 2, reflectionText: "QA reflection" };
const FEEDBACK = { band: "intentional", label: "QA label", message: "QA feedback" };
const CHOICE_SQL = "select public.bty_record_legacy_choice_reward($1::uuid,$2::uuid,$3::text,$4::text,$5::integer,$6::integer,$7::jsonb,$8::jsonb) as result";
const BEGINNER_SQL = "select public.bty_complete_beginner_reward($1::uuid,$2::uuid,$3::text,$4::jsonb,$5::integer,$6::jsonb) as result";
const ACT_SQL = "select public.bty_complete_healing_awakening_act($1::uuid,$2::integer) as result";
const RITUAL_SQL = "select public.bty_complete_second_awakening($1::uuid,$2::text) as result";
const AWARD_SQL = "select public.bty_foundry_award_core_atomic($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,$5::timestamptz) as result";
const CLAIM_SQL = "select public.bty_foundry_redeem_completion_claim_atomic($1::text,$2::uuid,$3::text,$4::text,$5::uuid,$6::uuid,$7::integer,$8::date,$9::date,$10::timestamptz,$11::integer,$12::date,$13::date,$14::timestamptz,$15::integer,$16::boolean,$17::timestamptz,$18::timestamptz) as result";
const OLD_CLAIM_SQL = CLAIM_SQL.replace("_atomic(", "(");
const QUEST_SQL = "select public.bty_claim_weekly_reflection_quest($1::uuid,$2::date) as result";
// Every check body must run exactly once, in this order; a skipped body fails the run.
const EXPECTED_CHECKS: string[] = [
  "before cutover: old legacy choice route can pay the same run twice (reproduced bug)",
  "before cutover: old beginner completion commits DONE as a separate write before XP",
  "before cutover: old Healing acts and milestone are user-JWT writes",
  "before cutover: old Foundry ledger commits without Core or marker",
  "cutover with a held write lock times out and rolls back completely",
  "cutover waits for the transaction already writing a fenced table",
  "cutover leaves every pre-existing learner row byte-identical",
  "ledger records exactly the four cutover migrations; rerun is refused without change",
  "an old transaction opened before cutover cannot write Healing afterwards",
  "an old transaction opened before cutover cannot commit a Foundry ledger award afterwards",
  "resumed old legacy choice: event insert rejected, so the route stops before XP",
  "forged old-route meta cannot pass: fence keys on legacy catalog IDs, not client meta",
  "resumed old beginner completion: DONE, reflection and beginner reward events rejected",
  "resumed old Healing user-JWT writes rejected (milestone after pre-cutover acts, new act, starter unlock)",
  "the Healing trigger itself rejects user-JWT writes even if a client grant is restored",
  "resumed old Foundry writes rejected: ledger, marker after pre-cutover ledger, old eligible claim",
  "residual (documented, unfenceable by row): shared XP/Core writes of a request whose anchor committed before cutover",
  "unchanged writers pass: canonical CHOICE_CONFIRMED, scenario FREE_RESPONSE, organic unlocks, LAB ledger, progress link/claim issue, XP RPCs",
  "fence catalog equals the bundled legacy catalog (45 IDs) and excludes canonical IDs",
  "new legacy choice: one award, identical replay frozen, changed input refused",
  "new legacy choice: two concurrent sessions produce one award and one frozen replay",
  "new beginner completion: one award and frozen replay",
  "pre-cutover partial/duplicate legacy state is review-required and unchanged",
  "new Healing acts and ritual: atomic, replay idempotent, partial history review-required",
  "new Foundry award and claim: one award, replay, concurrent claimants, partial history review-required",
  "injected failure at the final receipt/milestone write rolls back every earlier write",
  "same legacy run: three pre-cutover anchors, resumed XP with a mid-failure and a retry pay exactly the surviving anchors",
  "same beginner run: one DONE anchor among three old requests pays once; a failed XP call and every retry pay nothing",
  "same Foundry progress: one ledger anchor pays Core once; a failed Core write and every retry pay nothing",
  "residual: an old absolute Core write interleaved with a new atomic award overwrites that award (under-payment, measured)",
  "pre-fix quest flow (still in previous-release Workers) pays twice under concurrency and after a failed claim insert",
  "atomic quest: five concurrent claims pay +15 exactly once with TypeScript-identical Core",
  "atomic quest: a failure inside the transaction writes nothing and the retry pays once",
  "atomic quest: eligibility, week bounds and caller role are enforced before any write",
  "atomic quest Core matches applySeasonalXpToCore across buffer and tier boundaries",
  "residual: a previous-release quest request racing the atomic claim can still add one extra +15 (measured)",
  "historical rows remain byte-identical after every fenced and atomic operation",
  "recovery bundle removes only the fence; receipts/RPCs stay; old split write possible again",
];
const SNAPSHOT_TABLES = ["public.arena_events", "public.arena_runs", "public.arena_profiles", "public.weekly_xp",
  "public.core_xp_ledger", "public.foundry_event_training_progress", "public.foundry_event_assignments",
  "public.user_healing_awakening_acts", "public.user_healing_milestones", "public.user_advanced_unlocks",
  "public.arena_weekly_quest_claims"];

// Observed read-only from production pg_proc (md5(prosrc)) on 2026-11-01.
const PROD_FUNCTION_MD5: Record<string, string> = {
  increment_arena_xp: "7b1aaa33bd00901cefb67069b6aaa082",
  increment_weekly_xp: "9c3a30812c0db7a7798125dc50d780db",
  ensure_arena_profile: "ac0d6714f09a51bae15b06f11dd01c5c",
  bty_foundry_award_daily_capped: "4eb4d5b65dcf6f47fa7ce29b7604208c",
  bty_foundry_claim_assignment: "0161658f1b59f5de16cd31e038fd9caa",
  bty_foundry_materialize_followup: "8b83759b7fcf9da944fe30f02a7cc18c",
  bty_foundry_materialize_apply_window: "4426acc0b9177a43c3b7d36e1cf7b994",
  bty_foundry_redeem_completion_claim: "48ff28360097aded84a45da97313b651",
};
// Production text differs from the repository's first definition only in layout.
const PROD_ARENA_FUNCTIONS = `
CREATE OR REPLACE FUNCTION public.ensure_arena_profile()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.arena_profiles(user_id) values (auth.uid())
  on conflict (user_id) do nothing;
end;
$function$;
CREATE OR REPLACE FUNCTION public.increment_arena_xp(p_user_id uuid, p_run_id uuid, p_xp integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_xp is null or p_xp <= 0 then return; end if;
  update public.arena_profiles set lifetime_xp = lifetime_xp + p_xp, weekly_xp = weekly_xp + p_xp, updated_at = now() where user_id = p_user_id;
  update public.arena_runs set total_xp = total_xp + p_xp where run_id = p_run_id and user_id = p_user_id;
end;
$function$;`;

// Production column/constraint shapes (read-only catalog, 2026-11-01) for the fenced Arena tables.
const FIXTURE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key, statements text[], name text, created_by text, idempotency_key text, rollback text[]);
create table public.arena_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade, lifetime_xp int not null default 0,
 weekly_xp int not null default 0, core_xp_total int not null default 0, core_xp_buffer numeric not null default 0,
 tier int not null default 0, code_index int not null default 0, sub_name text, sub_name_renamed_in_code boolean not null default false,
 stage int not null default 1, code_hidden boolean not null default false,
 updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table public.arena_runs (
 run_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 scenario_id text not null, locale text, status text not null default 'IN_PROGRESS', started_at timestamptz not null default now(),
 completed_at timestamptz, total_xp integer not null default 0, run_type text not null default 'scenario',
 beginner_maturity_score integer, difficulty text, meta jsonb, acknowledgment_timestamp timestamptz,
 completion_state text default 'in_progress' check (completion_state in ('in_progress','locked_step7_abandoned','complete_verified')),
 pipeline text default 'legacy' check (pipeline in ('legacy','new')), current_step integer default 0, reached_step_2_at timestamptz);
create table public.arena_events (
 event_id uuid primary key default gen_random_uuid(), run_id uuid not null references public.arena_runs(run_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, step integer not null, event_type text not null,
 scenario_id text not null, choice_id text, follow_up_index integer, xp integer not null default 0,
 deltas jsonb, meta jsonb, created_at timestamptz not null default now());
create unique index arena_events_run_level_verified_uq on public.arena_events(user_id, run_id) where event_type = 'RUN_LEVEL_VERIFIED_APPLIED';
create table public.weekly_xp (
 id bigserial primary key, user_id uuid not null references auth.users(id), league_id uuid,
 xp_total integer not null default 0, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create unique index weekly_xp_user_null_league_uq on public.weekly_xp(user_id) where league_id is null;
create unique index weekly_xp_user_league_uq on public.weekly_xp(user_id,league_id) where league_id is not null;
create table public.train_day_completions(user_id uuid not null references auth.users(id), day integer not null);
create table public.bty_organizations(id uuid primary key);
create table public.bty_org_memberships(id uuid primary key);
create table public.foundry_events(id uuid primary key, owner_user_id uuid not null references auth.users(id), status text not null default 'active');
create table public.foundry_event_participants(id uuid primary key, event_id uuid not null references public.foundry_events(id), user_id uuid references auth.users(id), unique(event_id,id));
create table public.arena_weekly_quest_claims(user_id uuid not null references auth.users(id) on delete cascade, week_start date not null,
 quest_type text not null default 'reflection', created_at timestamptz not null default now(), primary key (user_id, week_start, quest_type));
`;
const FOUNDRY_SOURCES: { file: string; table?: string; fn?: string }[] = [
  { file: "20260302000000_arena_ledgers_memberships_snapshots.sql", table: "core_xp_ledger" },
  { file: "20260714000000_foundry_event_rooms_v1.sql", table: "foundry_event_training_progress" },
  ...["foundry_event_participation_mode", "foundry_event_assignments", "foundry_event_assignment_audit"].map(table => ({ file: "20260721000000_foundry_assignment_foundation_v1.sql", table })),
  ...["foundry_participant_followups", "foundry_participant_followup_audit"].map(table => ({ file: "20260728000000_foundry_participant_followups_v1.sql", table })),
  { file: "20260823000000_foundry_participant_apply_windows_v1.sql", table: "foundry_participant_apply_windows" },
  { file: "20260518000000_increment_weekly_xp_rpc.sql", fn: "increment_weekly_xp" },
  { file: "20260714000000_foundry_event_rooms_v1.sql", fn: "bty_foundry_award_daily_capped" },
  { file: "20260724000000_foundry_assignment_claim_v2.sql", fn: "bty_foundry_claim_assignment" },
  { file: "20260728000000_foundry_participant_followups_v1.sql", fn: "bty_foundry_materialize_followup" },
  { file: "20260929000000_foundry_apply_action_day_v1.sql", fn: "bty_foundry_materialize_apply_window" },
  { file: "20260827000000_foundry_deferred_completion_claim_v1.sql", fn: "bty_foundry_redeem_completion_claim" },
];

export function validateFenceTarget(value: string | undefined): URL {
  assert(value, "REWARD_FENCE_TEST_DATABASE_URL is required; no application URL fallback exists");
  const u = new URL(value);
  assert(["postgres:", "postgresql:"].includes(u.protocol));
  assert(["127.0.0.1", "[::1]"].includes(u.hostname), "Only literal loopback targets are accepted");
  assert.equal(u.port, PORT); assert.equal(u.pathname, `/${DB}`);
  assert.equal(u.search, ""); assert.equal(u.hash, "");
  return u;
}

function extractDefinition(source: string, spec: { table?: string; fn?: string }): string {
  if (spec.table) {
    const start = source.indexOf(`create table if not exists public.${spec.table}`);
    assert(start >= 0, `table ${spec.table} missing`);
    const end = source.indexOf("\n);", start); assert(end > start);
    return source.slice(start, end + 3);
  }
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${spec.fn}\\s*\\(`, "gi");
  let last = -1; for (let m = re.exec(source); m; m = re.exec(source)) last = m.index;
  assert(last >= 0, `function ${spec.fn} missing`);
  const rest = source.slice(last); const tag = /\$[A-Za-z_]*\$/.exec(rest); assert(tag);
  const close = rest.indexOf(tag[0], tag.index + tag[0].length); const semi = rest.indexOf(";", close);
  return rest.slice(0, semi + 1);
}

async function connect(u: URL, name: string): Promise<Client> {
  const { Client: PgClient } = await import("pg");
  const c = new PgClient({ connectionString: u.toString(), application_name: name, connectionTimeoutMillis: 5000 });
  await c.connect();
  const s = (await c.query("select current_database() db, host(inet_server_addr()) host, inet_server_port() port")).rows[0];
  // A Unix-socket session reports a null host and is refused like any non-loopback server.
  validateFenceServer(s, { containerService: process.env.REWARD_FENCE_TEST_CONTAINER_SERVICE === "1", githubActions: process.env.GITHUB_ACTIONS === "true" }, DB);
  return Object.assign(c, { processID: (c as unknown as { processID: number }).processID });
}

async function bootstrap(c: Client) {
  const existing = (await c.query("select count(*)::int n from information_schema.tables where table_schema in ('public','auth','supabase_migrations')")).rows[0].n;
  assert.equal(existing, 0, "Refuse a nonempty database");
  await c.query("set timezone='UTC'"); await c.query(FIXTURE);
  const provenance: Row[] = [];
  for (const spec of FOUNDRY_SOURCES) {
    const sql = extractDefinition(await readFile(path.resolve("supabase/migrations", spec.file), "utf8"), spec);
    await c.query(sql);
    provenance.push({ file: spec.file, name: spec.table ?? spec.fn, sha256: createHash("sha256").update(sql).digest("hex") });
  }
  await c.query(PROD_ARENA_FUNCTIONS);
  for (const relative of ["20260310010000_emotional_stats.sql", "20260311010000_user_healing_milestones.sql", "20260317120000_user_healing_awakening_acts.sql"]) {
    const source = await readFile(path.resolve("supabase/migrations", relative), "utf8");
    const sql = relative.startsWith("20260310010000")
      ? source.slice(source.indexOf("create table if not exists public.user_advanced_unlocks"), source.indexOf("comment on table public.user_emotional_stats"))
      : source;
    await c.query(sql); provenance.push({ file: relative, sha256: createHash("sha256").update(sql).digest("hex") });
  }
  await c.query(`alter table public.foundry_event_training_progress add column claim_secret_hash text, add column claim_secret_expires_at timestamptz, add column claim_consumed_at timestamptz;
    alter table public.foundry_participant_apply_windows add column action_bty_day date;
    create unique index core_xp_ledger_source_idempotent_uq on public.core_xp_ledger(source_type,source_id) where source_id is not null;
    create unique index core_xp_ledger_user_source_uq on public.core_xp_ledger(user_id,source_type,source_id) where source_id is not null;
    create unique index foundry_progress_active_claim_hash_uidx on public.foundry_event_training_progress(claim_secret_hash) where claim_secret_hash is not null and claim_consumed_at is null;
    grant usage on schema public, auth to anon, authenticated, service_role;
    -- Production ACLs observed on the fenced tables: full client-role table grants, RLS governs rows.
    grant all on public.arena_events, public.arena_runs, public.core_xp_ledger, public.user_healing_awakening_acts,
      public.user_healing_milestones, public.user_advanced_unlocks to anon, authenticated;
    grant all on public.foundry_event_training_progress to authenticated;
    grant select, update on public.arena_profiles to authenticated;
    grant all on all tables in schema public to service_role; grant usage, select on all sequences in schema public to service_role;
    alter default privileges in schema public grant all on tables to service_role;
    revoke execute on all functions in schema public from public, anon, authenticated;
    grant execute on all functions in schema public to service_role;
    grant execute on function public.ensure_arena_profile() to authenticated;
    create policy runs_insert_own on public.arena_runs for insert to authenticated with check (auth.uid() = user_id);
    create policy runs_select_own on public.arena_runs for select to authenticated using (auth.uid() = user_id);
    create policy runs_update_own on public.arena_runs for update to authenticated using (auth.uid() = user_id);
    create policy events_insert_own on public.arena_events for insert to authenticated with check (auth.uid() = user_id);
    create policy events_select_own on public.arena_events for select to authenticated using (auth.uid() = user_id);
    create policy profiles_select_own on public.arena_profiles for select to authenticated using (auth.uid() = user_id);
    create policy profiles_update_own on public.arena_profiles for update to authenticated using (auth.uid() = user_id);
    create policy profiles_insert_own on public.arena_profiles for insert to authenticated with check (auth.uid() = user_id);
    grant insert on public.arena_profiles to authenticated;
    grant all on public.arena_weekly_quest_claims to anon, authenticated;
    create policy weekly_quest_claims_insert_own on public.arena_weekly_quest_claims for insert to authenticated with check (auth.uid() = user_id);
    create policy weekly_quest_claims_select_own on public.arena_weekly_quest_claims for select to authenticated using (auth.uid() = user_id);`);
  for (const t of ["arena_profiles", "arena_runs", "arena_events", "weekly_xp", "core_xp_ledger", "train_day_completions", "arena_weekly_quest_claims",
    "foundry_event_training_progress", "foundry_event_assignments"]) await c.query(`alter table public.${t} enable row level security`);
  const md5 = (await c.query(`select p.proname, md5(p.prosrc) md5 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any($1)`, [Object.keys(PROD_FUNCTION_MD5)])).rows;
  for (const { proname, md5: got } of md5) assert.equal(got, PROD_FUNCTION_MD5[proname], `${proname} differs from production`);
  assert.equal(md5.length, Object.keys(PROD_FUNCTION_MD5).length);
  return provenance;
}

// ---------- old-release requests: one PostgREST call per statement ----------
async function asUser<T>(c: Client, user: string, fn: () => Promise<T>): Promise<T> {
  await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]); await c.query("set role authenticated");
  const restore = async () => { await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub', '', false)"); };
  // Inside an aborted transaction the restore fails; ROLLBACK reverts it, and the original error must surface.
  try { const out = await fn(); await restore(); return out; } catch (e) { await restore().catch(() => {}); throw e; }
}
async function asService<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  await c.query("set role service_role");
  try { const out = await fn(); await c.query("reset role"); return out; } catch (e) { await c.query("reset role").catch(() => {}); throw e; }
}
const OLD = {
  // origin/inner-main src/app/api/arena/event/route.ts:128,145-160,165
  choiceEvent: (c: Client, s: Seed, scenario = LEGACY_SCENARIO, meta: Row | null = { qa: "old" }) => asUser(c, s.user, () => c.query(
    `insert into public.arena_events(run_id,user_id,step,event_type,scenario_id,choice_id,follow_up_index,xp,deltas,meta)
     values($1,$2,2,'CHOICE_CONFIRMED',$3,'choice-a',null,82,'{"trust":2}',$4) returning event_id`, [s.run, s.user, scenario, meta])),
  choiceStep: (c: Client, s: Seed) => asUser(c, s.user, () => c.query(
    "update public.arena_runs set current_step=2, reached_step_2_at=coalesce(reached_step_2_at, now()) where run_id=$1 and user_id=$2", [s.run, s.user])),
  choiceXp: (c: Client, s: Seed) => asService(c, () => c.query("select public.increment_arena_xp($1,$2,82)", [s.user, s.run])),
  // origin/inner-main src/app/api/arena/beginner-complete/route.ts:84-95,109,111,123
  beginnerDone: (c: Client, s: Seed) => asUser(c, s.user, () => c.query(
    "update public.arena_runs set status='DONE', completed_at=now(), beginner_maturity_score=17 where run_id=$1 and user_id=$2 and status='IN_PROGRESS' returning run_id", [s.run, s.user])),
  beginnerWeekly: (c: Client, s: Seed) => asService(c, () => c.query("select public.increment_weekly_xp($1,null,30)", [s.user])),
  beginnerReflection: (c: Client, s: Seed) => asUser(c, s.user, () => c.query(
    `insert into public.arena_events(run_id,user_id,step,event_type,scenario_id,meta) values($1,$2,7,'BEGINNER_REFLECTION',$3,'{"reflectionText":"old"}')`, [s.run, s.user, s.scenario])),
  // old run/complete reflectionRewards.server.ts:124 and free-response/route.ts:109 on a beginner run
  beginnerFreeResponse: (c: Client, s: Seed) => asUser(c, s.user, () => c.query(
    "insert into public.arena_events(run_id,user_id,step,event_type,scenario_id,xp) values($1,$2,2,'FREE_RESPONSE',$3,10)", [s.run, s.user, s.scenario])),
  // origin/inner-main completeAwakeningAct.ts:55,79 and secondAwakening.ts:182,193
  healingAct: (c: Client, user: string, act: number) => asUser(c, user, () => c.query(
    "insert into public.user_healing_awakening_acts(user_id,act_id) values($1,$2)", [user, act])),
  healingMilestone: (c: Client, user: string, at: string, starter: string | null = null) => asUser(c, user, () => c.query(
    `insert into public.user_healing_milestones(user_id,second_awakening_completed_at,starter_unlock_granted) values($1,$2,$3)
     on conflict (user_id) do update set second_awakening_completed_at=excluded.second_awakening_completed_at, starter_unlock_granted=excluded.starter_unlock_granted`, [user, at, starter])),
  healingUnlock: (c: Client, user: string, name: string, at: string) => asUser(c, user, () => c.query(
    `insert into public.user_advanced_unlocks(user_id,advanced_stat_name,unlocked_at) values($1,$2,$3)
     on conflict (user_id,advanced_stat_name) do update set unlocked_at=excluded.unlocked_at`, [user, name, at])),
  // origin/inner-main foundryTrainingService.ts:719,734,803 (all admin client)
  foundryLedger: (c: Client, f: FSeed) => asService(c, () => c.query(
    "select public.bty_foundry_award_daily_capped($1,$2,$3,10,$4,$5,3) as outcome", [f.user, f.event, f.progress, day.start, day.end])),
  // applyDirectCoreXp (old applyCoreXp.ts:106-157): a read, then an absolute write.
  foundryCoreRead: (c: Client, f: FSeed) => asService(c, async () => Number((await c.query(
    "select core_xp_total from public.arena_profiles where user_id=$1", [f.user])).rows[0].core_xp_total)),
  foundryCoreWrite: (c: Client, f: FSeed, readCore: number) => asService(c, () => c.query(
    "update public.arena_profiles set core_xp_total=$2, updated_at=now() where user_id=$1", [f.user, readCore + 10])),
  foundryMarker: (c: Client, f: FSeed) => asService(c, () => c.query(
    "update public.foundry_event_training_progress set linked_user_id=$2, xp_awarded_at=now() where id=$1 and xp_awarded_at is null", [f.progress, f.user])),
  foundryClaim: (c: Client, f: FSeed) => asService(c, () => c.query(OLD_CLAIM_SQL, claimParams(f))),
  // applySeasonalXpToCore (applyCoreXp.ts:23-90) with the user client: a read, then an absolute write.
  seasonalCoreRead: (c: Client, user: string) => asUser(c, user, async () => (await c.query(
    "select core_xp_total, core_xp_buffer, sub_name, sub_name_renamed_in_code from public.arena_profiles where user_id=$1", [user])).rows[0] as Row),
  seasonalCoreWrite: (c: Client, user: string, read: Row, xp: number) => {
    const next = seasonalCoreOracle(read, xp);
    return asUser(c, user, () => c.query(`update public.arena_profiles set core_xp_total=$2, core_xp_buffer=$3, tier=$4, code_index=$5,
      stage=$6, code_hidden=$7, sub_name=$8 where user_id=$1`, [user, next.core, next.buffer, next.tier, next.code, next.stage, next.hidden, next.subName]));
  },
  beginnerProfile: (c: Client, s: Seed) => asUser(c, s.user, () => c.query("select public.ensure_arena_profile()")),
  // Pre-fix run/complete weekly reflection quest (route.ts before this PR): read claim, pay, Core, claim.
  questClaimRead: (c: Client, user: string, week: string) => asUser(c, user, async () => (await c.query(
    "select user_id from public.arena_weekly_quest_claims where user_id=$1 and week_start=$2 and quest_type='reflection'", [user, week])).rows.length > 0),
  questWeekly: (c: Client, user: string) => asService(c, () => c.query("select public.increment_weekly_xp($1,null,15)", [user])),
  questClaimInsert: (c: Client, user: string, week: string) => asUser(c, user, () => c.query(
    "insert into public.arena_weekly_quest_claims(user_id,week_start,quest_type) values($1,$2,'reflection')", [user, week])),
};

/** TypeScript oracle: applySeasonalXpToCore's arithmetic from src/lib/bty/arena/codes.ts. */
function seasonalCoreOracle(read: Row, xp: number) {
  const current = Math.max(0, Number(read.core_xp_total ?? 0));
  const buffer = Math.max(0, Number(read.core_xp_buffer ?? 0));
  const { coreGain, fractionalBuffer } = seasonalToCoreConversion(xp, current);
  let nextBuffer = buffer + fractionalBuffer;
  const fromBuffer = Math.floor(nextBuffer); nextBuffer -= fromBuffer;
  const core = current + coreGain + fromBuffer;
  const tier = tierFromCoreXp(core); const code = codeIndexFromTier(tier);
  const defaults = (SUB_NAMES as Record<number, readonly string[] | null | undefined>)[code];
  const subName = Boolean(read.sub_name_renamed_in_code) || defaults == null ? read.sub_name ?? null : defaults[subTierGroupFromTier(tier)];
  return { core, buffer: nextBuffer, gain: core - current, tier, code, stage: Math.min(7, Math.floor(core / 100) + 1), hidden: core >= 700, subName };
}

type Seed = { user: string; run: string; scenario: string };
type FSeed = { user: string; owner: string; event: string; participant: string; progress: string; org: string; assignment: string | null; hash: string };
let day = { start: "", end: "", date: "", dueDate: "", dueAt: "" };

async function seedRun(c: Client, type: "scenario" | "beginner", scenario = type === "beginner" ? "beginner-qa" : LEGACY_SCENARIO, user: string = randomUUID()): Promise<Seed> {
  const run = randomUUID();
  await c.query("insert into auth.users(id) values($1) on conflict do nothing", [user]);
  await c.query("insert into public.arena_profiles(user_id,lifetime_xp,weekly_xp,core_xp_total,core_xp_buffer,sub_name) values($1,11,7,199,$2,'QA existing') on conflict do nothing", [user, 2 / 3]);
  await c.query("insert into public.arena_runs(run_id,user_id,scenario_id,run_type) values($1,$2,$3,$4)", [run, user, scenario, type]);
  return { user, run, scenario };
}
async function seedHealingUser(c: Client): Promise<string> {
  const user = randomUUID(); await c.query("insert into auth.users(id) values($1)", [user]);
  await c.query("insert into public.train_day_completions(user_id,day) select $1, g from generate_series(1,28) g", [user]);
  return user;
}
async function seedFoundry(c: Client, claim = false, user: string = randomUUID()): Promise<FSeed> {
  const owner = randomUUID(), event = randomUUID(), participant = randomUUID(), progress = randomUUID(), org = randomUUID();
  const hash = randomBytes(32).toString("hex");
  await c.query("insert into auth.users(id) values($1),($2) on conflict do nothing", [user, owner]);
  await c.query("insert into public.foundry_events(id,owner_user_id) values($1,$2)", [event, owner]);
  await c.query("insert into public.arena_profiles(user_id,lifetime_xp,weekly_xp,core_xp_total,core_xp_buffer,tier,sub_name,stage) values($1,11,7,199,$2,19,'QA name',2) on conflict do nothing", [user, 2 / 3]);
  await c.query("insert into public.foundry_event_participants(id,event_id,user_id) values($1,$2,$3)", [participant, event, claim ? null : user]);
  await c.query(`insert into public.foundry_event_training_progress(id,event_id,participant_id,video_completed_at,response_text,completed_at,linked_user_id,claim_secret_hash,claim_secret_expires_at)
    values($1,$2,$3,now(),'QA completion',now(),$4,$5,now()+interval '1 day')`, [progress, event, participant, claim ? null : user, claim ? hash : null]);
  let assignment: string | null = null;
  if (claim) {
    assignment = randomUUID(); const membership = randomUUID();
    await c.query("insert into public.bty_organizations(id) values($1)", [org]); await c.query("insert into public.bty_org_memberships(id) values($1)", [membership]);
    await c.query("insert into public.foundry_event_participation_mode(event_id,mode) values($1,'assigned_overlay')", [event]);
    await c.query(`insert into public.foundry_event_assignments(id,event_id,organization_id,membership_id,user_id,membership_id_snapshot,user_id_snapshot,assigned_by_snapshot)
      values($1,$2,$3,$4,$5,$4,$5,$6)`, [assignment, event, org, membership, user, owner]);
  }
  return { user, owner, event, participant, progress, org, assignment, hash };
}
function claimParams(f: FSeed, over: Row = {}) {
  return [f.hash, f.user, "UTC", "QA training", f.assignment, f.org, 7, day.date, day.dueDate, day.dueAt, 7, day.date, day.dueDate, day.dueAt, 10, over.eligible ?? true, day.start, day.end];
}
const choiceParams = (s: Seed, over: Row = {}) => [s.user, s.run, s.scenario, over.choiceId ?? "choice-a", 2, 82, JSON.stringify({ trust: 2 }), JSON.stringify({ qa: "new" })];
const beginnerParams = (s: Seed) => [s.user, s.run, s.scenario, JSON.stringify(RESPONSES), 17, JSON.stringify(FEEDBACK)];
const service = (c: Client, sql: string, args: unknown[]) => asService(c, async () => (await c.query(sql, args)).rows[0].result as Row);

/** Reward totals that a payment changes; used to count actual payments, not RPC outcomes. */
async function money(c: Client, user: string, run?: string): Promise<Row> {
  const p = (await c.query("select lifetime_xp, weekly_xp, core_xp_total, core_xp_buffer from public.arena_profiles where user_id=$1", [user])).rows[0] ?? {};
  const weekly = (await c.query("select coalesce(sum(xp_total),0)::int n from public.weekly_xp where user_id=$1", [user])).rows[0].n;
  const runXp = run ? (await c.query("select total_xp from public.arena_runs where run_id=$1", [run])).rows[0].total_xp : null;
  const ledger = (await c.query("select count(*)::int n, coalesce(sum(delta_xp),0)::int xp from public.core_xp_ledger where user_id=$1", [user])).rows[0];
  return { lifetime: p.lifetime_xp ?? null, profileWeekly: p.weekly_xp ?? null, core: p.core_xp_total ?? null, buffer: p.core_xp_buffer == null ? null : Number(p.core_xp_buffer),
    weeklyXpTotal: weekly, runTotalXp: runXp, ledgerRows: ledger.n, ledgerXp: ledger.xp };
}
const delta = (after: Row, before: Row) => Object.fromEntries(Object.keys(after).map(k =>
  [k, typeof after[k] === "number" && typeof before[k] === "number" ? after[k] - before[k] : after[k]]));
async function seedReflections(c: Client, user: string, count: number, at = "now()") {
  const s = await seedRun(c, "scenario", LEGACY_SCENARIO, user);
  for (let i = 0; i < count; i++) await c.query(`insert into public.arena_events(run_id,user_id,step,event_type,scenario_id,created_at)
    values($1,$2,5,'REFLECTION_SELECTED',$3,${at})`, [s.run, user, s.scenario]);
  return s;
}

async function snapshot(c: Client): Promise<Row> {
  const out: Row = {};
  for (const t of SNAPSHOT_TABLES) out[t] = (await c.query(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]') v from ${t} x`)).rows[0].v;
  return out;
}
async function rejected(work: Promise<unknown>, expect: RegExp): Promise<string> {
  try { await work; } catch (e) { const msg = `${(e as Error).message} ${(e as { detail?: string }).detail ?? ""}`; assert.match(msg, expect); return msg.trim(); }
  assert.fail(`expected rejection ${expect}`);
}
async function rejectedUnchanged(c: Client, work: () => Promise<unknown>, expect: RegExp): Promise<string> {
  const before = await snapshot(c); const msg = await rejected(work(), expect); assert.deepEqual(await snapshot(c), before, "rejected work changed rows"); return msg;
}
const FENCED = /REWARD_WRITE_FENCED/;
const count = async (c: Client, sql: string, args: unknown[] = []) => (await c.query(sql, args)).rows[0].n as number;
async function waitForLockWait(observer: Client, pid: number) {
  for (let i = 0; i < 100; i++) {
    const r = (await observer.query("select wait_event_type from pg_stat_activity where pid=$1", [pid])).rows[0];
    if (r?.wait_event_type === "Lock") return;
    await new Promise(res => setTimeout(res, 50));
  }
  assert.fail(`pid ${pid} never waited on a lock`);
}
async function fenceInstalled(c: Client) {
  return count(c, "select count(*)::int n from pg_trigger where tgname like 'bty_reward_fence_%'");
}

async function main() {
  const jsonIndex = process.argv.indexOf("--json");
  const jsonOut = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : undefined;
  if (jsonOut) assert(path.isAbsolute(jsonOut), "Absolute --json path required");
  const url = validateFenceTarget(process.env.REWARD_FENCE_TEST_DATABASE_URL);
  const c = await connect(url, "fence-main");
  const sessions: Client[] = [c];
  const open = async (name: string) => { const s = await connect(url, name); sessions.push(s); return s; };
  const sources = readCutoverSources(process.cwd());
  const bundle = buildApplyBundle(sources) as string;
  const evidence: Row = {
    engine: "native-postgresql", engineVersion: "", startedAt: new Date().toISOString(),
    bundleSha256: createHash("sha256").update(bundle).digest("hex"),
    sources: sources.map((s: Row) => ({ file: s.file, sha256: s.sha256 })), fixture: [] as Row[], checks: [] as Row[], residual: [] as Row[],
  };
  evidence.expectedChecks = EXPECTED_CHECKS;
  const check = async (name: string, fn: () => Promise<Row | void>) => {
    assert(EXPECTED_CHECKS.includes(name), `unlisted check: ${name}`);
    assert(!evidence.checks.some((x: Row) => x.name === name), `duplicate check: ${name}`);
    const detail = await fn(); evidence.checks.push({ name, ...(detail ?? {}) }); console.log(`PASS ${name}`);
  };
  try {
    evidence.engineVersion = (await c.query("select version() v")).rows[0].v;
    evidence.fixture = await bootstrap(c);
    const t = (await c.query("select date_trunc('day',now())::text s,(date_trunc('day',now())+interval '1 day')::text e,current_date::text d,(current_date+7)::text dd,(date_trunc('day',now())+interval '7 days')::text da")).rows[0];
    day = { start: t.s, end: t.e, date: t.d, dueDate: t.dd, dueAt: t.da };
    const legacyIds = SCENARIOS.map((s: { scenarioId: string }) => s.scenarioId);
    const week = getWeekStartUTC();

    // ---------------- before cutover: the old release really splits its writes ----------------
    const hist: Row = {};
    await check("before cutover: old legacy choice route can pay the same run twice (reproduced bug)", async () => {
      const s = await seedRun(c, "scenario"); hist.choiceDup = s;
      for (let i = 0; i < 2; i++) { await OLD.choiceEvent(c, s); await OLD.choiceStep(c, s); await OLD.choiceXp(c, s); }
      assert.equal(await count(c, "select count(*)::int n from public.arena_events where run_id=$1 and event_type='CHOICE_CONFIRMED'", [s.run]), 2);
      assert.equal(await count(c, "select total_xp n from public.arena_runs where run_id=$1", [s.run]), 164);
    });
    await check("before cutover: old beginner completion commits DONE as a separate write before XP", async () => {
      const s = await seedRun(c, "beginner"); hist.beginnerPartial = s;
      assert.equal((await OLD.beginnerDone(c, s)).rows.length, 1);
      assert.equal(await count(c, "select count(*)::int n from public.weekly_xp where user_id=$1", [s.user]), 0);
    });
    await check("before cutover: old Healing acts and milestone are user-JWT writes", async () => {
      const u = await seedHealingUser(c); hist.healingPartial = u;
      for (const act of [1, 2, 3]) await OLD.healingAct(c, u, act);
      assert.equal(await count(c, "select count(*)::int n from public.user_healing_awakening_acts where user_id=$1", [u]), 3);
      assert.equal(await count(c, "select count(*)::int n from public.user_healing_milestones where user_id=$1", [u]), 0);
    });
    await check("before cutover: old Foundry ledger commits without Core or marker", async () => {
      const f = await seedFoundry(c); hist.foundryPartial = f;
      assert.equal((await OLD.foundryLedger(c, f)).rows[0].outcome, "awarded");
      assert.equal(await count(c, "select core_xp_total n from public.arena_profiles where user_id=$1", [f.user]), 199);
    });
    // Pre-cutover rows a paused old request will try to continue after cutover.
    const paused = { beginner: await seedRun(c, "beginner"), healing: await seedHealingUser(c), foundry: await seedFoundry(c), ritual: await seedHealingUser(c) };
    await OLD.beginnerDone(c, paused.beginner);
    for (const act of [1, 2, 3]) await OLD.healingAct(c, paused.healing, act);
    await OLD.foundryLedger(c, paused.foundry);
    const ritualAt = new Date().toISOString();
    await OLD.healingMilestone(c, paused.ritual, ritualAt, "PRM");
    // Several old requests on the same run/progress commit anchors before cutover.
    const multi = { choice: await seedRun(c, "scenario"), beginner: await seedRun(c, "beginner"), beginnerFail: await seedRun(c, "beginner"),
      foundry: await seedFoundry(c), foundryFail: await seedFoundry(c), lostOld: await seedFoundry(c) };
    const lostNew = await seedFoundry(c, false, multi.lostOld.user);
    for (let i = 0; i < 3; i++) await OLD.choiceEvent(c, multi.choice);
    const beginnerAnchors: number[] = [];
    for (const s of [multi.beginner, multi.beginnerFail]) for (let i = 0; i < 3; i++) beginnerAnchors.push((await OLD.beginnerDone(c, s)).rows.length);
    const foundryAnchors: string[] = [];
    for (const f of [multi.foundry, multi.foundryFail]) for (let i = 0; i < 2; i++) foundryAnchors.push((await OLD.foundryLedger(c, f)).rows[0].outcome);
    await OLD.foundryLedger(c, multi.lostOld);
    const residualUsers = new Set([paused.foundry.user, paused.beginner.user, multi.choice.user, multi.beginner.user,
      multi.beginnerFail.user, multi.foundry.user, multi.foundryFail.user, multi.lostOld.user]);
    const historical = await snapshot(c);

    // ---------------- requests already inside the database at cutover ----------------
    const t1 = await open("old-inflight-writer"); const t2 = await open("old-inflight-reader");
    const t3 = await open("old-inflight-foundry"); const cut = await open("cutover"); const observer = await open("observer");
    const inflight = await seedRun(c, "scenario"); const lateHealing = await seedHealingUser(c); const lateFoundry = await seedFoundry(c);
    await t1.query("begin"); await asUser(t1, inflight.user, () => t1.query(
      `insert into public.arena_events(run_id,user_id,step,event_type,scenario_id,choice_id,xp) values($1,$2,2,'CHOICE_CONFIRMED',$3,'choice-a',82)`,
      [inflight.run, inflight.user, inflight.scenario]));
    await t2.query("begin"); await asUser(t2, lateHealing, () => t2.query("select count(*) from public.user_healing_awakening_acts where user_id=$1", [lateHealing]));
    await t3.query("begin"); await asService(t3, () => t3.query("select count(*) from public.core_xp_ledger"));

    await check("cutover with a held write lock times out and rolls back completely", async () => {
      const msg = await rejected(cut.query(buildApplyBundle(sources, { lockTimeout: "500ms" })), /lock timeout/);
      await cut.query("rollback").catch(() => {});
      assert.equal(await fenceInstalled(c), 0);
      assert.equal(await count(c, "select count(*)::int n from supabase_migrations.schema_migrations"), 0);
      assert.equal(await count(c, "select count(*)::int n from pg_class where relname in ('arena_reward_receipts','foundry_xp_reward_receipts')"), 0);
      return { error: msg };
    });
    let cutoverDone = false;
    const cutover = cut.query(bundle).then(() => { cutoverDone = true; });
    await check("cutover waits for the transaction already writing a fenced table", async () => {
      await waitForLockWait(observer, cut.processID!);
      assert.equal(cutoverDone, false); assert.equal(await fenceInstalled(observer), 0);
      await t1.query("commit"); await cutover; assert.equal(cutoverDone, true);
      assert.equal(await count(c, "select count(*)::int n from public.arena_events where run_id=$1 and event_type='CHOICE_CONFIRMED'", [inflight.run]), 1);
      return { note: "a write committed before the fence existed is kept, never rewritten" };
    });
    await check("cutover leaves every pre-existing learner row byte-identical", async () => {
      const after = await snapshot(c);
      for (const table of SNAPSHOT_TABLES) for (const row of historical[table]) assert(after[table].some((r: Row) => JSON.stringify(r) === JSON.stringify(row)), `${table} row changed`);
    });
    await check("ledger records exactly the four cutover migrations; rerun is refused without change", async () => {
      const versions = (await c.query("select version from supabase_migrations.schema_migrations order by 1")).rows.map(r => r.version);
      assert.deepEqual(versions, sources.map((s: Row) => s.version));
      assert.equal(await fenceInstalled(c), FENCE_TRIGGERS.length);
      const before = await snapshot(c);
      await rejected(cut.query(bundle), /CUTOVER_LEDGER_NOT_EMPTY/); await cut.query("rollback").catch(() => {});
      assert.deepEqual(await snapshot(c), before);
    });
    await check("an old transaction opened before cutover cannot write Healing afterwards", async () => {
      const msg = await rejected(asUser(t2, lateHealing, () => t2.query("insert into public.user_healing_awakening_acts(user_id,act_id) values($1,1)", [lateHealing])), /permission denied|REWARD_WRITE_FENCED/);
      await t2.query("rollback");
      assert.equal(await count(c, "select count(*)::int n from public.user_healing_awakening_acts where user_id=$1", [lateHealing]), 0);
      return { error: msg };
    });
    await check("an old transaction opened before cutover cannot commit a Foundry ledger award afterwards", async () => {
      const outcome = (await asService(t3, () => t3.query("select public.bty_foundry_award_daily_capped($1,$2,$3,10,$4,$5,3) o", [lateFoundry.user, lateFoundry.event, lateFoundry.progress, day.start, day.end]))).rows[0].o;
      assert.equal(outcome, "awarded");
      const msg = await rejected(t3.query("commit"), FENCED);
      assert.equal(await count(c, "select count(*)::int n from public.core_xp_ledger where source_id=$1", [lateFoundry.progress]), 0);
      return { error: msg };
    });

    // ---------------- paused old HTTP requests resume after cutover ----------------
    await check("resumed old legacy choice: event insert rejected, so the route stops before XP", async () => {
      const s = await seedRun(c, "scenario");
      return { error: await rejectedUnchanged(c, () => OLD.choiceEvent(c, s), FENCED) };
    });
    await check("forged old-route meta cannot pass: fence keys on legacy catalog IDs, not client meta", async () => {
      const s = await seedRun(c, "scenario");
      return { error: await rejectedUnchanged(c, () => OLD.choiceEvent(c, s, LEGACY_SCENARIO, { binding: "v1" }), FENCED) };
    });
    await check("resumed old beginner completion: DONE, reflection and beginner reward events rejected", async () => {
      const s = await seedRun(c, "beginner");
      await rejectedUnchanged(c, () => OLD.beginnerDone(c, s), FENCED);
      await rejectedUnchanged(c, () => OLD.beginnerReflection(c, s), FENCED);
      await rejectedUnchanged(c, () => OLD.beginnerFreeResponse(c, s), FENCED);
      await rejectedUnchanged(c, () => OLD.beginnerReflection(c, paused.beginner), FENCED);
      await rejectedUnchanged(c, () => OLD.beginnerFreeResponse(c, paused.beginner), FENCED);
    });
    await check("resumed old Healing user-JWT writes rejected (milestone after pre-cutover acts, new act, starter unlock)", async () => {
      await rejectedUnchanged(c, () => OLD.healingMilestone(c, paused.healing, new Date().toISOString()), /permission denied|REWARD_WRITE_FENCED/);
      const u = await seedHealingUser(c);
      await rejectedUnchanged(c, () => OLD.healingAct(c, u, 1), /permission denied|REWARD_WRITE_FENCED/);
      return { error: await rejectedUnchanged(c, () => OLD.healingUnlock(c, paused.ritual, "PRM", ritualAt), FENCED) };
    });
    await check("the Healing trigger itself rejects user-JWT writes even if a client grant is restored", async () => {
      const u = await seedHealingUser(c);
      await c.query("begin"); await c.query("grant insert, update on public.user_healing_awakening_acts, public.user_healing_milestones to authenticated");
      const a = await rejected(OLD.healingAct(c, u, 1), FENCED); await c.query("rollback");
      await c.query("begin"); await c.query("grant insert, update on public.user_healing_milestones to authenticated");
      const m = await rejected(OLD.healingMilestone(c, u, new Date().toISOString()), FENCED); await c.query("rollback");
      return { errors: [a, m] };
    });
    await check("resumed old Foundry writes rejected: ledger, marker after pre-cutover ledger, old eligible claim", async () => {
      const f = await seedFoundry(c);
      await rejectedUnchanged(c, () => OLD.foundryLedger(c, f), FENCED);
      await rejectedUnchanged(c, () => OLD.foundryMarker(c, paused.foundry), FENCED);
      const claim = await seedFoundry(c, true);
      await rejectedUnchanged(c, () => OLD.foundryClaim(c, claim), FENCED);
      assert.equal(await count(c, "select count(*)::int n from public.foundry_event_training_progress where id=$1 and claim_consumed_at is null", [claim.progress]), 1);
    });
    await check("residual (documented, unfenceable by row): shared XP/Core writes of a request whose anchor committed before cutover", async () => {
      const weeklyBefore = await count(c, "select count(*)::int n from public.weekly_xp where user_id=$1", [paused.beginner.user]);
      await OLD.beginnerWeekly(c, paused.beginner);
      await OLD.foundryCoreWrite(c, paused.foundry, await OLD.foundryCoreRead(c, paused.foundry));
      assert.equal(await count(c, "select count(*)::int n from public.weekly_xp where user_id=$1", [paused.beginner.user]), weeklyBefore + 1);
      evidence.residual.push({ path: "beginner increment_weekly_xp / Foundry applyDirectCoreXp after a pre-cutover anchor",
        why: "weekly_xp and arena_profiles are written identically by unchanged reward paths; no row-level predicate separates them",
        bound: "completes at most that one old award; its anchor has no receipt, so the new RPC refuses with review-required (checked below)" });
    });

    // ---------------- non-replaced writers keep working ----------------
    await check("unchanged writers pass: canonical CHOICE_CONFIRMED, scenario FREE_RESPONSE, organic unlocks, LAB ledger, progress link/claim issue, XP RPCs", async () => {
      const canon = await seedRun(c, "scenario", CANONICAL_SCENARIO);
      await OLD.choiceEvent(c, canon, CANONICAL_SCENARIO, { binding: "v1" }); await OLD.choiceXp(c, canon);
      const scen = await seedRun(c, "scenario");
      await OLD.beginnerFreeResponse(c, scen);
      const u = await seedHealingUser(c);
      await OLD.healingUnlock(c, u, "EL", new Date().toISOString()); await OLD.healingUnlock(c, u, "PRM", new Date().toISOString());
      await asService(c, () => c.query("insert into public.core_xp_ledger(user_id,delta_xp,source_type,source_id) values($1,5,'LAB',$2)", [u, randomUUID()]));
      const f = await seedFoundry(c, true);
      await asService(c, () => c.query("update public.foundry_event_training_progress set claim_secret_hash=$2, claim_secret_expires_at=now()+interval '1 day' where id=$1", [f.progress, randomBytes(32).toString("hex")]));
      const l = await seedFoundry(c);
      await asService(c, () => c.query("update public.foundry_event_training_progress set linked_user_id=$2 where id=$1", [l.progress, l.user]));
      await OLD.beginnerWeekly(c, scen);
    });
    await check("fence catalog equals the bundled legacy catalog (45 IDs) and excludes canonical IDs", async () => {
      const inSql = (await c.query("select count(*)::int n from unnest($1::text[]) id where public.bty_reward_fence_is_legacy_catalog_scenario(id)", [legacyIds])).rows[0].n;
      assert.equal(legacyIds.length, 45); assert.equal(inSql, 45);
      assert.equal((await c.query("select public.bty_reward_fence_is_legacy_catalog_scenario($1) v", [CANONICAL_SCENARIO])).rows[0].v, false);
    });

    // ---------------- new atomic paths after cutover ----------------
    await check("new legacy choice: one award, identical replay frozen, changed input refused", async () => {
      const s = await seedRun(c, "scenario");
      const first = await service(c, CHOICE_SQL, choiceParams(s));
      const replay = await service(c, CHOICE_SQL, choiceParams(s));
      assert.equal(first.replayed, false); assert.deepEqual(replay, { ...first, replayed: true });
      await rejectedUnchanged(c, () => service(c, CHOICE_SQL, choiceParams(s, { choiceId: "choice-b" })), /REWARD_INPUT_CONFLICT/);
      assert.equal(await count(c, "select total_xp n from public.arena_runs where run_id=$1", [s.run]), 82);
    });
    await check("new legacy choice: two concurrent sessions produce one award and one frozen replay", async () => {
      const s = await seedRun(c, "scenario"); const a = await open("race-a"); const b = await open("race-b");
      const results = await Promise.all([service(a, CHOICE_SQL, choiceParams(s)), service(b, CHOICE_SQL, choiceParams(s))]);
      assert.deepEqual(results.map(r => r.replayed).sort(), [false, true]);
      assert.equal(await count(c, "select count(*)::int n from public.arena_reward_receipts where run_id=$1", [s.run]), 1);
      assert.equal(await count(c, "select total_xp n from public.arena_runs where run_id=$1", [s.run]), 82);
    });
    await check("new beginner completion: one award and frozen replay", async () => {
      const s = await seedRun(c, "beginner");
      const first = await service(c, BEGINNER_SQL, beginnerParams(s)); const replay = await service(c, BEGINNER_SQL, beginnerParams(s));
      assert.equal(first.seasonalXp, 30); assert.deepEqual(replay, { ...first, replayed: true });
      assert.equal(await count(c, "select xp_total n from public.weekly_xp where user_id=$1", [s.user]), 30);
    });
    await check("pre-cutover partial/duplicate legacy state is review-required and unchanged", async () => {
      await rejectedUnchanged(c, () => service(c, CHOICE_SQL, choiceParams(hist.choiceDup)), /LEGACY_REWARD_REVIEW_REQUIRED/);
      await rejectedUnchanged(c, () => service(c, CHOICE_SQL, choiceParams(inflight)), /LEGACY_REWARD_REVIEW_REQUIRED/);
      await rejectedUnchanged(c, () => service(c, BEGINNER_SQL, beginnerParams(hist.beginnerPartial)), /LEGACY_REWARD_REVIEW_REQUIRED/);
      await rejectedUnchanged(c, () => service(c, BEGINNER_SQL, beginnerParams(paused.beginner)), /LEGACY_REWARD_REVIEW_REQUIRED/);
    });
    await check("new Healing acts and ritual: atomic, replay idempotent, partial history review-required", async () => {
      const u = await seedHealingUser(c);
      for (const act of [1, 2, 3]) await service(c, ACT_SQL, [u, act]);
      await rejectedUnchanged(c, () => service(c, ACT_SQL, [u, 3]), /ACT_ALREADY_COMPLETED/);
      assert.equal(await count(c, "select count(*)::int n from public.user_healing_milestones where user_id=$1 and second_awakening_completed_at is not null", [u]), 1);
      const r = await seedHealingUser(c);
      const first = await service(c, RITUAL_SQL, [r, "SAG"]); const replay = await service(c, RITUAL_SQL, [r, "SAG"]);
      assert.equal(first.idempotent, false); assert.equal(replay.idempotent, true);
      assert.equal(await count(c, "select count(*)::int n from public.user_advanced_unlocks where user_id=$1 and advanced_stat_name='SAG'", [r]), 1);
      const act3 = await rejectedUnchanged(c, () => service(c, ACT_SQL, [hist.healingPartial, 3]), /HEALING_COMPLETION_REVIEW_REQUIRED|ACT_ALREADY_COMPLETED/);
      const ritual = await rejectedUnchanged(c, () => service(c, RITUAL_SQL, [paused.ritual, "PRM"]), /HEALING_COMPLETION_REVIEW_REQUIRED/);
      return { partialAct3: act3, partialRitual: ritual };
    });
    await check("new Foundry award and claim: one award, replay, concurrent claimants, partial history review-required", async () => {
      const f = await seedFoundry(c);
      const first = await service(c, AWARD_SQL, [f.user, f.event, f.progress, day.start, day.end]);
      const replay = await service(c, AWARD_SQL, [f.user, f.event, f.progress, day.start, day.end]);
      assert.equal(first.outcome, "awarded"); assert.equal(replay.replayed, true);
      assert.equal(await count(c, "select core_xp_total n from public.arena_profiles where user_id=$1", [f.user]), 209);
      const claim = await seedFoundry(c, true); const a = await open("claim-a"); const b = await open("claim-b");
      const both = await Promise.all([service(a, CLAIM_SQL, claimParams(claim)), service(b, CLAIM_SQL, claimParams(claim))]);
      assert.equal(both.filter(r => r.replayed === true).length, 1);
      assert.equal(await count(c, "select count(*)::int n from public.core_xp_ledger where source_id=$1", [claim.progress]), 1);
      const partialResults: Row[] = [];
      for (const partial of [hist.foundryPartial, paused.foundry]) {
        const before = await snapshot(c);
        const result = await service(c, AWARD_SQL, [partial.user, partial.event, partial.progress, day.start, day.end]).catch((e: Error) => ({ error: e.message }));
        assert.match(JSON.stringify(result), /review|REVIEW/i, JSON.stringify(result));
        assert.deepEqual(await snapshot(c), before, "review-required Foundry result wrote rows");
        partialResults.push(result);
      }
      return { partialResults };
    });

    // ---------------- failure inside the atomic transaction rolls everything back ----------------
    await check("injected failure at the final receipt/milestone write rolls back every earlier write", async () => {
      await c.query(`create function public.qa_fail() returns trigger language plpgsql as $$ begin raise exception 'QA_INJECTED_FAILURE'; end $$;
        create trigger qa_fail before insert on public.arena_reward_receipts for each row execute function public.qa_fail();
        create trigger qa_fail before insert on public.foundry_xp_reward_receipts for each row execute function public.qa_fail();
        create trigger qa_fail before insert on public.user_healing_milestones for each row execute function public.qa_fail();`);
      try {
        const s = await seedRun(c, "scenario"); const b = await seedRun(c, "beginner"); const f = await seedFoundry(c);
        const u = await seedHealingUser(c); await service(c, ACT_SQL, [u, 1]); await service(c, ACT_SQL, [u, 2]);
        await rejectedUnchanged(c, () => service(c, CHOICE_SQL, choiceParams(s)), /QA_INJECTED_FAILURE/);
        await rejectedUnchanged(c, () => service(c, BEGINNER_SQL, beginnerParams(b)), /QA_INJECTED_FAILURE/);
        await rejectedUnchanged(c, () => service(c, AWARD_SQL, [f.user, f.event, f.progress, day.start, day.end]), /QA_INJECTED_FAILURE/);
        await rejectedUnchanged(c, () => service(c, ACT_SQL, [u, 3]), /QA_INJECTED_FAILURE/);
      } finally {
        await c.query(`drop trigger qa_fail on public.arena_reward_receipts; drop trigger qa_fail on public.foundry_xp_reward_receipts;
          drop trigger qa_fail on public.user_healing_milestones; drop function public.qa_fail();`);
      }
    });

    // ---------------- item 2: many old requests per anchor, resumed after cutover ----------------
    await check("same legacy run: three pre-cutover anchors, resumed XP with a mid-failure and a retry pay exactly the surviving anchors", async () => {
      const before = await money(c, multi.choice.user, multi.choice.run);
      await OLD.choiceStep(c, multi.choice); await OLD.choiceXp(c, multi.choice);              // request 1 resumes
      await c.query("begin"); await OLD.choiceXp(c, multi.choice); await c.query("rollback");   // request 2: XP call lost mid-transaction
      await rejectedUnchanged(c, () => OLD.choiceEvent(c, multi.choice), FENCED);              // request 2 client retry: new event fenced, route stops
      await OLD.choiceStep(c, multi.choice); await OLD.choiceXp(c, multi.choice);              // request 3 resumes
      const paid = delta(await money(c, multi.choice.user, multi.choice.run), before);
      const anchors = await count(c, "select count(*)::int n from public.arena_events where run_id=$1 and event_type='CHOICE_CONFIRMED'", [multi.choice.run]);
      assert.equal(anchors, 3); assert.equal(paid.runTotalXp, 164); assert.equal(paid.lifetime, 164); assert.equal(paid.profileWeekly, 164);
      await rejectedUnchanged(c, () => service(c, CHOICE_SQL, choiceParams(multi.choice)), /LEGACY_REWARD_REVIEW_REQUIRED/);
      return { anchorsBeforeCutover: anchors, paymentsAfterCutover: paid.runTotalXp / 82, xpPerPayment: 82, runTotalXpDelta: paid.runTotalXp,
        note: "each post-cutover payment belongs to an anchor committed before cutover; no anchor can be created after it" };
    });
    await check("same beginner run: one DONE anchor among three old requests pays once; a failed XP call and every retry pay nothing", async () => {
      assert.deepEqual(beginnerAnchors, [1, 0, 0, 1, 0, 0]);
      const before = await money(c, multi.beginner.user); const beforeFail = await money(c, multi.beginnerFail.user);
      // Winner resumes: profile, weekly +30, Core read/write, reflection (fenced; the old route ignores that error).
      await OLD.beginnerProfile(c, multi.beginner); await OLD.beginnerWeekly(c, multi.beginner);
      const read = await OLD.seasonalCoreRead(c, multi.beginner.user); await OLD.seasonalCoreWrite(c, multi.beginner.user, read, 30);
      await rejectedUnchanged(c, () => OLD.beginnerReflection(c, multi.beginner), FENCED);
      // Second run: the winner's weekly call fails mid-transaction, the route returns 500 before Core.
      await OLD.beginnerProfile(c, multi.beginnerFail);
      await c.query("begin"); await OLD.beginnerWeekly(c, multi.beginnerFail); await c.query("rollback");
      // Every retry and both losers re-read DONE and return the stored result without writes.
      for (const s of [multi.beginner, multi.beginner, multi.beginnerFail, multi.beginnerFail]) {
        assert.equal((await OLD.beginnerDone(c, s)).rows.length, 0);
      }
      const paid = delta(await money(c, multi.beginner.user), before), paidFail = delta(await money(c, multi.beginnerFail.user), beforeFail);
      const oracle = seasonalCoreOracle(read, 30);
      assert.equal(paid.weeklyXpTotal, 30); assert.equal(paid.core, oracle.gain);
      assert.equal(paidFail.weeklyXpTotal, 0); assert.equal(paidFail.core, 0);
      for (const s of [multi.beginner, multi.beginnerFail]) await rejectedUnchanged(c, () => service(c, BEGINNER_SQL, beginnerParams(s)), /LEGACY_REWARD_REVIEW_REQUIRED/);
      return { completed: { payments: 1, weeklyXpDelta: paid.weeklyXpTotal, coreDelta: paid.core }, failedThenRetried: { payments: 0, weeklyXpDelta: 0, coreDelta: 0 } };
    });
    await check("same Foundry progress: one ledger anchor pays Core once; a failed Core write and every retry pay nothing", async () => {
      assert.deepEqual(foundryAnchors, ["awarded", "already_awarded", "awarded", "already_awarded"]);
      const before = await money(c, multi.foundry.user); const beforeFail = await money(c, multi.foundryFail.user);
      await OLD.foundryCoreWrite(c, multi.foundry, await OLD.foundryCoreRead(c, multi.foundry));  // anchor owner resumes Core
      await rejectedUnchanged(c, () => OLD.foundryMarker(c, multi.foundry), FENCED);                // its marker is fenced
      const readFail = await OLD.foundryCoreRead(c, multi.foundryFail);
      await c.query("begin"); await OLD.foundryCoreWrite(c, multi.foundryFail, readFail); await c.query("rollback"); // Core write lost
      for (const f of [multi.foundry, multi.foundryFail]) {
        // Client retries: the old capped award reports already_awarded, so old code skips Core; its marker stays fenced.
        assert.equal((await OLD.foundryLedger(c, f)).rows[0].outcome, "already_awarded");
        await rejectedUnchanged(c, () => OLD.foundryMarker(c, f), FENCED);
      }
      const paid = delta(await money(c, multi.foundry.user), before), paidFail = delta(await money(c, multi.foundryFail.user), beforeFail);
      assert.equal(paid.core, 10); assert.equal(paid.ledgerRows, 0); assert.equal(paidFail.core, 0); assert.equal(paidFail.ledgerRows, 0);
      for (const f of [multi.foundry, multi.foundryFail]) {
        const r = await service(c, AWARD_SQL, [f.user, f.event, f.progress, day.start, day.end]).catch((e: Error) => ({ error: e.message }));
        assert.match(JSON.stringify(r), /FOUNDRY_XP_REVIEW_REQUIRED/);
      }
      return { completed: { ledgerRows: 1, coreDelta: paid.core }, failedThenRetried: { ledgerRows: 1, coreDelta: 0 } };
    });
    await check("residual: an old absolute Core write interleaved with a new atomic award overwrites that award (under-payment, measured)", async () => {
      const read = await OLD.foundryCoreRead(c, multi.lostOld);                       // old request read 199 before
      const award = await service(c, AWARD_SQL, [lostNew.user, lostNew.event, lostNew.progress, day.start, day.end]);
      assert.equal(award.outcome, "awarded");                                          // new award commits 209
      await OLD.foundryCoreWrite(c, multi.lostOld, read);                              // old writes 199 + 10
      const core = (await money(c, multi.lostOld.user)).core;
      assert.equal(core, 209);
      evidence.residual.push({ path: "old applyDirectCoreXp/applySeasonalXpToCore read-then-write racing any Core writer",
        measured: { expectedCore: 219, actualCore: core }, effect: "one 10-point award overwritten (lost), never duplicated",
        note: "pre-existing lost-update hazard of TypeScript Core writers, also present in unchanged routes" });
      return { expectedCore: 219, actualCore: core };
    });

    // ---------------- item 3: weekly reflection quest +15 ----------------
    await check("pre-fix quest flow (still in previous-release Workers) pays twice under concurrency and after a failed claim insert", async () => {
      const racer = randomUUID(); await c.query("insert into auth.users(id) values($1)", [racer]); await seedReflections(c, racer, 3);
      const before = await money(c, racer);
      const sawClaim = [await OLD.questClaimRead(c, racer, week), await OLD.questClaimRead(c, racer, week)]; // both requests read first
      for (let i = 0; i < 2; i++) { await OLD.questWeekly(c, racer); const r = await OLD.seasonalCoreRead(c, racer); await OLD.seasonalCoreWrite(c, racer, r, 15); }
      await OLD.questClaimInsert(c, racer, week);
      await rejected(OLD.questClaimInsert(c, racer, week), /duplicate key/);           // second insert fails; old route ignores it
      const retry = randomUUID(); await c.query("insert into auth.users(id) values($1)", [retry]); await seedReflections(c, retry, 3);
      const beforeRetry = await money(c, retry);
      await OLD.questWeekly(c, retry); await OLD.seasonalCoreWrite(c, retry, await OLD.seasonalCoreRead(c, retry), 15);
      await c.query("begin"); await OLD.questClaimInsert(c, retry, week); await c.query("rollback");  // claim insert lost
      assert.equal(await OLD.questClaimRead(c, retry, week), false);
      await OLD.questWeekly(c, retry); await OLD.seasonalCoreWrite(c, retry, await OLD.seasonalCoreRead(c, retry), 15); await OLD.questClaimInsert(c, retry, week);
      const race = delta(await money(c, racer), before), again = delta(await money(c, retry), beforeRetry);
      assert.deepEqual(sawClaim, [false, false]); assert.equal(race.weeklyXpTotal, 30); assert.equal(again.weeklyXpTotal, 30);
      return { concurrent: { payments: 2, weeklyXpDelta: race.weeklyXpTotal }, failedClaimThenRetry: { payments: 2, weeklyXpDelta: again.weeklyXpTotal } };
    });
    await check("atomic quest: five concurrent claims pay +15 exactly once with TypeScript-identical Core", async () => {
      const u = randomUUID(); await c.query("insert into auth.users(id) values($1)", [u]); await seedReflections(c, u, 3);
      await c.query("update public.arena_profiles set core_xp_total=199, core_xp_buffer=$2, sub_name='Spark' where user_id=$1", [u, 0.9]);
      const read = (await c.query("select core_xp_total, core_xp_buffer, sub_name, sub_name_renamed_in_code from public.arena_profiles where user_id=$1", [u])).rows[0];
      const before = await money(c, u);
      const sessions5 = await Promise.all([1, 2, 3, 4, 5].map(i => open(`quest-${i}`)));
      const results = await Promise.all(sessions5.map(x => service(x, QUEST_SQL, [u, week])));
      const outcomes = results.map(r => r.outcome).sort();
      assert.deepEqual(outcomes, ["already_claimed", "already_claimed", "already_claimed", "already_claimed", "awarded"]);
      const paid = delta(await money(c, u), before); const oracle = seasonalCoreOracle(read, 15);
      assert.equal(paid.weeklyXpTotal, 15); assert.equal(paid.core, oracle.gain);
      const p = (await c.query("select core_xp_total, core_xp_buffer::float8 b, tier, code_index, stage, code_hidden, sub_name from public.arena_profiles where user_id=$1", [u])).rows[0];
      assert.deepEqual([p.core_xp_total, p.b, p.tier, p.code_index, p.stage, p.code_hidden, p.sub_name],
        [oracle.core, oracle.buffer, oracle.tier, oracle.code, oracle.stage, oracle.hidden, oracle.subName]);
      assert.equal(await count(c, "select count(*)::int n from public.arena_weekly_quest_claims where user_id=$1", [u]), 1);
      return { outcomes, payments: 1, weeklyXpDelta: paid.weeklyXpTotal, coreDelta: paid.core };
    });
    await check("atomic quest: a failure inside the transaction writes nothing and the retry pays once", async () => {
      const u = randomUUID(); await c.query("insert into auth.users(id) values($1)", [u]); await seedReflections(c, u, 3);
      await c.query(`create function public.qa_fail() returns trigger language plpgsql as $$ begin raise exception 'QA_INJECTED_FAILURE'; end $$;
        create trigger qa_fail before update on public.arena_profiles for each row execute function public.qa_fail();`);
      try { await rejectedUnchanged(c, () => service(c, QUEST_SQL, [u, week]), /QA_INJECTED_FAILURE/); }
      finally { await c.query("drop trigger qa_fail on public.arena_profiles; drop function public.qa_fail();"); }
      const before = await money(c, u);
      const first = await service(c, QUEST_SQL, [u, week]); const replay = await service(c, QUEST_SQL, [u, week]);
      assert.equal(first.outcome, "awarded"); assert.equal(replay.outcome, "already_claimed");
      assert.equal(delta(await money(c, u), before).weeklyXpTotal, 15);
    });
    await check("atomic quest: eligibility, week bounds and caller role are enforced before any write", async () => {
      const two = randomUUID(); await c.query("insert into auth.users(id) values($1)", [two]); await seedReflections(c, two, 2);
      await seedReflections(c, two, 5, "now() - interval '8 days'");
      const before = await snapshot(c);
      assert.equal((await service(c, QUEST_SQL, [two, week])).outcome, "not_eligible");
      assert.deepEqual(await snapshot(c), before);
      const tuesday = new Date(Date.parse(`${week}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
      const future = new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
      for (const bad of [tuesday, future]) await rejectedUnchanged(c, () => service(c, QUEST_SQL, [two, bad]), /INVALID_REWARD_INPUT/);
      await rejectedUnchanged(c, () => asUser(c, two, () => c.query(QUEST_SQL, [two, week])), /permission denied/);
    });
    await check("atomic quest Core matches applySeasonalXpToCore across buffer and tier boundaries", async () => {
      const cases: [number, number, boolean][] = [[0, 0, false], [199, 2 / 3, false], [199, 0.95, false], [200, 0.5, false], [249, 0.99, false], [699, 0.99, false], [998, 0.2, true]];
      const results: Row[] = [];
      for (const [core, buffer, renamed] of cases) {
        const u = randomUUID(); await c.query("insert into auth.users(id) values($1)", [u]); await seedReflections(c, u, 3);
        await c.query("update public.arena_profiles set core_xp_total=$2, core_xp_buffer=$3, sub_name=$4, sub_name_renamed_in_code=$5 where user_id=$1",
          [u, core, buffer, renamed ? "Custom" : "Spark", renamed]);
        const read = (await c.query("select core_xp_total, core_xp_buffer, sub_name, sub_name_renamed_in_code from public.arena_profiles where user_id=$1", [u])).rows[0];
        assert.equal((await service(c, QUEST_SQL, [u, week])).outcome, "awarded");
        const p = (await c.query("select core_xp_total, core_xp_buffer::float8 b, tier, code_index, stage, code_hidden, sub_name from public.arena_profiles where user_id=$1", [u])).rows[0];
        const o = seasonalCoreOracle(read, 15);
        assert.deepEqual([p.core_xp_total, p.b, p.tier, p.code_index, p.stage, p.code_hidden, p.sub_name], [o.core, o.buffer, o.tier, o.code, o.stage, o.hidden, o.subName], JSON.stringify({ core, buffer }));
        results.push({ core, buffer, coreAfter: p.core_xp_total, bufferAfter: p.b });
      }
      return { cases: results };
    });
    await check("residual: a previous-release quest request racing the atomic claim can still add one extra +15 (measured)", async () => {
      const u = randomUUID(); await c.query("insert into auth.users(id) values($1)", [u]); await seedReflections(c, u, 3);
      const before = await money(c, u);
      assert.equal(await OLD.questClaimRead(c, u, week), false);                       // old request reads first
      assert.equal((await service(c, QUEST_SQL, [u, week])).outcome, "awarded");      // new release claims and pays
      await OLD.questWeekly(c, u); await OLD.seasonalCoreWrite(c, u, await OLD.seasonalCoreRead(c, u), 15);
      await rejected(OLD.questClaimInsert(c, u, week), /duplicate key/);
      const paid = delta(await money(c, u), before);
      assert.equal(paid.weeklyXpTotal, 30);
      evidence.residual.push({ path: "previous-release run/complete weekly quest (preview URL or in-flight)", measured: { payments: 2, weeklyXpDelta: 30 },
        why: "the old flow pays through increment_weekly_xp and an absolute Core write before its claim; both are shared with unchanged writers",
        mitigation: "disable workers.dev preview URLs so no previous version serves; in-flight old requests are bounded to those already running" });
      return { payments: 2, weeklyXpDelta: paid.weeklyXpTotal };
    });
    await check("historical rows remain byte-identical after every fenced and atomic operation", async () => {
      const after = await snapshot(c);
      for (const table of SNAPSHOT_TABLES) for (const row of historical[table]) {
        const key = JSON.stringify(row);
        // Residual checks resume old XP/Core writes for these users; their profile and weekly rows change by design.
        if (["public.arena_profiles", "public.weekly_xp", "public.arena_runs"].includes(table) && residualUsers.has(row.user_id)) continue;
        // lostNew was seeded before cutover and legitimately awarded afterwards by the atomic RPC.
        if (table === "public.foundry_event_training_progress" && row.id === lostNew.progress) continue;
        assert(after[table].some((r: Row) => JSON.stringify(r) === key), `${table} historical row changed: ${key}`);
      }
    });

    // ---------------- recovery ----------------
    await check("recovery bundle removes only the fence; receipts/RPCs stay; old split write possible again", async () => {
      const receipts = await count(c, "select count(*)::int n from public.arena_reward_receipts");
      await c.query(buildRecoveryBundle());
      assert.equal(await fenceInstalled(c), 0);
      assert.equal(await count(c, "select count(*)::int n from public.arena_reward_receipts"), receipts);
      const s = await seedRun(c, "scenario"); await OLD.choiceEvent(c, s);
      assert.equal(await count(c, "select count(*)::int n from pg_proc where proname='bty_record_legacy_choice_reward'"), 1);
    });
    const executed = evidence.checks.map((x: Row) => x.name);
    evidence.unrun = EXPECTED_CHECKS.filter(name => !executed.includes(name));
    assert.deepEqual(executed, EXPECTED_CHECKS, "every expected check body must execute exactly once, in order");
    evidence.result = "pass";
  } catch (error) {
    evidence.result = "fail"; evidence.error = (error as Error).stack ?? String(error); throw error;
  } finally {
    evidence.finishedAt = new Date().toISOString();
    if (jsonOut) await writeFile(jsonOut, JSON.stringify(evidence, null, 2));
    for (const s of sessions.reverse()) await s.end().catch(() => {});
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
