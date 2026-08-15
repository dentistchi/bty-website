# BUILD 26T-R1B-R6-R1B — YouTube API-data retention: census and provenance model

**§B/§C COMPLETE. No schema change applied, no sweeper built, no production write. — 2026-08-15**

**E1 not applied. Build 106 not uploaded. ASC untouched. Content Rights untouched.**

---

## 0. Two corrections to BUILD 26T-R1B-R6 Part 3, made first

R6 Part 3 said *"`karaoke_video_durations` has no fetch timestamp at all, so its age is not merely
non-compliant — it is unknowable."* **That is wrong.** The table has carried one since BUILD 20M:

```sql
resolved_at timestamptz not null default now()   -- 20260803120000, line 55
```

And it is **factual**, not incidental: `upsertDurations` writes the row in the same call that
fetched the duration from YouTube, so `resolved_at` genuinely is the API-fetch instant. Duration is
therefore the ONE store that already has truthful provenance. What it lacks is any *use* of it —
the schema comment says it plainly: *"TTL: durations are immutable → effectively permanent; lazy
re-resolve only on a MISS."*

R6 Part 3 also implied the whole problem was a missing column. The real problem is narrower and
worse in one place and better in another, which §C sets out.

---

## §B — complete persistence census

| Store | Column / key | Class | Write path | Read path | Retention today | Refresh | Delete | Provenance today |
|---|---|---|---|---|---|---|---|---|
| `karaoke_requests` | `youtube_video_id` | **B** API Data | **client POST body** | queue/history UI | indefinite | none | account/room lifecycle | `created_at` only |
| | `youtube_title`, `youtube_channel_title`, `youtube_thumbnail_url` | **B** | **client POST body** | queue/history UI | indefinite | none | none | **none** |
| | `search_query` | A | client input | — | indefinite | n/a | n/a | n/a |
| | `guest_name`, `status`, `position`, `created_at`, `started_at`, `completed_at`, `ready_at` | **A** BTY fact | server | UI | indefinite | n/a | n/a | n/a |
| `karaoke_user_saved_songs` | `video_id`, `title_snapshot`, `artist_snapshot`, `thumbnail_url_snapshot` | **B** | **client POST body** | My Songs | indefinite | none | cascade on account delete | `created_at` only |
| `karaoke_video_durations` | `duration_seconds`, `source` | **B** | **server, at fetch** | admission/lease | indefinite | on MISS only | none | **`resolved_at` — FACTUAL** |
| Cloudflare KV `ytq:<query>` | projected search results | **B** | server, at fetch | search | **TTL 1h** | expiry = refresh | automatic | TTL |
| Worker logs | — | — | no `[observability]`, no logpush | — | none configured | — | — | — |
| Native `UserDefaults` | `bty.savedsongs.v1` | **B** | client | local My Songs | indefinite | none | app uninstall | none |

**Class C (mixed / must split): `karaoke_requests` and `karaoke_user_saved_songs`.** Each row is a
single record holding *both* a BTY independent fact (a guest requested something at time T; an
account saved something at time T) and YouTube API Data (title, channel, thumbnail, video id). The
retention lifecycle must reach the second without destroying the first.

**Nothing is classified BTY-independent merely for living inside a BTY row.** Title, channel,
thumbnail, duration and video id are all Class B wherever they appear.

---

## §C — write-path provenance: why `created_at` cannot stand in

This is the decisive finding, and it disqualifies the obvious shortcut.

```
karaoke_requests        youtube_title/channel/thumbnail  ←  parsed.data.*   (route.ts:190-192)
karaoke_user_saved_songs title/artist/thumbnail_snapshot ←  parsed.data.*   (route.ts:47-49)
```

Both come from **the client's POST body**, not from a server-side fetch. The client obtained them
from a search that may have happened minutes earlier — and BUILD 18B makes it worse in a way that
is easy to miss: a guest request is replayed from a **durable intent** that stores the exact
payload and survives a process death and relaunch. `guestRequestBody()` deliberately re-sends the
original title/channel/thumbnail verbatim, because replay equality depends on it.

So a `karaoke_requests` row created today can legitimately carry metadata fetched days earlier.
**`created_at` is the moment BTY recorded the request, never the moment YouTube was asked.** Mapping
one to the other would manufacture a freshness fact that does not exist — precisely what §C forbids.

By contrast `karaoke_video_durations` is written by `upsertDurations` inside the same server call
that fetched from YouTube, so its `resolved_at` **is** the fetch instant. One store already truthful,
two that cannot be inferred.

### Provenance model that follows

```
karaoke_video_durations    resolved_at ALREADY FACTUAL — reuse it, add no column
karaoke_requests           NEW  youtube_metadata_fetched_at timestamptz NULL
karaoke_user_saved_songs   NEW  youtube_metadata_fetched_at timestamptz NULL

existing rows              NULL — provenance unknown, never backfilled from created_at
NULL means                 unknown, and fail-safe means NOT fresh
duration                   keeps its OWN provenance, not merged into the row's — it is
                           fetched independently, on a different path, at a different time
```

That last line is §C's instruction taken literally: duration is fetched separately from
title/channel/thumbnail, so forcing one timestamp across them would be a lie of convenience.

---

## §G — video ID, traced conservatively

```
active playback identity     PlayHandoff builds youtube.com/watch?v=…
request/queue relation       karaoke_requests.youtube_video_id
dedup / idempotency          the guest intent's logical key IS the video id
saved songs                  primary identity of a saved item
refresh lookup key           the ONLY way to re-fetch this item's metadata
external link                result cards and the watch handoff
```

**No exemption is invented.** The narrow conflict is stated plainly: the video id is simultaneously
(a) API Data subject to the lifecycle and (b) the sole key by which its own API Data can be
refreshed. Deleting it forecloses refresh permanently and converts a refreshable record into an
unrefreshable one.

BTY *can* preserve an internal independent identity — every row already has its own UUID primary
key, and the queue/idempotency relations could be re-pointed at it — so a design where the BTY fact
survives without the video id is architecturally possible. Whether the video id may be *retained*
beyond 30 days specifically to serve refresh is a policy question, not an engineering one.
**Flagged for rights review; not decided here.**

---

## §J — production census

```
PRODUCTION_CENSUS = HELD_ACCESS
```

Unchanged from R6-R1: `supabase projects list` shows only `bty-release-manager`; the karaoke
project `zycwaqignioawtqynopj` is absent, there is no `.env`, and `wrangler secret list` returns
names only by design. No secret was invented or recovered. The census SQL is ready and reads counts
and timestamps only.

Per §J this does **not** block the local architecture — but it does block the first live cleanup,
and it means the split between "rows with factual provenance" and "rows whose age cannot be known"
is currently unmeasurable in production.

---

## §I — quota shape, from the measured architecture

The duration path already batches: `youtube-duration.server.ts` collects misses and issues **one**
upstream call for many ids (`.in('video_id', ids)` on the cache read, then a batched lookup). A
refresh sweeper must reuse that shape rather than refreshing row-by-row. Exact endpoint quota
costs must come from official YouTube API documentation at implementation time; no number is
invented here, and no candidate count is available while §J is `HELD_ACCESS`.

---

## OUTPUT

```
API_DATA_CENSUS               COMPLETE
PROVENANCE_MODEL              PASS — one store already factual, two need a column, none inferred
LOCAL_RETENTION_MIGRATION     HELD — designed above, not written or applied
REFRESH_SWEEPER               HELD — not built
DRY_RUN                       HELD — not built
VIDEO_ID_LIFECYCLE            HELD — narrow conflict stated, flagged for rights review
HISTORICAL_DISPLAY            FOUNDER_DECISION_REQUIRED (below)
PRODUCTION_CENSUS             HELD_ACCESS
INITIAL_PRODUCTION_REMEDIATION NOT_READY
R6_R1B                        HELD
CONTENT_RIGHTS                HELD
```

### §F/§M — the product decision this reaches, stated not invented

When a saved song's or a past request's YouTube metadata expires and cannot be refreshed (video
deleted, made private, region-locked), the record must stop presenting stale API data as current.
Two truthful options, and the choice is a product one:

```
OPTION 1  CLEAR_API_FIELDS
          Keep the BTY fact, null the title/channel/thumbnail. My Songs and history then show a
          song the user can no longer identify by name. Maximally conservative; visibly lossy.

OPTION 2  MARK_UNAVAILABLE
          Keep the BTY fact, clear the API fields, and render an explicit historical state —
          "this song is no longer available on YouTube". Requires new user-facing copy and a
          state the UI does not have today, so it is a real product change, not a refactor.
```

Both preserve the BTY record. Neither deletes a request or a saved row. **Founder decision required
before either is built** — §M forbids inventing the wording or redesigning the surface unilaterally.
