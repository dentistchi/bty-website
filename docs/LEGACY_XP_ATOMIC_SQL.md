# Legacy XP atomic SQL contract

Prepared source: `20261031222747_legacy_xp_atomic_reward_receipts.sql`.
This is an additive, unapplied migration for legacy Arena rewards. It changes no
existing migration, function, learner record, Learning XP or reward amount.

## API boundary and authority

Both new RPCs are `SECURITY INVOKER`, use an empty `search_path`, and grant
`EXECUTE` only to `service_role`. The authenticated server verifies the user and
current consent before calling either RPC. The server computes the catalog choice
XP/deltas or beginner maturity score/feedback. SQL validates their bounded
shape; it does not accept client-authored reward policy.

| RPC | Ordered parameters |
| --- | --- |
| `bty_record_legacy_choice_reward` | `p_user_id uuid`, `p_run_id uuid`, `p_scenario_id text`, `p_choice_id text`, `p_step integer`, `p_xp integer`, `p_deltas jsonb`, `p_meta jsonb` |
| `bty_complete_beginner_reward` | `p_user_id uuid`, `p_run_id uuid`, `p_scenario_id text`, `p_responses jsonb`, `p_score integer`, `p_feedback jsonb` |

`arena_reward_receipts` has RLS enabled, no client policies, all privileges revoked
from `PUBLIC`/`anon`/`authenticated`, and only `SELECT`/`INSERT` granted to
`service_role`. Its unique reward key is `run_id`; kind remains
`legacy_choice` or `beginner_completion`. A run UUID can receive one legacy reward
in total. Neither kind, choice nor step contributes to the reward key. Changing
run type or deleting and recreating a run UUID cannot create a second award.
`user_id` references `auth.users` with deletion cascading. There is deliberately
no run foreign key, so a run deletion preserves its receipt. Account deletion
remains the receipt-retention boundary through the approved user FK cascade.

## Transaction and replay

Each RPC locks the owned run, validates scenario identity, and reads the receipt.
A matching owner, reward kind and business request returns the frozen original
result with only `replayed` changed to `true`. A different reward kind, owner or
business input raises `REWARD_INPUT_CONFLICT`; there is no second award or reflection insert.

| Kind | Canonical business request |
| --- | --- |
| `legacy_choice` | user ID, run ID, scenario ID, choice ID, step |
| `beginner_completion` | user ID, run ID, scenario ID, all normalized responses including reflection |

Derived XP/deltas, metadata, score and feedback are excluded from replay equality.
A policy or feedback text change must not replace an already committed result.
The supplied first metadata, score and feedback are stored unchanged in the
first event or frozen result as appropriate.

A new award requires the expected run type and `IN_PROGRESS`. A prior legacy
`CHOICE_CONFIRMED`, or beginner `DONE`/`BEGINNER_REFLECTION`, without this receipt
raises `LEGACY_REWARD_REVIEW_REQUIRED` before any write. Historical split writes
cannot prove whether XP was paid. There is no inferred repair or backfill.

After the run lock, both functions create or lock the profile. Beginner then
acquires the weekly row through the existing atomic increment RPC. This gives a
consistent run → profile → weekly order within these new reward paths. Choice
inserts its event, mirrors Step 2 reach/progress, calls the existing legacy XP
increment, and inserts its receipt in the same transaction. Beginner performs
its fixed 30 weekly XP, Core conversion/profile projection, `DONE`/score,
reflection event and receipt in one transaction. Any error rolls all of these
writes back, including a newly created profile or weekly row.

## Frozen result

Every result contains `policyVersion: "legacy-xp-atomic/v1"`, `kind`, `runId`,
`scenarioId`, `receiptId`, `eventId` and `replayed`. Choice adds `choiceId`, `step`
and `xp`. Beginner adds `score`, `feedback`, `seasonalXp: 30`, `coreGain`,
`coreBefore`, `coreAfter`, `coreBufferBefore`, `coreBufferAfter` and
`weeklyXpTotal`. The endpoint maps this receipt to its response and validates its
shape before acknowledging success.

Domain exceptions use SQLSTATE `P0001` and these exact messages:
`REWARD_RUN_NOT_FOUND`, `RUN_SCENARIO_MISMATCH`, `RUN_NOT_ACTIVE`,
`NOT_BEGINNER_RUN`, `LEGACY_REWARD_REVIEW_REQUIRED`, `REWARD_INPUT_CONFLICT`,
`INVALID_REWARD_INPUT`. Suppressed required writes raise the internal
`REWARD_WRITE_FAILED` and are reported as a generic award failure. Other database
failures propagate without interception.

## Existing Core conversion parity

The SQL mirrors `seasonalToCoreConversion` and `applySeasonalXpToCore` for the
fixed 30 award: use rate 45 while pre-award Core is below 200, otherwise 60;
add the fractional remainder to the nonnegative existing buffer; transfer its
floor to permanent Core; persist the remainder. It deliberately uses double
precision arithmetic, then shortest float text to numeric, to retain the
TypeScript `Number` buffer behavior rather than introducing decimal arithmetic.
The function fixes `extra_float_digits=1` to make that text conversion stable.

Tier is `floor(Core / 10)`, code is clamped `floor(tier / 100)` to 0–6, and the
sub-name group is clamped `floor((tier % 100) / 25)` to 0–3. Defaults match
`SUB_NAMES`; a custom rename or code 6 preserves the existing sub-name. Stage is
`min(7, floor(Core / 100) + 1)` and `code_hidden` is `Core >= 700`, preserving the
existing helper even where display thresholds differ from code thresholds.
Avatar synchronization remains a derived, post-commit concern.

Verification must distinguish embedded PostgreSQL SQL/rollback/parity checks
from independent native connections exercising actual blocking and contention.
A queued embedded-engine invocation is not a row-lock race test.

## Rollout prerequisite

Production application, learner-data writes, merge and deployment are outside this
source preparation. The migration is still **unapplied**. Missing RPCs produce
`503 XP_STORAGE_UNAVAILABLE`; routes never fall back to old split writes.

A controlled rollout must first fence legacy reward requests on **all** entry
points: custom domains, workers.dev, version/preview URLs and other aliases. While
that fence remains closed, deploy the new code and obtain operator-verifiable
proof that old invocations have drained or can no longer finish split writes.
A 100% deployment, absence of logs or a fixed sleep does not establish that proof.
Only then apply the separately reviewed migration, run isolated service-only
smoke checks, and reopen traffic. If draining cannot be proved, stop and design a
credential/database fence; do not guess at a wait interval.

Other legacy Core writers outside these two RPCs still use their existing write
protocols. These receipts serialize the new reward paths, not every historical XP
writer. Existing ambiguous rewards return review-required; no automated historical
reconciliation is supplied. Avatar refresh runs best effort on the first receipt
only (even for zero whole-Core gain); losing that first HTTP acknowledgement may
skip a derived refresh. Replay never reapplies a stale avatar transition.
