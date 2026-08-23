set -u
export PGPASSWORD=pg
P=54494
docker rm -f bty-g3 >/dev/null 2>&1 || true
docker run -d --name bty-g3 -e POSTGRES_PASSWORD=pg -p $P:5432 postgres:15 >/dev/null
for i in $(seq 1 40); do docker exec bty-g3 pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
psql -h 127.0.0.1 -p $P -U postgres -q -c "create role anon; create role authenticated; create role service_role; create extension if not exists pgcrypto; create schema if not exists auth;" >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  psql -h 127.0.0.1 -p $P -U postgres -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1 || true
done
q(){ psql -h 127.0.0.1 -p $P -U postgres -Atc "$1"; }
A=1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c
q "insert into public.karaoke_accounts (id,provider,provider_subject,email,display_name) values ('$A','google','r4','r4@e.com','R4');" >/dev/null
q "insert into public.karaoke_host_plan_assignments (account_id,plan_code,source,status) values ('$A','FREE','SYSTEM_DEFAULT','active');" >/dev/null
# A PAID grant must link to a verified purchase (timed_pass_paid_linkage_chk), so the fixture
# builds the real chain rather than a paid-looking row: purchase first, then the linked grant.
q "insert into public.karaoke_apple_purchases (id,account_id,purchase_owner_ref,environment,apple_transaction_id,apple_original_transaction_id,storekit_product_id,product_code,purchase_date,quantity,signed_transaction_payload,signed_transaction_sha256,verification_status,verified_at,grant_status,source)
   values ('eeeeeeee-0000-4000-8000-00000000000e','$A','ffffffff-0000-4000-8000-00000000000f','Sandbox','seed-txn-1','seed-txn-1','com.btydaily.norebang.pass.1hour','PASS_1H',now(),1,'seed','0000000000000000000000000000000000000000000000000000000000000000','VERIFIED',now(),'NOT_GRANTED','MANUAL_RECONCILIATION');" >/dev/null
q "insert into public.timed_access_pass_grants (id,account_id,pass_type,duration_seconds,status,source_type,is_paid,issue_reason,issue_idempotency_key,apple_purchase_id)
   values ('aaaaaaaa-0000-4000-8000-000000000001','$A','ONE_HOUR',3600,'AVAILABLE','PAID',true,null,'seed-paid','eeeeeeee-0000-4000-8000-00000000000e'),
          ('bbbbbbbb-0000-4000-8000-000000000002','$A','ONE_HOUR',3600,'AVAILABLE','MANUAL_PROMOTIONAL',false,'promo','seed-b',null),
          ('cccccccc-0000-4000-8000-000000000003','$A','ONE_HOUR',3600,'AVAILABLE','MANUAL_PROMOTIONAL',false,'promo','seed-c',null),
          ('dddddddd-0000-4000-8000-000000000004','$A','ONE_HOUR',3600,'AVAILABLE','MANUAL_PROMOTIONAL',false,'promo','seed-d',null);"

q "update public.karaoke_apple_purchases set grant_status='GRANTED', pass_grant_id='aaaaaaaa-0000-4000-8000-000000000001', granted_seconds=3600 where id='eeeeeeee-0000-4000-8000-00000000000e';" >/dev/null
N=$(q "select count(*) from timed_access_pass_grants;")
echo "  seeded grants: $N  (the gate is void unless this is 4)"
[ "$N" = "4" ] || { echo "  ABORT — seed failed, no verdict is possible"; docker rm -f bty-g3 >/dev/null 2>&1; exit 1; }

snap(){ q "select string_agg(id||'|'||status||'|sel:'||coalesce(selected_at::text,'-')||'|act:'||coalesce(activated_at::text,'-')||'|exp:'||coalesce(expires_at::text,'-'),E'\n' order by id) from timed_access_pass_grants where id<>'aaaaaaaa-0000-4000-8000-000000000001';"; }
echo "=== GRANT-R4B-3 — selecting the PAID grant must not touch any OTHER AVAILABLE grant ==="
B=$(snap)
q "select select_timed_access_pass('$A','aaaaaaaa-0000-4000-8000-000000000001',null);" | sed 's/^/  rpc: /'
AF=$(snap)
echo "  chosen grant:  $(q "select status||'  selected_at='||coalesce(selected_at::text,'NULL')||'  activated_at='||coalesce(activated_at::text,'NULL')||'  expires_at='||coalesce(expires_at::text,'NULL') from timed_access_pass_grants where id='aaaaaaaa-0000-4000-8000-000000000001';")"
if [ "$B" = "$AF" ]; then echo "  other 3 grants: BYTE-IDENTICAL before and after"; else echo "  other 3 grants: CHANGED"; diff <(echo "$B") <(echo "$AF") | sed 's/^/     /'; fi
echo "  others now:    $(q "select string_agg(status,',' order by id) from timed_access_pass_grants where id<>'aaaaaaaa-0000-4000-8000-000000000001';")"

echo "=== positive control — the snapshot CAN detect a change ==="
q "update timed_access_pass_grants set status='REVOKED', revoked_at=now(), revoke_reason='positive-control' where id='dddddddd-0000-4000-8000-000000000004';" >/dev/null
[ "$B" = "$(snap)" ] && echo "  BLIND — the comparison cannot see a real mutation" || echo "  detected: the same comparison catches a deliberate change"
q "update timed_access_pass_grants set status='AVAILABLE', revoked_at=null, revoke_reason=null where id='dddddddd-0000-4000-8000-000000000004';" >/dev/null

echo "=== negative control — an id that is not this account's grant is refused ==="
q "select select_timed_access_pass('$A','99999999-0000-4000-8000-000000000009',null);" | sed 's/^/  /'
echo "  statuses after refusal: $(q "select string_agg(status,',' order by id) from timed_access_pass_grants;")"
docker rm -f bty-g3 >/dev/null 2>&1
