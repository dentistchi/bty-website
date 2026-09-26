-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- BTY FOUNDER MERGE — T2 VERIFICATION (READ-ONLY, one SELECT, one row).
-- Ledger-driven: it proves the rows T2 actually moved, not hard-coded counts.
-- Every *_ok column must be true; `all_ok` is their conjunction.
with
  k as (
    select '81f08aa1-44a2-40b1-9190-7866151461a7'::uuid as a,
           '18b1ee80-2200-4bc6-91d7-039ba43f6a50'::uuid as b
  ),
  rehome as (
    select * from bty_ops.founder_merge_ledger where phase = 'T2' and step = 'rehome'
  ),
  -- 1. Every direct-rehome column holds zero A rows.
  a_left as (
    select t.tbl, t.col,
           (xpath('/row/n/text()', query_to_xml(
              format('select count(*) as n from %s where %I::text = %L', t.tbl, t.col, k.a::text),
              false, true, '')))[1]::text::int as n
    from k, (values
      ('public.bty_action_captures','user_id'), ('public.bty_today_dismissals','user_id'),
      ('public.user_conversation_preferences','user_id'), ('public.bty_foundry_event_history_dismissals','user_id'),
      ('public.foundry_events','owner_user_id'), ('public.foundry_event_quizzes','created_by_user_id'),
      ('public.foundry_module_drafts','owner_user_id'), ('public.foundry_program_generation_attempts','owner_user_id'),
      ('public.foundry_programs','owner_user_id'), ('public.bty_tracked_announcements','owner_user_id'),
      ('public.bty_tracked_announcement_recipients','handled_by_user_id'),
      ('public.bty_announcement_thread_messages','author_user_id'),
      ('public.bty_announcement_thread_message_reads','reader_user_id'),
      ('public.foundry_host_followup_contacts','host_user_id'), ('public.user_day','user_id')
    ) t(tbl, col)
  ),
  -- 2/4/5. Every ledgered row is now found under B by its original primary key.
  moved as (
    select l.table_name, l.id,
           (xpath('/row/n/text()', query_to_xml(
              format('select count(*) as n from %s where %s', l.table_name,
                (select string_agg(format('%I::text = %L', kk,
                          case when kk = l.column_name then l.new_value else l.row_key ->> kk end), ' and ')
                   from jsonb_object_keys(l.row_key) kk)
                || format(' and %I::text = %L', l.column_name, l.new_value)),
              false, true, '')))[1]::text::int as found
    from rehome l
  ),
  -- 3. B's Today "Saved for later" — the exact filter listMyActionCaptures uses.
  today_b as (
    select c.id from public.bty_action_captures c, k
    where c.user_id = k.b and c.status = 'captured' and c.saved_at is not null and c.saved_removed_at is null
  ),
  -- The authoritative expectation: the IDs that were ACTIVE Saved captures on A at the moment T2
  -- ran, recorded by T2 itself. No capture id is hard-coded here — an item legitimately cleared
  -- from Saved before T2 is correctly absent from both sides.
  today_marker as (
    select l.new_value::jsonb as ids
    from bty_ops.founder_merge_ledger l
    where l.phase = 'T2' and l.step = 'today_expectation'
  ),
  a_active_saved as (
    select (e.v)::uuid as id from today_marker m, jsonb_array_elements_text(m.ids) e(v)
  ),
  -- 7/8/9. XP / contracts / Arena / evidence rows unchanged since the T2 baseline.
  baseline as (
    select new_value::jsonb as j from bty_ops.founder_merge_ledger where phase = 'T2' and step = 'baseline_marker'
  ),
  now_counts as (
    select jsonb_object_agg(t,
             (xpath('/row/n/text()', query_to_xml(
                format('select count(*) as n from %s x where to_jsonb(x)::text like %L or to_jsonb(x)::text like %L',
                       t, '%' || k.a || '%', '%' || k.b || '%'), false, true, '')))[1]::text::int) as j
    from baseline, k, jsonb_object_keys(baseline.j) t
  ),
  -- 10. Every public table that still mentions A anywhere.
  residue as (
    select c.relname::text as tbl,
           (xpath('/row/n/text()', query_to_xml(
              format('select count(*) as n from %s x where to_jsonb(x)::text like %L', c.oid::regclass, '%' || k.a || '%'),
              false, true, '')))[1]::text::int as n
    from k, pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  ),
  residue_hits as (select tbl, n from residue where n > 0),
  allowed(tbl) as (values
    ('arena_consent_log'), ('arena_profiles'), ('user_learning_paths'), ('clinical_reasoning_traces'),
    ('foundry_programs'), ('bty_tracked_announcements'), ('foundry_teams_training_deliveries'),
    ('foundry_teams_training_delivery_attempts'), ('bty_org_memberships'), ('foundry_host_grants')
  ),
  m as (
    select
      (select jsonb_object_agg(tbl || '.' || col, n) from a_left where n > 0)                   as a_rows_left,
      (select count(*) from rehome)                                                             as rows_rehomed,
      (select count(*) from moved where found <> 1)                                             as rehomed_not_found_on_b,
      (select jsonb_object_agg(table_name, cnt) from
         (select table_name, count(*) cnt from rehome group by 1) x)                            as rehomed_by_table,
      (select count(*) from public.bty_action_captures, k where user_id = k.b)                  as b_captures_total,
      (select count(*) from today_b)                                                            as b_today_saved,
      (select count(*) from a_active_saved)                                                     as a_active_saved_moved,
      (select count(*) from a_active_saved s where s.id not in (select id from today_b))        as a_active_saved_missing_from_today,
      (select count(*) from today_marker)                                                       as today_marker_rows,
      (select j from baseline)                                                                  as xp_contract_evidence_baseline,
      (select j from now_counts)                                                                as xp_contract_evidence_now,
      (select coalesce(sum(delta_xp), 0) from public.core_xp_ledger, k where user_id = k.b)     as b_core_xp_ledger_sum,
      (select count(*) from public.core_xp_ledger, k where user_id = k.a)                       as a_core_xp_rows,
      (select count(*) from public.bty_platform_admin_grants, k where user_id = k.b and status = 'active') as b_admin_active,
      (select count(*) from public.foundry_host_grants, k where user_id = k.b and status = 'active' and manual_granted) as b_manual_host_active,
      (select count(*) from public.bty_org_memberships mm, k where mm.user_id = k.b and mm.status = 'active') as b_membership_active,
      (select count(*) from public.bty_org_membership_responsibilities r join public.bty_org_memberships mm on mm.id = r.membership_id, k
        where mm.user_id = k.b and mm.status = 'active' and r.status = 'active' and r.responsibility_key = 'PARTNER') as b_partner_active,
      (select count(*) from public.bty_org_membership_responsibilities r join public.bty_org_memberships mm on mm.id = r.membership_id, k
        where mm.user_id = k.b and mm.status = 'active' and r.status = 'active' and r.responsibility_key = 'CLINICAL_DIRECTOR') as b_clinical_director_active,
      (select count(*) from public.bty_org_memberships, k where user_id = k.a and status = 'active')         as a_membership_active,
      (select count(*) from public.foundry_host_grants, k
        where user_id = k.a and (status = 'active' or manual_granted or microsoft_manager_granted))         as a_host_authority,
      (select jsonb_object_agg(tbl, n) from residue_hits)                                       as a_residue,
      (select jsonb_agg(tbl) from residue_hits where tbl not in (select tbl from allowed))       as a_residue_unexpected
  )
select m.*,
       m.a_rows_left is null                                               as zero_a_in_rehome_columns_ok,
       m.rows_rehomed > 0 and m.rehomed_not_found_on_b = 0                 as rehomed_rows_on_b_ok,
       m.today_marker_rows = 1 and m.a_active_saved_missing_from_today = 0  as today_ok,
       m.xp_contract_evidence_now = m.xp_contract_evidence_baseline and m.a_core_xp_rows = 0 as no_xp_contract_evidence_change_ok,
       m.b_admin_active = 1 and m.b_manual_host_active = 1 and m.b_membership_active = 1
         and m.b_partner_active = 1 and m.b_clinical_director_active = 1   as b_authority_ok,
       m.a_membership_active = 0 and m.a_host_authority = 0                as a_authority_removed_ok,
       m.a_residue_unexpected is null                                      as residue_ok,
       (m.a_rows_left is null
        and m.rows_rehomed > 0 and m.rehomed_not_found_on_b = 0
        and m.today_marker_rows = 1 and m.a_active_saved_missing_from_today = 0
        and m.xp_contract_evidence_now = m.xp_contract_evidence_baseline and m.a_core_xp_rows = 0
        and m.b_admin_active = 1 and m.b_manual_host_active = 1 and m.b_membership_active = 1
        and m.b_partner_active = 1 and m.b_clinical_director_active = 1
        and m.a_membership_active = 0 and m.a_host_authority = 0
        and m.a_residue_unexpected is null)                                as all_ok
from m;
