#!/usr/bin/env bash
# BUILD 24 — reproducible Postgres authority harness.
#
# BUILD 20M shipped its integration test as README instructions, which is why the 04:00 ->
# midnight window regression survived: nobody re-ran it. This is the same idea as a script —
# it builds an ISOLATED throwaway cluster, applies the migration chain in order, runs the
# assertions, and tears the cluster down. It never touches the linked Supabase project, the
# local `supabase start` stack, or any port those use (54321/54322/54421/54422).
#
#   bash supabase/tests/b24/run.sh              # build, test, destroy
#   KEEP=1 bash supabase/tests/b24/run.sh       # leave the cluster up for psql poking
set -euo pipefail

PORT="${PORT:-54331}"
PGDIR="${PGDIR:-/tmp/pgk-b24}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations"
PSQL="psql -h 127.0.0.1 -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

cleanup() {
  if [ "${KEEP:-0}" != "1" ]; then
    pg_ctl -D "$PGDIR" stop -m immediate >/dev/null 2>&1 || true
    rm -rf "$PGDIR"
  else
    echo "KEEP=1 — cluster left running on port $PORT (pg_ctl -D $PGDIR stop to end it)"
  fi
}
trap cleanup EXIT

echo "# building isolated cluster on 127.0.0.1:$PORT"
pg_ctl -D "$PGDIR" stop -m immediate >/dev/null 2>&1 || true
rm -rf "$PGDIR"
initdb -D "$PGDIR" --auth=trust -U postgres >/dev/null
pg_ctl -D "$PGDIR" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$PGDIR/log" start >/dev/null
for _ in $(seq 1 30); do pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1 && break; sleep 0.3; done

echo "# applying the migration chain in order"
$PSQL -f "$HERE/../20m/00_prereq.sql"
for m in \
  20260726120000_karaoke_shadow_metering_b1.sql \
  20260728120000_karaoke_timed_access_passes.sql \
  20260803120000_karaoke_playback_lease_20m.sql \
  20260804120000_karaoke_lease_admission_response_v1.sql \
  20260805120000_karaoke_free_final_song_grace_v1.sql \
  20260806120000_karaoke_video_duration_raw_cache_v1.sql \
  20260807120000_karaoke_free_window_truth_v1.sql
do
  echo "  - $m"
  $PSQL -f "$MIG/$m"
done

# Re-running the BUILD 24 migration must be a no-op (ordered AND idempotent).
echo "# idempotency: re-applying 20260807120000"
$PSQL -f "$MIG/20260807120000_karaoke_free_window_truth_v1.sql"

if [ ! -d "$HERE/node_modules/pg" ]; then
  echo "# installing pg driver"
  ( cd "$HERE" && npm install --silent --no-save pg >/dev/null )
fi

echo
PGPORT="$PORT" node "$HERE/window-truth.pg.test.mjs"

# BUILD 24 replays the BUILD 20M suites against the SAME cluster, on the SAME schema. This is the
# G10 database half: the lease union, the non-shrink invariant, and Final Song Grace must all
# still hold after the window and entitlement changes. BUILD 20M shipped these as README
# instructions, which is exactly why the 04:00 -> midnight regression survived — nobody re-ran
# them. They are part of the runnable harness now.
echo
echo "# BUILD 20M regression replay (lease)"
PGPORT="$PORT" node "$HERE/../20m/lease.pg.test.mjs"
echo
echo "# BUILD 20M-R4 regression replay (Final Song Grace)"
PGPORT="$PORT" node "$HERE/../20m/grace.pg.test.mjs"
