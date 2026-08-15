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
