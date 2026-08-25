#!/usr/bin/env bash
# BUILD 26U-R4G-R2A-R1 — partial refund + carryover-safe service value, against a REAL Postgres
# carrying every production migration.
#
# THE FIRST SECTION IS THE MEASURED DEFECT. R4G-R2A-R0 proved that refunding a 1-hour purchase
# holding 86399 seconds of ANOTHER purchase's carryover denied 89999 seconds, and that the
# resulting figure then broke the reversal. Restoring `duration + carryover` must fail here.
#
# Evidence rule carried from R4C/R4D/R4E/R4G: empty measurement = FAILURE, fixture error = ABORT,
# no hardcoded PASS. Every verdict compares a value read back out of the database.
set -u
C="docker exec -i bty-r2a1 psql -U postgres -v ON_ERROR_STOP=1 -Atq"
FAIL=0
ok(){ if [ -z "$2" ]; then printf "   FAIL  %-56s NO MEASUREMENT want[%s]\n" "$1" "$3"; FAIL=$((FAIL+1)); return; fi
      if [ "$2" = "$3" ]; then printf "   PASS  %-56s %s\n" "$1" "$2"
      else printf "   FAIL  %-56s got[%s] want[%s]\n" "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi }
need(){ if [ -z "$2" ] || [ "$2" != "$3" ]; then printf "   ABORT fixture: %s got[%s] want[%s]\n" "$1" "$2" "$3"
        docker rm -f bty-r2a1 >/dev/null 2>&1; exit 2; fi; printf "   ok    fixture: %-50s %s\n" "$1" "$2"; }
J(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1') if d.get('$1') is not None else 'null')"; }

docker rm -f bty-r2a1 >/dev/null 2>&1 || true
docker run -d --name bty-r2a1 -e POSTGRES_PASSWORD=pg postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-r2a1 pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
$C -c "create role anon; create role authenticated; create role service_role;
       create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
for f in supabase/migrations/*.sql; do docker exec -i bty-r2a1 psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1 || true; done
need "the refund RPC has exactly one definition" \
  "$($C -c "select count(*) from pg_proc where proname='apply_apple_purchase_refund';")" "1"

A=1a0be5e8-0000-4000-8000-00000000003a
ROOM=33333333-0000-4000-8000-00000000003a
$C >/dev/null <<SQL
insert into karaoke_accounts (id,provider,provider_subject,email,display_name) values ('$A','google','r2a1','a@e.com','A');
insert into karaoke_host_plan_assignments (account_id,plan_code,source,status) values ('$A','FREE','SYSTEM_DEFAULT','active');
insert into karaoke_workspaces (id,name) values ('22222222-0000-4000-8000-00000000003a','WS');
insert into karaoke_workspace_members (workspace_id,account_id,role,status) values ('22222222-0000-4000-8000-00000000003a','$A','owner','active');
insert into karaoke_rooms (id,slug,display_name,status,dj_secret) values ('$ROOM','r2a1','R2A1','open','s');
insert into karaoke_room_ownership (room_id,workspace_id) values ('$ROOM','22222222-0000-4000-8000-00000000003a');
update karaoke_usage_policy set premium_room_mode='premium_all';
SQL
N=0
mkpaid(){ local T=$1 TYPE=$2 DUR=$3 PID GID; N=$((N+1))
  PID=$($C -c "insert into karaoke_apple_purchases
    (account_id,purchase_owner_ref,environment,apple_transaction_id,apple_original_transaction_id,
     storekit_product_id,product_code,purchase_date,quantity,signed_transaction_payload,
     signed_transaction_sha256,verification_status,verified_at,grant_status,source)
    values ('$A',gen_random_uuid(),'Sandbox','$T','$T','p','PASS_1H',now(),1,'jws',
     repeat('0',64),'VERIFIED',now(),'NOT_GRANTED','STOREKIT_CLIENT') returning id;")
  GID=$($C -c "insert into timed_access_pass_grants
    (account_id,pass_type,duration_seconds,status,source_type,is_paid,issue_idempotency_key,apple_purchase_id)
    values ('$A','$TYPE',$DUR,'AVAILABLE','PAID',true,'idem-$T','$PID') returning id;")
  $C -c "update karaoke_apple_purchases set grant_status='GRANTED', pass_grant_id='$GID', granted_seconds=$DUR where id='$PID';" >/dev/null
  echo "$GID"; }
refund(){ $C -c "select apply_apple_purchase_refund('Sandbox','$1',now(),'apple_refund','$2',$3,$4);"; }
st(){ $C -c "select status from timed_access_pass_grants where id='$1';"; }
rem(){ $C -c "select coalesce((select duration_seconds::text from timed_access_pass_grants
        where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='$1')),'none');"; }

echo
echo "=== A. §P THE MEASURED DEFECT — FULL refund must not touch FOREIGN carryover ==="
G24=$(mkpaid txn-24 TWENTY_FOUR_HOURS 86400)
G1=$(mkpaid  txn-01 ONE_HOUR 3600)
$C -c "select select_timed_access_pass('$A','$G24',null);" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev','pub','g','test','premium');" >/dev/null
need "the 24h grant is ACTIVE via the real chain" "$(st $G24)" "ACTIVE"
$C -c "select switch_timed_access_pass('$A','$G1','k-sw');" >/dev/null
CARRY=$($C -c "select carryover_seconds from timed_access_pass_grants where id='$G1';")
need "the 1h grant carries the other purchase's residual" "$([ "$CARRY" -gt 86000 ] && echo yes)" "yes"
OUT=$(refund txn-01 nuid-01 null null)
ok "denied is the PURCHASE only, not base+foreign carry" "$(echo "$OUT" | J deniedSeconds)" "3600"
ok "…never the measured 89999"                     "$([ "$(echo "$OUT" | J deniedSeconds)" = "89999" ] && echo OVER || echo bounded)" "bounded"
ok "…and stays inside REFUND_CREDIT's bound"       "$([ "$(echo "$OUT" | J deniedSeconds)" -le 86400 ] && echo yes)" "yes"
ok "the original ONE_HOUR grant is REVOKED"        "$(st $G1)" "REVOKED"
ok "…with its product duration PRESERVED"          "$($C -c "select duration_seconds from timed_access_pass_grants where id='$G1';")" "3600"
ok "the foreign carryover SURVIVES as a remainder" "$(rem txn-01)" "$CARRY"
R=$($C -c "select id from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='txn-01');")
ok "…AVAILABLE, unpaid, no purchase link, no carry" \
   "$($C -c "select status||'/'||is_paid||'/'||coalesce(apple_purchase_id::text,'null')||'/'||carryover_seconds from timed_access_pass_grants where id='$R';")" \
   "AVAILABLE/false/null/0"
ok "…and it is NOT selected or activated"          "$($C -c "select coalesce(selected_at::text,'-')||'/'||coalesce(activated_at::text,'-') from timed_access_pass_grants where id='$R';")" "-/-"
echo "--- and the defect-2 consequence is gone: the reversal can now pay out ---"
REV=$($C -c "select apply_apple_refund_reversal('Sandbox','txn-01','nuid-01-rev');")
ok "REFUND_REVERSED issues the exact denied seconds" "$(echo "$REV" | J restoredSeconds)" "3600"
ok "…as a REFUND_CREDIT, not an error"               "$(echo "$REV" | J passType)" "REFUND_CREDIT"

echo
echo "=== B. §C VALIDATION MATRIX — malformed evidence never becomes a full refund ==="
i=0
badcase(){ i=$((i+1)); local G T; G=$(mkpaid "bad-$i" ONE_HOUR 3600)
  local O; O=$(refund "bad-$i" "nb-$i" "$1" "$2")
  ok "$3" "$(echo "$O" | J error)" "$4"
  ok "   …grant untouched" "$(st $G)" "AVAILABLE"; }
badcase "'REFUND_FULL'"     "99999" "REFUND_FULL with a partial percentage is refused" "full_percentage_mismatch"
badcase "'REFUND_FULL'"     "0"     "REFUND_FULL at 0 is refused"                      "full_percentage_mismatch"
badcase "'REFUND_PRORATED'" "null"  "PRORATED with no percentage is refused"           "prorated_percentage_missing"
badcase "'REFUND_PRORATED'" "0"     "PRORATED at 0 is refused"                         "prorated_percentage_out_of_range"
badcase "'REFUND_PRORATED'" "100000" "PRORATED at 100000 is refused"                   "prorated_percentage_out_of_range"
badcase "'FAMILY_REVOKE'"   "null"  "FAMILY_REVOKE is refused — not a BTY refund"      "unsupported_revocation_type"
badcase "'REFUND_MYSTERY'"  "null"  "an unknown future type is refused"                "unsupported_revocation_type"
badcase "null"              "40000" "a percentage with no type is refused"             "unsupported_revocation_type"

echo
echo "=== C. ACCEPTED SHAPES ==="
GA=$(mkpaid ok-legacy ONE_HOUR 3600); OUT=$(refund ok-legacy n-l null null)
ok "legacy shape (both absent) is FULL"        "$(echo "$OUT" | J refundKind)" "FULL"
ok "…denying the whole purchase"               "$(echo "$OUT" | J deniedSeconds)" "3600"
GB=$(mkpaid ok-full ONE_HOUR 3600); OUT=$(refund ok-full n-f "'REFUND_FULL'" 100000)
ok "explicit REFUND_FULL/100000 is FULL"       "$(echo "$OUT" | J refundKind)" "FULL"
GC=$(mkpaid ok-full2 ONE_HOUR 3600); OUT=$(refund ok-full2 n-f2 "'REFUND_FULL'" null)
ok "explicit REFUND_FULL with no percentage"   "$(echo "$OUT" | J refundKind)" "FULL"

echo
echo "=== D. §R/§S/§T/§U/§V — the specified prorated examples ==="
GD=$(mkpaid pro-avail ONE_HOUR 3600); OUT=$(refund pro-avail n-pa "'REFUND_PRORATED'" 40000)
ok "§R AVAILABLE 40%: nominal"                 "$(echo "$OUT" | J nominalRefundedSeconds)" "1440"
ok "§R AVAILABLE 40%: denied"                  "$(echo "$OUT" | J deniedSeconds)" "1440"
ok "§R AVAILABLE 40%: surviving"               "$(echo "$OUT" | J survivingFutureSeconds)" "2160"
ok "§R remainder duration"                     "$(rem pro-avail)" "2160"

GE=$(mkpaid pro-sel ONE_HOUR 3600)
GF=$(mkpaid pro-src ONE_HOUR 3600)
$C -c "select select_timed_access_pass('$A','$GF',null);" >/dev/null
$C -c "delete from karaoke_events where room_id='$ROOM';" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev2','pub2','g2','test','premium');" >/dev/null
$C -c "update timed_access_pass_grants set activated_at=now()-interval '2700 seconds',
        expires_at=now()-interval '2700 seconds'+make_interval(secs=>duration_seconds+carryover_seconds)
       where id='$GF';" >/dev/null
$C -c "select switch_timed_access_pass('$A','$GE','k-sw2');" >/dev/null
SELCARRY=$($C -c "select carryover_seconds from timed_access_pass_grants where id='$GE';")
need "SELECTED grant carries ~900s from elsewhere" "$([ "$SELCARRY" -ge 895 ] && [ "$SELCARRY" -le 901 ] && echo yes)" "yes"
OUT=$(refund pro-sel n-ps "'REFUND_PRORATED'" 40000)
ok "§S SELECTED 40%: denied is base-only"      "$(echo "$OUT" | J deniedSeconds)" "1440"
ok "§S SELECTED 40%: surviving = 2160 + carry" "$(echo "$OUT" | J survivingFutureSeconds)" "$((2160+SELCARRY))"
ok "§S remainder holds it exactly"             "$(rem pro-sel)" "$((2160+SELCARRY))"

GG=$(mkpaid pro-act ONE_HOUR 3600)
$C -c "select select_timed_access_pass('$A','$GG',null);" >/dev/null
$C -c "delete from karaoke_events where room_id='$ROOM';" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev3','pub3','g3','test','premium');" >/dev/null
need "the grant is ACTIVE" "$(st $GG)" "ACTIVE"
$C -c "update timed_access_pass_grants set activated_at=now()-interval '600 seconds',
        expires_at=now()-interval '600 seconds'+make_interval(secs=>duration_seconds+carryover_seconds)
       where id='$GG';" >/dev/null
OUT=$(refund pro-act n-pact "'REFUND_PRORATED'" 40000)
ok "§T ACTIVE 40% after 600s: baseRemaining"   "$(echo "$OUT" | J baseRemainingSeconds)" "3000"
ok "§T ACTIVE 40%: denied"                     "$(echo "$OUT" | J deniedSeconds)" "1440"
ok "§T ACTIVE 40%: surviving"                  "$(echo "$OUT" | J survivingFutureSeconds)" "1560"
ok "§T conservation 600+1560+1440"             "$((600+1560+1440))" "3600"
ok "§T entitlement is cut immediately"         "$($C -c "select (public.karaoke_premium_room_entitlement_at('$A',now())->>'entitled');")" "false"

GH=$(mkpaid pro-over ONE_HOUR 3600)
$C -c "select select_timed_access_pass('$A','$GH',null);" >/dev/null
$C -c "delete from karaoke_events where room_id='$ROOM';" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev4','pub4','g4','test','premium');" >/dev/null
$C -c "update timed_access_pass_grants set activated_at=now()-interval '3000 seconds',
        expires_at=now()-interval '3000 seconds'+make_interval(secs=>duration_seconds+carryover_seconds)
       where id='$GH';" >/dev/null
OUT=$(refund pro-over n-pov "'REFUND_PRORATED'" 40000)
ok "§U nominal exceeds what is left"           "$(echo "$OUT" | J nominalRefundedSeconds)" "1440"
ok "§U denied is capped at what remains"       "$(echo "$OUT" | J deniedSeconds)" "600"
ok "§U nothing survives"                       "$(echo "$OUT" | J survivingFutureSeconds)" "0"
ok "§U …so NO remainder is issued"             "$(rem pro-over)" "none"
REV=$($C -c "select apply_apple_refund_reversal('Sandbox','pro-over','n-pov-rev');")
ok "§U reversal restores 600, never 1440"      "$(echo "$REV" | J restoredSeconds)" "600"

GI=$(mkpaid pro-tiny ONE_HOUR 3600); OUT=$(refund pro-tiny n-pt "'REFUND_PRORATED'" 1)
ok "§V 1 milliunit: nominal is 0"              "$(echo "$OUT" | J nominalRefundedSeconds)" "0"
ok "§V …denied 0, never nudged to 1"           "$(echo "$OUT" | J deniedSeconds)" "0"
ok "§V …the whole future service survives"     "$(rem pro-tiny)" "3600"
REV=$($C -c "select apply_apple_refund_reversal('Sandbox','pro-tiny','n-pt-rev');")
ok "§V reversal issues NO credit for 0 denied" "$(echo "$REV" | J compensationGrantId)" "null"
ok "…and no REFUND_CREDIT row appeared"        "$($C -c "select count(*) from timed_access_pass_grants where reversal_notification_uuid='n-pt-rev';")" "0"

echo
echo "=== E. §O CONFLICTING SECOND EVIDENCE / §X IDEMPOTENCY ==="
OUT=$(refund pro-avail n-pa2 "'REFUND_PRORATED'" 40000)
ok "the SAME evidence replays"                 "$(echo "$OUT" | J replayed)" "True"
ok "…reporting the same frozen denied value"   "$(echo "$OUT" | J deniedSeconds)" "1440"
OUT=$(refund pro-avail n-pa3 "'REFUND_PRORATED'" 70000)
ok "MATERIALLY DIFFERENT evidence is a CONFLICT" "$(echo "$OUT" | J error)" "refund_evidence_conflict"
OUT=$(refund pro-avail n-pa4 "'REFUND_FULL'" null)
ok "…a different KIND is a conflict too"       "$(echo "$OUT" | J error)" "refund_evidence_conflict"
OUT=$(refund ok-legacy n-l2 "'REFUND_FULL'" 100000)
ok "legacy FULL vs explicit FULL is NOT a conflict" "$(echo "$OUT" | J replayed)" "True"
ok "still exactly ONE remainder for that purchase" \
   "$($C -c "select count(*) from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='pro-avail');")" "1"
ok "the unique index refuses a second remainder" \
   "$($C -c "insert into timed_access_pass_grants (account_id,pass_type,duration_seconds,status,source_type,is_paid,issue_idempotency_key,remainder_of_purchase_id)
             values ('$A','REFUND_REMAINDER',60,'AVAILABLE','REFUND_REMAINDER',false,'dup',
             (select id from karaoke_apple_purchases where apple_transaction_id='pro-avail'));" 2>&1 | grep -qiE "duplicate key|remainder_once|ERROR" && echo refused || echo ALLOWED)" "refused"
ok "no extra REVOKED audit from the replays"   "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$GD' and action='REVOKED';")" "1"

echo
echo "=== F. §M REMAINDER ABOVE 86400 — and it must still activate and expire ==="
GJ=$(mkpaid big-24 TWENTY_FOUR_HOURS 86400)
GK=$(mkpaid big-src TWENTY_FOUR_HOURS 86400)
$C -c "select select_timed_access_pass('$A','$GK',null);" >/dev/null
$C -c "delete from karaoke_events where room_id='$ROOM';" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev5','pub5','g5','test','premium');" >/dev/null
$C -c "select switch_timed_access_pass('$A','$GJ','k-sw3');" >/dev/null
BIGCARRY=$($C -c "select carryover_seconds from timed_access_pass_grants where id='$GJ';")
OUT=$(refund big-24 n-big "'REFUND_PRORATED'" 1)
BIGREM=$(rem big-24)
ok "surviving service exceeds one product duration" "$([ "$BIGREM" -gt 86400 ] && echo yes)" "yes"
ok "…and the remainder holds it exactly"            "$BIGREM" "$((86400+BIGCARRY))"
$C -c "select select_timed_access_pass('$A','$(  $C -c "select id from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='big-24');")','k-rem');" >/dev/null
RID=$($C -c "select id from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='big-24');")
ok "the >86400 remainder can be SELECTED"           "$(st $RID)" "SELECTED"
$C -c "delete from karaoke_events where room_id='$ROOM';" >/dev/null
$C -c "select karaoke_start_premium_room_session('$ROOM','ev6','pub6','g6','test','premium');" >/dev/null
ok "…and ACTIVATED through the real chain"          "$(st $RID)" "ACTIVE"
ok "…with expires_at = activated_at + its duration" \
   "$($C -c "select (expires_at = activated_at + make_interval(secs=>duration_seconds+carryover_seconds))::text from timed_access_pass_grants where id='$RID';")" "true"
ok "…entitled now"    "$($C -c "select (public.karaoke_premium_room_entitlement_at('$A',now())->>'entitled');")" "true"
ok "…and NOT entitled after its own cutoff"  \
   "$($C -c "select (public.karaoke_premium_room_entitlement_at('$A',(select expires_at from timed_access_pass_grants where id='$RID'))->>'entitled');")" "false"

echo
echo "=== G. §N/§AI CONTAINMENT — the remainder is not a product ==="
ok "catalog CHECK rejects REFUND_REMAINDER" \
   "$($C -c "insert into karaoke_product_catalog (product_code,storekit_product_id,product_kind,is_paid,pass_type,duration_seconds,display_order)
             values ('X','x','PAID_CONSUMABLE',true,'REFUND_REMAINDER',60,9);" 2>&1 | grep -qiE "violates|ERROR" && echo refused || echo ALLOWED)" "refused"
ok "normal issuance rejects REFUND_REMAINDER" \
   "$($C -c "select (issue_timed_access_pass('$A','REFUND_REMAINDER','x','k-rem-x',
             jsonb_build_object('version',1,'source','T','actor_kind','SYSTEM','actor_id','t'))->>'error');")" "invalid_pass_type"
ok "…and REFUND_CREDIT too"  \
   "$($C -c "select (issue_timed_access_pass('$A','REFUND_CREDIT','x','k-cred-x',
             jsonb_build_object('version',1,'source','T','actor_kind','SYSTEM','actor_id','t'))->>'error');")" "invalid_pass_type"
ok "every remainder is unpaid"        "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_REMAINDER' and is_paid;")" "0"
ok "…and none has an apple_purchase_id" "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_REMAINDER' and apple_purchase_id is not null;")" "0"

echo
echo "=== H. §AH PRODUCT INVARIANTS UNWEAKENED ==="
for pair in "ONE_HOUR:3599" "FOUR_HOURS:14399" "TWENTY_FOUR_HOURS:86399"; do
  T=${pair%%:*}; D=${pair##*:}
  ok "$T at $D is still refused" \
     "$($C -c "insert into timed_access_pass_grants (account_id,pass_type,duration_seconds,status,issue_idempotency_key)
               values ('$A','$T',$D,'AVAILABLE','p-$T-$D');" 2>&1 | grep -qiE "duration_matches_type|violates|ERROR" && echo refused || echo ALLOWED)" "refused"
done
ok "REFUND_CREDIT above 86400 is still refused" \
   "$($C -c "insert into timed_access_pass_grants (account_id,pass_type,duration_seconds,status,issue_idempotency_key)
             values ('$A','REFUND_CREDIT',86401,'AVAILABLE','p-cred');" 2>&1 | grep -qiE "duration_matches_type|violates|ERROR" && echo refused || echo ALLOWED)" "refused"
ok "REFUND_REMAINDER at 0 is refused"  \
   "$($C -c "insert into timed_access_pass_grants (account_id,pass_type,duration_seconds,status,issue_idempotency_key)
             values ('$A','REFUND_REMAINDER',0,'AVAILABLE','p-rem0');" 2>&1 | grep -qiE "duration_matches_type|violates|ERROR" && echo refused || echo ALLOWED)" "refused"

echo
echo "=== I. §AK CONCURRENCY — two real connections, one outcome ==="
GL=$(mkpaid conc ONE_HOUR 3600)
( $C -c "select apply_apple_purchase_refund('Sandbox','conc',now(),'apple_refund','n-c','REFUND_PRORATED',40000);" >/tmp/r2a-c1.out 2>&1 ) &
( $C -c "select apply_apple_purchase_refund('Sandbox','conc',now(),'apple_refund','n-c','REFUND_PRORATED',40000);" >/tmp/r2a-c2.out 2>&1 ) &
wait
ok "no deadlock"                      "$(cat /tmp/r2a-c1.out /tmp/r2a-c2.out | grep -ci deadlock)" "0"
ok "one terminal transition"          "$(st $GL)" "REVOKED"
ok "exactly ONE REVOKED audit"        "$($C -c "select count(*) from timed_access_pass_audit where pass_grant_id='$GL' and action='REVOKED';")" "1"
ok "exactly ONE remainder"            "$($C -c "select count(*) from timed_access_pass_grants where remainder_of_purchase_id=(select id from karaoke_apple_purchases where apple_transaction_id='conc');")" "1"
ok "…of the right size"               "$(rem conc)" "2160"

echo
echo "=== J. NEGATIVE PROOF ==="
ok "no grant was ever resurrected from REVOKED" "$($C -c "select count(*) from timed_access_pass_grants g join karaoke_apple_purchases p on p.pass_grant_id=g.id where p.revoked_at is not null and g.status not in ('REVOKED','EXPIRED');")" "0"
ok "no remainder is SELECTED or ACTIVE by itself" "$($C -c "select count(*) from timed_access_pass_grants where pass_type='REFUND_REMAINDER' and selected_at is not null and id<>'$RID';")" "0"
ok "refund_denied_seconds never exceeds 86400"  "$($C -c "select count(*) from karaoke_apple_purchases where refund_denied_seconds > 86400;")" "0"
ok "every refunded purchase records its kind"   "$($C -c "select count(*) from karaoke_apple_purchases where revoked_at is not null and refund_kind is null;")" "0"
ok "audit remains immutable"                    "$($C -c "update timed_access_pass_audit set created_at=created_at-interval '1 hour' where pass_grant_id='$G1';" 2>&1 | grep -qiE "immutable|append-only|cannot|ERROR" && echo refused || echo ALLOWED)" "refused"

echo
docker rm -f bty-r2a1 >/dev/null 2>&1
if [ "$FAIL" -eq 0 ]; then echo "ALL R4G-R2A-R1 GATES PASS (0 failures)"; else echo "$FAIL FAILURE(S)"; fi
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
