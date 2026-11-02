# Legacy XP atomicity repair — 2026-10-31

Status: source repair prepared; migration unapplied; no merge or deployment.
Independent branch from `inner-main` `50e7a311`; Draft PR90 remains unchanged.

## Concrete failures and resulting behavior

Repeating `CHOICE_CONFIRMED` previously inserted another event and incremented XP
again. Beginner completion wrote `DONE` before weekly XP, Core and reflection; a
subsequent award failure left partial state, while retry returned success from
`DONE` without proving persistence. New private SQL transactions commit evidence,
progression, rewards and a globally unique run receipt together. Failure rolls
back; identical input returns the first frozen result; changed business input
conflicts. Historical events or completion without a receipt require review.

Clients require the public receipt before advancing, display its stored XP and
retain the current selection/reflection after HTTP, transport or malformed-200
failures. Beginner runs cannot also claim the general scenario completion or
free-response paths. Canonical choices, Clinical/Practice and Learning Rewards v1
keep their existing reward policy.

## Frozen regression evidence

- Unchanged-source API oracle: 83 checks, 17 passed / 66 failed.
- Actual hook/page reproduction: 23 checks, all failed before the fix.
- Cross-path Beginner probes: four failures and four passing ordinary-run controls.
- Independent repaired API run: 94/94 across the 83 atomic probes and 11 security
  controls, with only auth/database factories stubbed; consent/scoring/helper/routes
  execute real source. Mocked concurrency proves delegation, not PostgreSQL locks.
- Root final related run: 339/339 across 30 files, including actual hooks/pages,
  strict public receipts, API persistence boundaries, general completion/free-response
  regressions, helper tests and four always-active SQL harness guard/oracle checks.
- Independent extra route edges: 20/20. Independent helper edges: 19/19.
- Root standalone TypeScript with Node 20.20.2 and an 8 GiB heap: exit 0. The first
  attempt found two new test typing errors; exact matcher/return annotations fixed
  them. An agent's default-heap attempt exhausted memory and was not a pass.

One frozen oracle was explicitly corrected: `coreBufferBefore: 1.1` is valid
legacy input because the old helper normalizes nonnegative carried buffers. The
invalid example is now negative. Separate coherent >=1 normalization tests were
added; post-conversion buffers still require [0,1). A signed existing weekly
balance is also valid; the newly awarded amount remains exactly 30. No runtime
reward value or fixture expectation was lowered to hide an application failure.
Existing security mocks now acknowledge the new single RPC; canonical server XP,
ownership, no-user-write assertions and one-award controls are retained.

## SQL verification and limits

Root independently reapplied the exact migration to a fresh embedded PostgreSQL
17.5 engine (PGlite 0.3.14): **119/119 passed**. Includes repeat migration, immutable
receipt ACLs, replay/conflict, both reward-kind crossover directions, deleted and
recreated run IDs, historical review, forced errors/suppressed writes with rollback
and retry, and 80 legacy Core/buffer/custom-name parity checks. The fixture is an
isolated minimal schema with relevant legacy functions, not the production database.
It creates synthetic rows only in memory and imports no application environment.

Native PostgreSQL cannot start in this execution namespace (UID 0 only). The
secret-free GitHub CI path closed that gap on a disposable **PostgreSQL 17.11**
container: **123/123 passed**, including all four independent-backend race groups.
Eight duplicate choice requests and eight duplicate Beginner requests each yield
one original receipt, with all other acknowledgements replaying it. Conflicting
choice inputs have one winner; six same-user Beginner runs preserve every Core
buffer and weekly increment. The harness requires distinct backend IDs and all
contenders observed waiting on real row locks before release.

Verified head `fe3471af`, [run 41250106625](https://github.com/dentistchi/bty-website/actions/runs/41250106625),
job `124681645670`; `unrun` is empty for that isolated SQL suite. Native test inputs
remain identical in the final docs/UI-test follow-up. This is not full production
Supabase schema or Worker/Teams integration validation. The first CI attempt
failed before SQL because `inet::text` included `/32`; `host(inet_server_addr())`
now produces a plain address while strict loopback/CI-private address guards remain.
Both logs and the extracted successful JSON result are retained.

## Full repository comparison

Both runs use Node 20.20.2, stripped app environment, identical source lockfile and
one worker. Compare a multiset of relative-file + exact assertion full name, with
suite collection errors separately retained. Raw counts are deliberately not
rewritten after a narrower repair:

| Run | Passed | Failed | Skipped | Failed files |
| --- | ---: | ---: | ---: | ---: |
| Clean inner-main `50e7a311` | 15,403 | 151 | 409 | 45 |
| XP branch broad run | 15,590 | 152 | 409 | 46 |

All 190 added assertion identities in the broad run pass; none of the 151 baseline
failing identities disappeared. Two old Beginner security test identities were
replaced by explicit frozen-receipt/review-required assertions, reflecting the
intentional contract change. The same missing historical Git-object collection
error remains. The full suite is **not green**.

The one additional failure is an unchanged `FieldActionForm.stateAware` test: it
awaited a wrapper that is also present during loading, then synchronously queried
an editable field before fetch/body/state completion. The component is byte-identical
on baseline and branch. A held-fetch reproduction fails deterministically (7/8
pass); the final test retains the expected editable field, verifies the loading
state, releases fetch and awaits that actual field. Three independent file runs
pass 8/8, and the final root 339-test run includes all eight. This is a corrected
test readiness wait, not evidence of an application repair.

The broad run began before the last two SQL-harness guard tests were added; they
are covered in the final targeted run. The full repository suite was not rerun
after this test-only correction. No overall whole-suite pass or zero-failure
release claim follows from the targeted checks.

## Remaining verification

Fresh Cloudflare build exits 0 in an independent clean worktree with real npm ci
(hooks enabled), Node 20.20.2, dummy loopback public values and no app credentials.
Application/config/SQL files match runtime `9ab1a13`; the build omits only later
helper tests/harness/CI/docs. Next generated all 353 pages. Outer heap is 8 GiB;
the existing Next subcommand retains its configured 4 GiB. Pure artifact inspection
finds 3,627 JavaScript files, zero unsafe implementations and 2/2 safe middleware.
A bounded scan of 301 author/patient/receipt-SQL markers in 743 public text assets
finds zero hits and no public SQL files; this is not exhaustive disclosure proof.
Install initially failed on missing proxy/DNS and then platform CA trust; the final
normal installation retained only platform proxy/CA variables and passed.

Native concurrency now passes as described above. The exact full-suite comparison
and its remaining non-green baseline are preserved, not relabeled as a pass.
Actual Teams/iPhone, production Worker calls and production migrations are unrun.
The rollout fence and old-invocation drain in `LEGACY_XP_ATOMIC_SQL.md` remain
mandatory; source tests do not authorize reopening production writes. Other legacy
Core writers remain outside the new two-path transaction protocol.

## Evidence

`docs/legacy-xp-qa/manifest.json` lists preserved compressed raw reports and hashes.
Use `gzip -dc` to inspect archived JSON/logs. They contain synthetic QA records,
not learner records. No credentials, login session or real learner rows are used.
