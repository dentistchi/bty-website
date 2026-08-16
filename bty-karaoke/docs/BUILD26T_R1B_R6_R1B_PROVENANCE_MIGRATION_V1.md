# BUILD 26T-R1B-R6-R1B — provenance migration validated; the propagation chain is blocked upstream

**Migration VALIDATED locally. Sweeper, MARK_UNAVAILABLE UI and the propagation chain NOT built.
No production write. E1 unapplied. Build 106 not uploaded. ASC untouched.**

---

## What is done and proven

`supabase/migrations/20260818120000_karaoke_youtube_metadata_provenance_v1.sql`, applied and
exercised against real local PostgreSQL:

```
karaoke_requests.youtube_metadata_fetched_at        timestamptz NULL
karaoke_user_saved_songs.youtube_metadata_fetched_at timestamptz NULL
karaoke_video_durations                              DELIBERATELY UNTOUCHED
4 partial indexes                                    unknown-provenance + approaching-expiry
```

Behaviour proved, not asserted:

```
P4  a 90-day-old legacy row migrates to NULL — never backfilled from created_at      PASS
P7  an unrelated BTY status update does NOT bump API freshness                       PASS
P1  a factual fetched-at can be stored, distinct from created_at                     PASS
S   both sweeper selections (unknown provenance / past a 23-day margin) resolve      PASS
H26 durations keep resolved_at as the single authority — no second column added      PASS
```

The durations table is untouched **because adding a column there would create two sources of truth
for one fact**. Its `resolved_at` is already factual, and §A says so explicitly.

---

## THE BLOCKER — provenance cannot be propagated truthfully today

§A requires tracing where the live YouTube response enters the client and propagating its factual
fetched-at. That trace ends at a wall:

```
src/lib/youtube.server.ts:180
    await kv.put(cacheKey, JSON.stringify(items), { expirationTtl: SEARCH_CACHE_TTL_SECONDS })
```

**The KV search cache stores a bare `items` array with no fetch timestamp.** A search response can
therefore be served from cache up to an hour after the underlying YouTube fetch, and the server has
no way to say when that fetch happened. Stamping `now()` on a cache hit would be inventing the
exact fact §A forbids inventing.

So the chain must be repaired from its source before any provenance can be written:

```
1  KV VALUE SHAPE      { fetchedAt, items } instead of a bare array.
                       Live fetch → fetchedAt = now. Cache hit → the STORED fetchedAt.
                       Legacy entries are bare arrays → fetchedAt unknown → NULL, not now.
                       (Self-healing: legacy entries expire within the 1h TTL.)
2  SEARCH RESPONSE     additive `youtubeFetchedAt` field
3  CLIENTS (web+native) carry it into the request/save payload, and the BUILD 18B durable intent
                       must STORE it so a replay re-sends the ORIGINAL value (§B: a replay is
                       not a refresh)
4  ROUTES              accept the additive optional field; write it; NULL when absent
```

Step 3 is where §B's regression test belongs, and it cannot be written before step 1 exists —
there is no factual T0 to preserve yet.

---

## OUTPUT

```
API_DATA_CENSUS                 COMPLETE
PROVENANCE_MODEL                PASS
LOCAL_RETENTION_MIGRATION       VALIDATED
DURATION_PROVENANCE             EXISTING_RESOLVED_AT_USED
REFRESH_SWEEPER                 HELD — cannot select on provenance that cannot yet be written
DRY_RUN                         HELD
VIDEO_ID_LIFECYCLE              RESOLVED_DELETE_OR_REFRESH (contract ratified; not implemented)
HISTORICAL_DISPLAY              HELD — MARK_UNAVAILABLE copy approved, UI not built
PRODUCTION_CENSUS               HELD_ACCESS
INITIAL_PRODUCTION_REMEDIATION  NOT_READY
R6_R1B                          HELD
CONTENT_RIGHTS                  HELD
```

## Remaining order of work

```
1  KV cache value shape + search-response field          ← unblocks everything
2  client propagation + the §B replay-preservation test
3  sweeper (refresh / hard-unavailable / transient / DEFER_ACTIVE) with the day-23 margin
4  dry run with a write-attempt mutant
5  MARK_UNAVAILABLE rendering, approved copy, no Request/Play on a cleared id
6  production census, then first dry run
```
