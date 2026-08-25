#!/usr/bin/env bash
# BUILD 26U-R4D-R1 — post-expiry re-entry and next-grant continuity.
#
# Isolated Postgres, every migration, no production contact, no waiting an hour.
#
# EVIDENCE RULE (carried from 26U-R4C-R1 §R / R4D §AA): an empty or errored measurement is a
# FAILURE, never a pass, and the fixture aborts rather than emitting void assertions. Every
# verdict below is computed by comparing a value read back out of the database to an expectation.
set -u
export PGPASSWORD=pg
P=54496
C="docker exec -i bty-r4d psql -U postgres -v ON_ERROR_STOP=1 -Atq"
FAIL=0
ok(){
  if [ -z "$2" ]; then printf "   FAIL  %-60s NO MEASUREMENT want[%s]\n" "$1" "$3"; FAIL=$((FAIL+1)); return; fi
  if [ "$2" = "$3" ]; then printf "   PASS  %-60s %s\n" "$1" "$2"
  else printf "   FAIL  %-60s got[%s] want[%s]\n" "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi
}
need(){ # fixture prerequisite: abort the whole run rather than measure a broken world
  if [ -z "$2" ] || [ "$2" != "$3" ]; then
    printf "   ABORT fixture prerequisite failed: %s got[%s] want[%s]\n" "$1" "$2" "$3"
    docker rm -f bty-r4d >/dev/null 2>&1; exit 2
  fi
  printf "   ok    fixture: %-54s %s\n" "$1" "$2"
}

docker rm -f bty-r4d >/dev/null 2>&1 || true
docker run -d --name bty-r4d -e POSTGRES_PASSWORD=pg -p $P:5432 postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-r4d pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
$C -c "create role anon; create role authenticated; create role service_role;
       create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  docker exec -i bty-r4d psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1 || true
done

ACC=1a0be5e8-0000-4000-8000-0000000000aa      # the Host under test
DACC=1a0be5e8-0000-4000-8000-0000000000dd     # unrelated account D
ROOM=33333333-0000-4000-8000-0000000000a1
$C >/dev/null <<SQL
insert into karaoke_accounts (id,provider,provider_subject,email,display_name) values
  ('$ACC','google','r4d-a','a@e.com','A'), ('$DACC','google','r4d-d','d@e.com','D');
insert into karaoke_host_plan_assignments (account_id,plan_code,source,status) values
  ('$ACC','FREE','SYSTEM_DEFAULT','active'), ('$DACC','FREE','SYSTEM_DEFAULT','active');
insert into karaoke_workspaces (id,name) values ('22222222-0000-4000-8000-0000000000a1','WS');
insert into karaoke_workspace_members (workspace_id,account_id,role,status)
  values ('22222222-0000-4000-8000-0000000000a1','$ACC','owner','active');
insert into karaoke_rooms (id,slug,display_name,status,dj_secret)
  values ('$ROOM','r4d-room','R4D','open','s');
insert into karaoke_room_ownership (room_id,workspace_id)
  values ('$ROOM','22222222-0000-4000-8000-0000000000a1');
update karaoke_usage_policy set premium_room_mode='premium_all';
SQL
iss(){ $C -c "select issue_timed_access_pass('$1','ONE_HOUR','r4d','$2',
   jsonb_build_object('source','R4D_FIXTURE','actor_kind','SYSTEM','actor_id','r4d','version',1));" >/dev/null; }
iss "$ACC" k-a; iss "$ACC" k-b; iss "$ACC" k-c; iss "$DACC" k-d
A=$($C -c "select id from timed_access_pass_grants where account_id='$ACC' order by created_at limit 1;")
B=$($C -c "select id from timed_access_pass_grants where account_id='$ACC' order by created_at offset 1 limit 1;")
CG=$($C -c "select id from timed_access_pass_grants where account_id='$ACC' order by created_at offset 2 limit 1;")
D=$($C -c "select id from timed_access_pass_grants where account_id='$DACC' limit 1;")
need "three grants for the Host + one for D" "$($C -c "select count(*) from timed_access_pass_grants;")" "4"

# A through the REAL chain: select -> Start New Room -> ACTIVE
$C -c "select select_timed_access_pass('$ACC','$A',null);" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','evA','pubA','gA','test','premium');" >/dev/null
need "A activated through the real chain" "$($C -c "select status from timed_access_pass_grants where id='$A';")" "ACTIVE"
# Move A's window two hours into the past. Row shape is exactly what the lifecycle produced.
$C -c "update timed_access_pass_grants set activated_at=activated_at-interval '2 hours',
        expires_at=expires_at-interval '2 hours' where id='$A';" >/dev/null
# THE AUDIT LOG CANNOT BE SHIFTED, and must not be. `timed_access_pass_audit_immutable()` is a
# trigger that refuses UPDATE outright, so the fixture moves the grant WINDOW only and audit
# timestamps stay true wall-clock. An earlier draft of this harness tried to shift them, had the
# UPDATE silently refused behind >/dev/null, and then asserted an ordering against a mixture of
# shifted and unshifted values. The immutability is asserted below instead of worked around.
$C -c "delete from karaoke_events where room_id='$ROOM';" >/dev/null

st(){ $C -c "select status from timed_access_pass_grants where id='$1';"; }
aud(){ $C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$1' and action='$2';"; }
ent(){ $C -c "select (public.karaoke_premium_room_entitlement_at('$ACC',now())->>'entitled');"; }
eff(){ $C -c "select (public.karaoke_timed_pass_state_at('$ACC',now())->>'effectiveEntitlement');"; }
apass(){ $C -c "select coalesce((public.karaoke_timed_pass_state_at('$ACC',now())->'activePass'->>'id'),'null');"; }
ready(){ $C -c "select count(*) from timed_access_pass_grants where account_id='$ACC' and status='AVAILABLE';"; }
snap(){ $C -c "select id||'|'||account_id||'|'||status||'|'||coalesce(activated_at::text,'-')||'|'||coalesce(expires_at::text,'-')||'|'||coalesce(carryover_seconds,0)||'|'||source_type||'|'||is_paid||'|'||coalesce(apple_purchase_id::text,'-')||'|'||duration_seconds from timed_access_pass_grants where id='$1';"; }

echo
echo "=== E/F. BASELINE — past A's cutoff, before ANY Host action ==="
ok "A stored status"                       "$(st $A)" "ACTIVE"
ok "A expires_at is in the past"           "$($C -c "select (expires_at < now())::text from timed_access_pass_grants where id='$A';")" "true"
ok "A expired_at still null"               "$($C -c "select coalesce(expired_at::text,'null') from timed_access_pass_grants where id='$A';")" "null"
ok "entitlement false"                     "$(ent)" "false"
ok "projection FREE"                       "$(eff)" "FREE"
ok "activePass null"                       "$(apass)" "null"
ok "B still AVAILABLE (expiry spent nothing)" "$(st $B)" "AVAILABLE"
ok "C still AVAILABLE"                     "$(st $CG)" "AVAILABLE"
ok "B never selected"                      "$(aud $B SELECTED)" "0"
ok "B never activated"                     "$(aud $B ACTIVATED)" "0"
ok "B activated_at null"                   "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$B';")" "null"
ok "A has no EXPIRED audit yet"            "$(aud $A EXPIRED)" "0"
ok "ready-to-use count (AVAILABLE only)"   "$(ready)" "2"
CSNAP=$(snap $CG); DSNAP=$(snap $D)
DAUD=$($C -c "select count(*) from timed_access_pass_audit where account_id='$DACC';")

echo
echo "=== I. A IS TERMINAL FOR SELECTION while stale ACTIVE ==="
ok "selecting stale-ACTIVE A is refused"   "$($C -c "select (select_timed_access_pass('$ACC','$A',null)->>'error');")" "not_selectable"
ok "…and A did not change"                 "$(st $A)" "ACTIVE"

echo
echo "=== G/H. SELECT B while A is stale ACTIVE ==="
ok "select B succeeded"                    "$($C -c "select (select_timed_access_pass('$ACC','$B','r4d-sel')->>'status');")" "SELECTED"
ok "B is SELECTED"                         "$(st $B)" "SELECTED"
ok "A UNCHANGED — selection does not sweep" "$(st $A)" "ACTIVE"
ok "A expired_at still null"               "$($C -c "select coalesce(expired_at::text,'null') from timed_access_pass_grants where id='$A';")" "null"
ok "A still has no EXPIRED audit"          "$(aud $A EXPIRED)" "0"
ok "exactly one SELECTED audit for B"      "$(aud $B SELECTED)" "1"
ok "B SELECTED audit vocabulary"           "$($C -c "select actor_type||'/'||from_status||'->'||to_status from timed_access_pass_audit where pass_grant_id='$B' and action='SELECTED';")" "HOST/AVAILABLE->SELECTED"
ok "SELECTION DID NOT START B's CLOCK"     "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$B';")" "null"
ok "B expires_at still null"               "$($C -c "select coalesce(expires_at::text,'null') from timed_access_pass_grants where id='$B';")" "null"
ok "B has no activation audit"             "$(aud $B ACTIVATED)" "0"
ok "entitlement still false"               "$(ent)" "false"
ok "C untouched"                           "$(snap $CG)" "$CSNAP"
ok "ready count after selecting B"         "$(ready)" "1"

echo
echo "=== T. CLOSE / REOPEN — the server projection is the reload path ==="
ok "reopen: A still stale ACTIVE"          "$(st $A)" "ACTIVE"
ok "reopen: entitlement still false"       "$(ent)" "false"
ok "reopen: B still SELECTED"              "$(st $B)" "SELECTED"
ok "reopen: selectedPass resolves to B"    "$($C -c "select (public.karaoke_timed_pass_state_at('$ACC',now())->'selectedPass'->>'id');")" "$B"
ok "reopen: no automatic activation"       "$(aud $B ACTIVATED)" "0"
ok "reopen: ready count"                   "$(ready)" "1"

echo
echo "=== J/K/L. START NEW ROOM — the handoff, one transaction ==="
BEFORE_EV=$($C -c "select count(*) from karaoke_events;")
OUT=$($C -c "select karaoke_start_premium_room_session('$ROOM','evB','pubB','gB','test','premium');")
ok "session started with source ACTIVATED_PASS" "$(echo "$OUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('source',''))")" "ACTIVATED_PASS"
ok "A materialized EXPIRED"                "$(st $A)" "EXPIRED"
ok "B is ACTIVE"                           "$(st $B)" "ACTIVE"
ok "C still AVAILABLE"                     "$(st $CG)" "AVAILABLE"
ok "exactly one ACTIVE grant for account"  "$($C -c "select count(*) from timed_access_pass_grants where account_id='$ACC' and status='ACTIVE';")" "1"
ok "zero SELECTED grants for account"      "$($C -c "select count(*) from timed_access_pass_grants where account_id='$ACC' and status='SELECTED';")" "0"
ok "exactly one EXPIRED audit for A"       "$(aud $A EXPIRED)" "1"
ok "exactly one ACTIVATED audit for B"     "$(aud $B ACTIVATED)" "1"
ok "ready count after activating B"        "$(ready)" "1"

echo
echo "=== L. B's CLOCK IS ITS OWN ==="
TB=$($C -c "select activated_at from timed_access_pass_grants where id='$B';")
ok "B expires_at = activated_at + duration + carryover" \
   "$($C -c "select (expires_at = activated_at + make_interval(secs => duration_seconds + coalesce(carryover_seconds,0)))::text from timed_access_pass_grants where id='$B';")" "true"
ok "B window is exactly 3600s"             "$($C -c "select extract(epoch from (expires_at - activated_at))::int from timed_access_pass_grants where id='$B';")" "3600"
ok "B activated AFTER A expired (fresh instant)" \
   "$($C -c "select (b.activated_at > a.expires_at)::text from timed_access_pass_grants a, timed_access_pass_grants b where a.id='$A' and b.id='$B';")" "true"
ok "B carryover is zero — A contributed nothing" "$($C -c "select coalesce(carryover_seconds,0) from timed_access_pass_grants where id='$B';")" "0"
ok "A's own window unchanged by the handoff" \
   "$($C -c "select extract(epoch from (expires_at - activated_at))::int from timed_access_pass_grants where id='$A';")" "3600"

echo
echo "=== N/X. A CANNOT RESURRECT ==="
ok "EXPIRED A is not selectable"           "$($C -c "select (select_timed_access_pass('$ACC','$A',null)->>'error');")" "not_selectable"
ok "A still EXPIRED"                       "$(st $A)" "EXPIRED"
ok "A has exactly ONE activation audit ever" "$(aud $A ACTIVATED)" "1"
ok "A never got a second EXPIRED audit"    "$(aud $A EXPIRED)" "1"
ok "one-activation index is present"       "$($C -c "select count(*) from pg_indexes where indexname='timed_pass_audit_one_activation_idx';")" "1"
ok "one-ACTIVE index is present"           "$($C -c "select count(*) from pg_indexes where indexname='timed_pass_one_active_per_account_idx';")" "1"

echo
echo "=== O/AC. AUDIT CHAIN — actual timestamps ==="
$C -c "select 'A '||action||' '||coalesce(from_status,'-')||'->'||coalesce(to_status,'-')||' '||created_at
        from timed_access_pass_audit where pass_grant_id='$A' order by created_at;" | sed 's/^/   /'
$C -c "select 'A expires_at (logical cutoff)  '||expires_at from timed_access_pass_grants where id='$A';" | sed 's/^/   /'
$C -c "select 'B '||action||' '||coalesce(from_status,'-')||'->'||coalesce(to_status,'-')||' '||created_at
        from timed_access_pass_audit where pass_grant_id='$B' order by created_at;" | sed 's/^/   /'
# The product invariant §O is about: a grant's own window is coherent, activation before expiry.
# Asserted on the grant's self-consistent pair, because the fixture moved the window while the
# audit (correctly) records real wall-clock and cannot be moved.
ok "A.activated_at < A.expires_at (the grant's own window)" "$($C -c "select (activated_at < expires_at)::text from timed_access_pass_grants where id='$A';")" "true"
# postgres reports a refusal across several lines (ERROR plus CONTEXT), so the assertion is
# "at least one refusal line", not an exact line count. Counting lines was measuring psql's
# formatting rather than the database's answer.
ok "audit log is IMMUTABLE — an UPDATE is refused" "$(docker exec -i bty-r4d psql -U postgres -Atq -c "update timed_access_pass_audit set created_at=created_at-interval '1 hour' where pass_grant_id='$A';" 2>&1 | grep -qiE "immutable|append-only|cannot|ERROR" && echo refused || echo ALLOWED)" "refused"
ok "…and no audit row was altered by that attempt" "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$A' and action='ACTIVATED' and created_at > now() - interval '10 minutes';")" "1"
ok "A.expires_at < A.EXPIRED audit (lazy materialization)" "$($C -c "select (g.expires_at < x.created_at)::text from timed_access_pass_audit x, timed_access_pass_grants g where x.pass_grant_id='$A' and x.action='EXPIRED' and g.id='$A';")" "true"
ok "B.SELECTED < B.ACTIVATED" "$($C -c "select (s.created_at < a.created_at)::text from timed_access_pass_audit s, timed_access_pass_audit a where s.pass_grant_id='$B' and s.action='SELECTED' and a.pass_grant_id='$B' and a.action='ACTIVATED';")" "true"
echo "   --- §P the cross-grant ordering that MATTERS ---"
ok "B.SELECTED precedes A.EXPIRED (allowed, selection does not sweep)" "$($C -c "select (s.created_at < e.created_at)::text from timed_access_pass_audit s, timed_access_pass_audit e where s.pass_grant_id='$B' and s.action='SELECTED' and e.pass_grant_id='$A' and e.action='EXPIRED';")" "true"
ok "A.EXPIRED precedes B.ACTIVATED (the safety boundary)" "$($C -c "select (e.created_at <= a.created_at)::text from timed_access_pass_audit e, timed_access_pass_audit a where e.pass_grant_id='$A' and e.action='EXPIRED' and a.pass_grant_id='$B' and a.action='ACTIVATED';")" "true"

echo
echo "=== Q/R. CONTAINMENT ==="
ok "C byte-identical across the whole handoff" "$(snap $CG)" "$CSNAP"
ok "C has zero audit rows beyond issuance"     "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$CG' and action<>'ISSUED';")" "0"
ok "account D grant byte-identical"            "$(snap $D)" "$DSNAP"
ok "account D audit count unchanged"           "$($C -c "select count(*) from timed_access_pass_audit where account_id='$DACC';")" "$DAUD"
ok "account D has no rooms"                    "$($C -c "select count(*) from karaoke_room_ownership o join karaoke_workspace_members m on m.workspace_id=o.workspace_id where m.account_id='$DACC';")" "0"

echo
echo "=== U. ROOM BOUNDARY ==="
ok "exactly one Event exists (the new one)"    "$($C -c "select count(*) from karaoke_events;")" "1"
ok "the Event belongs to the R4D room"         "$($C -c "select count(*) from karaoke_events where room_id='$ROOM';")" "1"
ok "the room still exists and is open"         "$($C -c "select status from karaoke_rooms where id='$ROOM';")" "open"
ok "no second room was created"                "$($C -c "select count(*) from karaoke_rooms;")" "1"
ok "no queue rows invented"                    "$($C -c "select count(*) from karaoke_requests;")" "0"
ok "the new session is bound to B, not A"      "$($C -c "select (public.karaoke_premium_room_entitlement_at('$ACC',now())->>'passGrantId');")" "$B"

echo
echo "=== Y. RETRY — the session op again while B is ACTIVE ==="
R2=$($C -c "select karaoke_start_premium_room_session('$ROOM','evB2','pubB2','gB2','test','premium');")
ok "retry reports already_live"                "$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('outcome',''))")" "already_live"
ok "retry created no second Event"             "$($C -c "select count(*) from karaoke_events;")" "1"
ok "retry created no second activation audit"  "$(aud $B ACTIVATED)" "1"
ok "retry created no second expiry audit"      "$(aud $A EXPIRED)" "1"
ok "retry created no grant"                    "$($C -c "select count(*) from timed_access_pass_grants;")" "4"
ok "B activated_at unchanged by the retry"     "$($C -c "select activated_at from timed_access_pass_grants where id='$B';")" "$TB"

echo
echo "=== V. TWO-CONNECTION CONCURRENCY ==="
# Re-arm a clean race: C becomes the next candidate while B is the live ACTIVE grant, and B's
# window is pushed into the past so the session path has a genuine sweep to perform.
$C -c "delete from karaoke_events;" >/dev/null
$C -c "update timed_access_pass_grants set activated_at=activated_at-interval '2 hours',
        expires_at=expires_at-interval '2 hours' where id='$B';" >/dev/null
need "B is a stale expired ACTIVE before the race" "$(st $B)" "ACTIVE"
# MEASURED FINDING (R4D-R1): the two paths do NOT share an advisory lock.
#   select_/switch_timed_access_pass  ->  hashtext('timed_pass:' || account)
#   karaoke_start_premium_room_session ->  hashtextextended('acct:' || account, 0)
# R0 listed both locks without comparing their keys, and this harness first asserted that
# connection 1 must BLOCK. It does not, and it should not have been expected to. What makes the
# handoff safe is not mutual exclusion between these two paths -- it is the partial unique
# indexes (one SELECTED, one ACTIVE, one ACTIVATED audit per grant) plus the guarded conditional
# updates, which are declarative and cannot be raced past.
#
# So the test below proves something STRONGER than blocking: the two ran genuinely CONCURRENTLY --
# connection 1 committed while connection 2's transaction was still open -- and no illegal
# lifecycle state resulted.
LK1=$($C -c "select hashtext('timed_pass:' || '$ACC'::text);")
LK2=$($C -c "select public.karaoke_account_lock_key('$ACC');")
ok "the two paths use DIFFERENT advisory lock keys (measured)" "$([ "$LK1" != "$LK2" ] && echo different || echo same)" "different"

( docker exec -i bty-r4d psql -U postgres -Atq <<SQL
begin;
select karaoke_start_premium_room_session('$ROOM','evR','pubR','gR','test','legacy');
select pg_sleep(3);
commit;
SQL
) > /tmp/r4d-conn2.out 2>&1 &
P2=$!
sleep 1
S1=$(date +%s%N)
docker exec -i bty-r4d psql -U postgres -Atq -c "select select_timed_access_pass('$ACC','$CG','r4d-race');" > /tmp/r4d-conn1.out 2>&1
E1=$(date +%s%N)
C1DONE=$(date +%s%N)
wait $P2
P2DONE=$(date +%s%N)
W=$(( (E1-S1)/1000000 ))
OVERLAP=$(( (P2DONE-C1DONE)/1000000 ))
echo "   connection 1 (select C) took ${W} ms; connection 2 held its transaction ${OVERLAP} ms longer"
ok "the race was GENUINELY CONCURRENT (c1 finished inside c2's open txn)" "$([ "$OVERLAP" -gt 500 ] && echo yes || echo no)" "yes"
ok "no deadlock"                                "$(grep -ci deadlock /tmp/r4d-conn1.out /tmp/r4d-conn2.out | awk -F: '{s+=$2} END{print s+0}')" "0"
ok "at most one SELECTED grant"                 "$($C -c "select count(*) from timed_access_pass_grants where account_id='$ACC' and status='SELECTED';")" "1"
ok "at most one ACTIVE grant"                   "$($C -c "select (count(*) <= 1)::text from timed_access_pass_grants where account_id='$ACC' and status='ACTIVE';")" "true"
ok "B reconciled to EXPIRED by the race"        "$(st $B)" "EXPIRED"
ok "B still exactly one EXPIRED audit"          "$(aud $B EXPIRED)" "1"
ok "B still exactly one ACTIVATED audit"        "$(aud $B ACTIVATED)" "1"
ok "A untouched by the race"                    "$(st $A)" "EXPIRED"
ok "A still exactly one EXPIRED audit"          "$(aud $A EXPIRED)" "1"
ok "no expired grant is entitled"               "$(ent)" "false"

echo
echo "=== AD. NEGATIVES ==="
ok "no grant created across the whole run"      "$($C -c "select count(*) from timed_access_pass_grants;")" "4"
ok "no grant deleted"                           "$($C -c "select count(*) from timed_access_pass_grants where account_id='$ACC';")" "3"
ok "expiry created no Event (only session starts did)" "$($C -c "select count(*) from karaoke_events where room_id<>'$ROOM';")" "0"
ok "no QR/queue/playback rows invented"         "$($C -c "select count(*) from karaoke_requests;")" "0"
ok "total ACTIVATED audits = 2 (A once, B once)" "$($C -c "select count(*) from timed_access_pass_audit where account_id='$ACC' and action='ACTIVATED';")" "2"
ok "total EXPIRED audits = 2 (A once, B once)"   "$($C -c "select count(*) from timed_access_pass_audit where account_id='$ACC' and action='EXPIRED';")" "2"

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL R4D GATES PASS (0 failures)"; else echo "FAILURES: $FAIL"; fi
docker rm -f bty-r4d >/dev/null 2>&1
exit $FAIL
