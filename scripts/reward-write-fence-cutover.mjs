#!/usr/bin/env node
/**
 * Builds the single-transaction SQL bundle for the reward write cutover. Local
 * file generation only: no network, credentials, database or Worker access.
 *
 *   node scripts/reward-write-fence-cutover.mjs --apply-out /abs/cutover.sql
 *   node scripts/reward-write-fence-cutover.mjs --pause-out /abs/pause.sql --pause-reason "<why>"
 *   node scripts/reward-write-fence-cutover.mjs --resume-out /abs/resume.sql
 *   node scripts/reward-write-fence-cutover.mjs --remove-fence-out /abs/remove-fence.sql   (last resort)
 *
 * The apply bundle locks every fenced table first (waiting for transactions that
 * already hold write locks to end), refuses a partially applied ledger, applies
 * the three PR91 migrations, the fence and the atomic weekly quest together, records them in
 * supabase_migrations.schema_migrations and asserts the result before COMMIT.
 * A lock timeout or any assertion rolls the whole bundle back.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CUTOVER_MIGRATIONS = [
  ["20261031222747", "legacy_xp_atomic_reward_receipts"],
  ["20261101000728", "healing_awakening_atomic_completion"],
  ["20261101001020", "foundry_core_atomic_rewards"],
  ["20261101120000", "reward_write_fence_v1"],
  ["20261101130000", "weekly_reflection_quest_atomic"],
  ["20261101140000", "shared_reward_write_fence"],
];
// Order matters only for readability; one LOCK statement acquires all of them.
export const FENCED_TABLES = [
  "public.arena_events", "public.arena_runs", "public.core_xp_ledger",
  "public.foundry_event_training_progress", "public.user_healing_awakening_acts",
  "public.user_healing_milestones", "public.user_advanced_unlocks",
  "public.arena_profiles", "public.weekly_xp", "public.activity_xp_events", "public.arena_weekly_quest_claims",
];
export const FENCE_TRIGGERS = [
  ["arena_events", "bty_reward_fence_legacy_choice"], ["arena_events", "bty_reward_fence_beginner_event"],
  ["arena_runs", "bty_reward_fence_beginner_done"], ["arena_runs", "bty_reward_fence_beginner_done_insert"],
  ["core_xp_ledger", "bty_reward_fence_foundry_ledger"],
  ["foundry_event_training_progress", "bty_reward_fence_foundry_marker"],
  ["foundry_event_training_progress", "bty_reward_fence_foundry_marker_insert"],
  ["user_healing_awakening_acts", "bty_reward_fence_healing_acts"],
  ["user_healing_milestones", "bty_reward_fence_healing_milestones"],
  ["user_advanced_unlocks", "bty_reward_fence_starter_unlock"],
  ["arena_profiles", "bty_reward_fence_profile_xp"], ["arena_profiles", "bty_reward_fence_profile_xp_insert"],
  ["weekly_xp", "bty_reward_fence_weekly_xp"], ["weekly_xp", "bty_reward_fence_weekly_xp_insert"],
  ["arena_runs", "bty_reward_fence_run_xp"], ["arena_runs", "bty_reward_fence_run_xp_insert"],
  ["arena_events", "bty_reward_fence_run_reward_anchor"],
  ["activity_xp_events", "bty_reward_fence_activity_anchor"],
  ["core_xp_ledger", "bty_reward_fence_core_ledger_anchor"],
  ["arena_weekly_quest_claims", "bty_reward_fence_quest_claim_anchor"],
];
const ATOMIC_RPCS = [
  "bty_record_legacy_choice_reward", "bty_complete_beginner_reward",
  "bty_complete_healing_awakening_act", "bty_complete_second_awakening",
  "bty_foundry_award_core_atomic", "bty_foundry_redeem_completion_claim_atomic",
  "bty_claim_weekly_reflection_quest",
  "bty_award_xp_v2", "bty_award_run_xp_v2", "bty_award_activity_xp_v2", "bty_award_lab_xp_v2",
  "bty_apply_arena_run_rewards_v2", "bty_e2e_set_core_xp",
];

const sha256 = text => createHash("sha256").update(text).digest("hex");
const quoteList = values => values.map(v => `'${v}'`).join(",");

export function readCutoverSources(root = ROOT) {
  return CUTOVER_MIGRATIONS.map(([version, name]) => {
    const file = `supabase/migrations/${version}_${name}.sql`;
    const text = readFileSync(path.join(root, file), "utf8");
    assert(!/^\s*(begin|commit|rollback)\s*;/im.test(text), `${file} must not control transactions`);
    return { version, name, file, text, sha256: sha256(text) };
  });
}

function dollarQuote(text) {
  const tag = `$bty_src_${sha256(text).slice(0, 12)}$`;
  assert(!text.includes(tag));
  return `${tag}${text}${tag}`;
}

export function buildApplyBundle(sources, { lockTimeout = "3s" } = {}) {
  const versions = quoteList(sources.map(s => s.version));
  const triggers = FENCE_TRIGGERS.map(([t, n]) => `('${t}','${n}')`).join(",");
  return [
    `-- Reward write cutover bundle. Sources: ${sources.map(s => `${s.file} sha256=${s.sha256}`).join("; ")}`,
    "begin;",
    `set local lock_timeout = '${lockTimeout}';`,
    "set local statement_timeout = '120s';",
    // Waits for every transaction already holding a write lock on these tables;
    // readers continue. New writers queue behind this lock until COMMIT.
    `lock table ${FENCED_TABLES.join(", ")} in share row exclusive mode;`,
    `do $guard$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version in (${versions})) then
    raise exception 'CUTOVER_LEDGER_NOT_EMPTY';
  end if;
  if to_regclass('public.arena_reward_receipts') is not null
     or to_regclass('public.foundry_xp_reward_receipts') is not null then
    raise exception 'CUTOVER_OBJECTS_ALREADY_PRESENT';
  end if;
end $guard$;`,
    ...sources.map(s => `-- >>> ${s.file}\n${s.text}\n-- <<< ${s.file}`),
    ...sources.map(s => `insert into supabase_migrations.schema_migrations(version, name, statements) values ('${s.version}', '${s.name}', array[${dollarQuote(s.text)}]);`),
    `do $verify$ declare v_missing text; begin
  select string_agg(x.t || '.' || x.n, ',') into v_missing from (values ${triggers}) x(t, n)
   where not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
     join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relname = x.t and g.tgname = x.n and g.tgenabled = 'O');
  if v_missing is not null then raise exception 'CUTOVER_TRIGGER_MISSING %', v_missing; end if;
  select string_agg(f, ',') into v_missing from unnest(array[${quoteList(ATOMIC_RPCS)}]) f
   where not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = f and not p.prosecdef
       and has_function_privilege('service_role', p.oid, 'execute')
       and not has_function_privilege('authenticated', p.oid, 'execute')
       and not has_function_privilege('anon', p.oid, 'execute'));
  if v_missing is not null then raise exception 'CUTOVER_RPC_INVALID %', v_missing; end if;
  if has_table_privilege('authenticated', 'public.user_healing_awakening_acts', 'insert')
     or has_table_privilege('authenticated', 'public.user_healing_milestones', 'update') then
    raise exception 'CUTOVER_HEALING_USER_WRITE_OPEN';
  end if;
  if public.bty_reward_writes_paused() is distinct from false then
    raise exception 'CUTOVER_PAUSE_SWITCH_INVALID';
  end if;
end $verify$;`,
    "commit;",
    "",
  ].join("\n");
}

const RECOVERY_LOCK = "set local lock_timeout = '3s';";
const quoteText = text => `$bty_reason$${String(text).replace(/\$bty_reason\$/g, "")}$bty_reason$`;

// Recovery: stops every reward payment for all Worker versions at once. Learning,
// saving and reading keep working; receipts, claims and the fence stay in place.
export function buildPauseBundle(reason) {
  assert(typeof reason === "string" && reason.trim().length >= 3 && reason.length <= 500, "A pause reason is required");
  return [
    "-- Pause every reward write (database switch). Undo with the resume bundle.",
    "begin;", RECOVERY_LOCK,
    `update public.bty_reward_write_control set paused = true, reason = ${quoteText(reason.trim())}, changed_at = now() where id;`,
    "do $verify$ begin if not public.bty_reward_writes_paused() then raise exception 'PAUSE_NOT_APPLIED'; end if; end $verify$;",
    "commit;", "",
  ].join("\n");
}

export function buildResumeBundle() {
  return [
    "-- Resume reward writes after a pause.",
    "begin;", RECOVERY_LOCK,
    "update public.bty_reward_write_control set paused = false, reason = null, changed_at = now() where id;",
    "do $verify$ begin if public.bty_reward_writes_paused() then raise exception 'RESUME_NOT_APPLIED'; end if; end $verify$;",
    "commit;", "",
  ].join("\n");
}

// Last resort only: removes the fence triggers (receipts, claims, RPCs stay). This
// reopens every previous-release split writer, so it requires that no previous
// Worker version, preview URL or in-flight request remains.
export function buildRemoveFenceBundle() {
  return [
    "-- Reward write fence removal. Re-opens old split writers: use only with every",
    "-- old Worker version, preview URL and alias confirmed unreachable.",
    "begin;", RECOVERY_LOCK,
    `lock table ${FENCED_TABLES.join(", ")} in share row exclusive mode;`,
    ...FENCE_TRIGGERS.map(([t, n]) => `drop trigger if exists ${n} on public.${t};`),
    "commit;", "",
  ].join("\n");
}

function main(argv) {
  const at = flag => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const outputs = {
    apply: at("--apply-out"), pause: at("--pause-out"), resume: at("--resume-out"), removeFence: at("--remove-fence-out"),
  };
  assert(Object.values(outputs).some(Boolean), "Pass --apply-out, --pause-out, --resume-out or --remove-fence-out with an absolute path");
  for (const out of Object.values(outputs).filter(Boolean)) assert(path.isAbsolute(out), "Absolute output path required");
  const write = (kind, out, bundle, extra = {}) => {
    writeFileSync(out, bundle);
    console.log(JSON.stringify({ kind, out, sha256: sha256(bundle), ...extra }));
  };
  if (outputs.apply) {
    const sources = readCutoverSources();
    write("apply", outputs.apply, buildApplyBundle(sources), { sources: sources.map(({ file, sha256: h }) => ({ file, sha256: h })) });
  }
  if (outputs.pause) write("pause", outputs.pause, buildPauseBundle(at("--pause-reason")));
  if (outputs.resume) write("resume", outputs.resume, buildResumeBundle());
  if (outputs.removeFence) write("remove-fence", outputs.removeFence, buildRemoveFenceBundle());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
