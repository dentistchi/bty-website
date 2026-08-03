#!/usr/bin/env bash
# BUILD 25 — reproducible Postgres authority harness.
#
# Same architecture as the BUILD 24 harness (supabase/tests/b24/run.sh) and for the same reason:
# a gate you have to remember to run by hand is not a gate. Builds an ISOLATED throwaway cluster,
# applies the migration chain in order, re-applies the BUILD 25 migration to prove idempotency,
# runs the BUILD 25 suite, then replays the BUILD 24 and BUILD 20M suites against the SAME schema
# so a change to the terminal writers cannot silently break metering, the lease union, or Final
# Song Grace.
#
# Its own port and data directory (54341 / /tmp/pgk-b25) so it can run alongside the b24 harness.
# It never touches the linked Supabase project, the local `supabase start` stack, or any port
# those use (54321/54322/54421/54422), and never the b24 harness port (54331).
#
#   bash supabase/tests/b25/run.sh              # build, test, destroy
#   KEEP=1 bash supabase/tests/b25/run.sh       # leave the cluster up for psql poking
set -euo pipefail

PORT="${PORT:-54341}"
PGDIR="${PGDIR:-/tmp/pgk-b25}"
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
# BUILD 25 is the first suite to call end_karaoke_event, which reaches beyond the metering subset.
$PSQL -f "$HERE/00_prereq_b25.sql"
for m in \
  20260726120000_karaoke_shadow_metering_b1.sql \
  20260728120000_karaoke_timed_access_passes.sql \
  20260803120000_karaoke_playback_lease_20m.sql \
  20260804120000_karaoke_lease_admission_response_v1.sql \
  20260805120000_karaoke_free_final_song_grace_v1.sql \
  20260806120000_karaoke_video_duration_raw_cache_v1.sql \
  20260807120000_karaoke_free_window_truth_v1.sql \
  20260808120000_karaoke_request_resolution_v1.sql
do
  echo "  - $m"
  $PSQL -f "$MIG/$m"
done

# Re-running the BUILD 25 migration must be a no-op (ordered AND idempotent). This is the check
# that catches a non-idempotent ALTER / constraint add before it reaches production.
echo "# idempotency: re-applying 20260808120000"
$PSQL -f "$MIG/20260808120000_karaoke_request_resolution_v1.sql"

if [ ! -d "$HERE/node_modules/pg" ]; then
  echo "# installing pg driver"
  ( cd "$HERE" && npm install --silent --no-save pg >/dev/null )
fi

echo
echo "# BUILD 25 request resolution"
PGPORT="$PORT" node "$HERE/resolution.pg.test.mjs"

# The regression half. BUILD 25 republishes karaoke_end_song_v2 and end_karaoke_event — both sit
# directly on the metering path — so the BUILD 24 and BUILD 20M suites are replayed against the
# post-BUILD-25 schema. If recording a reason changed admission, the lease union, the non-shrink
# invariant, the 04:00 window, or Final Song Grace, these fail here rather than on a device.
echo
echo "# BUILD 24 authority replay"
PGPORT="$PORT" node "$HERE/../b24/window-truth.pg.test.mjs"
echo
echo "# BUILD 20M regression replay (lease)"
PGPORT="$PORT" node "$HERE/../20m/lease.pg.test.mjs"
echo
echo "# BUILD 20M-R4 regression replay (Final Song Grace)"
PGPORT="$PORT" node "$HERE/../20m/grace.pg.test.mjs"
