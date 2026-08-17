# BUILD 26T-R1B-R6-R1B-R16 — production retention CLOSED, and what that releases

R6-R1B is closed. The production migrations are applied, the historical retention remediation ran,
and the V1.0 FREE production contract is established. Every status board written before this file
says `R6_R1B HELD` / `CONTENT_RIGHTS HELD` / `PRODUCTION_MIGRATION NOT_READY`; **those boards are now
stale, and this file is the correction.** They are left unedited — the boards are an append-log of
what was true when each pass ran, and rewriting them would destroy that.

## Provenance of the facts below — read this before using any number here

This closure has **two sources**, and they are not interchangeable.

```
FOUNDER-REPORTED   the production state (§1). Reported by the Founder on 2026-08-16 after the
                   authorized production pass. NOT measured by this session.
SESSION-MEASURED   the repository, build and test state (§2). Measured directly this pass and
                   reproducible from the commands shown.
```

This session held **no production credential** at any point — `SUPABASE_DB_PASSWORD` and every
substitute (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DATABASE_URL`,
`PGPASSWORD`) were absent from the environment across all three preflight attempts. It therefore
**cannot** independently confirm §1, and does not claim to. §1 is recorded as received. Anyone
re-deriving production truth must re-measure against the live database, not against this file.

## §1 — Production state, as reported by the Founder

```
E1 + R15 migrations                 PASS / applied
V1.0 FREE production contract       ESTABLISHED
historical retention remediation    PASS / CLOSED

karaoke_requests refreshed          450
saved songs refreshed               1
retention_due_requests              0
retention_due_saved_songs           0
retention_due_durations             0
HARD_UNAVAILABLE                    0
unavailable writes                  0
API-derived data clears             0
```

### The E1 production runtime fingerprint — a NEW baseline, not a failed gate

```
pre-E1  drift baseline    ef281fd84a6e59726d94c37af70aa509
post-E1 runtime           cb7c7ac6281be1fb3e2cd7e6afee2134
```

These differ **because E1 changed the function**, which is the entire point of E1. `ef281fd8…` was
the gate that had to match *before* the apply, to prove production had not drifted underneath the
reviewed migration; it is now spent and must never be re-asserted as a live expectation. A future
drift gate against `karaoke_begin_song_v2` compares to **`cb7c7ac6…`**. Reading the old value as the
current expectation would report a correctly-migrated production as drifted.

Both remain MD5 digests of `pg_get_functiondef` — **live database state**, never a migration file
hash. The file-level SHA-256s live in §2 and answer a different question.

## §2 — Repository, build and test state, measured this pass

```
monorepo HEAD == origin/main    4c93be9631240783ad0a33138d910c2cef7ffa20   (behind 0, ahead 0)
native repo HEAD                8f97231  build 109, working tree clean
```

Applied migration file hashes, all three re-measured byte-exact against their reviewed values:

```
20260817120000_karaoke_playback_integrity_e1_v1.sql          e9e0f713…cafbabba   13149 B
20260818120000_karaoke_youtube_metadata_provenance_v1.sql    cc125d50…87861e4e    2799 B
20260819120000_karaoke_youtube_retention_unavailable_v1.sql  e770e942…23b9c30d    8740 B
```

Full suites, all green:

```
karaoke web/server   tsc --noEmit clean · 247 files · 3020 tests passed
native host          Tests/run.sh        2791 passed, 0 failed
native guest         Tests/run-guest.sh  1069 passed
```

The web count moved 2926 → 3020 and the guest count 1006 → 1069 across R5–R13, so these runs
measured the current tree rather than a stale cache.

## §3 — What R6-R1B leaves finished

The YouTube API-Data obligations that gated the 1.0 release are now complete end to end:

```
provenance chain      server-attested HMAC, KV envelope → search → client transport → verify-then-write
retention engine      scripts/youtube-retention-sweep.mjs, refresh-or-delete lifecycle
unavailable state     MARK_UNAVAILABLE rendered on DJ queue, history, and web Guest history
historical backlog    remediated in production — 450 requests + 1 saved song refreshed, 0 due
```

Attribution, re-verified in code this pass, covers all three surfaces the J3 census required — and
only those three, since the other videoId-bearing surfaces render stored BTY snapshots rather than
API data:

```
web guest search        src/app/r/[slug]/RequestForm.tsx:693        DevelopedWithYouTube height=18
web host add-song       src/app/r/[slug]/dj/DjAddSongSheet.tsx:182  DevelopedWithYouTube height=18
native guest search     GuestRoomView.swift:2949                    DevelopedWithYouTubeMark height 26
```

The native mark is pinned by J4/J5 assertions in `Tests/QueueContractTests.swift` — that it ships,
that it is mounted, that it renders at the device-verified 26pt and not the illegible 16pt, that its
width stays derived from the official 700:250 ratio, and that VoiceOver names it.

`modestbranding` is deliberately **absent** from the player vars (`PlayerClient.tsx:98`): it is
deprecated and inert, so carrying it would have implied a guarantee the player no longer makes.

## §4 — The one thing still open for 1.0

```
ASC_SUBMISSION_METADATA    OPEN — Founder gate, cannot be executed from this environment
```

J5 fixed the ordering and the precondition it named has now been met:

> Correct order is: apply E1 to production under its own authorization, then enter these notes, then
> the screenshots. Entering them now would describe a build whose server contract is still the old one.

E1 is applied, so the notes now describe the shipped server contract truthfully. Both artifacts are
committed and final — the review-notes text in `BUILD26T_R1B_R6_R1A_J5_REVIEW_NOTES_FINAL_V1.md`,
and the Release-109 screenshots with their `PROVENANCE.md` under `appstore/1.0/screenshots/`.

App Store Connect is a GUI with no CLI equivalent for these fields, and `devicectl` has no screenshot
subcommand, so **entry is a Founder action**. This session cannot perform it and does not attempt it.

## OUTPUT

```
R6_R1B                          PASS / CLOSED
CONTENT_RIGHTS                  PASS — API-Data retention obligations met in production
PRODUCTION_MIGRATION            APPLIED (E1 + R15), Founder-reported
PRODUCTION_RETENTION            CLOSED — 450 requests + 1 saved song refreshed, all due counts 0
E1_PRODUCTION_RUNTIME           cb7c7ac6281be1fb3e2cd7e6afee2134  ← new drift baseline
E1_PRE_MIGRATION_BASELINE       ef281fd84a6e59726d94c37af70aa509  ← SPENT, never re-assert
MIGRATION_HASH_GATE             PASS (3/3 byte-exact)
ATTRIBUTION                     PASS — 3 required surfaces mounted, native pinned by tests
RMF                             PASS — modestbranding deliberately absent, documented
PRO_1_0                         RETIRED_AS_PLAYBACK_AUTHORITY
FREE_PLAYBACK_COPY              RETIRED
STORE_SURFACE_1_0               RETIRED
BUILD                           109 (native clean) · web HEAD == origin/main
TESTS                           web 3020 · native host 2791 · native guest 1069 — all green
APP_REVIEW_NOTES                FINAL, not entered into ASC
PUBLIC_SCREENSHOTS              FINAL (Release 109), not entered into ASC
ASC_SUBMISSION_METADATA         OPEN — Founder gate, the only remaining 1.0 blocker
PRODUCTION_SCHEMA_WRITES        0 (this pass)
PRODUCTION_RETENTION_WRITES     0 (this pass)
```

This pass wrote no SQL, ran no `supabase` command, touched no migration and held no production
credential. It is documentation plus verification only.
