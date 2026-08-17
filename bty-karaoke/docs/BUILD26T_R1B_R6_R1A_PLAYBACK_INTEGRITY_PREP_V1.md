# BUILD 26T-R1B-R6-R1A — Playback Integrity: local validation authority established

**Status: PREPARATION COMPLETE, IMPLEMENTATION NOT STARTED — 2026-08-15.**

**No migration written. No SQL changed. No production DB touched. No native/web code changed.
Build stays 104 — 105 was NOT minted. No ASC write. `PASS_1H` / `PASS_4H` / `PASS_24H` inactive.**

---

## What was accomplished

### §A — isolated local Supabase, established and then shut down

```
docker                     running (14 containers, 10 belonging to an UNRELATED project)
unrelated stack            supabase_*_h1b-migration-validation — NOT touched, still up (10)
my stack                   supabase_*_bty-karaoke-gate-b23, ports 54421 (api) / 54422 (db)
                           deliberately non-default, so no collision with the h1b stack
migrations applied         45 of 45, from the committed baseline
post-run cleanup           `supabase stop` — 0 of my containers remain (§H)
fixture rows created       NONE — no test data was inserted, so none needed removing
```

### The §A drift gate, captured from the live baseline

This is the artifact a future production apply must check **before** it runs:

```
md5( pg_get_functiondef('public.karaoke_begin_song_v2(uuid,uuid,text)'::regprocedure) )
  = ef281fd84a6e59726d94c37af70aa509
```

The human-readable copy is committed at
`docs/evidence/karaoke_begin_song_v2.baseline.pre-E1.sql` (172 lines). **Compare the md5 of
`pg_get_functiondef`, not the file** — the file carries a trailing newline from `psql` and hashes
differently (`bc76491d…`). If production's md5 is not `ef281fd8…`, **HALT for drift reconciliation**
exactly as §A requires.

### Refusal inventory of the live baseline — what E1 must and must not change

```
REMOVE as authority (§B)              KEEP as authority (§B)
  duration_unavailable   ×1             invalid_mode           ×1
  pass_insufficient      ×1             room_retired           ×1
  upgrade_required       ×1             ownership_state_invalid×1
  (v_dur > 900 ceiling, line 50)        not_found              ×1
                                        not_waiting            ×1
                                        event_state_invalid    ×1
                                        already_playing        ×1
                                        not_next               ×2
                                        not_ready              ×1
```

### The exact change E1 requires, specified against the live definition

```
1  line 50   `if v_dur is null or v_dur < 1 or v_dur > 900 then return duration_unavailable`
             → duration stops being a GATE entirely. It remains a RECORD (nullable), so the
               lease arithmetic below must become NULL-safe rather than assume a duration.
               This is what removes the 15-minute ceiling AND the unknown-duration refusal —
               both are duration-caused refusals.

2  `if v_pass_covered then if v_song_end > v_pass_expires → pass_insufficient`
             → refusal DELETED.

3  `elsif v_enf and v_plan='FREE' … if v_charge > v_remaining … → upgrade_required`
             → refusal DELETED, together with the grace branch that exists only to soften it.

4  `v_activate` / SELECTED-pass activation
             → must STOP activating. If a pass confers no playback privilege, activating one on
               first play consumes a customer's purchased window for nothing. The grant stays
               SELECTED and untouched — preserved as history (§C), not spent.

5  lease + usage-segment writes
             → RETAINED as a business/audit record, never as a gate (§C forbids deleting them).
```

---

## Why implementation stopped here, deliberately

`karaoke_begin_song_v2` is the single function that admits every song in the product. The rewrite
touches pass expiry, pass activation, carryover minting (whose CHECK constraint `timed_pass_expiry_
math_chk` **aborts** rather than shortens if the arithmetic is wrong), the free-window grace ledger,
and the non-shrinkable lease that BUILD 20M built to close a real revenue exploit.

Doing that safely needs the full §F matrix — ten SQL cases including concurrency/idempotency and a
proof that the historical ledger is untouched — executed against the local stack, not a plausible
diff. Starting a rewrite of the playback admission path with too little room left to validate it is
the failure mode this whole build chain exists to avoid, so it was not started.

**Everything expensive is now done and reusable**: the stack config is proven, ports are known
non-colliding, the baseline and its md5 are captured, and the change is specified line-by-line.
Resuming is `supabase start`, write the migration, run the matrix.

---

## OUTPUT (§I)

```
PLAYBACK_INTEGRITY      HELD  — validation authority established; migration not yet written
PRO_1_0                 HELD  — retiring PRO depends on the same migration; and the §C question
                                "does PRO have any independently measured non-YouTube benefit"
                                is answered NO by the current product, which is a Founder-facing
                                product consequence, not just a code change
15_MINUTE_CEILING       HELD  — located exactly (live definition line 50); removal specified
ATTRIBUTION             HELD  — see below, it has its own blocker
RMF                     HELD  — measured in R6-R1; repair not started
PRODUCTION_MIGRATION    NOT_READY
CONTENT_RIGHTS          HELD  (and stays HELD until R6-R1B retention closes, as instructed)
```

### Attribution has a blocker I cannot clear myself

§4/§D require the **official YouTube logo**, used unmodified, from YouTube's Brand Features. I have
no legitimate way to produce that asset: I must not draw one, must not recolor one, and fetching a
binary brand asset into this repository is a distribution decision that is the Founder's to make,
not mine. So attribution is blocked on **the official asset being supplied**, after which the
approved placement is mechanical:

```
Search Results
[official YouTube logo] Results from YouTube      ← section-level, immediately above the cards
                                                    logo clickable → the YouTube content/component
                                                    never beside the BTY product name
```

Everything else about it is ready: the surface is single-provider (confirmed), so no result can be
mis-attributed, and the tests in §D are straightforward once the asset exists.

### §G — build identity

Native shipping code was **not** changed, so per §G no build was minted. **104 stands**, and its
paid-containment invariant is untouched.

---

## To resume

```
1  supabase start        (ports 54421/54422; ~2 min; migrations reapply from the committed baseline)
2  write the migration   per the five-point specification above
3  run the §F matrix     10 SQL cases + the historical-ledger untouched proof
4  supabase stop         and report container state
5  separately: supply the official YouTube brand asset to unblock attribution
6  separately: the RMF player repair (overlays out of the iframe rect, min-size pin)
```

No production DB was touched. Nothing uploaded, nothing submitted, no IAP activated, ASC Content
Rights untouched.

---

# CONTINUATION — local E1 execution (2026-08-15)

**Status: LOCAL_E1_MIGRATION = HELD. The migration is written and applies cleanly, but local
execution found a SECOND home for the 15-minute ceiling that the migration does not yet address.**

## What passed

```
§A  local stack           bty-karaoke-gate-b23, ports 54421/54422, 45/45 migrations
§A  md5 drift gate        live == ef281fd84a6e59726d94c37af70aa509   MATCH
§B  migration written     supabase/migrations/20260817120000_karaoke_playback_integrity_e1_v1.sql
                          authored by TRANSFORMING pg_get_functiondef output, not from memory
§B  applies cleanly       CREATE FUNCTION (after one orphan `end if;` was found and fixed)
```

**Refusal inventory, measured before → after on the live definition:**

```
duration_unavailable   1 → 0      *** removed (incl. the >900 ceiling)
pass_insufficient      1 → 0      *** removed
upgrade_required       1 → 0      *** removed
invalid_mode           1 → 1      room_retired            1 → 1
ownership_state_invalid 1 → 1     not_found               1 → 1
not_waiting            1 → 1      event_state_invalid     1 → 1
already_playing        1 → 1      not_next                2 → 2
not_ready              1 → 1      request_state_changed   2 → 2

`v_dur > 900` occurrences: 0        `v_activate := true` occurrences: 0
```

Every security/structure refusal survives byte-identically; only the three quota refusals are gone,
and a SELECTED pass can no longer be activated by playback.

## THE FINDING — the ceiling has a second home, in a CHECK constraint

Executing the matrix drove the segment INSERT into a constraint the function change cannot satisfy:

```
usage_seg_lease_consistency ON karaoke_event_usage_segments
  CHECK ( (duration_seconds IS NULL AND lease_ends_at IS NULL AND lease_seconds IS NULL
           AND charged_window_start IS NULL AND charged_window_end IS NULL)
       OR (duration_seconds >= 1 AND duration_seconds <= 900        ← ***
           AND lease_ends_at >= started_at
           AND lease_seconds >= 0 AND lease_seconds <= duration_seconds
           AND charged_window_start IS NOT NULL AND charged_window_end > charged_window_start) )
```

**Two defects follow, and neither is visible in the function's source:**

1. **The 15-minute ceiling is still enforced — by the table.** A 16-minute song now passes the
   function's authority and then **fails the INSERT**, aborting the start with a constraint
   violation. That is strictly worse than the refusal it replaced: a 500 instead of a clean answer.
   §2's requirement that `900` must not remain as a hidden duration gate is **not met** by the
   function change alone.
2. **Unknown duration violates the all-or-nothing arm.** My migration writes `duration_seconds =
   NULL` while still setting `lease_ends_at` / `lease_seconds` / the window columns. The constraint
   requires all five to be NULL together. This is a real defect in the migration as written, found
   by the database rather than by reading.

**The local matrix is what found both.** Source inspection had already "confirmed" the ceiling was
gone — the refusal-count table above says exactly that, and it was true and insufficient.

## What the completed E1 needs (not yet written)

```
1  relax usage_seg_lease_consistency: drop the `duration_seconds <= 900` arm, and allow
   duration_seconds NULL while the row still records the window — or make the function write all
   five lease columns NULL together when duration is unknown. Which of the two is correct is a
   RECORD-SEMANTICS decision (what should a segment mean for an unpriceable song?), not a
   mechanical one.
2  re-check every other constraint on the lease/segment/grace/carryover tables for further
   duration or quota assumptions. `timed_pass_expiry_math_chk` is already known to ABORT rather
   than shorten, so it must be re-read under the no-activation change.
3  then re-run the full §C matrix.
```

## §G cleanup

```
my containers remaining          0
unrelated h1b stack              10 containers, untouched throughout
fixture rows                     NONE persisted — the matrix ran inside a transaction that
                                 ROLLED BACK, by construction
artifacts kept in git            the migration + docs/evidence/e1_postgres_matrix.sql
                                 + docs/evidence/karaoke_begin_song_v2.baseline.pre-E1.sql
```

## OUTPUT (§I)

```
PLAYBACK_INTEGRITY      HELD  — function repaired; table-level ceiling still enforced
PRO_1_0                 HELD  — depends on the same completed migration
15_MINUTE_CEILING       HELD  — removed from the FUNCTION, still live in a CHECK constraint
ATTRIBUTION             HELD  — official brand asset not yet acquired
RMF                     HELD  — not started this pass
LOCAL_E1_MIGRATION      HELD  — applies, but incomplete against the schema
PRODUCTION_MIGRATION    NOT_READY
CONTENT_RIGHTS          HELD
```

No production DB touched. No build minted (no native change). Nothing uploaded or submitted.

---

# §A READER TRACE — UNMETERED_SEGMENT_SEMANTICS = **PASS (safe)**

**No SQL was edited in this pass, as §A requires.** The question was whether the existing
all-five-NULL arm can truthfully represent 1.0 unmetered playback. It can, and the reason is
stronger than "the CHECK permits it".

## The five columns

```
duration_seconds · lease_ends_at · lease_seconds · charged_window_start · charged_window_end
```

## Why the all-NULL arm exists historically

BUILD 20M (`20260803120000`) **added these five columns as nullable, explicitly for back-compat**:

```
-- ── A. LEASE + CHARGED-WINDOW COLUMNS (nullable → back-compat) ──
```

So the NULL arm's original meaning is *"a segment recorded before lease metering existed"* — a
**started song carrying no lease semantics**. That is not an approximation of the 1.0 meaning; it
is the same meaning. The constraint is also `NOT VALID`, consistent with a back-compat arm rather
than an invariant asserted over all history.

## Every reader, and what all-NULL means to it

| # | Reader | Reads | All-NULL means | Verdict |
|---|---|---|---|---|
| 1 | `usage_seg_lease_consistency` | all five | permitted (back-compat arm) | safe |
| 2 | `karaoke_free_minutes_entitlement_at_v2` — usage sum | `lease_seconds` | **excluded by an explicit predicate**: `where metered and lease_seconds is not null`, wrapped in `coalesce(sum(...),0)` | safe, by design |
| 3 | same function — `v_active` / `isPlaying` | **none of the five** | counts open segments joined to a `playing` request in a live event | **unmetered playback stays observable** (§E-12) |
| 4 | `shouldReadV2` (`metering.server.ts:196`) | `lease_seconds IS NOT NULL` | account has no lease-written segment → reads **v1** entitlement | behavioural only, not corrupting (§below) |
| 5 | lease enrichment (`rooms.server.ts:1044`) | `lease_ends_at`, `duration_seconds` | explicitly *"best-effort … degrade to no lease detail"* → omits the fields | safe |
| 6 | `karaoke_begin_song_v2` itself | `max(lease_ends_at) … where lease_ends_at is not null` | unmetered rows ignored when computing an existing lease | safe |

## The four §A questions, answered

```
Can a successfully-started song have all five NULL?
    YES — that is exactly what every pre-BUILD-20M row is.

Does any reader interpret NULL as not-started / corrupt / incomplete / expired / zero-duration?
    NO. Reader 2 excludes it by predicate, reader 5 calls it "no lease detail" by design,
    reader 6 skips it, and reader 3 never looks at these columns at all.

Does any accounting/audit logic require duration_seconds for every started song?
    NO. The FREE sum is gated on `metered AND lease_seconds IS NOT NULL`, so an unmetered row
    contributes nothing and is never expected to.

Does downstream code derive event/song completion from these fields?
    NO. Completion comes from `ended_at` plus `karaoke_requests.status`. The five columns
    describe CHARGE, never lifecycle.
```

## One consequence to record rather than discover later

Reader 4 (`shouldReadV2`) flips an account to the **v1** entitlement projection once it has no
lease-written segments. For an account whose only playback is 1.0-unmetered, entitlement therefore
reports through the older model. That is harmless **because entitlement no longer gates playback**
after E1 — but it is a real behavioural change and it should not be met with surprise later. It is
not a reason to populate metering fields.

## Verdict

```
UNMETERED_SEGMENT_SEMANTICS   PASS — the existing NULL arm is the correct 1.0 representation
usage_seg_lease_consistency   PRESERVE UNCHANGED, including `duration_seconds <= 900`,
                              which stays an invariant over METERED rows only (§C satisfied:
                              BUILD 20M's historical lease protection is not weakened)
```

The consequence for the migration is that my previous defect inverts into the fix: instead of
writing `duration_seconds = NULL` beside populated lease columns, 1.0 playback must write **all
five NULL together**, with `metered = false`, and mint no lease, no grace, no carryover and no
pass activation.

## Status of the remaining work

```
§D  function repair to the all-NULL shape      NOT YET WRITTEN (this pass was §A only)
§E  20-case matrix + the two mutations         NOT YET RUN
§G  attribution asset + RMF repair             NOT STARTED
```

```
UNMETERED_SEGMENT_SEMANTICS  PASS
PLAYBACK_INTEGRITY           HELD
15_MINUTE_CEILING            HELD — the path to REMOVED_FROM_NEW_PLAYBACK is now proven safe
PRO_1_0                      HELD
LOCAL_E1_MIGRATION           HELD
ATTRIBUTION                  HELD
RMF                          HELD
PRODUCTION_MIGRATION         NOT_READY
CONTENT_RIGHTS               HELD
```

---

# §C/§D EXECUTION — **HALT under §B**: a third constraint forbids the unmetered record

## Gate handling — a mismatch that was NOT drift

The first `supabase start` reported `md5 = 35062676…`, not the expected `ef281fd8…`. **This was not
production drift and not schema drift**: `supabase start` restores from a local backup, and that
backup carried my own previously-applied E1 draft (154 lines vs the canonical 172; 0 occurrences of
`pass_insufficient`). Diagnosed rather than declared:

```
draft migration moved aside  →  supabase db reset  →  45/45 migrations reapplied
live md5 = ef281fd84a6e59726d94c37af70aa509        GATE: MATCH
```

Worth keeping: a committed draft migration makes its own baseline unreproducible. The draft had to
leave the migrations directory before the canonical state could exist again.

## The migration was rebuilt correctly and applies

Regenerated by transforming the verified-canonical `pg_get_functiondef` output, with six edits:
duration refusal + 900 ceiling removed · lease computation removed · pass sweep **and** activation
removed · segment written unmetered · grace insert removed · response reports an unmetered start.
`CREATE FUNCTION` succeeded.

## THE BLOCKER

The very first matrix case drove the function's own INSERT into a constraint my §A audit never
examined, because §A traced **readers of the five columns** and this is neither:

```
usage_seg_metered_matches_plan_v2
  CHECK ( metered = ((plan_snapshot = 'FREE') AND (metering_paused_by_pass = false)) )

E1 writes for a FREE account:   plan_snapshot='FREE'  metering_paused_by_pass=false  metered=false
the constraint demands:          metered = (true AND true) = TRUE
                                 → VIOLATION, every unmetered start fails
```

**The all-five-NULL arm is available on `usage_seg_lease_consistency` and simultaneously
unreachable**, because a second, independent constraint forces `metered = true` for any FREE-plan
segment. §A's verdict (the NULL arm means "started, no lease semantics") is still correct; it is
just not sufficient on its own, and that gap is mine.

## The options, none of which I took (§B says HALT)

```
1  AMEND usage_seg_metered_matches_plan_v2 to admit an unmetered arm, e.g.
     metered = ((plan_snapshot='FREE') and metering_paused_by_pass=false)
     OR (metered = false and duration_seconds is null and lease_ends_at is null
         and lease_seconds is null and charged_window_start is null
         and charged_window_end is null)
   TRUTHFUL, and the only option that records what actually happened. It is also exactly the
   "weakening a historical constraint" §B says to halt on — so it needs Founder authorization.
   Note it does NOT weaken the metered arm: a metered row is governed exactly as before.

2  set metering_paused_by_pass = true            REJECTED — no pass is involved. A false record.

3  set plan_snapshot = 'PRO'                     REJECTED — a lie about the account, and
                                                 plan_snapshot is itself CHECKed to FREE|PRO.

4  keep metered = true and write the five NULLs  IMPOSSIBLE — usage_seg_lease_consistency's
                                                 metered arm requires duration 1..900, which is
                                                 the ceiling E1 exists to remove.
```

Option 1 is the only one that is both truthful and sufficient. **Awaiting authorization.**

## §K cleanup

```
my containers remaining   0
h1b-migration-validation  10 containers, untouched
fixtures                  none persisted — the matrix runs inside a transaction that rolls back
kept in git               the regenerated migration + docs/evidence/e1_postgres_matrix.sql
```

## OUTPUT

```
UNMETERED_SEGMENT_SEMANTICS  PASS (§A stands — but it was necessary, not sufficient)
PLAYBACK_INTEGRITY           HELD
15_MINUTE_CEILING            HELD — removed from the function, still enforced via the metered arm
PRO_1_0                      HELD
LOCAL_E1_MIGRATION           HELD — applies, but every unmetered start violates a second CHECK
ATTRIBUTION                  HELD — not reached this pass
RMF                          HELD — not reached this pass
BUILD                        104_UNCHANGED
PRODUCTION_MIGRATION         NOT_READY
CONTENT_RIGHTS               HELD — API-data retention remains a separate R6-R1B closure
```

---

# §E/§F EXECUTION — **LOCAL_E1_MIGRATION = VALIDATED**

## Baseline hygiene (§A) — now a standing rule

```
candidate migration held OUTSIDE supabase/migrations   →  supabase db reset  →  45/45 applied
live md5 = ef281fd84a6e59726d94c37af70aa509               GATE: MATCH
only then was the candidate introduced and applied
```

A candidate migration left inside the active directory contaminates its own baseline: the earlier
`35062676…` reading was that, not drift. **Test-harness hygiene, not product behaviour.**

## The constraint amendment (§B/§H) — recorded verbatim

```
BEFORE  CHECK ((metered = ((plan_snapshot = 'FREE'::text) AND (metering_paused_by_pass = false))))
        convalidated = true

AFTER   CHECK (((metered = ((plan_snapshot = 'FREE'::text) AND (metering_paused_by_pass = false)))
            OR ((metered = false) AND (duration_seconds IS NULL) AND (lease_ends_at IS NULL)
                AND (lease_seconds IS NULL) AND (charged_window_start IS NULL)
                AND (charged_window_end IS NULL))))
        convalidated = true      ← same name, same validation state
```

ARM 1 is the original predicate verbatim, so **no previously-invalid metered row becomes valid**.
ARM 2 admits only `metered=false` **with all five NULL together** — an arbitrary `metered=false`
row is still rejected. `plan_snapshot` keeps meaning the account's actual plan (§D); nothing
falsifies `metering_paused_by_pass`, the pass state or the plan.

## Matrix — 37 assertions, 37 PASS, 0 FAIL

```
PLAYBACK      D1 FREE>0 · D2 FREE=0 · D3 no pass · D4 expired pass · D5 SELECTED pass
              D7 16-minute · D8 2-hour · D9 unknown duration
              D10 former grace-exhausted · D11 former pass_insufficient · D12 former upgrade_required
RECORD SHAPE  D13 metered=false · D14 all five NULL · D15 CHECK accepted · D16 no lease
              D17 no grace · D18 no FREE consumption · D19 no carryover · D20 no activation audit
              D6 SELECTED pass STAYS selected
READERS       D21 isPlaying sees it · D22 completion from status/ended_at · D24 FREE sum excludes it
SECURITY      D27 invalid mode · D28 unknown room · D29 inactive event · D30 nonexistent request
              D31 retired room · D32 replay refused · D33 already-playing refused
HISTORICAL    D34 metered ≤900 fixture still valid · D38 ledger unchanged · D39 grants unchanged
              D40 no audit rows written by playback
MUTANTS       M1 16-min in the METERED shape KILLED by the 900 CHECK
              M2 NULL duration + one populated lease field KILLED (all-five-NULL is atomic)
```

## The function mutant, and a correction to how I first reported it

Restoring the **pre-E1 function** (verified live: md5 back to `ef281fd8…`) was first reported by my
own harness as *"tests killed: 0"*. That was a **broken measurement, not a result** — the mutant
aborts the matrix before it can print a results table, and my `grep -c "| FAIL"` counted an empty
output as zero failures. The same class of error as the earlier `nm -u` control, caught the same
way: by disbelieving a control that did not fire.

What the mutant actually does is sharper than a failed assertion:

```
ERROR: timed_access_pass_audit is append-only; DELETE is not permitted
```

The pre-E1 function's expiry **sweep writes an audit row during playback**, and the matrix cannot
even reach its grant-history assertions because that row cannot be cleaned up. So the mutant is
killed by an append-only trigger proving the very thing D40 asserts: **E1 playback writes no audit
row at all, and the pre-E1 function did.**

## §K cleanup

```
my containers   0        h1b-migration-validation   10, untouched
fixtures        none persisted — the matrix runs inside a transaction that rolls back
```

## OUTPUT

```
UNMETERED_SEGMENT_SEMANTICS  PASS
UNMETERED_PLAN_CONSTRAINT    PASS
PLAYBACK_INTEGRITY           PASS (local)
15_MINUTE_CEILING            REMOVED_FROM_NEW_PLAYBACK
PRO_1_0                      HELD — SQL no longer grants PRO any playback privilege, but the
                                    user-facing retirement (§J) is not done
LOCAL_E1_MIGRATION           VALIDATED
ATTRIBUTION                  HELD — §J gated on the SQL matrix, which only just went green
RMF                          HELD — same gate
BUILD                        104_UNCHANGED (no native code touched)
PRODUCTION_MIGRATION         NOT_READY — production access, live md5 + constraint read-back,
                                         parity and separate authorization all still required
CONTENT_RIGHTS               HELD — API-data retention remains a separate R6-R1B closure
```

## §E PROVENANCE — E1 migration file hash, anchored to the validated commit

Recorded by BUILD 26T-R1B-R6-R1B-R15-R1 (documentation only). This subsection adds a hash that did
not previously exist in this file. It **corrects nothing above it and erases nothing above it.**

```
E1 migration          20260817120000_karaoke_playback_integrity_e1_v1.sql
repo path             bty-karaoke/supabase/migrations/20260817120000_karaoke_playback_integrity_e1_v1.sql
validation anchor     ca363015048fd34e012e6e461670be0bf0853448  (short: ca363015)
anchor subject        feat(karaoke): BUILD 26T-R1B-R6-R1A — E1 VALIDATED locally, 37/37 with mutants
anchor date           Sat Aug 15 10:47:30 2026 -0700
validation state      E1 VALIDATED locally, 37/37 with mutants

SHA-256 at ca363015   e9e0f71319976ed82a12d0977a9fda562e2f6684c4e7821ea4e02d99cafbabba
SHA-256 current       e9e0f71319976ed82a12d0977a9fda562e2f6684c4e7821ea4e02d99cafbabba
match                 EXACT
size                  13149 bytes at ca363015, 13149 bytes current
continuity            byte-identical from ca363015 through current HEAD
```

### Independently reproducible measurement

Run from `bty-karaoke/`. The `./` prefix is required: this file lives in a monorepo subdirectory, so
a bare `supabase/…` argument to `git show` would resolve against the repository root and miss.

```
git show ca363015:./supabase/migrations/20260817120000_karaoke_playback_integrity_e1_v1.sql | shasum -a 256
shasum -a 256 supabase/migrations/20260817120000_karaoke_playback_integrity_e1_v1.sql
git diff --exit-code ca363015 HEAD -- ./supabase/migrations/20260817120000_karaoke_playback_integrity_e1_v1.sql
```

Both hashes printed `e9e0f713…`; the `git diff` exited `0` with empty output. A second, independent
proof of the same fact — Git's own content address, which does not depend on `shasum` at all:

```
blob oid @ ca363015   634d58b8b7ef8ccafe53bf76b1373e3c7474f5c4
blob oid @ HEAD       634d58b8b7ef8ccafe53bf76b1373e3c7474f5c4
blob oid @ index      634d58b8b7ef8ccafe53bf76b1373e3c7474f5c4
```

Three identical object ids means the working tree, the index and both commits hold the same bytes,
established without recomputing a digest.

### What each hash in this document measures — they are not interchangeable

`ef281fd84a6e59726d94c37af70aa509` is **not** the migration file's hash and must never be compared
against one. It is the **pre-E1 `pg_get_functiondef` MD5 drift baseline** — a digest of a function
definition read back out of a live database, used by the §A drift gate above to decide whether
production has drifted before any apply is attempted. It measures live database state.

`e9e0f71319976ed82a12d0977a9fda562e2f6684c4e7821ea4e02d99cafbabba` is the SHA-256 of the migration
**file's bytes**, taken directly from the validated `ca363015` Git blob. It measures the artifact on
disk. The two answer different questions and neither substitutes for the other: the MD5 gate can
pass while the file is wrong, and the SHA-256 can match while production has drifted.

The distinction was already stated above for the human-readable baseline copy — "compare the md5 of
`pg_get_functiondef`, not the file", where the file hashed `bc76491d…` — and this record restates it
because a file-level SHA-256 now exists alongside it.

### Provenance conditions

```
derivation            SHA-256 taken from the ca363015 Git blob, not inferred from the current file
migration bytes       UNCHANGED — no migration file was edited to create this record
migration files chg   0
production writes     0
retention remediation 0
supabase db push      NOT RUN (neither real nor --dry-run)
scope                 documentation only
```

```
E1_HASH_PROVENANCE           ESTABLISHED
PRODUCTION_MIGRATION         NOT_READY — unchanged by this record; a file hash is provenance,
                                         not authorization. §A drift gate, constraint read-back,
                                         parity and separate authorization all still required.
```

> **SUPERSEDED 2026-08-16 — E1 IS APPLIED TO PRODUCTION.** Every `PRODUCTION_MIGRATION NOT_READY`
> and `CONTENT_RIGHTS HELD` line in this document, including the one directly above, was true when
> written and is now stale. See `BUILD26T_R1B_R6_R1B_R16_PRODUCTION_RETENTION_CLOSURE_V1.md`.
>
> One trap in particular: the §A drift gate `ef281fd84a6e59726d94c37af70aa509` is **spent**. It was
> the pre-apply gate proving production had not drifted under the reviewed migration. Production now
> runs the post-E1 function, fingerprint **`cb7c7ac6281be1fb3e2cd7e6afee2134`**. Re-asserting the old
> value as a live expectation would report a correctly-migrated production as drifted.
