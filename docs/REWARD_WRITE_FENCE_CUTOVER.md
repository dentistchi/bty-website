# Reward write fence cutover — 2026-11-01

Status: prepared and verified on disposable native PostgreSQL 17 only. Nothing in
this document has been applied to production.

## Why a database fence

PR91 replaces split reward writes with atomic RPCs. The previous release keeps
running after a deploy: in-flight requests have no documented end, Workers Logs
are off, and all 943 earlier versions stay reachable through preview URLs with
current secrets. Every Supabase secret key maps to the same `service_role`, and
old Healing writes use the publishable key plus the user's JWT, so key rotation
cannot tell old code from new. The fence therefore lives in the database and
judges each write by what it is, not by which Worker or credential sent it.

## What is fenced

| Path (old release) | Old write | Fence rule |
|---|---|---|
| `/api/arena/event` CHOICE_CONFIRMED | user-JWT event insert, then `increment_arena_xp` | `CHOICE_CONFIRMED` for the 45 bundled legacy catalog scenarios must have a `legacy_choice` receipt naming that event, checked at commit |
| `/api/arena/beginner-complete` | user-JWT `DONE`, XP, Core, reflection | beginner run reaching `DONE` and `BEGINNER_REFLECTION` need a `beginner_completion` receipt |
| old `run/complete`, `free-response` on beginner runs | `RUN_COMPLETED_APPLIED`, `RUN_COMPLETE_CONTRACT_QUEUED`, `FREE_RESPONSE` | rejected for beginner runs |
| Healing acts / second awakening | user-JWT inserts and upserts | any `anon`/`authenticated` write to acts or milestones; starter unlock stamped with its milestone time |
| Foundry training/document/guidance award, old eligible claim | `foundry_training_completion` ledger row, then Core, then marker | ledger row and `xp_awarded_at` need the matching `foundry_xp_reward_receipts` row, checked at commit |

Receipt-checked triggers are deferred constraint triggers: the atomic RPCs write
their receipt last in the same transaction. Canonical `/api/arena/choice`, other
event types, scenario-run free responses, organic emotional unlocks, LAB and other
ledger sources, progress linking and claim issue are unaffected. No learner row is
read for policy, inferred, backfilled or rewritten. Global JWT keys, service_role
grants and existing records are unchanged.

## Cutover procedure

1. Build the bundle locally:
   `node scripts/reward-write-fence-cutover.mjs --apply-out /abs/cutover.sql --recovery-out /abs/remove-fence.sql`
   and record the printed sha256.
2. Read-only preflight: ledger has none of the four versions; receipt tables absent.
3. Apply `cutover.sql` once. In one transaction it sets `lock_timeout=3s`, locks the
   seven fenced tables in `SHARE ROW EXCLUSIVE` mode, applies 20261031222747,
   20261101000728, 20261101001020 and 20261101120000, records them in the ledger,
   and asserts triggers, RPC ACLs and the Healing revoke before `COMMIT`.
   - The lock waits for every transaction already writing those tables. Readers continue.
   - A transaction that started earlier but writes later sees the fence and is rejected.
   - On lock timeout or any assertion the whole bundle rolls back with no residue. Retry it.
4. Deploy the merged SHA with the existing wrapper. Between steps 3 and 4 the old
   release's fenced reward routes return errors. This is the intended write block.
5. Verify both domains' `/api/version`, 100% traffic, ledger, triggers and RPC ACLs.
   List anchors without receipts read-only (counts only); these are historical
   review items, never backfilled.

HTTP blocking, pre-request checks and waiting are not part of the proof. The proof
is the lock acquisition plus commit-time enforcement.

## Residual boundary

A request whose anchor write (beginner `DONE`, Foundry ledger row) committed before
the cutover may still finish its shared side writes afterwards: the
`increment_weekly_xp` call and the `arena_profiles` Core update. Unchanged reward
paths write those tables identically, so no row predicate can separate them. Such a
request completes at most its one old award. Its reflection event and Foundry marker
are still rejected. The new RPCs return review-required for that anchor, so no
second award is possible.

## Recovery

- New code faulty, fence correct: `wrangler rollback` to the previous version. Its
  fenced reward routes then fail closed; everything else serves.
- Fence false positive: apply `remove-fence.sql`. It drops only the ten triggers and
  keeps receipts and RPCs. This reopens old split writers, so first confirm previews are
  disabled and no old version is serving.
- Do not drop receipt tables or RPCs after any receipt exists. Receipts are the audit
  that prevents a second award.

## Verification (disposable PostgreSQL 17.10, Node 20.20.2)

`scripts/reward-write-fence-postgres-qa.ts` passed 28 checks per run, in 3 of 3
fresh-database runs. It covers:

- **Old behaviour reproduced:** old writes run as their real roles, one autocommit
  statement per HTTP call, and the pre-cutover split and duplicate-reward behaviour
  is reproduced.
- **In-flight transactions:** lock-timeout rollback, a cutover waiting on a held
  write, and old transactions opened before the cutover being rejected afterwards.
- **Old requests rejected:** resumed old requests in every fenced path, plus forged
  client meta.
- **Healing trigger:** rejects user-JWT writes even with client grants restored.
- **Unchanged writers:** keep working.
- **New RPCs:** award, replay, conflict and concurrent sessions; history from before
  the cutover is review-required and unchanged.
- **Rollback:** injected receipt/milestone failure rolls back every earlier write.
- **Historical rows:** byte-identical throughout.
- **Recovery bundle:** removes only the fence.

The fixture uses production column and constraint shapes and production-identical
old function bodies (md5 pinned). It is not the full production schema, PostgREST
or a Worker, and this harness has no CI job.
