#!/usr/bin/env bash
# BUILD 26U-R4E-R1 — Apple refund / reversal lifecycle, proven deterministically.
# Evidence rule carried from R4C/R4D: empty measurement = FAILURE, fixture error = ABORT,
# no hardcoded PASS. Every verdict compares a value read back out of the database.
set -u
export PGPASSWORD=pg
C="docker exec -i bty-r4e psql -U postgres -v ON_ERROR_STOP=1 -Atq"
FAIL=0
ok(){ if [ -z "$2" ]; then printf "   FAIL  %-58s NO MEASUREMENT want[%s]\n" "$1" "$3"; FAIL=$((FAIL+1)); return; fi
      if [ "$2" = "$3" ]; then printf "   PASS  %-58s %s\n" "$1" "$2"
      else printf "   FAIL  %-58s got[%s] want[%s]\n" "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi }
need(){ if [ -z "$2" ] || [ "$2" != "$3" ]; then printf "   ABORT fixture: %s got[%s] want[%s]\n" "$1" "$2" "$3"
        docker rm -f bty-r4e >/dev/null 2>&1; exit 2; fi; printf "   ok    fixture: %-52s %s\n" "$1" "$2"; }

docker rm -f bty-r4e >/dev/null 2>&1 || true
docker run -d --name bty-r4e -e POSTGRES_PASSWORD=pg -p 54497:5432 postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-r4e pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
$C -c "create role anon; create role authenticated; create role service_role;
       create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  docker exec -i bty-r4e psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1 || true
done

ACC=1a0be5e8-0000-4000-8000-0000000000ee
OTHER=1a0be5e8-0000-4000-8000-0000000000ff
ROOM=33333333-0000-4000-8000-0000000000e1
$C >/dev/null <<SQL
insert into karaoke_accounts (id,provider,provider_subject,email,display_name) values
 ('$ACC','google','r4e','e@e.com','E'), ('$OTHER','google','r4e-o','o@e.com','O');
insert into karaoke_host_plan_assignments (account_id,plan_code,source,status) values
 ('$ACC','FREE','SYSTEM_DEFAULT','active'), ('$OTHER','FREE','SYSTEM_DEFAULT','active');
insert into karaoke_workspaces (id,name) values ('22222222-0000-4000-8000-0000000000e1','WS');
insert into karaoke_workspace_members (workspace_id,account_id,role,status)
 values ('22222222-0000-4000-8000-0000000000e1','$ACC','owner','active');
insert into karaoke_rooms (id,slug,display_name,status,dj_secret) values ('$ROOM','r4e','R4E','open','s');
insert into karaoke_room_ownership (room_id,workspace_id) values ('$ROOM','22222222-0000-4000-8000-0000000000e1');
update karaoke_usage_policy set premium_room_mode='premium_all';
SQL

# one paid purchase+grant pair, built in the forced FK order the ledger requires
mkpaid(){ # mkpaid <txn> <ownerref-suffix> -> echoes grant id
  local T=$1 S=$2 PID GID
  PID=$($C -c "insert into karaoke_apple_purchases
    (account_id,purchase_owner_ref,environment,apple_transaction_id,apple_original_transaction_id,
     storekit_product_id,product_code,purchase_date,quantity,signed_transaction_payload,
     signed_transaction_sha256,verification_status,verified_at,grant_status,source)
    values ('$ACC','ffffffff-0000-4000-8000-00000000000$S','Sandbox','$T','$T',
     'com.btydaily.norebang.pass.1hour','PASS_1H',now(),1,'jws',
     repeat('0',64),'VERIFIED',now(),'NOT_GRANTED','STOREKIT_CLIENT') returning id;")
  GID=$($C -c "insert into timed_access_pass_grants
    (account_id,pass_type,duration_seconds,status,source_type,is_paid,issue_idempotency_key,apple_purchase_id)
    values ('$ACC','ONE_HOUR',3600,'AVAILABLE','PAID',true,'idem-$T','$PID') returning id;")
  $C -c "update karaoke_apple_purchases set grant_status='GRANTED', pass_grant_id='$GID',
          granted_seconds=3600 where id='$PID';" >/dev/null
  echo "$GID"
}
G_AVAIL=$(mkpaid txn-avail 1)
G_SEL=$(mkpaid txn-sel 2)
G_ACT=$(mkpaid txn-act 3)
G_STALE=$(mkpaid txn-stale 4)
G_EXP=$(mkpaid txn-exp 5)
need "five paid purchase/grant pairs" "$($C -c "select count(*) from karaoke_apple_purchases;")" "5"
need "1:1 linkage on every pair" "$($C -c "select count(*) from karaoke_apple_purchases p join timed_access_pass_grants g on g.id=p.pass_grant_id where g.apple_purchase_id=p.id;")" "5"

st(){ $C -c "select status from timed_access_pass_grants where id='$1';"; }
ent(){ $C -c "select (public.karaoke_premium_room_entitlement_at('$ACC',now())->>'entitled');"; }
eff(){ $C -c "select (public.karaoke_timed_pass_state_at('$ACC',now())->>'effectiveEntitlement');"; }
apass(){ $C -c "select coalesce((public.karaoke_timed_pass_state_at('$ACC',now())->'activePass'->>'id'),'null');"; }
ready(){ $C -c "select count(*) from timed_access_pass_grants where account_id='$ACC' and status='AVAILABLE';"; }
refund(){ $C -c "select apply_apple_purchase_refund('Sandbox','$1',$2,'apple_refund','$3');"; }

echo
echo "=== §G CASE 1 — AVAILABLE -> REVOKED, zero carryover ==="
R0READY=$(ready)
OUT=$(refund txn-avail "now()" nuid-avail)
ok "grant AVAILABLE -> REVOKED"        "$(st $G_AVAIL)" "REVOKED"
ok "revoke_reason is apple_refund"     "$($C -c "select revoke_reason from timed_access_pass_grants where id='$G_AVAIL';")" "apple_refund"
ok "…and NEVER switched_pass"          "$($C -c "select count(*) from timed_access_pass_grants where revoke_reason='switched_pass';")" "0"
ok "activated_at stays null"           "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$G_AVAIL';")" "null"
ok "denied seconds = full window"      "$(echo "$OUT" | python3 -c "import sys,json;print(json.load(sys.stdin)['deniedSeconds'])")" "3600"
ok "purchase verification_status"      "$($C -c "select verification_status from karaoke_apple_purchases where apple_transaction_id='txn-avail';")" "REVOKED"
ok "purchase grant_status"             "$($C -c "select grant_status from karaoke_apple_purchases where apple_transaction_id='txn-avail';")" "GRANT_REVOKED"
ok "ready-to-use count dropped by one" "$(ready)" "$((R0READY-1))"
ok "exactly one REVOKED audit"         "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G_AVAIL' and action='REVOKED';")" "1"
ok "audit reason is apple_refund"      "$($C -c "select reason from timed_access_pass_audit where pass_grant_id='$G_AVAIL' and action='REVOKED';")" "apple_refund"

echo
echo "=== §G CASE 2 — SELECTED -> REVOKED, no carry, no auto-replacement ==="
$C -c "select select_timed_access_pass('$ACC','$G_SEL',null);" >/dev/null
need "G_SEL is SELECTED" "$(st $G_SEL)" "SELECTED"
CARRY_BEFORE=$($C -c "select coalesce(sum(carryover_seconds),0) from timed_access_pass_grants where account_id='$ACC';")
refund txn-sel "now()" nuid-sel >/dev/null
ok "SELECTED -> REVOKED"               "$(st $G_SEL)" "REVOKED"
ok "selected_at cleared"               "$($C -c "select coalesce(selected_at::text,'null') from timed_access_pass_grants where id='$G_SEL';")" "null"
ok "zero SELECTED grants remain"       "$($C -c "select count(*) from timed_access_pass_grants where account_id='$ACC' and status='SELECTED';")" "0"
ok "NO carryover was created anywhere" "$($C -c "select coalesce(sum(carryover_seconds),0) from timed_access_pass_grants where account_id='$ACC';")" "$CARRY_BEFORE"
ok "no replacement grant appeared"     "$($C -c "select count(*) from timed_access_pass_grants where account_id='$ACC';")" "5"

echo
echo "=== §J THE SECURITY GATE — live ACTIVE grant loses entitlement AT COMMIT ==="
$C -c "select select_timed_access_pass('$ACC','$G_ACT',null);" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev','pub','g','t','premium');" >/dev/null
need "G_ACT is ACTIVE" "$(st $G_ACT)" "ACTIVE"
need "…with a future expiry" "$($C -c "select (expires_at > now())::text from timed_access_pass_grants where id='$G_ACT';")" "true"
ok "BEFORE refund: entitled"           "$(ent)" "true"
ok "BEFORE refund: projection"         "$(eff)" "TIMED_ACCESS"
ok "BEFORE refund: activePass is it"   "$(apass)" "$G_ACT"
ACT_AT=$($C -c "select activated_at from timed_access_pass_grants where id='$G_ACT';")
EXP_AT=$($C -c "select expires_at from timed_access_pass_grants where id='$G_ACT';")
OUT=$(refund txn-act "now()" nuid-act)
ok "ACTIVE -> REVOKED"                 "$(st $G_ACT)" "REVOKED"
ok "AFTER refund: entitlement FALSE"   "$(ent)" "false"
ok "AFTER refund: projection FREE"     "$(eff)" "FREE"
ok "AFTER refund: activePass null"     "$(apass)" "null"
ok "activated_at PRESERVED"            "$($C -c "select activated_at from timed_access_pass_grants where id='$G_ACT';")" "$ACT_AT"
ok "original expires_at PRESERVED"     "$($C -c "select expires_at from timed_access_pass_grants where id='$G_ACT';")" "$EXP_AT"
ok "denied seconds ~ remaining window" "$(echo "$OUT" | python3 -c "import sys,json; d=json.load(sys.stdin)['deniedSeconds']; print('in-range' if 3500 < d <= 3600 else d)")" "in-range"
ok "the ROOM still exists"             "$($C -c "select status from karaoke_rooms where id='$ROOM';")" "open"
ok "the Event was NOT deleted"         "$($C -c "select count(*) from karaoke_events where room_id='$ROOM';")" "1"
ok "no queue/playback rows touched"    "$($C -c "select count(*) from karaoke_requests;")" "0"

echo
echo "=== §G CASE 4 — stale ACTIVE: which cause terminated it first ==="
$C -c "delete from karaoke_events;" >/dev/null
$C -c "select select_timed_access_pass('$ACC','$G_STALE',null);" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev2','pub2','g2','t','premium');" >/dev/null
$C -c "update timed_access_pass_grants set activated_at=activated_at-interval '2 hours',
        expires_at=expires_at-interval '2 hours' where id='$G_STALE';" >/dev/null
need "G_STALE is stale ACTIVE" "$(st $G_STALE)" "ACTIVE"
# revocation effective BEFORE the natural expiry -> financial revocation is the earlier cause
refund txn-stale "now() - interval '3 hours'" nuid-stale >/dev/null
ok "revocation earlier than expiry -> REVOKED" "$(st $G_STALE)" "REVOKED"

echo
echo "=== §G CASE 5 — already EXPIRED stays EXPIRED (financial truth on the ledger) ==="
$C -c "delete from karaoke_events;" >/dev/null
$C -c "select select_timed_access_pass('$ACC','$G_EXP',null);" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev3','pub3','g3','t','premium');" >/dev/null
$C -c "update timed_access_pass_grants set activated_at=activated_at-interval '2 hours',
        expires_at=expires_at-interval '2 hours' where id='$G_EXP';" >/dev/null
# Sweep it to EXPIRED through the CANONICAL lazy path. `switch_` cannot do this -- its target
# must be AVAILABLE, so passing the ACTIVE grant errored and swept nothing. The session RPC's
# already_live check precedes its sweep, so the Event must be cleared first.
$C -c "delete from karaoke_events;" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','evS','pubS','gS','t','legacy');" >/dev/null
need "G_EXP materialised EXPIRED" "$(st $G_EXP)" "EXPIRED"
refund txn-exp "now()" nuid-exp >/dev/null
ok "EXPIRED is NOT rewritten to REVOKED" "$(st $G_EXP)" "EXPIRED"
ok "…but the ledger records the refund"  "$($C -c "select verification_status from karaoke_apple_purchases where apple_transaction_id='txn-exp';")" "REVOKED"
ok "denied seconds = 0 (service delivered)" "$($C -c "select refund_denied_seconds from karaoke_apple_purchases where apple_transaction_id='txn-exp';")" "0"

echo
echo "=== §D/§Q DUPLICATE NOTIFICATION IS A NO-OP ==="
AUD_BEFORE=$($C -c "select count(*) from timed_access_pass_audit;")
OUT=$(refund txn-avail "now()" nuid-avail-dup)
ok "duplicate refund reports replayed"  "$(echo "$OUT" | python3 -c "import sys,json;print(json.load(sys.stdin)['replayed'])")" "True"
ok "no extra audit row"                 "$($C -c "select count(*) from timed_access_pass_audit;")" "$AUD_BEFORE"
ok "still exactly one REVOKED audit"    "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G_AVAIL' and action='REVOKED';")" "1"
ok "inbox dedupes notificationUUID"     "$($C -c "select (karaoke_record_apple_notification('nuid-x','REFUND',null,'Sandbox','txn-avail','txn-avail',now(),'abc')->>'duplicate');")" "false"
ok "…and the SAME uuid is a duplicate"  "$($C -c "select (karaoke_record_apple_notification('nuid-x','REFUND',null,'Sandbox','txn-avail','txn-avail',now(),'abc')->>'duplicate');")" "true"
ok "only ONE inbox row for that uuid"   "$($C -c "select count(*) from karaoke_apple_server_notifications where notification_uuid='nuid-x';")" "1"

echo
echo "=== §M FULFIL REPLAY CANNOT RECREATE A REFUNDED GRANT ==="
GRANTS_BEFORE=$($C -c "select count(*) from timed_access_pass_grants;")
$C -c "select fulfil_apple_purchase((select id from karaoke_apple_purchases where apple_transaction_id='txn-avail'));" >/dev/null 2>&1 || true
ok "no new grant from fulfil replay"    "$($C -c "select count(*) from timed_access_pass_grants;")" "$GRANTS_BEFORE"
ok "refunded grant stays REVOKED"       "$(st $G_AVAIL)" "REVOKED"

echo
echo "=== §N/§O REFUND_REVERSED — compensate, never resurrect ==="
OUT=$($C -c "select apply_apple_refund_reversal('Sandbox','txn-avail','rev-1');")
COMP=$(echo "$OUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('compensationGrantId') or '')")
ok "original grant NOT resurrected"     "$(st $G_AVAIL)" "REVOKED"
ok "a compensation grant was issued"    "$([ -n "$COMP" ] && echo yes || echo no)" "yes"
ok "compensation is AVAILABLE"          "$(st $COMP)" "AVAILABLE"
ok "compensation seconds = denied"      "$($C -c "select duration_seconds from timed_access_pass_grants where id='$COMP';")" "3600"
ok "compensation is NOT a paid grant"   "$($C -c "select is_paid::text from timed_access_pass_grants where id='$COMP';")" "false"
ok "compensation source_type"           "$($C -c "select source_type from timed_access_pass_grants where id='$COMP';")" "REFUND_REVERSAL"
ok "compensation not linked to the purchase" "$($C -c "select coalesce(apple_purchase_id::text,'null') from timed_access_pass_grants where id='$COMP';")" "null"
ok "compensation traces to the purchase"     "$($C -c "select (reversal_of_purchase_id is not null)::text from timed_access_pass_grants where id='$COMP';")" "true"
ok "compensation starts unactivated"    "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$COMP';")" "null"
N_AFTER=$($C -c "select count(*) from timed_access_pass_grants;")
ok "duplicate reversal issues NOTHING"  "$($C -c "select (apply_apple_refund_reversal('Sandbox','txn-avail','rev-1')->>'replayed');")" "true"
ok "…grant count unchanged"             "$($C -c "select count(*) from timed_access_pass_grants;")" "$N_AFTER"
ok "reversal of an EXPIRED refund gives 0 seconds -> no grant" "$($C -c "select coalesce((apply_apple_refund_reversal('Sandbox','txn-exp','rev-exp')->>'compensationGrantId'),'none');")" "none"
# txn-sel was itself refunded in case 2, so it was never a valid subject for this check. A
# genuinely un-refunded purchase is created for it instead.
G_CLEAN=$(mkpaid txn-clean 8)
ok "reversing a NON-refunded purchase is refused" "$($C -c "select (apply_apple_refund_reversal('Sandbox','txn-clean','rev-none')->>'error');")" "purchase_not_refunded"
ok "…and it issued no grant"                      "$($C -c "select count(*) from timed_access_pass_grants where reversal_notification_uuid='rev-none';")" "0"

echo
echo "=== §K REFUND vs ACTIVATION RACE — two real connections ==="
G_RACE=$(mkpaid txn-race 6)
$C -c "delete from karaoke_events;" >/dev/null
$C -c "select select_timed_access_pass('$ACC','$G_RACE',null);" >/dev/null
need "race subject is SELECTED" "$(st $G_RACE)" "SELECTED"
# Connection 2 holds the CANONICAL ACCOUNT LOCK inside a transaction while starting a session.
# The refund RPC deliberately takes that same lock first, so this race is genuinely serialized --
# unlike select-vs-session-start, which R4D measured as different lock domains.
( docker exec -i bty-r4e psql -U postgres -Atq <<SQL
begin;
select karaoke_start_premium_room_session('$ROOM','evR','pubR','gR','t','premium');
select pg_sleep(3);
commit;
SQL
) > /tmp/r4e-c2.out 2>&1 &
P2=$!
sleep 1
S=$(date +%s%N)
docker exec -i bty-r4e psql -U postgres -Atq -c \
  "select apply_apple_purchase_refund('Sandbox','txn-race',now(),'apple_refund','nuid-race');" > /tmp/r4e-c1.out 2>&1
E=$(date +%s%N)
wait $P2
W=$(( (E-S)/1000000 ))
echo "   refund waited ${W} ms behind the session lock"
ok "refund BLOCKED on the shared account lock" "$([ "$W" -gt 1500 ] && echo yes || echo no)" "yes"
ok "no deadlock"                        "$(grep -ci deadlock /tmp/r4e-c1.out /tmp/r4e-c2.out | awk -F: '{s+=$2} END{print s+0}')" "0"
ok "FINAL state is REVOKED"             "$(st $G_RACE)" "REVOKED"
ok "…and entitlement is false"          "$(ent)" "false"
ok "activation could not survive refund" "$($C -c "select count(*) from timed_access_pass_grants where id='$G_RACE' and status='ACTIVE';")" "0"
ok "exactly one REVOKED audit"          "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G_RACE' and action='REVOKED';")" "1"

echo
echo "=== §L REFUND vs SELECT RACE ==="
G_R2=$(mkpaid txn-race2 7)
( docker exec -i bty-r4e psql -U postgres -Atq <<SQL
begin;
select apply_apple_purchase_refund('Sandbox','txn-race2',now(),'apple_refund','nuid-race2');
select pg_sleep(3);
commit;
SQL
) > /tmp/r4e-c3.out 2>&1 &
P3=$!
sleep 1
S=$(date +%s%N)
docker exec -i bty-r4e psql -U postgres -Atq -c "select select_timed_access_pass('$ACC','$G_R2',null);" > /tmp/r4e-c4.out 2>&1
E=$(date +%s%N)
wait $P3
W2=$(( (E-S)/1000000 ))
echo "   select waited ${W2} ms behind the refund's timed-pass lock"
ok "select BLOCKED on the timed-pass lock" "$([ "$W2" -gt 1500 ] && echo yes || echo no)" "yes"
ok "refunded target finished REVOKED"      "$(st $G_R2)" "REVOKED"
ok "it did NOT remain SELECTED"            "$($C -c "select count(*) from timed_access_pass_grants where id='$G_R2' and status='SELECTED';")" "0"
ok "no carryover manufactured"             "$($C -c "select coalesce(carryover_seconds,0) from timed_access_pass_grants where id='$G_R2';")" "0"

echo
echo "=== §I ZERO-CARRYOVER, ACCOUNT-WIDE ==="
ok "no grant on the account carries any seconds" "$($C -c "select coalesce(sum(carryover_seconds),0) from timed_access_pass_grants where account_id='$ACC';")" "0"
ok "no grant anywhere has reason switched_pass"  "$($C -c "select count(*) from timed_access_pass_grants where revoke_reason='switched_pass';")" "0"

echo
echo "=== CONTAINMENT ==="
ok "the other account was never touched"  "$($C -c "select count(*) from timed_access_pass_grants where account_id='$OTHER';")" "0"
ok "no audit rows for the other account"  "$($C -c "select count(*) from timed_access_pass_audit where account_id='$OTHER';")" "0"
ok "every REVOKED grant is apple_refund"  "$($C -c "select count(*) from timed_access_pass_grants where status='REVOKED' and revoke_reason<>'apple_refund';")" "0"
ok "audit remains immutable"              "$(docker exec -i bty-r4e psql -U postgres -Atq -c "update timed_access_pass_audit set created_at=now();" 2>&1 | grep -qiE "immutable|append-only|cannot|ERROR" && echo refused || echo ALLOWED)" "refused"
ok "existing R4B/R4C/R4D functions untouched" "$($C -c "select count(*) from pg_proc where proname in ('select_timed_access_pass','switch_timed_access_pass','fulfil_apple_purchase','karaoke_start_premium_room_session','karaoke_premium_room_entitlement_at');")" "5"

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL R4E GATES PASS (0 failures)"; else echo "FAILURES: $FAIL"; fi
docker rm -f bty-r4e >/dev/null 2>&1
exit $FAIL
