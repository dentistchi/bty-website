#!/usr/bin/env bash
# BUILD 26S-R1 — reproducible Postgres authority harness for atomic Apple paid fulfilment.
#
# Same architecture as supabase/tests/b26p/run.sh: a gate you have to remember to run by hand is
# not a gate. Builds an ISOLATED throwaway cluster, applies the pass + commerce migration chain in
# order, re-applies the BUILD 26S migration twice to prove idempotency, then runs the suite.
#
# Its own port and data directory (54371 / /tmp/pgk-b26s) so it can run alongside the other
# harnesses. It never touches the linked Supabase project, the local `supabase start` stack, or
# any port those use (54321/54322/54421/54422), nor b24 (54331), b25 (54341), b26o (54351) or
# b26p (54361).
#
# WHY A REAL CLUSTER AND NOT MOCKS. This build's central claims are concurrency claims: that two
# simultaneous fulfilments of one Apple transaction produce exactly ONE paid grant, and that a
# replay writes nothing. Neither can be established by sequential unit mocks — they are properties
# of PostgreSQL locking and unique indexes, so they have to be proven against PostgreSQL.
#
#   bash supabase/tests/b26s/run.sh              # build, test, destroy
#   KEEP=1 bash supabase/tests/b26s/run.sh       # leave the cluster up for psql poking
set -euo pipefail

PORT="${PORT:-54371}"
PGDIR="${PGDIR:-/tmp/pgk-b26s}"
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
# The b26p prereq is REUSED verbatim rather than copied: 26S runs against exactly the schema 26P
# was proven on, plus this build's one function. A second divergent fixture for the same tables is
# how two suites start disagreeing about what production looks like.
$PSQL -f "$HERE/../b26p/00_prereq_b26p.sql"
for m in \
  20260726120000_karaoke_shadow_metering_b1.sql \
  20260728120000_karaoke_timed_access_passes.sql \
  20260803120000_karaoke_playback_lease_20m.sql \
  20260804120000_karaoke_lease_admission_response_v1.sql \
  20260805120000_karaoke_free_final_song_grace_v1.sql \
  20260806120000_karaoke_video_duration_raw_cache_v1.sql \
  20260807120000_karaoke_free_window_truth_v1.sql \
  20260811120000_karaoke_commerce_ledger_foundation_v1.sql \
  20260812120000_karaoke_timed_pass_switch_v1.sql \
  20260813120000_karaoke_timed_pass_carryover_v1.sql \
  20260814120000_karaoke_timed_pass_switch_playing_guard_v1.sql \
  20260815120000_karaoke_pass_issuance_actor_attribution_v1.sql \
  20260816120000_karaoke_apple_paid_fulfilment_v1.sql
do
  echo "  - $m"
  $PSQL -f "$MIG/$m"
done

# Re-running the BUILD 26S migration must be a no-op (ordered AND idempotent). `create or replace
# function` is idempotent by construction, but re-applying proves the grants/revokes and the
# comment are too, and catches an accidental table alteration slipping in later.
echo "# idempotency: re-applying 20260816120000"
$PSQL -f "$MIG/20260816120000_karaoke_apple_paid_fulfilment_v1.sql"
echo "# idempotency: and once more"
$PSQL -f "$MIG/20260816120000_karaoke_apple_paid_fulfilment_v1.sql"

if [ ! -d "$HERE/node_modules/pg" ]; then
  echo "# installing pg driver"
  ( cd "$HERE" && npm install --silent --no-save pg >/dev/null )
fi

PGPORT="$PORT" node "$HERE/fulfilment.pg.test.mjs"

# The regression half. BUILD 26S adds an operation that writes to the SAME grant and audit tables
# the pass lifecycle owns, so the suites that guard that lifecycle are replayed against the
# post-26S schema. If fulfilment disturbed issuance attribution, admission, metering, the lease
# union or the grace window, these fail here rather than in production.
echo
echo "# BUILD 26P regression replay (Apple purchase ledger)"
PGPORT="$PORT" node "$HERE/../b26p/purchase-ledger.pg.test.mjs"
echo
echo "# BUILD 26O regression replay (issuance attribution)"
PGPORT="$PORT" node "$HERE/../b26o/issuance-attribution.pg.test.mjs"
echo
echo "# BUILD 20M regression replay (lease)"
PGPORT="$PORT" node "$HERE/../20m/lease.pg.test.mjs"
echo
echo "# BUILD 20M-R4 regression replay (Final Song Grace)"
PGPORT="$PORT" node "$HERE/../20m/grace.pg.test.mjs"
