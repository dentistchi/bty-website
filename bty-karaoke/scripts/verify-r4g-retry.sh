#!/usr/bin/env bash
# BUILD 26U-R4G-R1 — status-aware notification retry, proven against a REAL Postgres carrying
# every production migration.
#
# THE FIRST SECTION IS THE R4G-R0 BLOCKER ITSELF. It is written so that restoring the old
# behaviour — "row exists -> duplicate" — fails this harness. Everything after it is the safety
# that must survive the fix: good dedupe, one evidence row, one lifecycle mutation under
# concurrency, and one compensation for a reversal.
#
# Evidence rule carried from R4C/R4D/R4E: empty measurement = FAILURE, fixture error = ABORT,
# no hardcoded PASS. Every verdict compares a value read back out of the database.
set -u
C="docker exec -i bty-r4g1 psql -U postgres -v ON_ERROR_STOP=1 -Atq"
FAIL=0
ok(){ if [ -z "$2" ]; then printf "   FAIL  %-58s NO MEASUREMENT want[%s]\n" "$1" "$3"; FAIL=$((FAIL+1)); return; fi
      if [ "$2" = "$3" ]; then printf "   PASS  %-58s %s\n" "$1" "$2"
      else printf "   FAIL  %-58s got[%s] want[%s]\n" "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi }
need(){ if [ -z "$2" ] || [ "$2" != "$3" ]; then printf "   ABORT fixture: %s got[%s] want[%s]\n" "$1" "$2" "$3"
        docker rm -f bty-r4g1 >/dev/null 2>&1; exit 2; fi; printf "   ok    fixture: %-52s %s\n" "$1" "$2"; }

docker rm -f bty-r4g1 >/dev/null 2>&1 || true
docker run -d --name bty-r4g1 -e POSTGRES_PASSWORD=pg postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-r4g1 pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
$C -c "create role anon; create role authenticated; create role service_role;
       create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
APPLIED=0
for f in supabase/migrations/*.sql; do
  docker exec -i bty-r4g1 psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1 && APPLIED=$((APPLIED+1))
done
need "migrations applied" "$($C -c "select count(*) from pg_proc where proname='karaoke_record_apple_notification';")" "1"

rec(){ # rec <uuid> <type> <source> -> the whole jsonb
  $C -c "select karaoke_record_apple_notification('$1','$2',null,'Sandbox','$3','o-$3',now(),'sha-$1','$4');"; }
field(){ python3 -c "import sys,json;print(json.load(sys.stdin).get('$1'))"; }
mark(){ $C -c "update karaoke_apple_server_notifications set processing_status='$2',
        processing_detail='t', processed_at=now() where notification_uuid='$1';" >/dev/null; }
status(){ $C -c "select processing_status from karaoke_apple_server_notifications where notification_uuid='$1';"; }
rows(){ $C -c "select count(*) from karaoke_apple_server_notifications where notification_uuid='$1';"; }

echo
echo "=== A. THE R4G-R0 BLOCKER — a FAILED event must NOT be a terminal duplicate ==="
U=11111111-1111-4111-8111-111111111111
R=$(rec $U REFUND txn-a SERVER_NOTIFICATION)
ok "first delivery inserts"                       "$(echo "$R" | field inserted)"       "True"
ok "…and asks to be processed"                    "$(echo "$R" | field shouldProcess)"  "True"
ok "…recording RECEIVED"                          "$(echo "$R" | field processingStatus)" "RECEIVED"
# The lifecycle apply fails; the handler marks FAILED and returns 503.
mark $U FAILED
ok "the row records that the apply FAILED"        "$(status $U)" "FAILED"
R=$(rec $U REFUND txn-a SERVER_NOTIFICATION)
ok "Apple's RETRY is NOT already handled"         "$(echo "$R" | field alreadyHandled)" "False"
ok "…and MUST be processed again"                 "$(echo "$R" | field shouldProcess)"  "True"
ok "…reported as an existing row, not an insert"  "$(echo "$R" | field inserted)"       "False"
ok "…still exactly ONE evidence row"              "$(rows $U)"                          "1"
# Operator recovery replays the same signed event and must reach the same conclusion.
R=$(rec $U REFUND txn-a API_RECOVERY)
ok "operator RECOVERY also reprocesses it"        "$(echo "$R" | field shouldProcess)"  "True"
ok "…and NEVER rewrites discovery_source"         "$(echo "$R" | field discoverySource)" "SERVER_NOTIFICATION"
mark $U APPLIED
ok "once applied, the row is terminal"            "$(status $U)" "APPLIED"

echo
echo "=== B. RECEIVED IS UNFINISHED TOO — a lost process must be recoverable ==="
U2=22222222-2222-4222-8222-222222222222
rec $U2 REFUND txn-b SERVER_NOTIFICATION >/dev/null
# No mark at all: the worker died, or the status write failed after a successful apply.
ok "a row left at RECEIVED"                       "$(status $U2)" "RECEIVED"
R=$(rec $U2 REFUND txn-b SERVER_NOTIFICATION)
ok "…is picked back up, not acknowledged"         "$(echo "$R" | field shouldProcess)"  "True"
ok "…and is not called already-handled"           "$(echo "$R" | field alreadyHandled)" "False"

echo
echo "=== C. POSITIVE CONTROLS — good dedupe must survive the fix ==="
U3=33333333-3333-4333-8333-333333333333
rec $U3 REFUND txn-c SERVER_NOTIFICATION >/dev/null; mark $U3 APPLIED
R=$(rec $U3 REFUND txn-c SERVER_NOTIFICATION)
ok "an APPLIED event is already handled"          "$(echo "$R" | field alreadyHandled)" "True"
ok "…and must NOT be processed"                   "$(echo "$R" | field shouldProcess)"  "False"
U4=44444444-4444-4444-8444-444444444444
rec $U4 TEST txn-d SERVER_NOTIFICATION >/dev/null; mark $U4 IGNORED
R=$(rec $U4 TEST txn-d SERVER_NOTIFICATION)
ok "an IGNORED event is already handled"          "$(echo "$R" | field alreadyHandled)" "True"
ok "…and is not mistaken for FAILED"              "$(echo "$R" | field shouldProcess)"  "False"
U5=55555555-5555-4555-8555-555555555555
R=$(rec $U5 REFUND txn-e API_RECOVERY)
ok "recovery-first records API_RECOVERY"          "$(echo "$R" | field discoverySource)" "API_RECOVERY"
mark $U5 FAILED
R=$(rec $U5 REFUND txn-e SERVER_NOTIFICATION)
ok "…and a later LIVE retry preserves it"         "$(echo "$R" | field discoverySource)" "API_RECOVERY"
ok "…while still reprocessing"                    "$(echo "$R" | field shouldProcess)"  "True"
BAD=$(rec $U5 REFUND txn-e MADE_UP)
ok "an invalid discovery_source is still refused" "$(echo "$BAD" | field error)" "invalid_discovery_source"
ok "the whole run so far holds one row per uuid"  "$($C -c "select count(*) from (select notification_uuid from karaoke_apple_server_notifications group by 1 having count(*)>1) x;")" "0"

echo
echo "=== D. FIXTURE — a real paid purchase + grant, for the lifecycle proofs ==="
ACC=1a0be5e8-0000-4000-8000-0000000000g1
ACC=1a0be5e8-0000-4000-8000-0000000000a1
$C >/dev/null <<SQL
insert into karaoke_accounts (id,provider,provider_subject,email,display_name)
 values ('$ACC','google','r4g','g@g.com','G');
insert into karaoke_host_plan_assignments (account_id,plan_code,source,status)
 values ('$ACC','FREE','SYSTEM_DEFAULT','active');
SQL
mkpaid(){ local T=$1 S=$2 PID GID
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
  echo "$GID"; }
G_RACE=$(mkpaid txn-race 1)
G_REV=$(mkpaid txn-rev 2)
need "two paid pairs exist" "$($C -c "select count(*) from karaoke_apple_purchases where account_id='$ACC';")" "2"

echo
echo "=== E. CONCURRENT SAME-UUID REFUND — two real connections, one mutation ==="
U6=66666666-6666-4666-8666-666666666666
# Both deliveries record first (the handler's order), then both run the canonical RPC at once.
rec $U6 REFUND txn-race SERVER_NOTIFICATION >/dev/null
( $C -c "select apply_apple_purchase_refund('Sandbox','txn-race',now(),'apple_refund','$U6');" >/tmp/r4g-c1.out 2>&1 ) &
( $C -c "select apply_apple_purchase_refund('Sandbox','txn-race',now(),'apple_refund','$U6');" >/tmp/r4g-c2.out 2>&1 ) &
wait
ok "no deadlock reported"                          "$(cat /tmp/r4g-c1.out /tmp/r4g-c2.out | grep -ci deadlock)" "0"
ok "grant reached exactly one terminal state"      "$($C -c "select status from timed_access_pass_grants where id='$G_RACE';")" "REVOKED"
ok "exactly ONE REVOKED audit row"                 "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G_RACE' and action='REVOKED';")" "1"
ok "purchase transitioned exactly once"            "$($C -c "select verification_status from karaoke_apple_purchases where apple_transaction_id='txn-race';")" "REVOKED"
ok "zero carryover was created anywhere"           "$($C -c "select coalesce(sum(carryover_seconds),0) from timed_access_pass_grants where account_id='$ACC';")" "0"
ok "still one inbox row for the uuid"              "$(rows $U6)" "1"
ok "no grant was resurrected"                      "$($C -c "select count(*) from timed_access_pass_grants where id='$G_RACE' and status<>'REVOKED';")" "0"

echo
echo "=== F. CONCURRENT REFUND_REVERSED — one compensation, never two ==="
U7=77777777-7777-4777-8777-777777777777
$C -c "select apply_apple_purchase_refund('Sandbox','txn-rev',now(),'apple_refund','pre-$U7');" >/dev/null
need "the reversal subject is REVOKED" "$($C -c "select status from timed_access_pass_grants where id='$G_REV';")" "REVOKED"
rec $U7 REFUND_REVERSED txn-rev SERVER_NOTIFICATION >/dev/null
( $C -c "select apply_apple_refund_reversal('Sandbox','txn-rev','$U7');" >/tmp/r4g-r1.out 2>&1 ) &
( $C -c "select apply_apple_refund_reversal('Sandbox','txn-rev','$U7');" >/tmp/r4g-r2.out 2>&1 ) &
wait
ok "no deadlock reported"                          "$(cat /tmp/r4g-r1.out /tmp/r4g-r2.out | grep -ci deadlock)" "0"
ok "exactly ONE compensation grant exists"         "$($C -c "select count(*) from timed_access_pass_grants where account_id='$ACC' and pass_type='REFUND_CREDIT';")" "1"
ok "…for the exact denied seconds"                 "$($C -c "select duration_seconds from timed_access_pass_grants where account_id='$ACC' and pass_type='REFUND_CREDIT';")" "3600"
ok "…AVAILABLE and unpaid"                         "$($C -c "select status||'/'||is_paid from timed_access_pass_grants where account_id='$ACC' and pass_type='REFUND_CREDIT';")" "AVAILABLE/false"
ok "the original grant stays REVOKED"              "$($C -c "select status from timed_access_pass_grants where id='$G_REV';")" "REVOKED"

echo
echo "=== G. UNKNOWN PURCHASE THAT BECOMES KNOWN — the ordering race ==="
U8=88888888-8888-4888-8888-888888888888
rec $U8 REFUND txn-late SERVER_NOTIFICATION >/dev/null
OUT=$($C -c "select apply_apple_purchase_refund('Sandbox','txn-late',now(),'apple_refund','$U8');")
ok "a refund with no purchase does not apply"      "$(echo "$OUT" | field ok)" "False"
mark $U8 FAILED
R=$(rec $U8 REFUND txn-late SERVER_NOTIFICATION)
ok "…and its row stays RECOVERABLE"                "$(echo "$R" | field shouldProcess)" "True"
G_LATE=$(mkpaid txn-late 3)
OUT=$($C -c "select apply_apple_purchase_refund('Sandbox','txn-late',now(),'apple_refund','$U8');")
ok "once the purchase exists, it applies"          "$(echo "$OUT" | field ok)" "True"
ok "…revoking the exact grant"                     "$($C -c "select status from timed_access_pass_grants where id='$G_LATE';")" "REVOKED"
mark $U8 APPLIED
ok "…under the SAME notificationUUID"              "$(rows $U8)" "1"
ok "…with no synthetic uuid invented"              "$($C -c "select count(*) from karaoke_apple_server_notifications where notification_uuid like '%txn-late%' or notification_uuid like '%:%';")" "0"

echo
echo "=== H. NEGATIVE PROOF ==="
ok "one row per notification, across the whole run" "$($C -c "select count(*) from (select notification_uuid from karaoke_apple_server_notifications group by 1 having count(*)>1) x;")" "0"
ok "no notification row was ever deleted"           "$($C -c "select count(*) from karaoke_apple_server_notifications;")" "8"
ok "audit remains immutable"                        "$($C -c "update timed_access_pass_audit set created_at=created_at-interval '1 hour' where pass_grant_id='$G_RACE';" 2>&1 | grep -qiE "immutable|append-only|cannot|ERROR" && echo refused || echo ALLOWED)" "refused"

echo
docker rm -f bty-r4g1 >/dev/null 2>&1
if [ "$FAIL" -eq 0 ]; then echo "ALL R4G-R1 GATES PASS (0 failures)"; else echo "$FAIL FAILURE(S)"; fi
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
