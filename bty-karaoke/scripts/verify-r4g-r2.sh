#!/usr/bin/env bash
# BUILD 26U-R4G-R2-R1 — retention-safe financial reconciliation, against a REAL Postgres carrying
# every production migration.
#
# WHAT THIS PROVES AND WHAT IT CANNOT. The DECISION matrix is proven exhaustively in
# src/domain/refund-reconciliation.test.ts, which needs no database. This proves the half that
# does: that the canonical RPCs accept reconciliation provenance WITHOUT a fake notification
# identity, that the XOR holds, that evidence identity is Apple's bytes rather than the clock, and
# that one purchase can never end up with two compensations however it was discovered.
#
# Evidence rule: empty measurement = FAILURE, fixture error = ABORT, no hardcoded PASS.
set -u
C="docker exec -i bty-r2r1 psql -U postgres -v ON_ERROR_STOP=1 -Atq"
FAIL=0
ok(){ if [ -z "$2" ]; then printf "   FAIL  %-56s NO MEASUREMENT want[%s]\n" "$1" "$3"; FAIL=$((FAIL+1)); return; fi
      if [ "$2" = "$3" ]; then printf "   PASS  %-56s %s\n" "$1" "$2"
      else printf "   FAIL  %-56s got[%s] want[%s]\n" "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi }
need(){ if [ -z "$2" ] || [ "$2" != "$3" ]; then printf "   ABORT fixture: %s got[%s] want[%s]\n" "$1" "$2" "$3"
        docker rm -f bty-r2r1 >/dev/null 2>&1; exit 2; fi; printf "   ok    fixture: %-50s %s\n" "$1" "$2"; }
J(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1') if d.get('$1') is not None else 'null')"; }

docker rm -f bty-r2r1 >/dev/null 2>&1 || true
docker run -d --name bty-r2r1 -e POSTGRES_PASSWORD=pg postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-r2r1 pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
$C -c "create role anon; create role authenticated; create role service_role;
       create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
for f in supabase/migrations/*.sql; do docker exec -i bty-r2r1 psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1 || true; done
need "the evidence table is live" "$($C -c "select count(*) from information_schema.tables where table_name='karaoke_apple_financial_reconciliation_evidence';")" "1"
need "the refund RPC has exactly one definition" "$($C -c "select count(*) from pg_proc where proname='apply_apple_purchase_refund';")" "1"
need "the reversal RPC has exactly one definition" "$($C -c "select count(*) from pg_proc where proname='apply_apple_refund_reversal';")" "1"

A=1a0be5e8-0000-4000-8000-00000000004a
$C >/dev/null <<SQL
insert into karaoke_accounts (id,provider,provider_subject,email,display_name) values ('$A','google','r2r1','a@e.com','A');
insert into karaoke_host_plan_assignments (account_id,plan_code,source,status) values ('$A','FREE','SYSTEM_DEFAULT','active');
SQL
mkpaid(){ local T=$1 PID GID
  PID=$($C -c "insert into karaoke_apple_purchases
    (account_id,purchase_owner_ref,environment,apple_transaction_id,apple_original_transaction_id,
     storekit_product_id,product_code,purchase_date,quantity,signed_transaction_payload,
     signed_transaction_sha256,verification_status,verified_at,grant_status,source)
    values ('$A',gen_random_uuid(),'Sandbox','$T','$T','p','PASS_1H',now(),1,'jws',
     repeat('0',64),'VERIFIED',now(),'NOT_GRANTED','STOREKIT_CLIENT') returning id;")
  GID=$($C -c "insert into timed_access_pass_grants
    (account_id,pass_type,duration_seconds,status,source_type,is_paid,issue_idempotency_key,apple_purchase_id)
    values ('$A','ONE_HOUR',3600,'AVAILABLE','PAID',true,'idem-$T','$PID') returning id;")
  $C -c "update karaoke_apple_purchases set grant_status='GRANTED', pass_grant_id='$GID', granted_seconds=3600 where id='$PID';" >/dev/null
  echo "$GID"; }
ev(){ $C -c "select karaoke_record_reconciliation_evidence('Sandbox','$1',null,'$2','$3',now(),$4,null,$5,$6,'p');"; }

echo
echo "=== A. EVIDENCE IDENTITY IS APPLE'S BYTES, NOT THE CLOCK ==="
E1=$(ev txn-a REFUND_HISTORY digest-1 "now()" "'REFUND_PRORATED'" 40000)
ok "first observation inserts"                 "$(echo "$E1" | J inserted)" "True"
ok "…and asks to be processed"                 "$(echo "$E1" | J shouldProcess)" "True"
E2=$(ev txn-a REFUND_HISTORY digest-1 "now()" "'REFUND_PRORATED'" 40000)
ok "the SAME signed bytes insert no second row" "$(echo "$E2" | J inserted)" "False"
ok "…converging on the same evidence id"        "$([ "$(echo "$E1" | J evidenceId)" = "$(echo "$E2" | J evidenceId)" ] && echo same)" "same"
E3=$(ev txn-a TRANSACTION_INFO digest-2 "now()" "null" "null")
ok "a DIFFERENT source is its own evidence row" "$(echo "$E3" | J inserted)" "True"
E4=$(ev txn-a REFUND_HISTORY digest-9 "now()" "'REFUND_PRORATED'" 40000)
ok "changed Apple state is a NEW row (reversal is observable)" "$(echo "$E4" | J inserted)" "True"
ok "an invalid evidence source is refused"      "$(ev txn-a NOTIFICATION digest-3 "now()" "null" "null" | J error)" "invalid_evidence_source"
ok "an invalid environment is refused"          "$($C -c "select (karaoke_record_reconciliation_evidence('Prod','t',null,'REFUND_HISTORY','d',now(),null,null,null,null,'p')->>'error');")" "invalid_environment"
EID=$(echo "$E1" | J evidenceId)
$C -c "select karaoke_mark_reconciliation_evidence('$EID','APPLIED','done');" >/dev/null
ok "an APPLIED evidence row is finished"        "$(ev txn-a REFUND_HISTORY digest-1 "now()" "'REFUND_PRORATED'" 40000 | J shouldProcess)" "False"
ok "…and its verified claims were NOT rewritten" "$($C -c "select revocation_type||'/'||revocation_percentage from karaoke_apple_financial_reconciliation_evidence where id='$EID';")" "REFUND_PRORATED/40000"

echo
echo "=== B. PROVENANCE XOR — never a fake notification identity ==="
G1=$(mkpaid txn-a)
ok "BOTH provenance sources is refused" \
   "$($C -c "select (apply_apple_purchase_refund('Sandbox','txn-a',now(),'apple_refund','nuid-x','REFUND_PRORATED',40000,'$EID')->>'error');")" "provenance_required"
ok "NEITHER source is refused"        \
   "$($C -c "select (apply_apple_purchase_refund('Sandbox','txn-a',now(),'apple_refund',null,'REFUND_PRORATED',40000,null)->>'error');")" "provenance_required"
ok "…and the grant is untouched by either refusal" "$($C -c "select status from timed_access_pass_grants where id='$G1';")" "AVAILABLE"
OUT=$($C -c "select apply_apple_purchase_refund('Sandbox','txn-a',now(),'apple_refund',null,'REFUND_PRORATED',40000,'$EID');")
ok "reconciliation-sourced refund APPLIES"      "$(echo "$OUT" | J ok)" "True"
ok "…with R2A valuation unchanged (40% of 3600)" "$(echo "$OUT" | J deniedSeconds)" "1440"
ok "…issuing the remainder"                      "$(echo "$OUT" | J survivingFutureSeconds)" "2160"
ok "…recording the evidence id as provenance"    "$($C -c "select refund_reconciliation_evidence_id from karaoke_apple_purchases where apple_transaction_id='txn-a';")" "$EID"
ok "…and leaving refund_notification_uuid NULL"  "$($C -c "select coalesce(refund_notification_uuid,'null') from karaoke_apple_purchases where apple_transaction_id='txn-a';")" "null"
ok "…so no notification identity was invented"   "$($C -c "select count(*) from karaoke_apple_server_notifications;")" "0"
ok "the audit names the reconciliation actor"    "$($C -c "select actor_ref from timed_access_pass_audit where pass_grant_id='$G1' and action='REVOKED';")" "apple_financial_reconciliation"
ok "…and its provenance source"                  "$($C -c "select metadata->>'provenanceSource' from timed_access_pass_audit where pass_grant_id='$G1' and action='REVOKED';")" "FINANCIAL_RECONCILIATION"

echo
echo "=== C. THE TWO DOORS CONVERGE — one purchase, one outcome ==="
ok "a NOTIFICATION replay of the same refund is inert" \
   "$($C -c "select (apply_apple_purchase_refund('Sandbox','txn-a',now(),'apple_refund','nuid-late','REFUND_PRORATED',40000,null)->>'replayed');")" "true"
ok "…still exactly one REVOKED audit"            "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G1' and action='REVOKED';")" "1"
ok "…still exactly one remainder"                "$($C -c "select count(*) from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='txn-a');")" "1"
ok "different evidence through the other door is STILL a conflict" \
   "$($C -c "select (apply_apple_purchase_refund('Sandbox','txn-a',now(),'apple_refund','nuid-c','REFUND_PRORATED',70000,null)->>'error');")" "refund_evidence_conflict"

echo
echo "=== D. RECONCILIATION-SOURCED REVERSAL ==="
ok "BOTH sources refused"  "$($C -c "select (apply_apple_refund_reversal('Sandbox','txn-a','nuid-r','$EID')->>'error');")" "provenance_required"
ok "NEITHER refused"       "$($C -c "select (apply_apple_refund_reversal('Sandbox','txn-a',null,null)->>'error');")" "provenance_required"
REV=$($C -c "select apply_apple_refund_reversal('Sandbox','txn-a',null,'$EID');")
ok "reversal restores the EXACT denied seconds"  "$(echo "$REV" | J restoredSeconds)" "1440"
CG=$(echo "$REV" | J compensationGrantId)
ok "…as a REFUND_CREDIT"                          "$($C -c "select pass_type from timed_access_pass_grants where id='$CG';")" "REFUND_CREDIT"
ok "…with evidence provenance, not a fake uuid"   "$($C -c "select coalesce(reversal_notification_uuid,'null')||'/'||coalesce(reversal_reconciliation_evidence_id::text,'null') from timed_access_pass_grants where id='$CG';")" "null/$EID"
ok "the original grant stays REVOKED"             "$($C -c "select status from timed_access_pass_grants where id='$G1';")" "REVOKED"
ok "the remainder is untouched"                   "$($C -c "select duration_seconds from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='txn-a');")" "2160"
ok "a NOTIFICATION reversal afterwards is inert"  "$($C -c "select (apply_apple_refund_reversal('Sandbox','txn-a','nuid-rev2',null)->>'replayed');")" "true"
ok "…exactly ONE compensation for the purchase"   "$($C -c "select count(*) from timed_access_pass_grants where reversal_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='txn-a');")" "1"
ok "the purchase-level index refuses a second"    "$($C -c "insert into timed_access_pass_grants (account_id,pass_type,duration_seconds,status,source_type,is_paid,issue_idempotency_key,reversal_of_purchase_id)
             values ('$A','REFUND_CREDIT',60,'AVAILABLE','REFUND_REVERSAL',false,'dup-rev',(select id from karaoke_apple_purchases where apple_transaction_id='txn-a'));" 2>&1 | grep -qiE "duplicate key|reversal_purchase_once|ERROR" && echo refused || echo ALLOWED)" "refused"

echo
echo "=== E. THE NOTIFICATION PATH IS UNCHANGED ==="
G2=$(mkpaid txn-b)
OUT=$($C -c "select apply_apple_purchase_refund('Sandbox','txn-b',now(),'apple_refund','nuid-b','REFUND_FULL',100000,null);")
ok "a notification-sourced FULL refund applies"  "$(echo "$OUT" | J deniedSeconds)" "3600"
ok "…recording the notification uuid"            "$($C -c "select refund_notification_uuid from karaoke_apple_purchases where apple_transaction_id='txn-b';")" "nuid-b"
ok "…and NO evidence id"                         "$($C -c "select coalesce(refund_reconciliation_evidence_id::text,'null') from karaoke_apple_purchases where apple_transaction_id='txn-b';")" "null"
ok "…audit actor is the notification"            "$($C -c "select actor_ref from timed_access_pass_audit where pass_grant_id='$G2' and action='REVOKED';")" "apple_server_notification"

echo
echo "=== F. PROVENANCE IS STRUCTURALLY REQUIRED ==="
ok "a revoked purchase with NO provenance is refused" \
   "$($C -c "update karaoke_apple_purchases set refund_notification_uuid=null, refund_reconciliation_evidence_id=null where apple_transaction_id='txn-b';" 2>&1 | grep -qiE "refund_provenance|violates|ERROR" && echo refused || echo ALLOWED)" "refused"
ok "…and the row is unchanged"                   "$($C -c "select refund_notification_uuid from karaoke_apple_purchases where apple_transaction_id='txn-b';")" "nuid-b"

echo
echo "=== G. §AA CONCURRENCY — two reconciliation workers, one outcome ==="
G3=$(mkpaid txn-c)
E5=$(ev txn-c TRANSACTION_INFO digest-c "now()" "'REFUND_PRORATED'" 40000 | J evidenceId)
( $C -c "select apply_apple_purchase_refund('Sandbox','txn-c',now(),'apple_refund',null,'REFUND_PRORATED',40000,'$E5');" >/tmp/r2r-1.out 2>&1 ) &
( $C -c "select apply_apple_purchase_refund('Sandbox','txn-c',now(),'apple_refund',null,'REFUND_PRORATED',40000,'$E5');" >/tmp/r2r-2.out 2>&1 ) &
wait
ok "no deadlock"                       "$(cat /tmp/r2r-1.out /tmp/r2r-2.out | grep -ci deadlock)" "0"
ok "one terminal transition"           "$($C -c "select status from timed_access_pass_grants where id='$G3';")" "REVOKED"
ok "exactly ONE REVOKED audit"         "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G3' and action='REVOKED';")" "1"
ok "exactly ONE remainder"             "$($C -c "select count(*) from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='txn-c');")" "1"
( $C -c "select apply_apple_refund_reversal('Sandbox','txn-c',null,'$E5');" >/tmp/r2r-3.out 2>&1 ) &
( $C -c "select apply_apple_refund_reversal('Sandbox','txn-c','nuid-race',null);" >/tmp/r2r-4.out 2>&1 ) &
wait
ok "no deadlock on the reversal race"  "$(cat /tmp/r2r-3.out /tmp/r2r-4.out | grep -ci deadlock)" "0"
ok "…and exactly ONE credit, from either door" "$($C -c "select count(*) from timed_access_pass_grants where reversal_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='txn-c');")" "1"

echo
echo "=== H. NEGATIVE PROOF ==="
ok "reconciliation wrote NO notification inbox row" "$($C -c "select count(*) from karaoke_apple_server_notifications;")" "0"
ok "no evidence id ever landed in a notification column" \
   "$($C -c "select count(*) from karaoke_apple_purchases p join karaoke_apple_financial_reconciliation_evidence e on e.id::text in (coalesce(p.refund_notification_uuid,''), coalesce(p.reversal_notification_uuid,''));")" "0"
ok "every remainder is unpaid and unlinked"     "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_REMAINDER' and (is_paid or apple_purchase_id is not null);")" "0"
ok "no denied value exceeds a product duration" "$($C -c "select count(*) from karaoke_apple_purchases where refund_denied_seconds > 86400;")" "0"
ok "REFUND_CREDIT/REFUND_REMAINDER still uncatalogued" \
   "$($C -c "select count(*) from karaoke_product_catalog where pass_type in ('REFUND_CREDIT','REFUND_REMAINDER');")" "0"
ok "normal issuance still refuses both"         "$($C -c "select (issue_timed_access_pass('$A','REFUND_REMAINDER','x','k-x',jsonb_build_object('version',1,'source','T','actor_kind','SYSTEM','actor_id','t'))->>'error');")" "invalid_pass_type"
ok "audit remains immutable"                    "$($C -c "update timed_access_pass_audit set created_at=now() where pass_grant_id='$G1';" 2>&1 | grep -qiE "immutable|append-only|cannot|ERROR" && echo refused || echo ALLOWED)" "refused"
ok "verified claims are never destructively rewritten" \
   "$($C -c "select count(*) from karaoke_apple_financial_reconciliation_evidence where revocation_type='REFUND_PRORATED' and revocation_percentage=40000;")" "3"

echo
docker rm -f bty-r2r1 >/dev/null 2>&1
if [ "$FAIL" -eq 0 ]; then echo "ALL R4G-R2-R1 GATES PASS (0 failures)"; else echo "$FAIL FAILURE(S)"; fi
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
