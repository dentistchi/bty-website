#!/usr/bin/env bash
# BUILD 26U-R4E-R4-R1 — exact partial refund-reversal credit.
# Evidence rule carried from R4C/R4D/R4E: empty measurement = FAILURE, fixture error = ABORT,
# no hardcoded PASS. Every verdict compares a value read back out of the database.
set -u
export PGPASSWORD=pg
C="docker exec -i bty-r4 psql -U postgres -v ON_ERROR_STOP=1 -Atq"
FAIL=0
ok(){ if [ -z "$2" ]; then printf "   FAIL  %-56s NO MEASUREMENT want[%s]\n" "$1" "$3"; FAIL=$((FAIL+1)); return; fi
      if [ "$2" = "$3" ]; then printf "   PASS  %-56s %s\n" "$1" "$2"
      else printf "   FAIL  %-56s got[%s] want[%s]\n" "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi }
need(){ if [ -z "$2" ] || [ "$2" != "$3" ]; then printf "   ABORT fixture: %s got[%s] want[%s]\n" "$1" "$2" "$3"
        docker rm -f bty-r4 >/dev/null 2>&1; exit 2; fi; printf "   ok    fixture: %-50s %s\n" "$1" "$2"; }

docker rm -f bty-r4 >/dev/null 2>&1 || true
docker run -d --name bty-r4 -e POSTGRES_PASSWORD=pg -p 54499:5432 postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-r4 pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
$C -c "create role anon; create role authenticated; create role service_role;
       create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
for f in supabase/migrations/*.sql; do docker exec -i bty-r4 psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1 || true; done

ACC=1a0be5e8-0000-4000-8000-00000000c001
ROOM=33333333-0000-4000-8000-00000000c001
$C >/dev/null <<SQL
insert into karaoke_accounts (id,provider,provider_subject,email,display_name) values ('$ACC','google','r4','r4@e.com','R4');
insert into karaoke_host_plan_assignments (account_id,plan_code,source,status) values ('$ACC','FREE','SYSTEM_DEFAULT','active');
insert into karaoke_workspaces (id,name) values ('22222222-0000-4000-8000-00000000c001','WS');
insert into karaoke_workspace_members (workspace_id,account_id,role,status) values ('22222222-0000-4000-8000-00000000c001','$ACC','owner','active');
insert into karaoke_rooms (id,slug,display_name,status,dj_secret) values ('$ROOM','r4-credit','R4','open','s');
insert into karaoke_room_ownership (room_id,workspace_id) values ('$ROOM','22222222-0000-4000-8000-00000000c001');
update karaoke_usage_policy set premium_room_mode='premium_all';
SQL

# A refunded purchase with an EXACT denied value, built through the real ledger shape.
refunded(){ # refunded <txn> <suffix> <denied> -> purchase id
  local T=$1 S=$2 D=$3 PID
  PID=$($C -c "insert into karaoke_apple_purchases
    (account_id,purchase_owner_ref,environment,apple_transaction_id,apple_original_transaction_id,
     storekit_product_id,product_code,purchase_date,quantity,signed_transaction_payload,
     signed_transaction_sha256,verification_status,verified_at,grant_status,source,
     revoked_at,refunded_at,revocation_reason,refund_denied_seconds,
     refund_notification_uuid,refund_kind)
    values ('$ACC','ffffffff-0000-4000-8000-0000000000$S','Sandbox','$T','$T',
     'com.btydaily.norebang.pass.1hour','PASS_1H',now(),1,'jws',repeat('0',64),
     'REVOKED',now(),'NOT_GRANTED','STOREKIT_CLIENT',now(),now(),'apple_refund',$D,
     -- BUILD 26U-R4G-R2-R1 — a refunded row must now be able to say where the refund came from
     -- (karaoke_apple_purchases_refund_provenance_chk). This fixture stands in for a notification-
     -- sourced refund, so it names one rather than leaving the origin blank.
     'fixture-nuid-$S','FULL') returning id;")
  echo "$PID"
}
rev(){ $C -c "select apply_apple_refund_reversal('Sandbox','$1','$2');"; }
credit(){ $C -c "select id from timed_access_pass_grants where reversal_notification_uuid='$1';"; }
st(){ $C -c "select status from timed_access_pass_grants where id='$1';"; }

echo
echo "=== §U THE REVERSAL MATRIX ==="
for pair in "0:c0:no-grant" "1:c1:1" "3599:c2:3599" "3600:c3:3600" "86400:c4:86400"; do
  D=${pair%%:*}; rest=${pair#*:}; S=${rest%%:*}; WANT=${rest##*:}
  refunded "txn-$S" "$S" "$D" >/dev/null
  OUT=$(rev "txn-$S" "uuid-$S")
  G=$(credit "uuid-$S")
  if [ "$WANT" = "no-grant" ]; then
    ok "denied=$D -> no compensation grant" "$([ -z "$G" ] && echo none || echo "$G")" "none"
  else
    ok "denied=$D -> credit duration"       "$($C -c "select duration_seconds from timed_access_pass_grants where id='$G';")" "$WANT"
    ok "denied=$D -> pass_type"             "$($C -c "select pass_type from timed_access_pass_grants where id='$G';")" "REFUND_CREDIT"
    ok "denied=$D -> AVAILABLE"             "$(st $G)" "AVAILABLE"
    ok "denied=$D -> not paid"              "$($C -c "select is_paid::text from timed_access_pass_grants where id='$G';")" "false"
    ok "denied=$D -> no apple_purchase_id"  "$($C -c "select coalesce(apple_purchase_id::text,'null') from timed_access_pass_grants where id='$G';")" "null"
    ok "denied=$D -> carryover 0"           "$($C -c "select coalesce(carryover_seconds,0) from timed_access_pass_grants where id='$G';")" "0"
    ok "denied=$D -> reversal provenance"   "$($C -c "select (reversal_of_purchase_id is not null)::text from timed_access_pass_grants where id='$G';")" "true"
    ok "denied=$D -> exactly one ISSUED audit" "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G' and action='ISSUED';")" "1"
  fi
done

echo
echo "=== §U CASE 6 — above the maximum fails closed, never clamped ==="
refunded "txn-over" "c5" "86401" >/dev/null
OUT=$(rev "txn-over" "uuid-c5")
ok "denied=86401 refused"              "$(echo "$OUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('error',''))")" "denied_seconds_out_of_range"
ok "…and no grant was created"         "$($C -c "select count(*) from timed_access_pass_grants where reversal_notification_uuid='uuid-c5';")" "0"
ok "…no clamped 86400 grant leaked in" "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_CREDIT' and reversal_notification_uuid='uuid-c5';")" "0"

echo
echo "=== §U CASES 7-8 — duplicate and non-refunded ==="
ok "duplicate reversal is replayed"    "$(rev "txn-c2" "uuid-c2" | python3 -c "import sys,json;print(json.load(sys.stdin)['replayed'])")" "True"
ok "…still exactly one credit"         "$($C -c "select count(*) from timed_access_pass_grants where reversal_notification_uuid='uuid-c2';")" "1"
$C -c "insert into karaoke_apple_purchases (account_id,purchase_owner_ref,environment,apple_transaction_id,apple_original_transaction_id,storekit_product_id,product_code,purchase_date,quantity,signed_transaction_payload,signed_transaction_sha256,verification_status,verified_at,grant_status,source) values ('$ACC','ffffffff-0000-4000-8000-0000000000c9','Sandbox','txn-clean','txn-clean','com.btydaily.norebang.pass.1hour','PASS_1H',now(),1,'jws',repeat('0',64),'VERIFIED',now(),'NOT_GRANTED','STOREKIT_CLIENT');" >/dev/null
ok "non-refunded purchase refused"     "$(rev "txn-clean" "uuid-clean" | python3 -c "import sys,json;print(json.load(sys.stdin).get('error',''))")" "purchase_not_refunded"

echo
echo "=== §AB PRODUCT INVARIANTS ARE UNWEAKENED ==="
mk(){ docker exec -i bty-r4 psql -U postgres -Atq -c "insert into timed_access_pass_grants (account_id,pass_type,duration_seconds,status,issue_idempotency_key) values ('$ACC','$1',$2,'AVAILABLE','probe-$3');" 2>&1; }
ok "ONE_HOUR at 3599 is refused"          "$(mk ONE_HOUR 3599 a | grep -qi 'duration_matches_type' && echo refused || echo ALLOWED)" "refused"
ok "FOUR_HOURS at 14399 is refused"       "$(mk FOUR_HOURS 14399 b | grep -qi 'duration_matches_type' && echo refused || echo ALLOWED)" "refused"
ok "TWENTY_FOUR_HOURS at 86399 refused"   "$(mk TWENTY_FOUR_HOURS 86399 c | grep -qi 'duration_matches_type' && echo refused || echo ALLOWED)" "refused"
ok "REFUND_CREDIT at 0 is refused"        "$(mk REFUND_CREDIT 0 d | grep -qi 'duration_matches_type' && echo refused || echo ALLOWED)" "refused"
ok "REFUND_CREDIT at 86401 is refused"    "$(mk REFUND_CREDIT 86401 e | grep -qi 'duration_matches_type' && echo refused || echo ALLOWED)" "refused"

echo
echo "=== §S/§L CONTAINMENT ==="
# Asserted TWO ways, because the first draft grepped the error for "pass_type" and the CATALOG's
# duration constraint fires first for 3599 — so a genuine refusal was reported as ALLOWED. The
# refusal is now measured by outcome (no row exists), and the pass_type CHECK is read directly
# from the catalogue so its vocabulary is pinned regardless of which constraint trips first.
docker exec -i bty-r4 psql -U postgres -Atq -c "insert into karaoke_product_catalog (product_code,storekit_product_id,product_kind,is_paid,pass_type,duration_seconds,display_order) values ('X','x','PAID_CONSUMABLE',true,'REFUND_CREDIT',3599,9);" >/dev/null 2>&1
ok "catalog holds NO REFUND_CREDIT row"   "$($C -c "select count(*) from karaoke_product_catalog where pass_type='REFUND_CREDIT';")" "0"
ok "catalog CHECK excludes REFUND_CREDIT" "$($C -c "select (pg_get_constraintdef(oid) not like '%REFUND_CREDIT%')::text from pg_constraint where conname='karaoke_product_catalog_pass_type_check';")" "true"
ok "grant CHECK includes REFUND_CREDIT"   "$($C -c "select (pg_get_constraintdef(oid) like '%REFUND_CREDIT%')::text from pg_constraint where conname='timed_access_pass_grants_pass_type_check';")" "true"
ok "issue RPC REJECTS REFUND_CREDIT"      "$($C -c "select (issue_timed_access_pass('$ACC','REFUND_CREDIT','x','k-x',jsonb_build_object('source','S','actor_kind','SYSTEM','actor_id','a','version',1))->>'error');")" "invalid_pass_type"
ok "exactly ONE writer emits REFUND_CREDIT" "$($C -c "select count(*) from pg_proc where prosrc like '%''REFUND_CREDIT''%' and proname not like 'pg_%';")" "1"
ok "…and it is the reversal RPC"          "$($C -c "select proname from pg_proc where prosrc like '%''REFUND_CREDIT''%' and proname not like 'pg_%';")" "apply_apple_refund_reversal"

echo
echo "=== §V THE 3599 CREDIT THROUGH THE FROZEN LIFECYCLE ==="
G=$(credit "uuid-c2")
need "the 3599 credit exists" "$($C -c "select duration_seconds from timed_access_pass_grants where id='$G';")" "3599"
ok "issuance did NOT start a clock"     "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$G';")" "null"
$C -c "select select_timed_access_pass('$ACC','$G',null);" >/dev/null
ok "AVAILABLE -> SELECTED"              "$(st $G)" "SELECTED"
ok "selection still starts no clock"    "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$G';")" "null"
$C -c "select karaoke_start_premium_room_session('$ROOM','ev','pub','g','t','premium');" >/dev/null
ok "SELECTED -> ACTIVE"                 "$(st $G)" "ACTIVE"
ok "window is EXACTLY 3599 seconds"     "$($C -c "select extract(epoch from (expires_at - activated_at))::int from timed_access_pass_grants where id='$G';")" "3599"
ok "…and it is still REFUND_CREDIT"     "$($C -c "select pass_type from timed_access_pass_grants where id='$G';")" "REFUND_CREDIT"
ok "exactly one ACTIVATED audit"        "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$G' and action='ACTIVATED';")" "1"

echo
echo "=== §J R4C ENTITLEMENT/EXPIRY, UNCHANGED FOR A CREDIT ==="
EXP=$($C -c "select expires_at from timed_access_pass_grants where id='$G';")
ent(){ $C -c "select (public.karaoke_premium_room_entitlement_at('$ACC','$1'::timestamptz)->>'entitled');"; }
eff(){ $C -c "select (public.karaoke_timed_pass_state_at('$ACC','$1'::timestamptz)->>'effectiveEntitlement');"; }
ok "before cutoff  -> entitled"         "$(ent "$($C -c "select ('$EXP'::timestamptz - interval '1 second')::text;")")" "true"
ok "before cutoff  -> TIMED_ACCESS"     "$(eff "$($C -c "select ('$EXP'::timestamptz - interval '1 second')::text;")")" "TIMED_ACCESS"
ok "exact cutoff   -> NOT entitled"     "$(ent "$EXP")" "false"
ok "after cutoff   -> NOT entitled"     "$(ent "$($C -c "select ('$EXP'::timestamptz + interval '1 second')::text;")")" "false"
ok "after cutoff   -> FREE"             "$(eff "$($C -c "select ('$EXP'::timestamptz + interval '1 second')::text;")")" "FREE"

echo
echo "=== §W CONTINUITY — original terminal, unrelated untouched ==="
# The credit for denied=3600 stands in for an unrelated AVAILABLE grant.
OTHER=$(credit "uuid-c3")
ok "unrelated credit still AVAILABLE"   "$(st $OTHER)" "AVAILABLE"
ok "it was NOT auto-selected"           "$($C -c "select coalesce(selected_at::text,'null') from timed_access_pass_grants where id='$OTHER';")" "null"
ok "it was NOT auto-activated"          "$($C -c "select coalesce(activated_at::text,'null') from timed_access_pass_grants where id='$OTHER';")" "null"
ok "no REVOKED grant was resurrected"   "$($C -c "select count(*) from timed_access_pass_grants where status='REVOKED';")" "0"
ok "no grant carries carryover"         "$($C -c "select coalesce(sum(carryover_seconds),0) from timed_access_pass_grants where account_id='$ACC';")" "0"

echo
echo "=== §X RECOVERY / LIVE ORDERING — one credit either way ==="
# recovery first, then a live delivery of the same UUID
$C -c "select karaoke_record_apple_notification('uuid-c2','REFUND_REVERSED',null,'Sandbox','txn-c2','txn-c2',now(),'d1','API_RECOVERY');" >/dev/null
ok "recovery recorded first"            "$($C -c "select discovery_source from karaoke_apple_server_notifications where notification_uuid='uuid-c2';")" "API_RECOVERY"
# BUILD 26U-R4G-R1 — `duplicate` is gone; what this gate protects is that the second arrival adds
# no second evidence row and rewrites no provenance. Whether it is REPROCESSED is now the
# processing status's business, not the row's existence.
ok "live delivery inserts no second row" "$($C -c "select (karaoke_record_apple_notification('uuid-c2','REFUND_REVERSED',null,'Sandbox','txn-c2','txn-c2',now(),'d1','SERVER_NOTIFICATION')->>'inserted');")" "false"
ok "…provenance not overwritten"        "$($C -c "select discovery_source from karaoke_apple_server_notifications where notification_uuid='uuid-c2';")" "API_RECOVERY"
ok "…still exactly ONE credit"          "$($C -c "select count(*) from timed_access_pass_grants where reversal_notification_uuid='uuid-c2';")" "1"
# live first, then recovery
$C -c "select karaoke_record_apple_notification('uuid-c3','REFUND_REVERSED',null,'Sandbox','txn-c3','txn-c3',now(),'d2','SERVER_NOTIFICATION');" >/dev/null
ok "live recorded first"                "$($C -c "select discovery_source from karaoke_apple_server_notifications where notification_uuid='uuid-c3';")" "SERVER_NOTIFICATION"
ok "recovery inserts no second row"     "$($C -c "select (karaoke_record_apple_notification('uuid-c3','REFUND_REVERSED',null,'Sandbox','txn-c3','txn-c3',now(),'d2','API_RECOVERY')->>'inserted');")" "false"
ok "…still exactly ONE credit"          "$($C -c "select count(*) from timed_access_pass_grants where reversal_notification_uuid='uuid-c3';")" "1"

echo
echo "=== §AB TOTALS ==="
ok "every REFUND_CREDIT is unpaid"      "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_CREDIT' and is_paid;")" "0"
ok "every REFUND_CREDIT is REFUND_REVERSAL" "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_CREDIT' and source_type<>'REFUND_REVERSAL';")" "0"
ok "no REFUND_CREDIT has a purchase link"   "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_CREDIT' and apple_purchase_id is not null;")" "0"
ok "credits created"                    "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_CREDIT';")" "4"

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL R4E-R4 GATES PASS (0 failures)"; else echo "FAILURES: $FAIL"; fi
docker rm -f bty-r4 >/dev/null 2>&1
exit $FAIL
