-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BTY FOUNDER MERGE — CANONICAL FOUNDER EMAIL ACCEPTANCE (READ-ONLY, one SELECT, one row)
--
-- REQUIRED acceptance paths (run this after each):
--   A. Microsoft hc@bty-dso.com        → path_hc_azure_exercised        must become true
--   B. Microsoft ddshanbit             → path_ddshanbit_azure_exercised must become true
-- After every run: canonical_email_ok MUST be true. `required_acceptance_ok` is the conjunction.
--
-- NOT REQUIRED (Founder decision 2026-09-26): Google ddshanbit web login is not a product
-- acceptance path. path_ddshanbit_google_exercised is reported for information only. The Google
-- identity stays attached to B — it is neither deleted nor unlinked by this acceptance.
--
-- Also required, outside SQL: a real-device Teams "Save to BTY" appears under Today → Saved.
--
-- INVARIANT: auth.users.email of B = 'hc@bty-dso.com'. If any run shows canonical_email_ok =
-- false: STOP acceptance, do not declare the merge complete, and report this row verbatim —
-- b_email, b_raw_app_meta_data, b_raw_user_meta_data and b_identities are exactly what GoTrue
-- now holds. No workaround is applied here.
--
-- "Exercised" = that identity's last_sign_in_at is later than T2's commit, i.e. the sign-in
-- really went through that identity, not through a cached session.
-- ===========================================================================
with
  k as (
    select '18b1ee80-2200-4bc6-91d7-039ba43f6a50'::uuid as b,
           '81f08aa1-44a2-40b1-9190-7866151461a7'::uuid as a
  ),
  t2 as (
    select new_value::timestamptz as at
      from bty_ops.founder_merge_ledger where phase = 'T2' and step = 'committed_marker'
  ),
  ids as (
    select i.id, i.provider, i.user_id,
           i.identity_data->'custom_claims'->>'oid' as oid,
           i.identity_data->>'email'                 as claim_email,
           i.created_at, i.updated_at, i.last_sign_in_at,
           (i.last_sign_in_at > (select at from t2))  as used_since_t2
      from auth.identities i, k
     where i.user_id = k.b
  )
select
  (select at from t2)                                                        as t2_committed_at,
  u.email                                                                    as b_email,
  lower(u.email) = 'hc@bty-dso.com'                                          as canonical_email_ok,
  u.raw_app_meta_data                                                        as b_raw_app_meta_data,
  u.raw_user_meta_data                                                       as b_raw_user_meta_data,
  u.last_sign_in_at                                                          as b_last_sign_in_at,
  (select jsonb_agg(to_jsonb(ids) order by ids.provider, ids.oid) from ids)  as b_identities,
  (select count(*) from ids) = 3                                             as b_has_three_identities,
  coalesce((select used_since_t2 from ids where id = '0f456b7d-acd0-4bdd-a06b-36300f19eeb2'), false) as path_hc_azure_exercised,
  coalesce((select used_since_t2 from ids where id = '71defecd-955c-445d-affe-6af4e86bd43a'), false) as path_ddshanbit_azure_exercised,
  coalesce((select used_since_t2 from ids where id = '336defc0-f3bd-4b4b-86c9-72036be4f7a3'), false) as path_ddshanbit_google_exercised,
  (lower(u.email) = 'hc@bty-dso.com'
   and coalesce((select used_since_t2 from ids where id = '0f456b7d-acd0-4bdd-a06b-36300f19eeb2'), false)
   and coalesce((select used_since_t2 from ids where id = '71defecd-955c-445d-affe-6af4e86bd43a'), false)) as required_acceptance_ok,
  (select count(*) from auth.identities, k where user_id = k.a)              as a_identities,
  (select email from auth.users, k where id = k.a)                           as a_email,
  (select banned_until from auth.users, k where id = k.a)                    as a_banned_until
from auth.users u, k
where u.id = k.b;
