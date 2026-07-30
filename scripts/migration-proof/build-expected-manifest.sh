#!/usr/bin/env bash
# Regenerate the WHOLE authoritative audit packet (Slice 3.2I-R5B1A.1-R2.4) from the shared query
# body + the historical migrations, on a disposable PostgreSQL (compile-on, no Docker, no live DB):
#   docs/audit/foundry_migration_expected_catalog.json       (expected manifest, exact ACL)
#   docs/audit/foundry_migration_security_statement_map.json  (resolved statement→effect map)
#   docs/audit/foundry_migration_provenance_readonly.sql      (generated self-authenticating live SQL)
# Byte-reproducible: same migrations + same body + same PG major → identical outputs + packetId.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # bty-app
MP="$ROOT/scripts/migration-proof"; MIG="$ROOT/supabase/migrations"
BASE="${PGPROOF_DIR:-/tmp/bty-expected}"; DATA="$BASE/data"; SOCK="$BASE/sock"; PORT="${PGPROOF_PORT:-5463}"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER="postgres" PGDATABASE="proofdb"
cleanup() { pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$BASE"; }
trap cleanup EXIT
rm -rf "$BASE"; mkdir -p "$DATA" "$SOCK"
initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$BASE/pg.log" -w start >/dev/null
createdb -h "$SOCK" -p "$PORT" -U postgres proofdb

psql -q -v ON_ERROR_STOP=1 -f "$MP/expected/bootstrap.sql"
for v in 20260726000000_foundry_shared_understanding_v1 20260727000000_personalize_today_from_reflections_v1 \
         20260728000000_foundry_participant_followups_v1 20260729000000_foundry_submit_followup_ambiguity_fix_v1; do
  echo "  apply $v" >&2
  psql -q -v ON_ERROR_STOP=1 -f "$MIG/$v.sql"
done

SVN=$(psql -tAq -c "show server_version_num")
FACTS=$(psql -tAq -f "$MP/audit-query-body.sql")   # the SHARED body → effects array

FACTS="$FACTS" SVN="$SVN" ROOT="$ROOT" node "$MP/expected/assemble.mjs"
echo "wrote manifest + statement map + generated audit SQL"
