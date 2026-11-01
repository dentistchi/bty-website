# Reward write fence cutover — 2026-11-01

Status: prepared and verified only on disposable PostgreSQL 17 databases and a local
PostgREST 14.5. Nothing in this document has been applied to production.

## Why a database fence

PR91 replaces split reward writes with atomic RPCs. The previous release keeps
running after a deploy, for three reasons:

- In-flight requests have no documented end.
- Workers Logs are off.
- All 943 earlier versions stay reachable through preview URLs with current secrets.

Key rotation cannot separate old code from new. Every Supabase secret key maps to
the same `service_role`, and old Healing writes use the publishable key plus the
user's JWT. So the fence lives in the database and judges each write by what it is,
not by which Worker or credential sent it.

## What is fenced

| Path (previous release) | Old write | Fence rule |
|---|---|---|
| `/api/arena/event` CHOICE_CONFIRMED | user-JWT event insert, then `increment_arena_xp` | for the 45 bundled legacy catalog scenarios, a `CHOICE_CONFIRMED` needs a `legacy_choice` receipt naming that event, checked at commit |
| `/api/arena/beginner-complete` | user-JWT `DONE`, XP, Core, reflection | a beginner run reaching `DONE`, and `BEGINNER_REFLECTION`, need a `beginner_completion` receipt |
| old `run/complete`, `free-response` on beginner runs | `RUN_COMPLETED_APPLIED`, `RUN_COMPLETE_CONTRACT_QUEUED`, `FREE_RESPONSE` | rejected for beginner runs |
| Healing acts / second awakening | user-JWT inserts and upserts | any `anon`/`authenticated` write to acts or milestones; a starter unlock stamped with its milestone time |
| Foundry training/document/guidance award, old eligible claim | `foundry_training_completion` ledger row, then Core, then marker | the ledger row and `xp_awarded_at` need the matching `foundry_xp_reward_receipts` row, checked at commit |

Receipt-checked triggers are deferred constraint triggers: the atomic RPCs write
their receipt last in the same transaction.

These keep working unchanged:

- canonical `/api/arena/choice`
- other event types
- scenario-run free responses
- organic emotional unlocks
- LAB and other ledger sources
- progress linking and claim issue

No learner row is read for policy, inferred, backfilled or rewritten. Global JWT
keys, service_role grants and existing records are unchanged.

## Weekly reflection quest (+15), repaired in this PR

`run/complete` used to:

1. read the weekly claim
2. pay weekly XP
3. apply Core in TypeScript
4. insert the claim, ignoring its error.

Two concurrent completions, or a lost claim insert followed by a retry, each paid
twice (reproduced: +30). It now calls `bty_claim_weekly_reflection_quest`
(`20261101130000`), which works in one transaction:

1. re-counts the week's reflections
2. inserts the claim first
3. pays weekly XP and Core with the same arithmetic as `applySeasonalXpToCore`.

A concurrent duplicate waits on the uncommitted claim and returns `already_claimed`.
Any failure writes nothing, so a later completion retries. The quest never fails the
run completion.

## Cutover procedure

1. Build the bundles locally:
   `node scripts/reward-write-fence-cutover.mjs --apply-out /abs/cutover.sql --recovery-out /abs/remove-fence.sql`
   and record the printed sha256.
2. Read-only preflight: the ledger has none of the five versions, and the receipt
   tables are absent.
3. Apply `cutover.sql` once. In one transaction it:
   - sets `lock_timeout=3s`;
   - locks the seven fenced tables in `SHARE ROW EXCLUSIVE` mode;
   - applies 20261031222747, 20261101000728, 20261101001020, 20261101120000 and
     20261101130000;
   - records them in the migration ledger;
   - asserts the triggers, RPC ACLs and Healing revoke before `COMMIT`.

   The lock waits for every transaction already writing those tables; readers
   continue. A transaction that started earlier but writes later sees the fence. On
   lock timeout or any failed assertion everything rolls back; retry it.
4. Disable workers.dev preview URLs for `bty-arena-staging` (`previews_enabled:false`).
   This stops previous versions from serving the unfenced shared writes listed below.
5. Deploy the merged SHA with the existing wrapper. Between steps 3 and 5 the previous
   release's fenced reward routes return errors. That is the intended write block.
6. Verify:
   - both domains' `/api/version` and 100% traffic;
   - the ledger, triggers and RPC ACLs;
   - that a preview URL of an old version no longer serves.

   List anchors without receipts read-only (counts only). These are historical review
   items and are never backfilled.

HTTP blocking, pre-request checks and waiting are not part of the proof. The proof is
the lock acquisition plus commit-time enforcement.

## Verified behaviour

`scripts/reward-write-fence-postgres-qa.ts` runs on native PostgreSQL 17. It passed
38 checks per run, in 3 of 3 fresh runs.

Requests already in the database, or resumed later:
- A cutover with a held write lock times out and rolls back completely.
- A cutover waits for a transaction that is already writing.
- An old transaction opened before the cutover cannot write afterwards.

Several old requests on the same anchor:

| Case | Anchors before cutover | Payments after cutover |
|---|---|---|
| Legacy run | 3 | 2 (82 XP each); one XP call was lost, and its retry is fenced before XP |
| Beginner run | 1 winner, 2 losers | 1 (weekly +30, Core per TypeScript); a failed weekly call plus every retry pays 0 |
| Foundry progress | 1 awarded, 1 already_awarded | Core +10 once; a failed Core write plus every retry pays 0 |

In every case, new RPCs on these anchors return review-required.

Weekly quest:
- Five concurrent claims pay +15 once.
- An injected failure writes nothing, and the retry pays once.
- Ineligible weeks, past-week reflections, a Tuesday or a future week, and a user
  JWT all write nothing.
- Core matches `applySeasonalXpToCore` at 7 buffer and tier boundaries.

Also checked:
- unchanged writers;
- recovery;
- historical rows staying byte-identical;
- an injected failure rolling back every atomic write.

`scripts/reward-write-fence-postgrest-qa.ts` runs real PostgREST 14.5 (production's
version). It passed 12 checks per run, in 3 of 3 fresh runs. Its schema is
`scripts/qa/reward-fence-prod-schema.sql`, exported read-only from production
pg_catalog with no rows. It adds the production auth helpers and DDL-watch event
triggers. The app's own supabase-js clients and server helpers call it through
`/rest/v1`.

- **Schema cache:** reloads within about 0.1 s after the cutover, without restarting
  PostgREST.
- **Fenced old writes:** return HTTP 400, `P0001`/`REWARD_WRITE_FENCED`, and persist
  nothing. This holds with `return=minimal` and `return=representation`, and for the
  beginner PATCH, Foundry RPC and Foundry marker.
- **Healing with a user JWT:** HTTP 403 (`42501`).
- **Receipts and atomic RPCs:** 401 for anon, 403 for authenticated; service_role
  succeeds.
- **App helpers:** map missing storage (before cutover), conflicts and review-required
  to the route statuses.
- **Production `arena_profiles` triggers:** coexist with the RPCs.

CI (`.github/workflows/reward-write-fence-postgres.yml`) runs both harnesses on a
fresh `postgres:17` service. The REST job downloads the PostgREST v14.5 release and
verifies its sha256. A Docker-bridge server address is accepted only with an explicit
opt-in plus `GITHUB_ACTIONS=true`, and only for RFC1918 IPv4. The job fails unless
every expected check name ran exactly once, in order.

## Remaining limits (measured)

1. **Pre-cutover anchors may still be paid after the cutover.** A previous-release
   request whose anchor committed before the cutover can still complete its shared
   `increment_*`/Core write afterwards. Unchanged writers write these tables the same
   way.
   - The result is at most one payment per anchor that already existed. No anchor can
     be created after the cutover.
   - Duplicate legacy anchors created before the cutover by the old bug are each paid
     at most once.
2. **Lost Core update.** The old TypeScript Core writers read, then write an absolute
   value. One interleaved with any other Core writer can overwrite that award
   (measured 219 → 209). This is under-payment, not duplication. Unchanged routes
   (chat, mentor, run/complete, lab) carry the same pre-existing hazard.
3. **Previous-release quest racing the new quest.** A previous-release `run/complete`
   racing the atomic quest can add one extra +15 (measured).
   - **Bound:** requests already in flight at deploy.
   - **Prerequisite:** preview URLs disabled (step 4).
4. **Not reproduced:** the Supabase API gateway (`sb_secret_`/`sb_publishable_` key
   translation), the production Worker runtime, Teams, and tables outside the exported
   subset (for example avatar state, whose sync stays best-effort).

## Recovery

- **New code faulty, fence correct:** `wrangler rollback` to the previous version.
  Its fenced reward routes then fail closed and everything else serves. The quest
  RPC and the fence stay.
- **Fence false positive:** apply `remove-fence.sql`. It drops only the ten triggers,
  inside the same lock, and keeps receipts and RPCs.
  - It reopens the old split writers.
  - Use it only while previews are disabled and no previous version is serving.
- **Do not drop receipt tables, quest claims or RPCs** once any row exists. They are
  the audit that prevents a second award.
- **A failed cutover leaves nothing behind.** It rolls back in one transaction; retry
  after the lock holder finishes.
