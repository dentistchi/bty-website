#!/usr/bin/env bash
# ============================================================================
# FUNCTION BODY FORENSICS harness (Slice 3.2I-R5B1A.1-R2.7).
#
# The PostgreSQL-17 live audit proved two function bodies differ from the final
# repository authority:
#   public.bty_foundry_set_shared_review  (blocks 20260726 → D)
#   public.bty_foundry_submit_followup    (blocks 20260729 → D)
#
# This harness installs EACH candidate body in turn against identical faithful
# prerequisites + deterministic fixtures, records the SAME behavior matrix for
# every one, and prints the raw-prosrc SHA-256 of whatever it actually measured
# (so a run can never claim to have tested a body it did not install).
#
# It is a MEASUREMENT instrument, not migration authority. It applies nothing to
# and reads nothing from the live database.
#
# Candidate bodies come from two places:
#   1. the repository migrations (always available)
#   2. OPTIONAL forensic live-body fixtures at
#        docs/audit/forensics/live_body_<function>.sql
#      Absent → that variant reports ABSENT and the run still succeeds. Drop the
#      trusted export in and re-run to judge the live body on the same matrix.
#
# Usage:  PGPROOF_BINDIR=/opt/homebrew/opt/postgresql@17/bin bash scripts/migration-proof/body-forensics/run.sh
# ============================================================================
set -euo pipefail
if [ -n "${PGPROOF_BINDIR:-}" ]; then export PATH="$PGPROOF_BINDIR:$PATH"; fi
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"   # → bty-app
cd "$ROOT"
MP="$ROOT/scripts/migration-proof"; BF="$MP/body-forensics"; MIG="$ROOT/supabase/migrations"
FORENSIC_DIR="$ROOT/docs/audit/forensics"
BASE="${PGPROOF_DIR:-/tmp/bty-bodyforensics}"; DATA="$BASE/data"; SOCK="$BASE/sock"; PORT="${PGPROOF_PORT:-5481}"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER="postgres" PGDATABASE="proofdb"
cleanup() { pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$BASE"; }
trap cleanup EXIT
rm -rf "$BASE"; mkdir -p "$DATA" "$SOCK"
initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$BASE/pg.log" -w start >/dev/null
createdb -h "$SOCK" -p "$PORT" -U postgres proofdb
echo "PostgreSQL: $(psql -tAqX -c 'show server_version')"

# Faithful prerequisites + the schema the functions operate on (26 → 27 → 28).
psql -q -v ON_ERROR_STOP=1 -f "$MP/expected/bootstrap.sql"
for v in 20260726000000_foundry_shared_understanding_v1 20260727000000_personalize_today_from_reflections_v1 \
         20260728000000_foundry_participant_followups_v1; do
  psql -q -v ON_ERROR_STOP=1 -f "$MIG/$v.sql" >/dev/null
done

psql -q -v ON_ERROR_STOP=1 -f "$BF/prereq.sql" >/dev/null

BASELINE="$FORENSIC_DIR/body_forensics_baseline.tsv"
MEASURED="$BASE/measured.tsv"
: > "$MEASURED"
fails=0
digest_of() { psql -tAqX -c "select encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='bty_foundry_$1'"; }

# run_variant <function> <label> [install-sql]
run_variant() {
  local fn="$1" label="$2" install="${3:-}"
  if [ -n "$install" ]; then
    if [ ! -f "$install" ]; then
      printf '\n=== %s / %s: ABSENT (no %s) ===\n' "$fn" "$label" "$install"
      printf '    This body could not be measured. A canonical decision that depends on it is UNRESOLVED.\n'
      printf '%s\t%s\tABSENT\t0\tABSENT\n' "$fn" "$label" >> "$MEASURED"
      return 0
    fi
    psql -q -v ON_ERROR_STOP=1 -f "$install" >/dev/null
  fi
  local d; d=$(digest_of "$fn")
  printf '\n=== %s / %s ===\n    measured raw-prosrc SHA-256: %s\n' "$fn" "$label" "$d"
  psql -q -f "$BF/cases_$fn.sql" >/dev/null 2>&1 || true
  psql -tAqX -c "select case when ok then '    PASS ' else '    FAIL ' end || lpad(case_no::text,2) || '  ' || name ||
                        case when ok then '' else '   [observed: ' || coalesce(observed,'<null>') || ' | contract: ' || coalesce(expected,'<null>') || ']' end
                 from _bf_result where fn='$fn' order by case_no"
  local bad; bad=$(psql -tAqX -c "select count(*) from _bf_result where fn='$fn' and not ok")
  local tot; tot=$(psql -tAqX -c "select count(*) from _bf_result where fn='$fn'")
  local failing; failing=$(psql -tAqX -c "select coalesce(string_agg(case_no::text, ',' order by case_no), '-') from _bf_result where fn='$fn' and not ok")
  printf '    ---- %s/%s contract cases passed\n' "$((tot - bad))" "$tot"
  if [ "$bad" != "0" ]; then echo "    VERDICT: this body does NOT satisfy the deployed caller contract"; else
    echo "    VERDICT: this body satisfies the deployed caller contract"; fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$fn" "$label" "$d" "$tot" "$failing" >> "$MEASURED"
}

echo "############################################################"
echo "# bty_foundry_set_shared_review"
echo "############################################################"
run_variant set_shared_review "repo-20260726"                       # already installed by the chain
run_variant set_shared_review "live" "$FORENSIC_DIR/live_body_set_shared_review.sql"

echo ""
echo "############################################################"
echo "# bty_foundry_submit_followup"
echo "############################################################"
run_variant submit_followup "repo-20260728"                          # pre-hotfix body (42702 defect)
run_variant submit_followup "repo-20260729" "$MIG/20260729000000_foundry_submit_followup_ambiguity_fix_v1.sql"
run_variant submit_followup "live" "$FORENSIC_DIR/live_body_submit_followup.sql"

echo ""
echo "############################################################"
echo "# Baseline comparison"
echo "############################################################"
# The measured behavior of every variant is LOCKED against a checked-in baseline. A body variant
# whose digest or whose set of failing contract cases changes — including a `live` body arriving
# where there was previously none — fails the run and demands an explicit human decision. Findings
# are recorded, not silently tolerated; nothing here is "expected to fail" by omission.
if [ ! -f "$BASELINE" ]; then
  echo "NO BASELINE at $BASELINE — measured results:"; cat "$MEASURED"; fails=$((fails+1))
elif diff -u "$BASELINE" "$MEASURED" > "$BASE/diff.txt"; then
  echo "  PASS: every variant matches the recorded forensic baseline"
  awk -F'\t' '$5=="-"  {print "  · "$1"/"$2": satisfies the caller contract"}
              $5=="ABSENT"{print "  · "$1"/"$2": ABSENT — not measurable, decision UNRESOLVED"}
              $5!="-" && $5!="ABSENT" {print "  · "$1"/"$2": FAILS contract cases "$5}' "$MEASURED"
else
  echo "  FAIL: forensic behavior changed vs the recorded baseline"; cat "$BASE/diff.txt"; fails=$((fails+1))
fi

echo ""
echo "----"
if [ "$fails" -eq 0 ]; then echo "BODY_FORENSICS: PASS"; else echo "BODY_FORENSICS: FAIL ($fails)"; exit 1; fi
