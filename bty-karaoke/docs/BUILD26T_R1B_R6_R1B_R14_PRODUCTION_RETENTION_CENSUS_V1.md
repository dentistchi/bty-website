# BUILD 26T-R1B-R6-R1B-R14 — Production Retention Census (READ ONLY)

**PRODUCTION_ACCESS = PASS_READ_ONLY** · **PRODUCTION_WRITES = 0**

Measured 2026-08-16 against production ref `zycwaqignioawtqynopj`.

---

## §A — the authorized read path

`supabase/.temp/project-ref` links this repo to the production project, and `.dev.vars` already
carries `KARAOKE_SUPABASE_URL` (production) plus `KARAOKE_SUPABASE_SERVICE_ROLE_KEY`. That is an
**already-present, already-authorized** credential in this environment; no new credential was
created, no secret was printed, copied into any file, or recovered from anywhere else.

**The Supabase CLI could NOT be used.** `supabase migration list --linked` returns
`403 … account does not have the necessary privileges`, and `supabase projects list` does not show
the production ref at all — the known access deviation carried since BUILD 24. The census therefore
ran over PostgREST instead.

### Why this is structurally read-only
Every request is an HTTP **GET**. The scripts contain no `POST`/`PATCH`/`PUT`/`DELETE` and no
`/rpc/` call — audited by grep before each run, both returning 0. Counts come from
`Prefer: count=exact` with `limit=0`, so the server returns the count in `Content-Range` and
**zero rows**: no customer value was transferred for any count.

Distinct-ID counts are the one exception — ids were pulled into process memory solely to be
counted, and are neither printed nor persisted anywhere.

---

## §B — migration parity

| | |
|---|---|
| Local head | `20260819120000_karaoke_youtube_retention_unavailable_v1.sql` |
| `youtube_metadata_fetched_at` (requests / saved) | **ABSENT** in production |
| `youtube_metadata_unavailable_at` (requests / saved) | **ABSENT** in production |
| `karaoke_retention_due_*` views | **ABSENT** in production |

**RETENTION_MIGRATION_PRODUCTION = UNAPPLIED** — as expected, and directly measured rather than
assumed. The provenance migration (`20260818120000`) is unapplied too.

**The exact production head is NOT established.** The CLI parity endpoint 403s, and migrations that
add only a CHECK constraint or replace a function (e.g. `20260815120000`, `20260817120000` E1) are
invisible to PostgREST column probing. Two probes I attempted for that purpose targeted the wrong
object and prove nothing; they are discarded rather than reported as evidence. What *is* proven is
the only thing this slice needs: **the two retention-relevant migrations are not applied.**
E1's production status remains undetermined by this method.

---

## §C — requests census

| Metric | Value |
|---|---|
| Total rows | **450** |
| With `youtube_video_id` | **450** (100%) |
| With title / channel / thumbnail | 447 / 446 / 443 |
| Distinct YouTube ids | **315** |
| status `waiting` | 17 |
| status `playing` | 5 |
| status `completed` | 277 |
| status `skipped` | 11 |
| status `removed` | 140 |
| Oldest `created_at` | 2026-07-13T15:44:22Z |
| Newest `created_at` | 2026-08-16T15:37:40Z |

Status counts sum to 450, matching the total.

## §C — saved songs census

| Metric | Value |
|---|---|
| Total rows | **1** |
| With `video_id` | 1 |
| Distinct YouTube ids | 1 |
| Oldest / newest `created_at` | 2026-07-30T02:15:53Z (single row) |

## §E — duration census (factual `resolved_at`)

| Metric | Value |
|---|---|
| `DURATION_TOTAL` | **676** |
| With factual `resolved_at` | 676 (100%) — none NULL |
| `DURATION_LT_23D` | **676** |
| `DURATION_GE_23D` | **0** |
| `DURATION_GE_30D` | **0** |
| Distinct video ids | 676 |
| `DURATION_OLDEST` | 2026-07-30T13:06:45Z |
| `DURATION_NEWEST` | 2026-08-16T15:02:41Z |

No second clock was invented; `resolved_at` was used directly.

---

## §D — legacy provenance reality

Production has **no** `youtube_metadata_fetched_at` column at all, so nothing on these two tables
can prove when YouTube was actually asked. `created_at` / `updated_at` / request time / save time
were **not** substituted.

| | |
|---|---|
| `LEGACY_UNKNOWN_PROVENANCE_REQUESTS` | **450** |
| `LEGACY_UNKNOWN_PROVENANCE_SAVED_SONGS` | **1** |

**The finding that matters:** the oldest request dates from 2026-07-13 — **34 days** before this
census, past the 30-day external maximum. Because provenance does not exist, we cannot show those
snapshots were fetched more than 30 days ago; equally, we cannot show they were not. That
irreducible uncertainty across 100% of the request table is precisely what remediation exists to
resolve, and it is why `UNKNOWN_PROVENANCE` must never be spent as "probably fine".

---

## §F — active-event exposure

| Metric | Value |
|---|---|
| Requests in `waiting` or `playing` | **22** |
| …of those, holding a YouTube id | 22 (all) |
| Distinct YouTube ids among them | 22 |
| Events total | 43 |
| Events with status `active` | **12** |

These 22 rows are the ones the bounded-deferral rule governs. Nothing was mutated.

---

## §G — first dry-run candidate forecast

Derived from census facts only. **No YouTube call was made**, so no row is classified
`WOULD_REFRESH` vs `WOULD_MARK_UNAVAILABLE` — those require the actual probe after migration and
dry-run authorization.

| Bucket | Rows | Distinct ids |
|---|---|---|
| `UNKNOWN_PROVENANCE` requests | 450 | 315 |
| `UNKNOWN_PROVENANCE` saved songs | 1 | 1 |
| STALE factual duration rows | **0** | 0 |
| ACTIVE unknown-provenance requests | 22 | 22 |

Every request and saved row is a candidate on day one, because none has provenance. Duration
contributes nothing: all 676 rows were resolved within the last 23 days.

---

## §H — quota call forecast

Batching is the measured contract: `videos.list` accepts up to 50 ids per call, so calls =
`ceil(N / 50)`.

| | Distinct ids | Calls |
|---|---|---|
| Legacy request metadata | 315 | **7** |
| Legacy saved-song metadata | 1 | 1 (or absorbed into the union) |
| Union of both | 315–316 | **7** either way — the overlap does not change the answer |
| Stale duration rows | 0 | **0** |

**Quota units: `COST_NOT_MEASURED`.** No official source was consulted in this slice, and the
"1 unit per call" figure in `youtube-duration.server.ts:36` is an in-repo assertion carried since
BUILD 22, not verification. No quota number is claimed.

---

## §I — write guard

Every production command was a GET. Write-verb audit of both census scripts returned **0** matches
for `POST`/`PATCH`/`PUT`/`DELETE`/`/rpc/`. No migration push, no sweep, no E1 apply, no worker
write, no YouTube call.

**PRODUCTION_WRITES = 0.**

---

## Privacy

No titles, channel names, thumbnails, account ids, guest names, video ids, room slugs or other
customer values appear in this document. Only counts and timestamps.
