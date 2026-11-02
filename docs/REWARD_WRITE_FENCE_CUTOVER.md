# Reward write fence cutover — 2026-11-01

Status: prepared and verified only on disposable PostgreSQL 17 databases and a local
PostgREST 14.5. Nothing in this document has been applied to production.

## Why a database fence

PR91 replaces split reward writes with atomic RPCs. The previous release keeps
running after a deploy, for three reasons:

- In-flight requests have no documented end.
- Workers Logs are off.
- Every earlier version stays reachable through preview URLs with current secrets.

Key rotation cannot separate old code from new. Every Supabase secret key maps to the
same `service_role`, and old Healing writes use the publishable key plus the user's
JWT. The fence therefore lives in the database and judges each write by what it is,
not by which Worker or credential sent it.

## What is fenced

### Reward-specific writes (`20261101120000`)

| Path (previous release) | Fence rule (checked at commit) |
|---|---|
| `/api/arena/event` CHOICE_CONFIRMED for the 45 legacy catalog scenarios | needs the `legacy_choice` receipt naming that event |
| `/api/arena/beginner-complete` | a beginner run reaching `DONE`, and `BEGINNER_REFLECTION`, need a `beginner_completion` receipt |
| old `run/complete`, `free-response` on beginner runs | `RUN_COMPLETED_APPLIED`, `RUN_COMPLETE_CONTRACT_QUEUED`, `FREE_RESPONSE` rejected |
| Healing acts / second awakening | user-JWT writes to acts and milestones, and the stamped starter unlock, are rejected |
| Foundry award and old eligible claim | the ledger row and `xp_awarded_at` need the matching `foundry_xp_reward_receipts` row |

### Shared XP/Core writes (`20261101140000`)

The previous release also paid through writes that look the same whichever release
sends them:

- top-level `increment_arena_xp` and `increment_weekly_xp` RPCs;
- read-then-absolute `arena_profiles` updates (`applySeasonalXpToCore`,
  `applyDirectCoreXp`);
- reward anchors written before (or, for the quest, after) their payment:
  `RUN_COMPLETED_APPLIED`, `activity_xp_events`, LAB/ARENA ledger rows and weekly quest
  claims.

From the cutover, the following writes are accepted only when the outermost function
on the database call stack is one of this release's atomic writers:

- any increase of `weekly_xp.xp_total`, `arena_profiles.lifetime_xp`/`weekly_xp` or
  `arena_runs.total_xp`;
- any change of permanent Core (`core_xp_total`, `core_xp_buffer`);
- any of those anchors.

The atomic writers are:

- PR91's legacy, beginner and Foundry RPCs;
- the quest RPC;
- `bty_award_xp_v2`, `bty_award_run_xp_v2`, `bty_award_activity_xp_v2`,
  `bty_award_lab_xp_v2` and `bty_apply_arena_run_rewards_v2`;
- `bty_e2e_set_core_xp`, a test-fixture seed;
- two unchanged single-transaction RPCs shared by both releases:
  `bty_event_scan_award` and `run_season_carryover`.

The call stack comes from `PG_CONTEXT`, which contains only function frames and their
source statements, never client-supplied values.

A direct PostgREST table write, or the old RPC names called directly, is rejected.
Weekly-reset decreases stay direct writes.

Every new writer locks the profile row and computes Core in SQL, so concurrent awards
are added together instead of one overwriting another. The application now calls only
these writers:

- choice and free-response XP;
- chat, mentor and quick-mode activity XP;
- run completion and re-exposure rewards;
- Lab XP;
- `applySeasonalXpToCore` and `applyDirectCoreXp`.

No learner row is read for policy, inferred, backfilled or rewritten. Global JWT keys
and service_role grants are unchanged.

## Weekly reflection quest (+15)

`bty_claim_weekly_reflection_quest` (`20261101130000`) works in one transaction:

1. re-counts the week's reflections
2. inserts the claim first
3. pays weekly XP and Core.

A concurrent duplicate waits and returns `already_claimed`; a failure writes nothing.

`run/complete` settles the quest on the first completion and again on every
idempotent retry of the same run. A quest that failed alone is therefore recovered
by retrying that run. The run reward is not repeated: the RPC is keyed on the run's
`RUN_COMPLETED_APPLIED` anchor. No second contract is created: the production key is
`UNIQUE(user_id, action_id = arena_action_loop:<run>)`, plus the open-contract check
per pattern family.

## Cutover SQL

`node scripts/reward-write-fence-cutover.mjs --apply-out /abs/cutover.sql` writes one
transaction. It runs these steps in order:

1. `set local lock_timeout = '3s'` and `statement_timeout = '120s'`.
2. Lock all eleven fenced tables in `SHARE ROW EXCLUSIVE` mode: `arena_events`,
   `arena_runs`, `core_xp_ledger`, `foundry_event_training_progress`,
   `user_healing_awakening_acts`, `user_healing_milestones`, `user_advanced_unlocks`,
   `arena_profiles`, `weekly_xp`, `activity_xp_events` and `arena_weekly_quest_claims`.
   - The lock waits for every transaction already writing them. Readers continue.
3. Refuse to run if any cutover version is already in the ledger, or the receipt tables
   exist.
4. Apply, in order:
   - 20261031222747 `legacy_xp_atomic_reward_receipts`
   - 20261101000728 `healing_awakening_atomic_completion`
   - 20261101001020 `foundry_core_atomic_rewards`
   - 20261101120000 `reward_write_fence_v1`
   - 20261101130000 `weekly_reflection_quest_atomic`
   - 20261101140000 `shared_reward_write_fence`
5. Insert these six rows into `supabase_migrations.schema_migrations` (version, name,
   statements).
6. Assert before COMMIT:
   - the 20 fence triggers are enabled;
   - the 13 release RPCs are invoker functions that only `service_role` can execute;
   - the Healing client write grants are revoked;
   - the pause switch exists and is off.
7. `commit`. A lock timeout or any failed assertion rolls everything back.

The PR records the exact bundle sha256 for the final head.

## Cutover procedure

1. Run the read-only preflight: the ledger has none of the six versions, and the
   receipt and control tables are absent.
2. Apply `cutover.sql` once; retry it after a lock timeout.
3. Deploy the merged SHA with the existing wrapper. Until then the previous release's
   reward routes return errors. That is the intended write block. Its learning and
   reading routes keep working.
4. Verify:
   - both domains' `/api/version` and 100% traffic;
   - the ledger, triggers and RPC ACLs;
   - that a previous-version preview URL can no longer pay (it gets
     `REWARD_WRITE_FENCED`).
5. List anchors without receipts read-only (counts only). They are review items and
   are never backfilled.

Disabling preview URLs is still good hygiene, but no payment safety depends on it.
Neither waiting nor HTTP blocking is part of the proof; the proof is the lock plus
database enforcement.

## Recovery (no rollback to the previous release)

Rolling the Worker back to the previous release is **not** a recovery path. Its reward
routes are fenced and fail, and its split writers would come back if the fence were
ever removed. Use these instead:

1. **Pause reward payments, all versions at once (database).**
   - Build it with
     `node scripts/reward-write-fence-cutover.mjs --pause-out /abs/pause.sql --pause-reason "<why>"`.
     The bundle sets `bty_reward_write_control.paused = true` in one transaction and
     verifies it.
   - From the next statement, every reward payment fails with `REWARD_WRITES_PAUSED`.
     This covers every writer listed above, including the atomic RPCs.
   - Healing completion, saving, learning, reading and ordinary event writes continue.
   - The receipts, claims and fence stay in place.
2. **Pause in the application (clean 503s).**
   - Set the Worker secret `REWARD_WRITES_PAUSED=1`. This creates a new version of the
     *same* code, not the previous release.
   - The reward helpers return `REWARD_WRITES_PAUSED` before any database request.
   - Routes respond 503 for the legacy and beginner rewards, free-response and run
     completion. Foundry and claim helpers report `unavailable`, and claims stay
     unspent.
   - Activity XP and the quest skip silently.
3. **Resume.** Run `--resume-out /abs/resume.sql`, then remove the secret or set it to
   `0`. Rewards resume without any repayment. Rewards refused while paused are simply
   not recorded; the next completion or retry pays them through the normal idempotency
   keys.
4. **Fix forward.** Deploy a corrected SHA with the wrapper while paused, then resume.
5. **Last resort only: `--remove-fence-out`.** It drops the 20 triggers inside the
   same lock and keeps the receipts, claims and RPCs. It reopens every previous-release
   split writer, so use it only when no previous version, preview URL or in-flight
   request can reach the database.
6. **A failed cutover leaves nothing behind.** It rolls back in one transaction.
7. **Never drop receipt tables, quest claims or RPCs** once any row exists.

## Verification

Results for the final head are recorded in the PR description. The harnesses are:

- `scripts/reward-write-fence-postgres-qa.ts`: native PostgreSQL, 42 checks.
- `scripts/reward-write-fence-postgrest-qa.ts`: PostgREST 14.5 over the read-only
  production schema export, 15 checks.

CI (`.github/workflows/reward-write-fence-postgres.yml`) fails unless every expected
check ran exactly once, in order.

## Remaining limits

- **Not reproduced:**
  - the Supabase API gateway (`sb_secret_`/`sb_publishable_` translation);
  - the production Worker and Teams;
  - tables outside the export (avatar state; avatar sync stays best-effort).
- **Old anchors are never paid after the cutover.** A previous-release request whose
  anchor committed before the cutover can no longer pay afterwards: a pre-cutover
  `CHOICE_CONFIRMED`, beginner `DONE` or Foundry ledger row. Those anchors are left
  unpaid and become review-required, never paid twice.
- **Other reward systems:** Learning Rewards V1 has its own ledger and its own switch
  (`LEARNING_REWARDS_ENABLED`), so the reward pause does not stop it.
  `bty_event_scan_award` and `run_season_carryover` change payment columns, so the
  database pause does stop them.
