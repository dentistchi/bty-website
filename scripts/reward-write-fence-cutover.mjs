#!/usr/bin/env node
/**
 * Builds the single-transaction SQL bundle for the reward write cutover. Local
 * file generation only: no network, credentials, database or Worker access.
 *
 *   node scripts/reward-write-fence-cutover.mjs --apply-out /abs/cutover.sql
 *   node scripts/reward-write-fence-cutover.mjs --recovery-out /abs/remove-fence.sql
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
];
// Order matters only for readability; one LOCK statement acquires all of them.
export const FENCED_TABLES = [
  "public.arena_events", "public.arena_runs", "public.core_xp_ledger",
  "public.foundry_event_training_progress", "public.user_healing_awakening_acts",
  "public.user_healing_milestones", "public.user_advanced_unlocks",
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
];
const ATOMIC_RPCS = [
  "bty_record_legacy_choice_reward", "bty_complete_beginner_reward",
  "bty_complete_healing_awakening_act", "bty_complete_second_awakening",
  "bty_foundry_award_core_atomic", "bty_foundry_redeem_completion_claim_atomic",
  "bty_claim_weekly_reflection_quest",
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
end $verify$;`,
    "commit;",
    "",
  ].join("\n");
}

// Removes only the fence. PR91 tables, receipts and RPCs stay; no learner row is touched.
export function buildRecoveryBundle() {
  return [
    "-- Reward write fence removal. Re-opens old split writers: use only with every",
    "-- old Worker version, preview URL and alias confirmed unreachable.",
    "begin;",
    "set local lock_timeout = '3s';",
    `lock table ${FENCED_TABLES.join(", ")} in share row exclusive mode;`,
    ...FENCE_TRIGGERS.map(([t, n]) => `drop trigger if exists ${n} on public.${t};`),
    "commit;",
    "",
  ].join("\n");
}

function main(argv) {
  const at = flag => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const applyOut = at("--apply-out"), recoveryOut = at("--recovery-out");
  assert(applyOut || recoveryOut, "Pass --apply-out and/or --recovery-out with an absolute path");
  for (const out of [applyOut, recoveryOut].filter(Boolean)) assert(path.isAbsolute(out), "Absolute output path required");
  if (applyOut) {
    const sources = readCutoverSources();
    const bundle = buildApplyBundle(sources);
    writeFileSync(applyOut, bundle);
    console.log(JSON.stringify({ applyOut, sha256: sha256(bundle), sources: sources.map(({ file, sha256: h }) => ({ file, sha256: h })) }));
  }
  if (recoveryOut) {
    const bundle = buildRecoveryBundle();
    writeFileSync(recoveryOut, bundle);
    console.log(JSON.stringify({ recoveryOut, sha256: sha256(bundle) }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
