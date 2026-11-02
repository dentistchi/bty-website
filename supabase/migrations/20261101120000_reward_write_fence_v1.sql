-- Reward write fence v1.
-- Apply only through scripts/reward-write-fence-cutover.mjs, inside the same
-- transaction as 20261031222747, 20261101000728 and 20261101001020, after that
-- transaction has locked every fenced table. This file alone is not a cutover.
--
-- The previous release completes these rewards with separate PostgREST writes.
-- After this commits, those writes are rejected in the database itself, whatever
-- Worker version, domain, preview URL or in-flight HTTP request issued them:
--   * legacy/beginner/Foundry reward rows must be committed together with the
--     receipt the atomic RPC writes in the same transaction (checked at commit);
--   * Healing completion rows can no longer be written with a user JWT.
-- No learner row is read for policy, inferred, backfilled or rewritten here.

-- The 45 bundled legacy catalog scenarios. The old /api/arena/event route pays a
-- CHOICE_CONFIRMED reward only for these IDs; canonical /api/arena/choice events
-- use disjoint canonical/elite IDs and stay unfenced. A source test pins this
-- list to src/lib/bty/scenario/legacy/bundledScenarios.ts.
create or replace function public.bty_reward_fence_is_legacy_catalog_scenario(p_scenario_id text)
returns boolean language sql immutable set search_path = '' as $$
  select p_scenario_id = any (array[
    'patient_refuses_treatment_001','front_desk_overbook_002','hygienist_questions_diagnosis_003',
    'manager_production_vs_clinical_004','assistant_sterilization_errors_005','patient_negative_review_006',
    'doctor_chronic_late_007','dso_ebitda_pressure_008','patient_overtreatment_accusation_009',
    'hygienist_burnout_010','insurance_denial_patient_conflict_011','assistant_gossips_about_doctor_012',
    'doctor_disagrees_dso_protocol_013','patient_requests_unnecessary_antibiotics_014','new_associate_underperforms_015',
    'hipaa_breach_incident_016','hygienist_demands_pay_raise_017','doctor_anger_in_operatory_018',
    'patient_cannot_afford_treatment_019','office_culture_divided_020','patient_questions_treatment_plan_021',
    'assistant_mistake_during_procedure_022','patient_late_blames_office_023','team_member_interrupts_024',
    'insurance_coordinator_billing_error_025','patient_refuses_xrays_026','new_employee_overwhelmed_027',
    'patient_complains_pain_after_028','staff_arrives_late_repeatedly_029','doctor_production_pressure_030',
    'team_member_feels_unappreciated_031','patient_challenges_fee_032','senior_staff_resists_new_protocol_033',
    'patient_leaves_negative_review_034','you_feel_compared_to_another_doctor_035','assistant_feels_over_corrected_036',
    'patient_requests_refund_037','manager_feels_overloaded_038','dso_requests_cost_reduction_039',
    'patient_cancels_last_minute_040','team_conflict_between_staff_041','patient_questions_infection_control_042',
    'associate_disagrees_in_meeting_043','patient_demands_immediate_attention_044','you_realize_overreacted_045'
  ]::text[])
$$;

-- Deferred: the atomic RPCs insert the event before their receipt.
create or replace function public.bty_reward_fence_arena_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A row deleted again inside its own transaction was never persisted.
  if not exists (select 1 from public.arena_events e where e.event_id = new.event_id) then
    return null;
  end if;
  if new.event_type = 'CHOICE_CONFIRMED' then
    if not exists (select 1 from public.arena_reward_receipts r
        where r.run_id = new.run_id and r.reward_kind = 'legacy_choice'
          and r.result->>'eventId' = new.event_id::text) then
      raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = 'legacy_choice_event';
    end if;
  elsif new.event_type = 'BEGINNER_REFLECTION' then
    if not exists (select 1 from public.arena_reward_receipts r
        where r.run_id = new.run_id and r.reward_kind = 'beginner_completion'
          and r.result->>'eventId' = new.event_id::text) then
      raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = 'beginner_reflection_event';
    end if;
  elsif exists (select 1 from public.arena_runs r where r.run_id = new.run_id and r.run_type = 'beginner') then
    -- Old run/complete and free-response also rewarded beginner runs.
    raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = 'beginner_scenario_reward_event';
  end if;
  return null;
end $$;

create or replace function public.bty_reward_fence_beginner_run()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.arena_runs r where r.run_id = new.run_id and r.status = 'DONE')
     and not exists (select 1 from public.arena_reward_receipts r
       where r.run_id = new.run_id and r.reward_kind = 'beginner_completion') then
    raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = 'beginner_completion_run';
  end if;
  return null;
end $$;

create or replace function public.bty_reward_fence_foundry_ledger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.core_xp_ledger l where l.id = new.id)
     and not exists (select 1 from public.foundry_xp_reward_receipts r where r.ledger_id = new.id) then
    raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = 'foundry_ledger';
  end if;
  return null;
end $$;

create or replace function public.bty_reward_fence_foundry_marker()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.foundry_event_training_progress p
      where p.id = new.id and p.xp_awarded_at is not null)
     and not exists (select 1 from public.foundry_xp_reward_receipts r where r.progress_id = new.id) then
    raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = 'foundry_award_marker';
  end if;
  return null;
end $$;

-- Immediate and invoker: current_user must be the caller's PostgREST role. The
-- atomic Healing RPCs run as service_role; the old routes wrote as authenticated.
create or replace function public.bty_reward_fence_healing_user_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = tg_table_name;
  end if;
  return new;
end $$;

-- Organic PRM/SAG unlocks from emotional events remain user-JWT writes. Only the
-- old second-awakening grant, stamped with its milestone's exact timestamp, is fenced.
create or replace function public.bty_reward_fence_starter_unlock()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.advanced_stat_name in ('PRM', 'SAG')
     and exists (select 1 from public.user_healing_milestones m
       where m.user_id = new.user_id and m.starter_unlock_granted = new.advanced_stat_name
         and m.second_awakening_completed_at = new.unlocked_at) then
    raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001', detail = 'second_awakening_unlock';
  end if;
  return new;
end $$;

-- Trigger WHEN clauses run with the writer's privileges, and every client role
-- inserts arena_events. This pure ID check must stay executable by all of them.
revoke all on function public.bty_reward_fence_is_legacy_catalog_scenario(text) from public;
grant execute on function public.bty_reward_fence_is_legacy_catalog_scenario(text) to anon, authenticated, service_role;
revoke all on function public.bty_reward_fence_arena_event() from public, anon, authenticated, service_role;
revoke all on function public.bty_reward_fence_beginner_run() from public, anon, authenticated, service_role;
revoke all on function public.bty_reward_fence_foundry_ledger() from public, anon, authenticated, service_role;
revoke all on function public.bty_reward_fence_foundry_marker() from public, anon, authenticated, service_role;
revoke all on function public.bty_reward_fence_healing_user_write() from public, anon, authenticated, service_role;
revoke all on function public.bty_reward_fence_starter_unlock() from public, anon, authenticated, service_role;

-- Constraint triggers cannot be replaced in place; recreate for idempotency.
drop trigger if exists bty_reward_fence_legacy_choice on public.arena_events;
create constraint trigger bty_reward_fence_legacy_choice
  after insert on public.arena_events deferrable initially deferred for each row
  when (new.event_type = 'CHOICE_CONFIRMED' and public.bty_reward_fence_is_legacy_catalog_scenario(new.scenario_id))
  execute function public.bty_reward_fence_arena_event();
drop trigger if exists bty_reward_fence_beginner_event on public.arena_events;
create constraint trigger bty_reward_fence_beginner_event
  after insert on public.arena_events deferrable initially deferred for each row
  when (new.event_type in ('BEGINNER_REFLECTION', 'RUN_COMPLETED_APPLIED', 'RUN_COMPLETE_CONTRACT_QUEUED', 'FREE_RESPONSE'))
  execute function public.bty_reward_fence_arena_event();
drop trigger if exists bty_reward_fence_beginner_done on public.arena_runs;
create constraint trigger bty_reward_fence_beginner_done
  after update on public.arena_runs deferrable initially deferred for each row
  when ((old.run_type = 'beginner' or new.run_type = 'beginner')
    and new.status = 'DONE' and old.status is distinct from 'DONE')
  execute function public.bty_reward_fence_beginner_run();
drop trigger if exists bty_reward_fence_beginner_done_insert on public.arena_runs;
create constraint trigger bty_reward_fence_beginner_done_insert
  after insert on public.arena_runs deferrable initially deferred for each row
  when (new.run_type = 'beginner' and new.status = 'DONE')
  execute function public.bty_reward_fence_beginner_run();
drop trigger if exists bty_reward_fence_foundry_ledger on public.core_xp_ledger;
create constraint trigger bty_reward_fence_foundry_ledger
  after insert on public.core_xp_ledger deferrable initially deferred for each row
  when (new.source_type = 'foundry_training_completion')
  execute function public.bty_reward_fence_foundry_ledger();
drop trigger if exists bty_reward_fence_foundry_marker on public.foundry_event_training_progress;
create constraint trigger bty_reward_fence_foundry_marker
  after update on public.foundry_event_training_progress deferrable initially deferred for each row
  when (new.xp_awarded_at is not null and old.xp_awarded_at is null)
  execute function public.bty_reward_fence_foundry_marker();
drop trigger if exists bty_reward_fence_foundry_marker_insert on public.foundry_event_training_progress;
create constraint trigger bty_reward_fence_foundry_marker_insert
  after insert on public.foundry_event_training_progress deferrable initially deferred for each row
  when (new.xp_awarded_at is not null)
  execute function public.bty_reward_fence_foundry_marker();
drop trigger if exists bty_reward_fence_healing_acts on public.user_healing_awakening_acts;
create trigger bty_reward_fence_healing_acts
  before insert or update on public.user_healing_awakening_acts for each row
  execute function public.bty_reward_fence_healing_user_write();
drop trigger if exists bty_reward_fence_healing_milestones on public.user_healing_milestones;
create trigger bty_reward_fence_healing_milestones
  before insert or update on public.user_healing_milestones for each row
  execute function public.bty_reward_fence_healing_user_write();
drop trigger if exists bty_reward_fence_starter_unlock on public.user_advanced_unlocks;
create trigger bty_reward_fence_starter_unlock
  before insert or update on public.user_advanced_unlocks for each row
  execute function public.bty_reward_fence_starter_unlock();
