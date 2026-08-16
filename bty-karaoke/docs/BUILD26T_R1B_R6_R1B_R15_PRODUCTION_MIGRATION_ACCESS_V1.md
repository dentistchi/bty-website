# BUILD 26T-R1B-R6-R1B-R15 — Production Retention Migration: HELD on DDL Access

**PRODUCTION_MIGRATION_ACCESS = HELD.** No production write of any kind was performed.
Measured 2026-08-16 against ref `zycwaqignioawtqynopj`.

---

## §A — the exact migrations required (E1 excluded)

| # | Filename | SHA-256 | Purpose | Objects |
|---|---|---|---|---|
| 1 | `20260818120000_karaoke_youtube_metadata_provenance_v1.sql` | `cc125d50db94fa49439b28c3e92eed8d38677ef77ca68ca7a83b8d6a87861e4e` | **Provenance columns** | `add column youtube_metadata_fetched_at` on `karaoke_requests` + `karaoke_user_saved_songs`; 4 partial indexes |
| 2 | `20260819120000_karaoke_youtube_retention_unavailable_v1.sql` | `e770e9423dc948ba40e0c5576cd44abb90efcae5caabf590d55b50323b9c30d0` | **Unavailable state + nullable API fields + coherence CHECKs** | `add column youtube_metadata_unavailable_at` ×2; `drop not null` on `karaoke_requests.youtube_video_id`, `karaoke_user_saved_songs.video_id`, `karaoke_user_saved_songs.title_snapshot`; 4 CHECK constraints; 2 partial indexes; 3 `karaoke_retention_due_*` views |

**Order is load-bearing:** #2's coherence CHECK references `youtube_metadata_fetched_at`, so #1 must
apply first. Nothing else is included — `20260817120000` (E1) is deliberately excluded.

The four contract elements §A asks to distinguish map as: provenance columns → #1; unavailable
state, nullable API fields, and coherence CHECKs → #2.

---

## §B — object-level production prestate

Read via a single GET of PostgREST's OpenAPI description (no `information_schema` access needed,
no write verb anywhere).

| Object | Production state | Migration expects |
|---|---|---|
| `karaoke_requests.youtube_video_id` | present · **NOT NULL** | drops NOT NULL ✅ |
| `karaoke_requests.youtube_title` / `_channel_title` / `_thumbnail_url` | present · nullable | unchanged ✅ |
| `karaoke_requests.youtube_metadata_fetched_at` | **ABSENT** | adds ✅ |
| `karaoke_requests.youtube_metadata_unavailable_at` | **ABSENT** | adds ✅ |
| `karaoke_user_saved_songs.video_id` | present · **NOT NULL** | drops NOT NULL ✅ |
| `karaoke_user_saved_songs.title_snapshot` | present · **NOT NULL** | drops NOT NULL ✅ |
| `karaoke_user_saved_songs.artist_snapshot` / `thumbnail_url_snapshot` | present · nullable | unchanged ✅ |
| `karaoke_user_saved_songs.youtube_metadata_fetched_at` / `_unavailable_at` | **ABSENT** | adds ✅ |
| `karaoke_video_durations.resolved_at` | present · NOT NULL | untouched ✅ |
| `karaoke_retention_due_requests` / `_saved_songs` / `_durations` | **ABSENT** ×3 | creates ✅ |

**RETENTION_SCHEMA_PRESTATE = EXACT_EXPECTED.** Nothing is partially applied; there is no drift to
work around, and no statement would need to be skipped.

---

## §C — why this stopped

The migrations are ready and the prestate is exactly right. What is missing is **authority**, not
correctness.

| Path | Result |
|---|---|
| `supabase migration list --linked` | `403 — Your account does not have the necessary privileges to access this endpoint` |
| `supabase projects list` | production ref **not present** — the authenticated account cannot see this project |
| `SUPABASE_DB_PASSWORD` | absent from the shell environment and from `.dev.vars` |

The R14 PostgREST service-role credential proves **application-level** production authority. It
does **not** prove database-DDL authority, and §C forbids the obvious workarounds — so none was
attempted: no improvised SQL executor over PostgREST, no `exec_sql` RPC, no DDL through an
application endpoint, no hand-written migration-history row, no secret recovery.

That restraint is the point. Every one of those shortcuts would have applied the schema while
destroying the audit trail that makes a production migration reviewable — and a migration nobody
can later prove was applied through the sanctioned path is worse than one not yet applied.

### Exact missing capability

**Either** of the following unblocks R15 immediately:

1. `SUPABASE_DB_PASSWORD` for project `zycwaqignioawtqynopj` present in the authorized shell,
   enabling `supabase db push --linked` — the project's established, auditable mechanism; **or**
2. a Supabase access token whose account holds management-API privileges on that project (the
   current one cannot even list it).

Option 1 is the smaller grant and matches how this project's migrations have always been applied.

---

## §D–§G — not reached

No DDL was executed, so the post-migration readback and the production dry run cannot run. The dry
run in particular depends on the `karaoke_retention_due_*` views, which do not exist in production.

**No YouTube API call was made**, so no quota was spent. The §I contract (`videos.list` = 1 unit
per call, officially verified this slice) is recorded for the run that follows: 315–316 distinct
ids → `ceil(N/50)` = **7 calls** = **7 units**. If any endpoint other than `videos.list` is used,
its cost will be reported separately rather than assumed to be 1.

---

## §F — write accounting

| | |
|---|---|
| DDL statements executed | **0** |
| Migration-history writes | **0** |
| Customer rows updated | **0** |
| Customer rows deleted | **0** |
| Retention transitions | **0** |
| YouTube API calls | **0** |

`PRODUCTION_SCHEMA_WRITES = 0` · `PRODUCTION_REMEDIATION_WRITES = 0`

Both census scripts were grep-audited for `POST`/`PATCH`/`PUT`/`DELETE`/`/rpc/` before running;
both returned 0. Every production request in this slice was a GET.

---

## Privacy

Counts, column names and timestamps only. No titles, channels, thumbnails, video ids, account ids,
guest names or room slugs. No secret was printed, copied, or written to any file.
