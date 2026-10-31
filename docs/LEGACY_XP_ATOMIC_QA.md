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
- Root final related run: 329/329 across 29 files, including actual hooks/pages,
  strict public receipts, API persistence boundaries, general completion/free-response
  regressions, helper tests and two always-active SQL harness guard/oracle checks.
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
17.5 engine (PGlite 0.3.14): **118/118 passed**. Includes repeat migration, immutable
receipt ACLs, replay/conflict, both reward-kind crossover directions, deleted and
recreated run IDs, historical review, forced errors/suppressed writes with rollback
and retry, and 80 legacy Core/buffer/custom-name parity checks. The fixture is an
isolated minimal schema with relevant legacy functions, not the production database.
It creates synthetic rows only in memory and imports no application environment.

Native PostgreSQL cannot start here: the execution namespace maps only UID 0 and
does not permit changing UID; PostgreSQL refuses root execution. Embedded single
session execution is **not** native lock/race evidence. Four separate-backend race
groups are prepared: duplicate choice, duplicate Beginner, conflicting input and
same-user cross-run Core/weekly updates, with observed blocking and backend IDs.
A secret-free disposable PostgreSQL 17 CI workflow is prepared to run these on
Draft PR opened/synchronize. It uses separate backend IDs and observed row-lock
blocking; CI has not yet run. Docker bridge server addresses require an explicit
GitHub Actions-only opt-in; the client target remains literal loopback, fixed port
and a fresh task-specific database.

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

Full-suite exact-identity comparison and native CI results will be recorded when
observed. Until then neither is marked passed.
Actual Teams/iPhone, production Worker calls and production migrations are unrun.
The rollout fence and old-invocation drain in `LEGACY_XP_ATOMIC_SQL.md` remain
mandatory; source tests do not authorize reopening production writes.

## Evidence

`docs/legacy-xp-qa/manifest.json` lists preserved compressed raw reports and hashes.
Use `gzip -dc` to inspect archived JSON/logs. They contain synthetic QA records,
not learner records. No credentials, login session or real learner rows are used.
