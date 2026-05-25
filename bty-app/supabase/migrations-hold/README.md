# migrations-hold — deferred migrations (post-launch track)

`supabase db push` does **not** scan this directory — only `supabase/migrations/`.
Files placed here are intentionally excluded from the migration run and tracked
for later, deliberate application.

> **Note:** For migrations that were *applied then reverted* (different
> semantics — forward path is DROP, not return), see `../migrations-reverted/`.

## Currently held

| File | version | What it does |
|---|---|---|
| `20260331120000_scenarios_delete_legacy_beginner_7step.sql` | 20260331120000 | Conditional `DELETE` of legacy `beginner_7step` rows from `public.scenarios` |
| `20260331130000_scenarios_truncate_for_elite_mirror.sql` | 20260331130000 | `DELETE FROM public.scenarios` (whole-table, no WHERE) |
| `20260430340000_memory_engine_user_behavior_events_align.sql` | 20260430340000 | `user_behavior_memory_events` "align" — adds `played_at`/`payload`/`source`, backfills |
| `20260431250000_action_contract_validator.sql` | 20260431250000 | Validator schema — Step 6 columns, escalation/eval tables, `approved` constraint |
| `20260431260000_scenario_pool_health_metrics.sql` | 20260431260000 | Pool health snapshots table + rollup functions |
| `20260431260001_validator_evaluations_escalation_audit.sql` | 20260431260001 | Validator evaluations / escalation audit |
| `20260431270000_scenario_pool_health_metric_catalog.sql` | 20260431270000 | Pool health metric catalog |
| `20260431280000_bty_action_contracts_layer6_columns_if_missing.sql` | 20260431280000 | `bty_action_contracts` Layer 6 columns |
| `20260431290000_bty_action_contracts_approved_constraint_validator_alignment.sql` | 20260431290000 | `bty_action_contracts` approved-constraint alignment |
| `20260501000000_bty_action_contracts_insert_policy.sql` | 20260501000000 | `bty_action_contracts` insert RLS policy |
| `20260502000000_arena_no_change_risks.sql` | 20260502000000 | `arena_no_change_risks` table (already live as `20260427105430`) |
| `20260503000000_pattern_engine_intensity_entry_count.sql` | 20260503000000 | Pattern engine intensity / entry count |
| `20260504000000_add_user_pattern_history.sql` | 20260504000000 | `user_pattern_history` |
| `20260505000000_bty_archetype_naming_locks.sql` | 20260505000000 | Archetype naming locks |
| `20260505000001_bty_create_archetype_lock_rpc.sql` | 20260505000001 | Archetype lock RPC |
| `20260505100000_drop_arena_pending_outcomes_dead_reinforcement_columns.sql` | 20260505100000 | Drop dead reinforcement columns from `arena_pending_outcomes` |
| `20260511000000_consent_tracking.sql` | 20260511000000 | Consent tracking |

## Why 20260431250000–20260511000000 (14 files) were separated (2026-05-18)

`db push` failed applying `20260431250000`:

```
ERROR: constraint "bty_action_contracts_approved_requires_validation_or_verify"
  already exists (SQLSTATE 42710)
```

The `action_contracts` validator chain has an **idempotency gap**: `20260431250000`
runs `ADD CONSTRAINT` without a preceding `DROP CONSTRAINT IF EXISTS`, and the
constraint (plus most columns/tables/indexes the migration creates) already
exists on the remote DB — migration history diverges from live schema.

**Decision (길 2):** stop driving `db push` to full completion. The goal is a
D-12 compression-test-ready state, not full migration reconciliation. Only
`20260517000000` (#46, `le_activation_log.result_origin`) is landed
standalone; the 14 files from `20260431250000` through `20260511000000` are
held.

Note: some of these 14 (`arena_no_change_risks`, `consent_tracking`,
`drop_arena_pending_outcomes_dead_reinforcement_columns`, …) are not part of
the action_contracts chain and might apply cleanly on their own — but because
`supabase db push` applies in version order, nothing after the blocked
`20260431250000` is reachable, so all 14 are held together.

**Post-launch track:** reconcile the action_contracts / validator schema
(constraints, indexes, RLS policies already partially live), fix the
idempotency gaps, then return these to `supabase/migrations/`.

## Why 20260430340000 was separated (2026-05-18)

`db push` failed applying this migration:

```
ERROR: column "created_at" does not exist (SQLSTATE 42703)
update public.user_behavior_memory_events
set played_at = coalesce(played_at, created_at, now())
```

The live `user_behavior_memory_events` table is a **different generation** than
the canonical definition in `20260430330000_bty_memory_engine.sql`:

- Live columns: `behavior_key, choice_id, flag_type, id, memory_source,
  metadata, occurred_at, payload, played_at, scenario_id, scenario_type,
  source, user_id`
- Canonical has `created_at`; live has **`occurred_at`** instead and **no
  `created_at`**. `20260430330000`'s `CREATE TABLE IF NOT EXISTS` no-op'd over
  the pre-existing table, so `created_at` was never added — and this align
  migration references it in the `played_at` backfill, hence the 42703.

This is part of a broader Memory Engine generational drift (all 4 tables —
`user_behavior_memory_events`, `user_behavior_pattern_state`,
`user_memory_recall_log`, `user_memory_trigger_queue` — diverge from canonical;
`user_memory_trigger_queue` is also missing `error_message`).

**Post-launch track:** reconcile the 4 Memory Engine tables against canonical
(decide `occurred_at` vs `created_at`, etc.), then fix/replace this migration
and return it to `supabase/migrations/`.

## Why these were separated (2026-05-18)

These two were pulled out of a 32-migration `db push` batch; the other 30 were
applied. Reason:

- `public.scenarios` currently holds **233 rows** across several historical id
  namespaces (`bty_elite`, `communication`, `integrity`, `beginner_7step`, …).
- The canonical reseed path — `syncCatalogToDB()` →
  `upsertEliteCatalogToPublicScenarios()` → `loadEliteDataset()` — currently
  produces only **8 rows** (`CHAIN_WORKSPACE_ELITE_IDS` = 3 scenarios + 1 slice
  scenario, × en/ko).
- So applying `20260331130000` (whole-table delete) followed by a reseed would
  take `public.scenarios` from **233 → 0 → 8** (net −225 rows).
- Live `arena_runs` (779 runs / 165 distinct `scenario_id`) reference many of
  the would-be-deleted rows (e.g. `assistant_feels_over_corrected_036`,
  `assistant_sterilization_errors_005`, `patient_challenges_fee_032`). The
  peripheral DB readers (`scenario-difficulty-adjuster`, `scenario-outcome-bridge`,
  `verticalSliceChoiceHistoryBridge`, `delayed-outcome-trigger`,
  `scenarioPoolHealth`) would degrade to null/default fallbacks for those ids.
- `20260331130000`'s own comment expects `syncCatalogToDB` to repopulate an
  "elite mirror" from `bty_elite_scenarios.json` (~50 scenarios). The current
  implementation reads the chain workspace instead — the migration is **stale**
  relative to the code.

The core 7-step Arena loop is unaffected either way (payloads are served from
the `@/data/scenario` JSON registry, not from `public.scenarios`).

## Before returning these to `migrations/`

1. Reconcile the catalog: decide whether `CHAIN_WORKSPACE_ELITE_IDS` (3 + 1)
   is the intended canonical set, or `syncCatalogToDB` / `loadEliteDataset`
   should produce the larger set the migration comment assumes.
2. Then `git mv` both files back into `supabase/migrations/` and run
   `supabase db push`.
3. **Out-of-order caveat:** their versions (`20260331…`) are *earlier* than
   migrations already applied (`20260401…`–`20260517…`). Newer Supabase CLI
   versions may flag an out-of-order migration. Verify whether `db push`
   applies them directly or whether `--include-all` / `supabase migration
   repair` is needed before running.
