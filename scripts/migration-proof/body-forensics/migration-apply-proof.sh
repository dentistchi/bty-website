#!/usr/bin/env bash
# ============================================================================
# APPLY / REAPPLY proof for the 20260804 reconciliation migration (R2.8).
#
# On a disposable PostgreSQL cluster:
#   1. replay the historical prerequisite chain 20260726 → 20260729
#   2. snapshot the FULL audited catalog (the canonical audit-query body)
#   3. apply 20260804, snapshot again
#   4. assert EXACTLY the two function-body effects changed — every other effect
#      (columns, tables, PK/FK/UNIQUE/CHECK, indexes, RLS, policies, ACL) is
#      byte-identical, so the migration touched nothing outside the two bodies
#   5. assert the resulting body digests equal the checked-in expected manifest
#   6. assert pg_proc structured properties and exact ACL tuples are unchanged
#   7. REAPPLY and assert the catalog is byte-identical to step 3 (idempotent)
#
# Applies nothing to and reads nothing from the live database.
# ============================================================================
set -euo pipefail
if [ -n "${PGPROOF_BINDIR:-}" ]; then export PATH="$PGPROOF_BINDIR:$PATH"; fi
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; cd "$ROOT"
MP="$ROOT/scripts/migration-proof"; MIG="$ROOT/supabase/migrations"
RECON="$MIG/20260804000000_foundry_function_body_reconciliation_v1.sql"
BASE="${PGPROOF_DIR:-/tmp/bty-applyproof}"; DATA="$BASE/data"; SOCK="$BASE/sock"; PORT="${PGPROOF_PORT:-5483}"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER="postgres" PGDATABASE="proofdb"
cleanup() { pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$BASE"; }
trap cleanup EXIT
rm -rf "$BASE"; mkdir -p "$DATA" "$SOCK"
initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$BASE/pg.log" -w start >/dev/null
createdb -h "$SOCK" -p "$PORT" -U postgres proofdb
echo "PostgreSQL: $(psql -tAqX -c 'show server_version')"

fails=0
chk() { if [ "$2" = "$3" ]; then echo "  PASS: $1"; else echo "  FAIL: $1"; echo "    expected [$2]"; echo "    actual   [$3]"; fails=$((fails+1)); fi }
snap() { psql -tAqX -f "$MP/audit-query-body.sql" > "$1"; }

psql -q -v ON_ERROR_STOP=1 -f "$MP/expected/bootstrap.sql"
for v in 20260726000000_foundry_shared_understanding_v1 20260727000000_personalize_today_from_reflections_v1 \
         20260728000000_foundry_participant_followups_v1 20260729000000_foundry_submit_followup_ambiguity_fix_v1; do
  psql -q -v ON_ERROR_STOP=1 -f "$MIG/$v.sql" >/dev/null
done
snap "$BASE/before.json"

echo "== apply 20260804 =="
psql -q -v ON_ERROR_STOP=1 -f "$RECON" >/dev/null
snap "$BASE/after.json"

# 4 — NOTHING outside the two function bodies changed. set_shared_review is expected to be
#     byte-IDENTICAL after the migration: the reconciled body is the 20260726 body reinstated
#     verbatim (live differed only in whitespace + one comment), so only submit_followup's body
#     actually moves. That asymmetry is itself the proof that the reinstatement is a no-op.
CHANGED=$(node -e '
const fs=require("fs");
const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8")), b=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const A=Object.fromEntries(a.map(e=>[e.effectId,JSON.stringify(e)])), B=Object.fromEntries(b.map(e=>[e.effectId,JSON.stringify(e)]));
const ids=[...new Set([...Object.keys(A),...Object.keys(B)])].sort();
console.log(ids.filter(i=>A[i]!==B[i]).map(i=>i.split("(")[0]).join(","));
' "$BASE/before.json" "$BASE/after.json")
chk "only submit_followup's body changed — no object outside the two functions touched" \
  "function:public.bty_foundry_submit_followup" "$CHANGED"

D_SSR=$(psql -tAqX -c "select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where pronamespace='public'::regnamespace and proname='bty_foundry_set_shared_review'")
chk "set_shared_review body is the 20260726 body, byte-identical (reinstatement is a no-op)" \
  "ea74856969177950a0c6e59fd1dc2fd766f4161b1289f360bc22d61980bc2af9" "$D_SSR"
D_SF=$(psql -tAqX -c "select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where pronamespace='public'::regnamespace and proname='bty_foundry_submit_followup'")
chk "submit_followup body moved 99c66ac7… → the reconciled body" \
  "4826ad0d0359719b67433a131c5595c1402067259f2294bcfb6da9f08ef47b59" "$D_SF"

# 5 — resulting digests equal the checked-in expected manifest.
EXPECTED=$(node -e '
const m=require(process.argv[1]);
console.log(m.effects.filter(e=>e.objectType==="function").map(e=>e.effectId.split("(")[0].replace("function:public.","")+"="+e.definitionDigest).sort().join(" "));
' "$ROOT/docs/audit/foundry_migration_expected_catalog.json")
ACTUAL=$(psql -tAqX -c "select string_agg(p.proname||'='||encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'), ' ' order by p.proname)
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
  ('bty_foundry_set_shared_review','bty_foundry_materialize_followup','bty_foundry_submit_followup','bty_foundry_get_my_followup')")
chk "post-apply body digests match the expected manifest" "$EXPECTED" "$ACTUAL"

# 6 — pg_proc structured properties + exact ACL tuples unchanged by the migration.
PROPS=$(node -e '
const fs=require("fs");
const f=p=>Object.fromEntries(JSON.parse(fs.readFileSync(p,"utf8")).filter(e=>["function","acl_function"].includes(e.objectType)).map(e=>[e.effectId,JSON.stringify(e.properties)]));
const a=f(process.argv[1]), b=f(process.argv[2]);
console.log(Object.keys(a).filter(k=>a[k]!==b[k]).join(",")||"none");
' "$BASE/before.json" "$BASE/after.json")
chk "pg_proc structured properties + function ACL tuples unchanged" "none" "$PROPS"

ACLDIFF=$(node -e '
const fs=require("fs");
const f=p=>Object.fromEntries(JSON.parse(fs.readFileSync(p,"utf8")).filter(e=>e.objectType.startsWith("acl_")).map(e=>[e.effectId,JSON.stringify(e.properties)]));
const a=f(process.argv[1]), b=f(process.argv[2]);
console.log(Object.keys(a).filter(k=>a[k]!==b[k]).join(",")||"none");
' "$BASE/before.json" "$BASE/after.json")
chk "every exact ACL tuple set unchanged (create-or-replace preserves grants)" "none" "$ACLDIFF"

# 7 — REAPPLY is byte-identical.
echo "== reapply 20260804 =="
psql -q -v ON_ERROR_STOP=1 -f "$RECON" >/dev/null
snap "$BASE/again.json"
chk "reapply produces a byte-identical catalog" "$(shasum -a 256 < "$BASE/after.json" | cut -d' ' -f1)" "$(shasum -a 256 < "$BASE/again.json" | cut -d' ' -f1)"

echo "----"
if [ "$fails" -eq 0 ]; then echo "MIGRATION_APPLY_PROOF: PASS"; else echo "MIGRATION_APPLY_PROOF: FAIL ($fails)"; exit 1; fi
