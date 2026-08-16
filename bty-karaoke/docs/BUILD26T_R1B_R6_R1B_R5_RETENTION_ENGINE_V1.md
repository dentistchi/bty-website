# BUILD 26T-R1B-R6-R1B-R5 — YouTube Retention Engine + Zero-Write Dry Run + Unavailable State

**Status:** PASS (local). Backend only — no UI, no build 107, no production writes.

**Migration:** `20260819120000_karaoke_youtube_retention_unavailable_v1.sql` (LOCAL ONLY)
**Engine:** `src/lib/youtube-retention.server.ts` · **Operator entry:** `scripts/youtube-retention-sweep.mjs`
**Evidence:** `docs/evidence/r5_retention_postgres_matrix.sql` — **39/39 PASS** on real local Postgres
**Tests:** 43 new engine tests · web/server suite **2926 → 2969**

---

## §B — the MEASURED API contract (traced before any taxonomy was written)

| | |
|---|---|
| Endpoint | `GET https://www.googleapis.com/youtube/v3/videos` |
| Metadata parts | `part=snippet` → `title`, `channelTitle`, `thumbnails.{high,medium,default}.url` |
| Duration part | `part=contentDetails` → ISO-8601 duration (the existing BUILD 21/22 path, untouched) |
| Batching | `id=a,b,c`, **max 50 ids per call**, one call per chunk |
| Existing helpers | `resolveRawVideoDuration` / `resolveRawVideoDurations` (`src/lib/youtube-duration.server.ts`) |

**The authoritative absence signal.** `videos.list` does **not** 404 for a missing video. It returns
**HTTP 200 with the id simply absent from `items`** — exactly how `youtube-duration.server.ts` has
detected `video_unavailable` since BUILD 21. So `HARD_UNAVAILABLE` is defined as *an understood 200
in which the requested id is absent*. Had "404 means deleted" been assumed, the rule would have
been wrong for this API and would never have fired.

**What the API cannot tell us.** Deleted, private and some region restrictions all present as the
same absence. No field separates them here, so no such claim is made or stored.

---

## §C — the taxonomy

| Class | Trigger |
|---|---|
| `REFRESHED` | 200, id present, snippet parsed |
| `HARD_UNAVAILABLE` | 200, understood, id **absent** — the only destructive response |
| `TRANSIENT_ERROR` | timeout/DNS, 429, quota/daily-limit, 5xx, malformed 200, missing `items` |
| `DEFER_ACTIVE` | `HARD_UNAVAILABLE` on a row still in a **live** queue (`waiting` / `playing`) |
| `ERROR` | ambiguous 4xx, unconfigured key, missing probe outcome |

A non-2xx **never** classifies a video as unavailable, whatever the status. A 200 we could not
parse is not an absence — absence is only meaningful inside a response we actually understood.

---

## §D/§O — the durable state

`youtube_metadata_unavailable_at timestamptz NULL` on **both** `karaoke_requests` and
`karaoke_user_saved_songs`.

- **NULL does not mean unavailable.** `title IS NULL` cannot carry this meaning: NULL already means
  legacy / unknown / never-captured on rows written before provenance existed.
- **Not an enum.** There is one determination and one fact about it. A timestamp carries both; an
  enum would add a vocabulary to keep in sync without recording anything new. A *reason* column is
  the additive move if a future slice ever needs deleted-vs-private — not speculative shape now.
- **No backfill.** Every historical row is NULL.
- **No marker on `karaoke_video_durations`** — nothing would read it.

**Coherence is enforced by the DATABASE, not by remembering.** A CHECK makes "fresh metadata plus a
stale unavailable marker" *unrepresentable*. Proven live: the matrix attempts exactly that update
and Postgres raises `check_violation` (P11b), and attempting to retain a video id on an unavailable
row is refused too (M6).

### The blocker this slice had to remove first

`karaoke_requests.youtube_video_id` and `karaoke_user_saved_songs.video_id` / `title_snapshot` were
**NOT NULL**. The ratified transition — clear the identifier, keep the BTY row — was therefore
*structurally impossible*: the only ways to satisfy those constraints were to delete the BTY row
(forbidden) or manufacture placeholder text (forbidden). The migration drops exactly those three
NOT NULLs and nothing else; every format CHECK still holds for every non-NULL value.

---

## §L/§M — dry run, and the control that makes the claim mean anything

Dry-run is structurally incapable of writing: it is handed a `PROHIBITED_WRITER` whose every method
**throws on contact**. A boolean checked at each call site would only be as good as the next
person's memory.

**Real dry run against real Postgres, with a stubbed upstream so classification was exercised:**

```
selected from real DB: karaoke_requests, karaoke_requests, karaoke_user_saved_songs
rowsExamined 3 · apiCallsAttempted 1 · apiCallsSucceeded 1 · dbWrites 0
WOULD_REFRESH 1 · WOULD_MARK_UNAVAILABLE 2 · WOULD_CLEAR_API_DATA 2 · UNKNOWN_PROVENANCE 1
requests byte-identical: YES   saved byte-identical: YES      (md5 of the whole table, before/after)
```

A second real run through the shipping operator script with no API key configured gave
`rowsExamined 3, apiCalls 0, dbWrites 0, ERROR 3` — honest, and both tables again byte-identical.

**The control fires.** A live sweep through a counting writer records **1 write** and reports
`dbWrites: 1` — so the detector is not blind. Then the mutant: routing `applyUnavailable` through
the dry-run branch raises `RetentionWriteViolation` and **kills 5 tests**.

---

## §Q — mutants, all killed

| # | Mutation | Result |
|---|---|---|
| M1 | NULL provenance treated as FRESH | 3 tests |
| M2 | `coalesce(fetched_at, created_at)` in the selection view | 2 SQL assertions |
| M3 | clear metadata on a timeout | 2 tests |
| M4 | clear an active queue row on hard-unavailable | 3 tests |
| M5 | refresh forgets to move `fetched_at` | 1 test |
| M6 | unavailable row retains the YouTube id (constraint dropped) | 2 SQL assertions |
| M7 | dry-run performs a persistence write | 5 tests, via the write detector |
| M8 | the transition deletes the whole BTY row | 6 SQL assertions |
| M9 | a second provenance clock added to the duration table | 1 SQL assertion |

---

## §N — quota cost

- **Batching: MEASURED.** 120 ids produced exactly **3** calls (50/50/20). Expected calls for N
  rows = `ceil(N/50)`, plus zero for every FRESH row (the margin's whole purpose).
- **Per-call unit cost: REPO_DOCUMENTED, not independently verified.**
  `src/lib/youtube-duration.server.ts:36` states `videos.list` costs one quota unit regardless of
  id count. That is an in-repo assertion carried since BUILD 22, not an official source read during
  this slice. No unofficial figure was invented, and no other quota number is claimed →
  **exact current quota units: COST_NOT_MEASURED.**
- Legacy unknown-provenance rows cost the same as any other candidate; they are simply ordered
  first (`nulls first`), so an unbounded age is remediated before a measurable one.

---

## §J — duration

`DURATION_USAGE = STILL_REQUIRED`. Traced, not assumed: after E1 the DJ playback clock
(`usePlaybackClock.ts`, `NowSingingClock.tsx`) and the search result label
(`RequestResultCard.tsx`) still read `durationSeconds`. So stale durations are **refreshed**, not
deleted. `resolved_at` remains the only duration clock — proven by P37 and mutant M9.

---

## Two conflicts for Founder review

**1. §G — an active event can outlive the policy window.** `DEFER_ACTIVE` correctly refuses to
break a live event, but nothing in the architecture forces an event to end. A room left open with a
`waiting` request whose video has gone away will defer on every pass, indefinitely — so that row's
API Data could be retained past 30 days. The sweep reports the count on every run (no silent
exemption), but the resolution is a **product decision**: an event staleness bound, or an explicit
accepted exception. Not decided here.

**2. §E — a cleared saved song becomes unaddressable.** `DELETE /api/host/saved-songs/{videoId}`
keys on the video id. Once `video_id` is NULL, the owner can no longer delete that library row
through the shipping API. The row is correctly preserved per the ratified contract, but the next
slice's UI work needs an id-addressed delete path or the row is stuck. Flagged, not silently
worked around.

---

## §S — production

`PRODUCTION_CENSUS = HELD_ACCESS`. No production read access was authorized or attempted. Every
count in this document is from local fixtures and is **not** a production fact.

---

## Holds observed

No production retention write · no production migration · no E1 apply · no build 107 · no upload ·
no ASC write · no IAP activation · no submission · no UI.
