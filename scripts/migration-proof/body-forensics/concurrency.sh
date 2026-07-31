#!/usr/bin/env bash
# ============================================================================
# REAL multi-connection concurrency matrix for the reconciled function bodies
# (Slice 3.2I-R5B1A.1-R2.8). Whatever body is currently installed is measured.
#
# Every case uses SEPARATE psql connections in real transactions — never a
# sequential simulation. Workers synchronise on a shared advisory lock so they
# reach the function together (the same pattern the one-shell proof already
# uses), then genuinely contend on the target row's FOR UPDATE lock.
#
# Invoked by run.sh with PG* env pointing at the disposable cluster. Prints one
# PASS/FAIL line per case and writes the failing case numbers to $CONC_OUT.
# ============================================================================
set -u
PSQL="${PSQL:-psql}"
BF="$(cd "$(dirname "$0")" && pwd)"
CONC_OUT="${CONC_OUT:-/tmp/bty-conc-failing}"
FU1='f1111111-1111-1111-1111-111111111111'
U1='d1111111-1111-1111-1111-111111111111'
U2='d2222222-2222-2222-2222-222222222222'
EV_A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
PART1='c1111111-1111-1111-1111-111111111111'
OWNER_A='11111111-1111-1111-1111-111111111111'
failing=""; n_total=0

rec() { # case_no  name  ok
  n_total=$((n_total+1))
  if [ "$3" = "1" ]; then echo "    PASS $(printf %2s "$1")  $2"
  else echo "    FAIL $(printf %2s "$1")  $2"; failing="${failing}${failing:+,}$1"; fi
}
reset() { $PSQL -q -v ON_ERROR_STOP=1 -f "$BF/fixtures.sql" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# submit_followup — N workers, each in its own transaction, own connection.
# Each writes "<result>|<status>|<outcome>|<rowcount>" so a two-row return is
# visible as a row count, not just a wrong result string.
# ---------------------------------------------------------------------------
race_submit() { # tmpdir  outcome-list (space separated, one per worker)
  local tmp="$1"; shift
  local i=0
  for oc in "$@"; do
    i=$((i+1))
    ( $PSQL -tAqX -v ON_ERROR_STOP=1 <<SQL > "$tmp/$i.out" 2>"$tmp/$i.err"
begin;
select pg_advisory_lock(4242);
select pg_advisory_unlock(4242);
select coalesce(string_agg(result||'|'||coalesce(status,'-')||'|'||coalesce(outcome,'-'), ';'),'<none>')||'#'||count(*)
  from public.bty_foundry_submit_followup('$FU1', '$U1', '$oc');
commit;
SQL
    ) &
  done
  wait
}

# Foreign-account worker used in the isolation case.
race_submit_mixed_owner() { # tmpdir
  local tmp="$1"
  ( $PSQL -tAqX <<SQL > "$tmp/own.out" 2>&1
begin;
select pg_advisory_lock(4242); select pg_advisory_unlock(4242);
select coalesce(string_agg(result||'|'||coalesce(outcome,'-'), ';'),'<none>')||'#'||count(*)
  from public.bty_foundry_submit_followup('$FU1', '$U1', 'NOT_YET');
commit;
SQL
  ) &
  ( $PSQL -tAqX <<SQL > "$tmp/foreign.out" 2>&1
begin;
select pg_advisory_lock(4242); select pg_advisory_unlock(4242);
select coalesce(string_agg(result||'|'||coalesce(outcome,'-'), ';'),'<none>')||'#'||count(*)
  from public.bty_foundry_submit_followup('$FU1', '$U2', 'APPLIED');
commit;
SQL
  ) &
  wait
}

count_of() { grep -c "$1" "$2"/*.out 2>/dev/null | awk -F: '{s+=$2} END{print s+0}'; }
audit_rows() { $PSQL -tAqX -c "select count(*) from public.foundry_participant_followup_audit where followup_id='$FU1'"; }
stored() { $PSQL -tAqX -c "select coalesce(outcome,'-')||'|'||status from public.foundry_participant_followups where id='$FU1'"; }
distinct_ts() { $PSQL -tAqX -c "select count(distinct responded_at) from public.foundry_participant_followups where id='$FU1'"; }

echo "  -- submit_followup concurrency --"

# C1 — 2 concurrent IDENTICAL submissions
tmp=$(mktemp -d); reset; race_submit "$tmp" NOT_YET NOT_YET
resp=$(count_of '^responded|' "$tmp"); unch=$(count_of '^unchanged|' "$tmp")
multi=$(cat "$tmp"/*.out | grep -E '#[0-9]+$' | grep -vc '#1$')
rec 101 "2 identical: exactly one responded"            "$([ "$resp" = 1 ] && echo 1 || echo 0)"
rec 102 "2 identical: exactly one unchanged"            "$([ "$unch" = 1 ] && echo 1 || echo 0)"
rec 103 "2 identical: exactly one audit row"            "$([ "$(audit_rows)" = 1 ] && echo 1 || echo 0)"
rec 104 "2 identical: stored NOT_YET/RESPONDED"         "$([ "$(stored)" = "NOT_YET|RESPONDED" ] && echo 1 || echo 0)"
rec 105 "2 identical: every connection got exactly 1 row" "$([ "$multi" = 0 ] && echo 1 || echo 0)"
rm -rf "$tmp"

# C2 — 2 concurrent CONFLICTING submissions
tmp=$(mktemp -d); reset; race_submit "$tmp" NOT_YET APPLIED
resp=$(count_of '^responded|' "$tmp"); alr=$(count_of '^already_responded|' "$tmp")
winner=$(cat "$tmp"/*.out | sed -n 's/^responded|RESPONDED|\([A-Z_]*\)#.*/\1/p')
st=$(stored); multi=$(cat "$tmp"/*.out | grep -E '#[0-9]+$' | grep -vc '#1$')
rec 106 "2 conflicting: exactly one responded"          "$([ "$resp" = 1 ] && echo 1 || echo 0)"
rec 107 "2 conflicting: exactly one already_responded"  "$([ "$alr" = 1 ] && echo 1 || echo 0)"
rec 108 "2 conflicting: exactly one audit row"          "$([ "$(audit_rows)" = 1 ] && echo 1 || echo 0)"
rec 109 "2 conflicting: FIRST committed outcome stands" "$([ "$st" = "$winner|RESPONDED" ] && echo 1 || echo 0)"
rec 110 "2 conflicting: every connection got exactly 1 row" "$([ "$multi" = 0 ] && echo 1 || echo 0)"
rm -rf "$tmp"

# C3 — 10 concurrent IDENTICAL submissions
tmp=$(mktemp -d); reset; race_submit "$tmp" NOT_YET NOT_YET NOT_YET NOT_YET NOT_YET NOT_YET NOT_YET NOT_YET NOT_YET NOT_YET
resp=$(count_of '^responded|' "$tmp"); unch=$(count_of '^unchanged|' "$tmp")
multi=$(cat "$tmp"/*.out | grep -E '#[0-9]+$' | grep -vc '#1$')
rec 111 "10 identical: exactly one responded"           "$([ "$resp" = 1 ] && echo 1 || echo 0)"
rec 112 "10 identical: nine unchanged"                  "$([ "$unch" = 9 ] && echo 1 || echo 0)"
rec 113 "10 identical: exactly one audit row"           "$([ "$(audit_rows)" = 1 ] && echo 1 || echo 0)"
rec 114 "10 identical: one distinct responded_at"       "$([ "$(distinct_ts)" = 1 ] && echo 1 || echo 0)"
rec 115 "10 identical: every connection got exactly 1 row" "$([ "$multi" = 0 ] && echo 1 || echo 0)"
rm -rf "$tmp"

# C4 — 10 concurrent MIXED outcomes
tmp=$(mktemp -d); reset; race_submit "$tmp" NOT_YET APPLIED BLOCKED PARTLY_APPLIED NOT_YET APPLIED BLOCKED PARTLY_APPLIED NOT_YET APPLIED
resp=$(count_of '^responded|' "$tmp")
other=$(( $(count_of '^already_responded|' "$tmp") + $(count_of '^unchanged|' "$tmp") ))
winner=$(cat "$tmp"/*.out | sed -n 's/^responded|RESPONDED|\([A-Z_]*\)#.*/\1/p')
st=$(stored); multi=$(cat "$tmp"/*.out | grep -E '#[0-9]+$' | grep -vc '#1$')
rec 116 "10 mixed: exactly one responded"               "$([ "$resp" = 1 ] && echo 1 || echo 0)"
rec 117 "10 mixed: nine refused (unchanged/already)"    "$([ "$other" = 9 ] && echo 1 || echo 0)"
rec 118 "10 mixed: exactly one audit row"               "$([ "$(audit_rows)" = 1 ] && echo 1 || echo 0)"
rec 119 "10 mixed: stored outcome == the winner's"      "$([ "$st" = "$winner|RESPONDED" ] && echo 1 || echo 0)"
rec 120 "10 mixed: every connection got exactly 1 row"  "$([ "$multi" = 0 ] && echo 1 || echo 0)"
rm -rf "$tmp"

# C5 — repeated call AFTER commit (separate transaction, not a retry inside one)
reset
$PSQL -tAqX -c "select * from public.bty_foundry_submit_followup('$FU1','$U1','NOT_YET')" >/dev/null
ts1=$($PSQL -tAqX -c "select responded_at from public.foundry_participant_followups where id='$FU1'")
after=$($PSQL -tAqX -c "select coalesce(string_agg(result,';'),'<none>')||'#'||count(*) from public.bty_foundry_submit_followup('$FU1','$U1','NOT_YET')")
ts2=$($PSQL -tAqX -c "select responded_at from public.foundry_participant_followups where id='$FU1'")
rec 121 "post-commit retry returns unchanged, one row"  "$([ "$after" = "unchanged#1" ] && echo 1 || echo 0)"
rec 122 "post-commit retry does not rewrite responded_at" "$([ "$ts1" = "$ts2" ] && echo 1 || echo 0)"
rec 123 "post-commit retry writes no audit row"         "$([ "$(audit_rows)" = 1 ] && echo 1 || echo 0)"

# C6 — ACCOUNT ISOLATION under contention
tmp=$(mktemp -d); reset; race_submit_mixed_owner "$tmp"
own=$(cat "$tmp/own.out"); foreign=$(cat "$tmp/foreign.out")
rec 124 "contended foreign account refused (not_owner, 1 row)" "$(echo "$foreign" | grep -q '^not_owner|-#1$' && echo 1 || echo 0)"
rec 125 "contended owner submission succeeded"          "$(echo "$own" | grep -q '^responded|NOT_YET#1$' && echo 1 || echo 0)"
rec 126 "contended foreign account mutated nothing"     "$([ "$(stored)" = "NOT_YET|RESPONDED" ] && echo 1 || echo 0)"
rec 127 "contended foreign account wrote no audit row"  "$([ "$(audit_rows)" = 1 ] && echo 1 || echo 0)"
rm -rf "$tmp"

# ---------------------------------------------------------------------------
# set_shared_review — concurrent Host reviews of the same participant row.
# ---------------------------------------------------------------------------
echo "  -- set_shared_review concurrency --"
race_review() { # tmpdir  status-list
  local tmp="$1"; shift; local i=0
  for st in "$@"; do
    i=$((i+1))
    ( $PSQL -tAqX <<SQL > "$tmp/$i.out" 2>&1
begin;
select pg_advisory_lock(4243); select pg_advisory_unlock(4243);
select coalesce(string_agg(result,';'),'<none>')||'#'||count(*)
  from public.bty_foundry_set_shared_review('$EV_A','$PART1','$OWNER_A','$st','shared note');
commit;
SQL
    ) &
  done
  wait
}
rev_audit() { $PSQL -tAqX -c "select count(*) from public.foundry_shared_review_audit"; }

# C7 — 2 concurrent IDENTICAL reviews
tmp=$(mktemp -d); reset; race_review "$tmp" ALIGNED ALIGNED
rv=$(count_of '^reviewed#' "$tmp"); un=$(count_of '^unchanged#' "$tmp")
multi=$(cat "$tmp"/*.out | grep -E '#[0-9]+$' | grep -vc '#1$')
rec 128 "2 identical reviews: exactly one reviewed"     "$([ "$rv" = 1 ] && echo 1 || echo 0)"
rec 129 "2 identical reviews: exactly one unchanged"    "$([ "$un" = 1 ] && echo 1 || echo 0)"
rec 130 "2 identical reviews: exactly one audit row"    "$([ "$(rev_audit)" = 1 ] && echo 1 || echo 0)"
rec 131 "2 identical reviews: every connection got 1 row" "$([ "$multi" = 0 ] && echo 1 || echo 0)"
rm -rf "$tmp"

# C8 — 2 concurrent CONFLICTING statuses. Both are legitimate distinct Host
#      intents; FOR UPDATE serialises them, so each is applied and audited once
#      and the audit chain records the real transition order.
tmp=$(mktemp -d); reset; race_review "$tmp" ALIGNED FOLLOW_UP_NEEDED
rv=$(count_of '^reviewed#' "$tmp")
final=$($PSQL -tAqX -c "select host_review_status from public.foundry_event_training_progress where id='e1111111-1111-1111-1111-111111111111'")
last=$($PSQL -tAqX -c "select new_status from public.foundry_shared_review_audit order by changed_at desc, new_status desc limit 1")
multi=$(cat "$tmp"/*.out | grep -E '#[0-9]+$' | grep -vc '#1$')
rec 132 "2 conflicting reviews: both applied serially"  "$([ "$rv" = 2 ] && echo 1 || echo 0)"
rec 133 "2 conflicting reviews: two audit rows"         "$([ "$(rev_audit)" = 2 ] && echo 1 || echo 0)"
rec 134 "2 conflicting reviews: audit tail matches stored status" "$([ "$final" = "$last" ] && echo 1 || echo 0)"
rec 135 "2 conflicting reviews: every connection got 1 row" "$([ "$multi" = 0 ] && echo 1 || echo 0)"
rm -rf "$tmp"

echo "${failing:--}" > "$CONC_OUT"
echo "  ---- $((n_total - $(echo "$failing" | tr ',' '\n' | grep -c '[0-9]'))) / $n_total concurrency cases passed"
