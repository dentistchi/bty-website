# BUILD 26T-R1B-R6-R1B-R4 — Native YouTube Provenance + BUILD 18B Durable Replay

**Status:** PASS — implemented and committed. **No build minted; 106 remains the last physically
verified artifact** (§L hold observed).

**Native commit:** `999beb0` (pushed) · **Server/web halves:** R1/R2/R3, already committed
**Migration:** none · **Deploy:** none · **Build number:** 106, unchanged (verified from the built
`Info.plist`, not assumed)

---

## The claim this slice makes

The device is **transport only**. It never signs, re-times or regenerates the server's provenance
seal. It stores the seal durably and re-sends it verbatim, so the value the server verifies is the
value the server issued.

## The chain, end to end

| Hop | Mechanism |
|---|---|
| Server issues | `signYouTubeProvenance` at the instant the YouTube response was received |
| KV envelope | `SearchCacheEnvelope.fetchedAt` — a cache hit re-seals the *original* instant |
| Search response | one response-level `fetchedAt`, one per-item seal |
| Native decode | `GuestSearchItem.youtubeProvenance: String?` |
| Durable intent | `GuestRequestIntent.youtubeProvenance: String?` |
| Request body | `youtubeProvenance` emitted only when present |
| Saved-song body | same seal, same four fields (§I) |
| Server writes | `verifyYouTubeProvenance` → `youtube_metadata_fetched_at`, or NULL |

## §I — NATIVE_SAVED_SONG_PROVENANCE = **APPLICABLE** (not NOT_APPLICABLE)

Traced rather than assumed. `GuestRoomView.toggleSaved(item: GuestSearchItem)` constructs a
`SavedSong` directly from a live search result and POSTs it to `/api/host/saved-songs`, which
already verifies provenance exactly as the request route does. This is a second live-search →
server-persist path, so the seal is carried through it. No unused path was built for symmetry: a
save that did **not** originate from a live search sends nothing.

The seal is a **write credential, not library state.** The server never returns it, so a row read
back from `/api/host/saved-songs` decodes with `nil` and loses nothing else.

## The upgrade gate — why every new field is optional

A durable intent written by build 106 has no `youtubeProvenance` key. A non-optional field would
make every such record undecodable, **silently destroying in-flight guest requests on upgrade**.
Same reasoning for the persisted local saved-song library. Both are pinned by fixtures containing
the exact build-106 shape, and by compile-breaking mutants.

## Mutants killed

| # | Mutation | Result |
|---|---|---|
| M1 | drop the field from the intent round trip | killed |
| M4 | durable intent field made non-optional | killed — build-106 fixture, 2 errors |
| M9 | save drops the seal | killed — 2 checks |
| M10 | save borrows a seal it was not given | killed — 2 checks |
| M11 | library field made non-optional | compile error at the build-106 local-library fixture |

## Measurement note — a harness that counted nothing

The first verification run used `Tests/run.sh` (the **host** suite, 2791) and the total did not move
after six new checks were added. A mutant then failed to fire. The cause was the wrong runner: the
guest suite is `Tests/run-guest.sh`. On the correct runner the count moved 1000 → **1006** and both
mutants killed. *A test count that does not move is a measurement to diagnose, not a rounding
detail.*

Three `Localizable.xcstrings` catalog failures observed mid-run were the known Xcode build-rewrite
artifact; reverting the catalog after the build restores 0 failed.

## Evidence

- Guest suite **1006 passed / 0 failed**
- Web + server **2926 passed / 242 files**
- Release **BUILD SUCCEEDED**, `CFBundleVersion` = **106**
- An unrelated local scheme diff (Release launch + a disabled LAN base-URL argument carrying a
  private IP) was reverted, not committed.

## Holds observed

No production E1, no build 106 upload, no build 107, no ASC write, no Content Rights change, no IAP
activation, no Add for Review, no submission, no production DB write or retention cleanup.

## Remaining in R1B

Refresh sweeper (day-23 margin, `HARD_UNAVAILABLE` vs `TRANSIENT_ERROR`, `DEFER_ACTIVE`), a
zero-write dry run with a write-attempt mutant, and the `MARK_UNAVAILABLE` UI using the approved
EN/KO copy. The production census remains `HELD_ACCESS`, which still blocks the first live cleanup.
