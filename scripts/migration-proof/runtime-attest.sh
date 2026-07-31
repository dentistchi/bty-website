#!/usr/bin/env bash
# Gate 3 — prove the generated audit SQL's actualRuntimeQueryDigest MEASURES the statement that
# actually ran: the honest statement matches its embedded expectedRuntimeQueryDigest, and any
# meaningful edit that RETAINS the embedded constants is detected (actual != expected). Self-
# contained disposable PostgreSQL (no Docker, no live DB).
set -euo pipefail
if [ -n "${PGPROOF_BINDIR:-}" ]; then export PATH="$PGPROOF_BINDIR:$PATH"; fi
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MP="$ROOT/scripts/migration-proof"; MIG="$ROOT/supabase/migrations"; SQLF="$ROOT/docs/audit/foundry_migration_provenance_readonly.sql"
BASE="/tmp/bty-runtime"; DATA="$BASE/data"; SOCK="$BASE/sock"; PORT=5477
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
  psql -q -v ON_ERROR_STOP=1 -f "$MIG/$v.sql"; done

field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(o['$1'])})"; }
run() { psql -tAq -f "$1"; }
fails=0

OUT=$(run "$SQLF"); ACT=$(echo "$OUT" | field actualRuntimeQueryDigest); EXP=$(echo "$OUT" | field expectedRuntimeQueryDigest)
[ "$ACT" = "$EXP" ] && echo "  PASS: honest statement → actual == expected" || { echo "  FAIL: honest mismatch"; fails=$((fails+1)); }

tamper() { # desc  sed-expr
  local f="$BASE/t.sql"; sed "$2" "$SQLF" > "$f"
  local a; a=$(run "$f" 2>/dev/null | field actualRuntimeQueryDigest || true)
  if [ "$a" != "$EXP" ]; then echo "  PASS: $1 → actual != expected (detected)"; else echo "  FAIL: $1 not detected"; fails=$((fails+1)); fi
}
# 2) change a catalog predicate (a controlled table name) but keep all embedded constants
tamper "changed catalog predicate" "s/foundry_participant_followups/foundry_participant_followup_audit/1"
# 3) remove an effect CTE reference (drop the tacl branch from the union)
tamper "removed an effect CTE from the union" "s/union all select \* from tacl//"
# 4) alter the ACL role filter
tamper "altered ACL role filter" "s/'anon','authenticated','service_role'/'anon','authenticated'/"
# 5) alter policy extraction
tamper "altered policy extraction column" "s/pp.polname/pp.polcmd/"
# 6) alter one object name in a column filter
tamper "altered an object name" "s/personalize_today_from_reflections/some_other_column/"
# 7) R2.6 — widen/narrow the DECLARED ACL authority scope (the boundary itself must be measured)
tamper "altered declared ACL authority scope" 's/"PUBLIC","anon","authenticated"/"PUBLIC","anon"/'
# 8) R2.6 — collapse the diagnostic environment-ACL channel into the compared tuple set
tamper "removed the environmentTuples channel" "s/'environmentTuples'/'tuples2'/"

echo "----"
if [ "$fails" -eq 0 ]; then echo "RUNTIME_ATTEST: PASS"; else echo "RUNTIME_ATTEST: FAIL ($fails)"; exit 1; fi
