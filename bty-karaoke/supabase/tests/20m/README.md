# BUILD 20M — playback-lease Postgres integration tests (isolated, NOT production)

Real PostgreSQL validation of `supabase/migrations/20260803120000_karaoke_playback_lease_20m.sql`
plus the forward-only response-completeness republish
`supabase/migrations/20260804120000_karaoke_lease_admission_response_v1.sql` (BUILD 20M-GLOBAL-CUTOVER-R1).
Not part of `npm test` (vitest globs `src/**` only) and not run in CI — it needs a live cluster.

## Run against an isolated local cluster
```
initdb -D /tmp/pgk --auth=trust -U postgres
pg_ctl -D /tmp/pgk -o "-p 54329 -c listen_addresses=127.0.0.1" start
PSQL="psql -h 127.0.0.1 -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1"
$PSQL -f supabase/tests/20m/00_prereq.sql                                   # roles + base tables
$PSQL -f supabase/migrations/20260726120000_karaoke_shadow_metering_b1.sql   # v1 metering
$PSQL -f supabase/migrations/20260728120000_karaoke_timed_access_passes.sql  # v1 pass
$PSQL -f supabase/migrations/20260803120000_karaoke_playback_lease_20m.sql   # v2 lease
$PSQL -f supabase/migrations/20260804120000_karaoke_lease_admission_response_v1.sql  # R1 response
( cd supabase/tests/20m && npm i pg && node lease.pg.test.mjs )              # 68 assertions
```
Covers: migration up, v1/v2 coexistence, grants/RLS/search_path, finish non-shrink,
EVENT_ENDED non-shrink, SUM(lease_seconds)+legacy fallback, same-request replay, exact FREE
boundary, 04:00 LA attribution + DST, ACTIVE/SELECTED pass full-video gates, duration
fail-closed, write-off/read-v2 rollback, two-Room same-account concurrency (separate connections).
