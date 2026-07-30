#!/usr/bin/env bash
# Spin up a DISPOSABLE local PostgreSQL cluster with initdb (NO Docker, NO network, trust auth on a
# private unix socket), run the executable migration proofs, then destroy it. Nothing persists; the
# cluster never touches the live Supabase database. CI uses a postgres service instead (run.sh).
set -euo pipefail
# Cluster lives OUTSIDE the repo (short path — unix socket paths are length-limited; never pollutes
# the working tree). Override with PGPROOF_DIR if /tmp is unsuitable.
BASE="${PGPROOF_DIR:-/tmp/bty-pgproof}"
DATA="$BASE/data"; SOCK="$BASE/sock"; PORT="${PGPROOF_PORT:-5459}"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER="postgres" PGDATABASE="proofdb"

cleanup() { pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$BASE"; }
trap cleanup EXIT

rm -rf "$BASE"; mkdir -p "$DATA" "$SOCK"
initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$BASE/pg.log" -w start >/dev/null
createdb -h "$SOCK" -p "$PORT" -U postgres proofdb
bash "$(dirname "$0")/run.sh"
# Runtime-query attestation manages its own disposable cluster (needs the migrated schema).
bash "$(dirname "$0")/runtime-attest.sh"
