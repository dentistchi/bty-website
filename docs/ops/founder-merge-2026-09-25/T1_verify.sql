-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- BTY FOUNDER MERGE — T1 VERIFICATION (READ-ONLY, one SELECT, one row).
-- Every *_ok column must be true. `all_ok` is their conjunction.
-- Valid in the window BETWEEN T1 and the Admin API step. After the Admin step GoTrue adds an
-- `email` identity for A's retired address, so a_identities reads 1 by design (see T2's gate).
with
  k as (
    select '81f08aa1-44a2-40b1-9190-7866151461a7'::uuid as a,
           '18b1ee80-2200-4bc6-91d7-039ba43f6a50'::uuid as b,
           '10110d5c-bd30-467e-9912-e44e67777647'::text as tid,
           '644ff2ac-9135-4bcc-9669-c382986e4b60'::text as oid_a,
           'f5767307-f693-4f8c-8e6c-5fb8a256b895'::text as oid_b
  ),
  r_a as (select r.* from k, public.bty_resolve_user_from_microsoft_identity(k.tid, k.oid_a) r),
  r_b as (select r.* from k, public.bty_resolve_user_from_microsoft_identity(k.tid, k.oid_b) r),
  m as (
    select
      (select status || ':' || coalesce(user_id::text, 'null') from r_a)                       as resolver_oid_a,
      (select status || ':' || coalesce(user_id::text, 'null') from r_b)                       as resolver_oid_b,
      (select user_id from auth.identities where id = '336defc0-f3bd-4b4b-86c9-72036be4f7a3')  as google_owner,
      (select count(*) from auth.identities, k where user_id = k.a)                            as a_identities,
      (select count(*) from auth.identities, k where user_id = k.b)                            as b_identities,
      (select count(*) from auth.identities, k where user_id = k.b
         and id in ('0f456b7d-acd0-4bdd-a06b-36300f19eeb2','71defecd-955c-445d-affe-6af4e86bd43a',
                    '336defc0-f3bd-4b4b-86c9-72036be4f7a3'))                                    as b_expected_identities,
      (select count(*) from auth.sessions, k where user_id = k.a)                              as a_sessions,
      (select count(*) from auth.refresh_tokens, k where user_id::text = k.a::text)            as a_refresh_tokens,
      (select count(*) from auth.flow_state, k where user_id::text = k.a::text)                as a_flow_state,
      (select count(*) from auth.sessions, k where user_id = k.b)                              as b_sessions,
      (select count(*) from auth.refresh_tokens, k where user_id::text = k.b::text and not coalesce(revoked, false)) as b_unrevoked_refresh_tokens,
      (select count(*) from auth.users, k where id = k.a and deleted_at is null)               as a_user_row_present,
      (select count(*) from public.bty_microsoft_authority_snapshots, k where user_id = k.a)   as a_snapshot,
      (select lower(aad_object_id) from public.bty_microsoft_authority_snapshots, k where user_id = k.b) as b_snapshot_oid,
      (select count(*) from public.bty_platform_admin_grants, k where user_id = k.b and status = 'active')        as b_admin_active,
      (select count(*) from public.foundry_host_grants, k
        where user_id = k.b and status = 'active' and manual_granted and revoked_at is null)   as b_manual_host_active,
      (select count(*) from public.bty_org_memberships mm, k where mm.user_id = k.b and mm.status = 'active') as b_membership_active,
      (select count(*) from public.bty_org_membership_responsibilities r
         join public.bty_org_memberships mm on mm.id = r.membership_id, k
        where mm.user_id = k.b and r.status = 'active' and r.responsibility_key = 'PARTNER')   as b_partner_active,
      (select count(*) from public.bty_org_membership_responsibilities r
         join public.bty_org_memberships mm on mm.id = r.membership_id, k
        where mm.user_id = k.b and r.status = 'active' and r.responsibility_key = 'CLINICAL_DIRECTOR') as b_clinical_director_active,
      (select new_value from bty_ops.founder_merge_ledger where phase = 'T1' and step = 'committed_marker') as t1_marker_at
  )
select m.*,
       m.resolver_oid_a = 'RESOLVED:18b1ee80-2200-4bc6-91d7-039ba43f6a50'   as resolver_oid_a_ok,
       m.resolver_oid_b = 'RESOLVED:18b1ee80-2200-4bc6-91d7-039ba43f6a50'   as resolver_oid_b_ok,
       m.google_owner = '18b1ee80-2200-4bc6-91d7-039ba43f6a50'::uuid        as google_ok,
       m.a_identities = 0 and m.b_identities = 3 and m.b_expected_identities = 3 as identities_ok,
       m.a_sessions = 0 and m.a_refresh_tokens = 0 and m.a_flow_state = 0   as a_auth_state_ok,
       m.b_sessions > 0 and m.b_unrevoked_refresh_tokens > 0               as b_sessions_ok,
       m.a_user_row_present = 1                                            as a_shell_ok,
       m.a_snapshot = 0 and m.b_snapshot_oid = 'f5767307-f693-4f8c-8e6c-5fb8a256b895' as snapshot_ok,
       m.b_admin_active = 1 and m.b_manual_host_active = 1 and m.b_membership_active = 1
         and m.b_partner_active = 1 and m.b_clinical_director_active = 1   as b_authority_ok,
       (m.resolver_oid_a = 'RESOLVED:18b1ee80-2200-4bc6-91d7-039ba43f6a50'
        and m.resolver_oid_b = 'RESOLVED:18b1ee80-2200-4bc6-91d7-039ba43f6a50'
        and m.google_owner = '18b1ee80-2200-4bc6-91d7-039ba43f6a50'::uuid
        and m.a_identities = 0 and m.b_identities = 3 and m.b_expected_identities = 3
        and m.a_sessions = 0 and m.a_refresh_tokens = 0 and m.a_flow_state = 0
        and m.b_sessions > 0 and m.b_unrevoked_refresh_tokens > 0
        and m.a_user_row_present = 1
        and m.a_snapshot = 0 and m.b_snapshot_oid = 'f5767307-f693-4f8c-8e6c-5fb8a256b895'
        and m.b_admin_active = 1 and m.b_manual_host_active = 1 and m.b_membership_active = 1
        and m.b_partner_active = 1 and m.b_clinical_director_active = 1)   as all_ok
from m;
