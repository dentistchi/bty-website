# App release reliability remainder — 2026-10-31

Status: application implementation frozen at `27ff4865`; production changes are
not part of this task. Final full Vitest execution at `76549c19` exited 0:
**16,074 reported passed / 0 failed / 409 explicitly skipped** in 1,399 files.
Native atomic PostgreSQL, fresh build, final standalone types and independent
browser checks also have observed passing results. The 74 opt-in persistence SQL
bodies were inactive in this full run, then actually executed in separate native
CI: **74/74 with 72 scenario-database witnesses**, all 268 input hashes matching.
The source extends Draft PR91; PR90's Clinical cases/router/content stay separate.

## What was reproduced and repaired

- Active /app Saved/Tracking lifecycle reads can overwrite a newer removal/read or
  show a superseded error. Native Practice used malformed HTTP200 as completion.
  Port only PR90's three exact app modules and their existing probes; no Clinical
  source/data is copied. Unit before: 13 passed/10 failed; after: 23/23. Actual
  component Chromium flows: 15/15 at 320/390/1280, no retries/flakes/skips.
- Healing ignored milestone/stat/event/train read errors, final-act milestone write
  failures and ritual unlock failures. New service-only transactions commit each
  act/milestone or ritual/unlock together. Historical contradictions require review,
  never inferred backfill. Clients keep input/progress on failed or malformed reads
  and writes and distinguish review409 from duplicate act409. Read/client tests and
  independent SQL fault injection are preserved separately.
- Foundry's old ledger-first/TypeScript-Core split can claim payment after a failed
  Core update; deferred code redemption did not bump Core. New private transactions
  bind canonical account/event/progress, preserve +10 Core and max3/day, commit Core,
  ledger, marker and immutable receipt together, and reuse existing assignment,
  follow-up and apply authorities inside the claim transaction. GETs perform no new
  reward writes; their existing last_seen heartbeat remains. Ambiguous old ledger
  or marker state is review-required, not a fabricated paid result.
- Missing-profile Foundry initialization deliberately corrects the former hardcoded
  tier 0 default: Core 10 initializes to canonical tier 1. Existing-profile conversion
  parity is tested separately; the bad absent-profile default is not preserved.
- The 25-hour fall-back day exposed an empty reward window with start+24h+1ms.
  A pure calendar-key helper retains the 05:00 local rule and handles 23/25-hour
  boundaries. Twelve independent clock tests pass. Context/timezone read errors
  fail unavailable before any claim side effects, rather than using a false UTC day.
- Public Foundry clients retain saved learning while XP is unavailable/reviewed.
  Failed claim plus healthy claimable reread still retains explicit pending/retry.
  Confirmed awarded/review/owner/daily decisions stay authoritative.

## Test contracts and evidence boundaries

Many previous failures are stale fixtures: retired Orb/labels/navigation, an old
explicit-Host export, new canonical directory authority table, and broad migration
or absent-Git-history assumptions. Authorization is not weakened; actual gate+
owned-service tests cover platform/manual/Microsoft positive and denial sources.
Historical legal wording remains byte-proven to its GitHub source; no legal text
or Microsoft identity policy is changed. Pinned later SQL names/hashes record
source observation, not production application approval.

Frozen replay unit tests now use separately identified, fixed synthetic inputs.
The original Run4/Run5 SHA/path authorities and default fail-closed CLI remain;
synthetic input cannot impersonate those historical measurements or run live.
Independent branch inspection identifies 39 reported-pass tests whose historical
or installed-file assertion branches lack their external evidence: C18 boundary 7,
C18 narrow 9, stability forensics 7, stability runner 13 and full retention 3. Some
still assert source or evidence absence; these are not 39 wholly empty bodies.
Three further reported-pass tests omit optional built-output branches (CSS 1,
Teams ZIP 2). These omissions are separate from explicit Vitest skips and cannot
count as historical or packaged-artifact proof. The earlier six-body tally was
only a subset. No missing evidence is fabricated or silently treated as coverage.
The [structured snapshot](release-reliability/conditional-summary.json) and
[per-test record](release-reliability/conditional-gaps.json.gz) describe exactly
what still asserts; only five of these 42 bodies execute no assertions. This is a
bounded seven-file inspection, not exhaustive repository branch coverage.
The current /today route redirects to /app. The retained legacy Today body received
bounded shape/order defense; those probes do not establish an active Today defect.

## Controlled baseline

Fresh `a611a32`, Node20.20.2, one Vitest worker, stripped app environment, local
npm/npx tool path and installed Chromium: **15,601 passed /143 failed /409 skipped**.
The earlier 151-failure run lacked the required viewport tool path. Environment
repair removes eight viewport setup failures; it is not eight app repairs. The
old tsx launcher still fails on sandbox IPC; direct Node --import tsx makes the
runner tests portable without changing model deadlines or doing provider calls.

The [exact multiset comparison](release-reliability/full-assertion-comparison.json)
retains 16,122 assertion identities, adds 361 and transparently renames/replaces 31
stale identities, with reasons for every affected file. All 118 retained baseline
failing identities now pass; 25 previously failing identities have replacement
contracts. All added identities report passed. The formerly uncollected Git scope
file now runs 42 checks; there is no remaining collection error. This is not a
claim that 143 different app bugs existed or that every test identity is unchanged.

| Controlled full run | Reported passed | Failed | Explicit skipped | Exit |
|---|---:|---:|---:|---:|
| Baseline `a611a32` | 15,601 | 143 | 409 | 1 |
| First after, before readiness repair | 16,073 | 1 | 409 | 1 |
| Second after `726106d3` | 16,073 | 1 | 409 | 1 |
| Final after `76549c19` | 16,074 | 0 | 409 | 0 |

Missing captures, live Teams/iPhone, real model quality and the whole production
Supabase stack are not substituted by synthetic fixtures.

Explicit Vitest skips total 409 across 18 files: PostgreSQL/PostgREST 401, Supabase
integration 6 and actual-model 2. The independent native SQL checks below do not
activate or replace the skipped whole-stack and PostgREST checks.

Four further files report 74 passes while their `BTY_PG_TEST_URL`-gated bodies
return without execution in this full run: Saved removal 15, Host Track retention
26, identity/integrity reconciliation 23 and Foundry history dismissal 10. The
prior 15-body report counted only Saved. These are separate from the 42 historical
or artifact omissions and 409 explicit skips. A dedicated disposable PostgreSQL
gate separately proved all 74 bodies execute, with 72 actual scenario-database
witnesses; the 271 atomic reward checks do not cover these persistence bodies.

## Observed independent verification

- Native PostgreSQL 17.11: legacy 123/123, Healing 58/58 and Foundry 90/90, all three
  fresh-container jobs successful in [run 41258285658](https://github.com/dentistchi/bty-website/actions/runs/41258285658)
  at remote source `5d287b4f` (local `4691a222`). Each JSON receipt has `unrun: []`.
  Real independent connections and observed SQL lock waits cover four legacy,
  six Healing and five Foundry race groups. These representative schemas are not
  the complete production Supabase schema/triggers or PostgREST stack.
  All three jobs also passed again at candidate `48fd3858` in
  [run 41261258150](https://github.com/dentistchi/bty-website/actions/runs/41261258150).
- Native persistence: **74/74 reported passes, zero skips**, Node 20.20.2 and
  PostgreSQL 17.11 in [run 41261258186](https://github.com/dentistchi/bty-website/actions/runs/41261258186)
  at `48fd3858` (local `82f63d94`). All four original files remain unchanged.
  Beyond the pass report, the runner verifies a fresh empty service before tests
  and exactly 72 actual child databases afterwards: Saved 14, Track retention 26,
  integrity 23 and history 9. Two of the 74 tests inspect migration text; the other
  72 execute their SQL scenarios. All 268 recorded source hashes match the local
  source. The downloaded artifact matches GitHub's SHA256 digest and is preserved
  alongside [the native receipt](release-reliability/native-persistence.json).
  No application environment, Supabase credential or production service is used.
  These SQL fixtures do not substitute the 409 skipped full-stack integration cases.
- Browser: **57/57 checks** at 320/390/1280px: 21 Playwright tests, 24 Foundry states
  and 12 retry-to-awarded transitions. Zero skips/flakes/retries, unexpected HTTP
  requests or page errors. These execute actual client components with synthetic
  intercepted HTTP, not a signed-in production stack. The earlier 15 app flows
  are a subset, not 15 additional unique checks. Sampled recovery text/button
  contrast measures at least 11.09:1/8.01:1; two 320px examples are retained.
- Standalone types at `76549c19`: Node 20.20.2, 8GB,
  `tsc --noEmit --incremental false`, observed exit 0. Since implementation freeze
  only two test files changed; their original assertions now wait for request or
  loaded-and-enabled readiness. No production component changed after the freeze.
- Independent fresh Cloudflare build at `27ff4865`: real `npm ci` with install
  hooks, 1,357 packages, Node 20.20.2, observed exit 0 and 353 generated pages. No app
  environment file or live credentials. Artifact inspection: 3,629 JS files,
  zero unsafe middleware, 2/2 safe implementations, only `default`, handler patch
  present. Sample public scan: 320 literal markers across 743 text assets, zero
  hits; this is not an exhaustive disclosure proof. Existing unsupported Next15
  warning/flag is unchanged; lint is skipped by the existing build configuration.

All four complete reports are retained independently. The first after-run exposed
an eligibility-request test that assumed a mounted loading container meant a
request had started: controlled fail before/pass after, then 6/6 in three separate
file runs. The second exposed four OFF-state consent tests that could click a
correctly disabled loading switch: held-GET reproduction 4/4 fail before, 4/4 pass
after, then 9/9 in three separate file runs. Error/rollback, enabled-state and
privacy assertions remain. Final complete rerun exits 0. These are test readiness
repairs, not additional production component bug claims.

## Database source and rollout

Prepared, **unapplied** migrations:

- `20261031222747_legacy_xp_atomic_reward_receipts.sql` (PR91 original)
- `20261101000728_healing_awakening_atomic_completion.sql`
- `20261101001020_foundry_core_atomic_rewards.sql`

Only disposable in-memory/CI databases receive synthetic test writes. Read-only
production catalog preflight confirms the relevant eight existing tables and five
old function signatures/ACLs; it reads no learner records. New tables have RLS and
client-deny ACLs; RPCs use invoker rights, empty search_path and service-only execute.
No old ledger/claim function body or historical learner award is rewritten.

Fence all old modified completion/reward writers on every domain/version/alias,
prove their in-flight writes are drained or impossible, then separately apply the
reviewed migrations before reopening writes. A fixed sleep or 100% deployment is
not drain proof. New code fails closed if storage is missing; never restore split
write fallback. Other legacy Core writers remain outside these transaction paths.
No merge, production deploy/migration, auth session, secret or Mac service change
is performed here. [Verification summary](release-reliability/verification.json)
and [evidence hashes](release-reliability/evidence-manifest.json) record the observed
results and their exact scope. Native persistence has separate observed proof;
its inactive full-suite wrappers are not used as SQL evidence. Later updates add
only CI/evidence/documentation; application runtime and the full-run test files
remain unchanged from their recorded verification sources.
