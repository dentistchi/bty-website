# App release reliability remainder — 2026-10-31

Status: source implementation frozen at `27ff4865`; production changes are not
part of this task. Native PostgreSQL, final complete suite and fresh build are
running; none is claimed passed until the observed result is recorded below.
The source extends Draft PR91; PR90's Clinical cases/router/content stay separate.

## What was reproduced and repaired

- Active /app Saved/Tracking lifecycle reads can overwrite a newer removal/read or
  show a superseded error. Native Practice used malformed HTTP200 as completion.
  Port only PR90's three exact app modules and their existing probes; no Clinical
  source/data is copied. Unit before: 13 passed/10 failed; after: 23/23. Real actual
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
Six pre-existing historical positive bodies still lack their real captures and
are explicitly unrun; reported Vitest passes must not count as historical proof.
The current /today route redirects to /app. The retained legacy Today body received
bounded shape/order defense; those probes do not establish an active Today defect.

## Controlled baseline

Fresh `a611a32`, Node20.20.2, one Vitest worker, stripped app environment, local
npm/npx tool path and installed Chromium: **15,601 passed /143 failed /409 skipped**.
The earlier 151-failure run lacked the required viewport tool path. Environment
repair removes eight viewport setup failures; it is not eight app repairs. The
old tsx launcher still fails on sandbox IPC; direct Node --import tsx makes the
runner tests portable without changing model deadlines or doing provider calls.

Final full-suite exact identity comparison, including formerly uncollected Git
scope tests, is pending. Missing captures, live Teams/iPhone, real model quality
and the whole production Supabase stack are not substituted by synthetic fixtures.

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
is performed here. Detailed final verification and file hashes follow once run.
