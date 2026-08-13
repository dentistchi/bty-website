#!/usr/bin/env bash
# BUILD 26P — reproducible Postgres authority harness for pass issuance actor attribution.
#
# Same architecture and reasoning as supabase/tests/b25/run.sh: a gate you have to remember to run
# by hand is not a gate. Builds an ISOLATED throwaway cluster, applies the pass migration chain in
# order, re-applies the BUILD 26P migration to prove idempotency, then runs the suite.
#
# Its own port and data directory (54361 / /tmp/pgk-b26p) so it can run alongside the b24/b25
# harnesses. It never touches the linked Supabase project, the local `supabase start` stack, or
# any port those use (54321/54322/54421/54422), nor the b24 (54331) or b25 (54341) harness ports.
#
#   bash supabase/tests/b26p/run.sh              # build, test, destroy
#   KEEP=1 bash supabase/tests/b26p/run.sh       # leave the cluster up for psql poking
set -euo pipefail

PORT="${PORT:-54361}"
PGDIR="${PGDIR:-/tmp/pgk-b26p}"
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
$PSQL -f "$HERE/00_prereq_b26p.sql"
# Every migration that has actually altered the PASS tables, so the RPC under test runs against
# the same grant shape production has: 26L's commerce columns (source_type / is_paid /
# apple_purchase_id) and 26M's carryover column and switch guard.
#
# BUILD 26E (20260809120000) is deliberately NOT applied. It is an account-deletion migration
# whose only relevance here is a column 26L reads (`purchase_owner_ref`) and a CHECK relaxation
# for refund-after-use, which no test below exercises; applying it wholesale would drag in
# workspaces, host sessions, identities, saved songs and guest handoffs — a stand-in schema far
# larger than this suite's subject, and every extra fixture is another thing that can diverge from
# production and quietly weaken the proof. The column it contributes is provided by the prereq.
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
  20260815120000_karaoke_pass_issuance_actor_attribution_v1.sql
do
  echo "  - $m"
  $PSQL -f "$MIG/$m"
done

# Re-running the BUILD 26P migration must be a no-op (ordered AND idempotent). This catches a
# non-idempotent constraint add or a drop/create ordering fault before it reaches production.
echo "# idempotency: re-applying 20260815120000"
$PSQL -f "$MIG/20260815120000_karaoke_pass_issuance_actor_attribution_v1.sql"
echo "# idempotency: and once more"
$PSQL -f "$MIG/20260815120000_karaoke_pass_issuance_actor_attribution_v1.sql"

if [ ! -d "$HERE/node_modules/pg" ]; then
  echo "# installing pg driver"
  ( cd "$HERE" && npm install --silent --no-save pg >/dev/null )
fi

PGPORT="$PORT" node "$HERE/purchase-ledger.pg.test.mjs"

# The regression half. BUILD 26P republishes the issuance RPC and constrains the audit table —
# both sit under the entitlement path — so the BUILD 20M lease and Final Song Grace suites are
# replayed against the post-26O schema. If attribution changed admission, metering, the lease
# union or the grace window, these fail here rather than on a device.
echo
echo "# BUILD 26O regression replay (issuance attribution)"
PGPORT="$PORT" node "$HERE/../b26o/issuance-attribution.pg.test.mjs"
echo
echo "# BUILD 20M regression replay (lease)"
PGPORT="$PORT" node "$HERE/../20m/lease.pg.test.mjs"
echo
echo "# BUILD 20M-R4 regression replay (Final Song Grace)"
PGPORT="$PORT" node "$HERE/../20m/grace.pg.test.mjs"
