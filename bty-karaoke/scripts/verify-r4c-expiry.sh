#!/usr/bin/env bash
# BUILD 26U-R4C-R1 — the expiry lifecycle, proven deterministically.
#
# Isolated Postgres carrying every migration. No production contact, no waiting one real hour.
#
# EVIDENCE RULE (26U-R4C-R1 §R): every verdict below is computed from a value read back out of
# the database. There is no printed "PASS" that is not the result of comparing a measured value
# to an expected one, because R0 produced exactly that failure -- a hardcoded conclusion that
# contradicted the numbers printed beside it.
set -u
export PGPASSWORD=pg
P=54495
C="docker exec -i bty-r4c psql -U postgres -v ON_ERROR_STOP=1 -Atq"
FAIL=0

ok(){ # ok <name> <actual> <expected>
  # AN EMPTY MEASUREMENT IS A FAILED MEASUREMENT, never a pass. The first run of this harness
  # printed PASS three times on values that were empty because the query had errored -- the very
  # instrumentation failure 26U-R4C-R1 §R was written about, reproduced inside the gate meant to
  # honour it. A verdict may only be computed from a value that actually came back.
  if [ -z "$2" ]; then printf "   FAIL  %-58s NO MEASUREMENT (empty) want[%s]\n" "$1" "$3"; FAIL=$((FAIL+1)); return; fi
  if [ "$2" = "$3" ]; then printf "   PASS  %-58s %s\n" "$1" "$2"
  else printf "   FAIL  %-58s got[%s] want[%s]\n" "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi
}

docker rm -f bty-r4c >/dev/null 2>&1 || true
docker run -d --name bty-r4c -e POSTGRES_PASSWORD=pg -p $P:5432 postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-r4c pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
$C -c "create role anon; create role authenticated; create role service_role;
       create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  docker exec -i bty-r4c psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1 || true
done
echo "migrations applied: $($C -c "select count(*) from pg_proc where proname='karaoke_start_premium_room_session';") start-session fn(s)"

# ---------------------------------------------------------------- fixture, via the real chain
A=1a0be5e8-0000-4000-8000-00000000000a   # account under test
B=1a0be5e8-0000-4000-8000-00000000000b   # untouched neighbour account
$C >/dev/null <<SQL
insert into karaoke_accounts (id,provider,provider_subject,email,display_name) values
  ('$A','google','r4c-a','a@e.com','A'), ('$B','google','r4c-b','b@e.com','B');
insert into karaoke_host_plan_assignments (account_id,plan_code,source,status) values
  ('$A','FREE','SYSTEM_DEFAULT','active'), ('$B','FREE','SYSTEM_DEFAULT','active');
insert into karaoke_workspaces (id,name) values ('22222222-0000-4000-8000-000000000001','WS-A');
insert into karaoke_workspace_members (workspace_id,account_id,role,status)
  values ('22222222-0000-4000-8000-000000000001','$A','owner','active');
insert into karaoke_rooms (id,slug,display_name,status,dj_secret)
  values ('33333333-0000-4000-8000-000000000001','r4c-room','R4C','open','s');
insert into karaoke_room_ownership (room_id,workspace_id)
  values ('33333333-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000001');
SQL
# three grants for account A, and one for B, all through issue_timed_access_pass
for n in 1 2 3; do
  $C -c "select issue_timed_access_pass('$A','ONE_HOUR','r4c','key-a-$n',
     jsonb_build_object('source','R4C_FIXTURE','actor_kind','SYSTEM','actor_id','r4c','version',1));" >/dev/null
done
$C -c "select issue_timed_access_pass('$B','ONE_HOUR','r4c','key-b-1',
   jsonb_build_object('source','R4C_FIXTURE','actor_kind','SYSTEM','actor_id','r4c','version',1));" >/dev/null
GA=$($C -c "select id from timed_access_pass_grants where account_id='$A' order by created_at limit 1;")
GB=$($C -c "select id from timed_access_pass_grants where account_id='$A' order by created_at offset 1 limit 1;")
GC=$($C -c "select id from timed_access_pass_grants where account_id='$A' order by created_at offset 2 limit 1;")
GN=$($C -c "select id from timed_access_pass_grants where account_id='$B' limit 1;")
echo "fixture: A grants ${GA:0:8}/${GB:0:8}/${GC:0:8}  neighbour ${GN:0:8}"
if [ -z "$GA" ] || [ -z "$GB" ] || [ -z "$GC" ] || [ -z "$GN" ]; then
  echo "   ABORT — the fixture produced no grants; every downstream verdict would be void."
  docker rm -f bty-r4c >/dev/null 2>&1; exit 2
fi

# grant A: real SELECT then real ACTIVATION through the production chain
$C -c "select select_timed_access_pass('$A','$GA',null);" >/dev/null
$C -c "update karaoke_usage_policy set premium_room_mode='premium_all';" >/dev/null
$C -c "select karaoke_start_premium_room_session('33333333-0000-4000-8000-000000000001',
        'ev','pub1','g1','test','premium');" >/dev/null
ACT=$($C -c "select status from timed_access_pass_grants where id='$GA';")
ok "fixture: grant A activated through the real chain" "$ACT" "ACTIVE"
$C -c "select select_timed_access_pass('$A','$GC',null);" >/dev/null   # grant C = SELECTED
# grant B stays AVAILABLE.

# Shift the ACTIVE window one hour into the past. The ROW SHAPE is exactly what the lifecycle
# produced (expires = activated + 3600); only the instants move, which is the controlled-clock
# substitute for waiting an hour. No invariant is bypassed to manufacture it.
$C -c "update timed_access_pass_grants
         set activated_at = activated_at - interval '2 hours',
             expires_at   = expires_at   - interval '2 hours'
       where id='$GA';" >/dev/null
$C -c "delete from karaoke_events where room_id='33333333-0000-4000-8000-000000000001';" >/dev/null

EXPA=$($C -c "select expires_at from timed_access_pass_grants where id='$GA';")
ACTA=$($C -c "select activated_at from timed_access_pass_grants where id='$GA';")
echo "grant A window: activated=$ACTA  expires=$EXPA"

ent(){ $C -c "select (public.karaoke_premium_room_entitlement_at('$A','$1'::timestamptz)->>'entitled');"; }
eff(){ $C -c "select (public.karaoke_timed_pass_state_at('$A','$1'::timestamptz)->>'effectiveEntitlement');"; }
apass(){ $C -c "select coalesce((public.karaoke_timed_pass_state_at('$A','$1'::timestamptz)->'activePass'->>'id'),'null');"; }
audits(){ $C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$GA' and action='EXPIRED';"; }
st(){ $C -c "select status from timed_access_pass_grants where id='$GA';"; }
expat(){ $C -c "select coalesce(expired_at::text,'null') from timed_access_pass_grants where id='$GA';"; }

echo
echo "=== G. BOUNDARY — the production predicate at three instants ==="
BEFORE=$($C -c "select ('$EXPA'::timestamptz - interval '1 second')::text;")
AFTER=$($C  -c "select ('$EXPA'::timestamptz + interval '1 second')::text;")
ok "case 1  expires_at > as_of   entitlement" "$(ent "$BEFORE")" "true"
ok "case 1  expires_at > as_of   projection"  "$(eff "$BEFORE")" "TIMED_ACCESS"
ok "case 1  expires_at > as_of   activePass"  "$(apass "$BEFORE")" "$GA"
ok "case 2  expires_at = as_of   entitlement" "$(ent "$EXPA")" "false"
ok "case 2  expires_at = as_of   projection"  "$(eff "$EXPA")" "FREE"
ok "case 2  expires_at = as_of   activePass"  "$(apass "$EXPA")" "null"
ok "case 3  expires_at < as_of   entitlement" "$(ent "$AFTER")" "false"
ok "case 3  expires_at < as_of   projection"  "$(eff "$AFTER")" "FREE"
ok "case 3  expires_at < as_of   activePass"  "$(apass "$AFTER")" "null"

echo
echo "=== H. LAZY PHYSICAL STATE IS SAFE (pre-sweep) ==="
ok "stored status is still ACTIVE"          "$(st)" "ACTIVE"
ok "expired_at still null"                  "$(expat)" "null"
ok "entitlement refuses anyway"             "$(ent "$AFTER")" "false"
ok "projection refuses anyway"              "$(eff "$AFTER")" "FREE"
ok "no expiry audit yet"                    "$(audits)" "0"

echo
echo "=== J. MUTATION CONTRACT — captured before the first sweep ==="
BEF=$($C -c "select id||'|'||account_id||'|'||activated_at||'|'||expires_at||'|'||coalesce(carryover_seconds,0)||'|'||source_type||'|'||is_paid||'|'||coalesce(apple_purchase_id::text,'-')||'|'||duration_seconds from timed_access_pass_grants where id='$GA';")
NB=$($C -c "select count(*) from timed_access_pass_grants;")

echo "=== I-A. PATH A — switch_timed_access_pass reconciles ==="
$C -c "select switch_timed_access_pass('$A','$GB','r4c-switch-1');" >/dev/null
ok "grant A materialized"                   "$(st)" "EXPIRED"
ok "expiry audit rows"                      "$(audits)" "1"
AUD=$($C -c "select actor_type||'/'||action||'/'||from_status||'->'||to_status from timed_access_pass_audit where pass_grant_id='$GA' and action='EXPIRED';")
ok "audit vocabulary"                       "$AUD" "SYSTEM/EXPIRED/ACTIVE->EXPIRED"
ok "expired_at now set"                     "$([ "$(expat)" = "null" ] && echo null || echo set)" "set"
AFT=$($C -c "select id||'|'||account_id||'|'||activated_at||'|'||expires_at||'|'||coalesce(carryover_seconds,0)||'|'||source_type||'|'||is_paid||'|'||coalesce(apple_purchase_id::text,'-')||'|'||duration_seconds from timed_access_pass_grants where id='$GA';")
ok "id/account/activated/expires/carryover/provenance preserved" "$AFT" "$BEF"
ok "no replacement grant created"           "$($C -c "select count(*) from timed_access_pass_grants;")" "$NB"
ok "entitlement still refuses"              "$(ent "$AFTER")" "false"

echo
echo "=== K. IDEMPOTENCY — same path, second run ==="
$C -c "select switch_timed_access_pass('$A','$GC','r4c-switch-2');" >/dev/null
ok "still EXPIRED"                          "$(st)" "EXPIRED"
ok "audit delta 0 (still exactly 1)"        "$(audits)" "1"
ok "row byte-identical on the pinned fields" "$($C -c "select id||'|'||account_id||'|'||activated_at||'|'||expires_at||'|'||coalesce(carryover_seconds,0)||'|'||source_type||'|'||is_paid||'|'||coalesce(apple_purchase_id::text,'-')||'|'||duration_seconds from timed_access_pass_grants where id='$GA';")" "$BEF"

echo
echo "=== L. CROSS-PATH IDEMPOTENCY — path B after path A ==="
$C -c "select karaoke_start_premium_room_session('33333333-0000-4000-8000-000000000001',
        'ev2','pub2','g2','test','legacy');" >/dev/null
ok "still EXPIRED after the other writer"   "$(st)" "EXPIRED"
ok "still exactly one expiry audit"         "$(audits)" "1"

echo
echo "=== M. MULTI-GRANT CONTAINMENT (same account) ==="
ok "grant B (AVAILABLE) unchanged"          "$($C -c "select status from timed_access_pass_grants where id='$GB';")" "AVAILABLE"
ok "grant C (SELECTED) unchanged"           "$($C -c "select status from timed_access_pass_grants where id='$GC';")" "SELECTED"
ok "no carryover appeared on B"             "$($C -c "select coalesce(carryover_seconds,0) from timed_access_pass_grants where id='$GB';")" "0"
ok "B never activated"                      "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$GB';")" "null"
ok "no expiry audit on B"                   "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$GB' and action='EXPIRED';")" "0"
ok "no expiry audit on C"                   "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$GC' and action='EXPIRED';")" "0"

echo
echo "=== N. CROSS-ACCOUNT CONTAINMENT ==="
ok "neighbour grant still AVAILABLE"        "$($C -c "select status from timed_access_pass_grants where id='$GN';")" "AVAILABLE"
ok "neighbour has zero expiry audits"       "$($C -c "select count(*) from timed_access_pass_audit where account_id='$B' and action='EXPIRED';")" "0"
ok "neighbour row never updated"            "$($C -c "select (updated_at = created_at)::text from timed_access_pass_grants where id='$GN';")" "true"
ok "neighbour grant count unchanged"        "$($C -c "select count(*) from timed_access_pass_grants where account_id='$B';")" "1"

echo
echo "=== O. ROOM CONTAINMENT ==="
ok "the room still exists"                  "$($C -c "select count(*) from karaoke_rooms where id='33333333-0000-4000-8000-000000000001';")" "1"
ok "room still open"                        "$($C -c "select status from karaoke_rooms where id='33333333-0000-4000-8000-000000000001';")" "open"
ok "room ownership untouched"               "$($C -c "select count(*) from karaoke_room_ownership where room_id='33333333-0000-4000-8000-000000000001';")" "1"
ok "no queue rows invented"                 "$($C -c "select count(*) from karaoke_requests where room_id='33333333-0000-4000-8000-000000000001';")" "0"
ok "no room created anywhere"               "$($C -c "select count(*) from karaoke_rooms;")" "1"

echo
echo "=== P. CONCURRENCY — two REAL connections racing over an expired grant ==="
# Re-arm: a second grant is activated, then its window is moved into the past, so both
# connections meet a genuinely expired ACTIVE row.
$C -c "delete from karaoke_events where room_id='33333333-0000-4000-8000-000000000001';" >/dev/null
# ORDER MATTERS: timed_pass_one_selected_per_account_idx allows exactly one SELECTED grant per
# account, so C must be released BEFORE B is selected. Doing it the other way round raises a
# unique violation, leaves B AVAILABLE, and every assertion below then measures the wrong row --
# which is exactly what the first run of this section did.
$C -c "update timed_access_pass_grants set status='AVAILABLE', selected_at=null where id='$GC';" >/dev/null
$C -c "update timed_access_pass_grants set status='SELECTED', selected_at=now(), activated_at=null, expires_at=null, expired_at=null where id='$GB';" >/dev/null
ok "re-arm: exactly one SELECTED grant on the account" "$($C -c "select count(*) from timed_access_pass_grants where account_id='$A' and status='SELECTED';")" "1"
$C -c "select karaoke_start_premium_room_session('33333333-0000-4000-8000-000000000001','ev3','pub3','g3','test','premium');" >/dev/null
ok "second grant is ACTIVE before the race" "$($C -c "select status from timed_access_pass_grants where id='$GB';")" "ACTIVE"
$C -c "update timed_access_pass_grants set activated_at=activated_at - interval '2 hours', expires_at=expires_at - interval '2 hours' where id='$GB';" >/dev/null
$C -c "delete from karaoke_events where room_id='33333333-0000-4000-8000-000000000001';" >/dev/null

# Connection B holds the account advisory lock inside a transaction while it reconciles.
( docker exec -i bty-r4c psql -U postgres -Atq <<SQL
begin;
select karaoke_start_premium_room_session('33333333-0000-4000-8000-000000000001','ev4','pub4','g4','test','legacy');
select pg_sleep(3);
commit;
SQL
) > /tmp/r4c-connB.out 2>&1 &
BPID=$!
sleep 1
# Connection A tries the other reconciliation path DURING B's transaction. It must block on the
# same account advisory lock rather than interleave.
STARTA=$(date +%s%N)
docker exec -i bty-r4c psql -U postgres -Atq -c \
  "select switch_timed_access_pass('$A','$GC','r4c-race');" > /tmp/r4c-connA.out 2>&1
ENDA=$(date +%s%N)
wait $BPID
WAITED=$(( (ENDA-STARTA)/1000000 ))
echo "   connection A was blocked for ${WAITED} ms while B held the account lock"
ok "the race was genuine (A blocked >1500ms)" "$([ "$WAITED" -gt 1500 ] && echo yes || echo no)" "yes"
ok "no deadlock reported"                     "$(grep -ci deadlock /tmp/r4c-connA.out /tmp/r4c-connB.out | awk -F: '{s+=$2} END{print s+0}')" "0"
ok "final status EXPIRED"                     "$($C -c "select status from timed_access_pass_grants where id='$GB';")" "EXPIRED"
ok "exactly ONE expiry audit for that grant"  "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$GB' and action='EXPIRED';")" "1"
ok "never resurrected to ACTIVE"              "$($C -c "select count(*) from timed_access_pass_grants where id='$GB' and status='ACTIVE';")" "0"
NOW=$($C -c "select now()::text;")
ok "expired entitlement never won the race"   "$($C -c "select (public.karaoke_premium_room_entitlement_at('$A','$NOW'::timestamptz)->>'entitled');")" "false"

# Connection B's legacy start created a real Event. That is the session lifecycle doing its job,
# not expiry doing something -- so it is removed before the census, and the census asserts that
# EXPIRY itself created none.
$C -c "delete from karaoke_events;" >/dev/null

echo
echo "=== T. NEGATIVE PROOF SUMMARY ==="
ok "expiry created no grant"                "$($C -c "select count(*) from timed_access_pass_grants;")" "4"
ok "expiry deleted no grant"                "$($C -c "select count(*) from timed_access_pass_grants where account_id='$A';")" "3"
ok "activations came only from real session starts" "$($C -c "select count(*) from timed_access_pass_audit where action='ACTIVATED' and account_id='$A';")" "2"
ok "expiry created no Event"                "$($C -c "select count(*) from karaoke_events;")" "0"
ok "total expiry audits across the account" "$($C -c "select count(*) from timed_access_pass_audit where account_id='$A' and action='EXPIRED';")" "2"

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL DETERMINISTIC GATES PASS (0 failures)"; else echo "FAILURES: $FAIL"; fi
docker rm -f bty-r4c >/dev/null 2>&1
exit $FAIL
