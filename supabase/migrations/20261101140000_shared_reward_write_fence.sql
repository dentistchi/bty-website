-- Shared XP/Core write fence and atomic shared reward writers.
-- Apply only through scripts/reward-write-fence-cutover.mjs with the other cutover migrations.
--
-- The previous release pays shared XP and Core with requests the database cannot
-- tell apart from other callers: top-level `increment_arena_xp`/`increment_weekly_xp`
-- RPCs and read-then-absolute `arena_profiles` updates. A delayed old request could
-- therefore still pay, or overwrite a newer award, after cutover. From this
-- migration on, an increase of weekly/lifetime/run XP, any change of permanent Core,
-- and the run/activity/Lab reward anchors are accepted only when the outermost
-- function on the call stack is one of the release's atomic writers below. Plain
-- PostgREST table writes and the old RPC names called directly are rejected. Every
-- new writer locks the profile row and computes Core in SQL, so concurrent awards
-- are all preserved. No learner row is rewritten here.

create table if not exists public.bty_reward_write_control (
  id boolean primary key default true check (id),
  paused boolean not null default false,
  reason text,
  changed_at timestamptz not null default now()
);
insert into public.bty_reward_write_control(id, paused) values (true, false) on conflict (id) do nothing;
alter table public.bty_reward_write_control enable row level security;
revoke all on public.bty_reward_write_control from public, anon, authenticated, service_role;

create or replace function public.bty_reward_writes_paused()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select paused from public.bty_reward_write_control where id), false)
$$;
revoke all on function public.bty_reward_writes_paused() from public, anon, authenticated;
grant execute on function public.bty_reward_writes_paused() to service_role;

-- Outermost PL/pgSQL or SQL function on the current call stack, or null for a
-- statement issued directly by the client. PG_CONTEXT contains only function frames
-- and the source text of their statements, never client-supplied values.
create or replace function public.bty_reward_outermost_function()
returns text language plpgsql stable set search_path = '' as $$
declare
  v_context text;
  v_line text;
  v_name text;
  v_outer text;
begin
  get diagnostics v_context = pg_context;
  foreach v_line in array pg_catalog.string_to_array(v_context, E'\n') loop
    v_name := (pg_catalog.regexp_match(v_line, '^PL/pgSQL function (?:public\.)?([a-z0-9_]+)\('))[1];
    if v_name is null then
      v_name := (pg_catalog.regexp_match(v_line, '^SQL function "(?:public\.)?([a-z0-9_]+)"'))[1];
    end if;
    if v_name is not null and v_name <> 'bty_reward_outermost_function' and v_name not like 'bty_reward_fence%' then
      v_outer := v_name;
    end if;
  end loop;
  return v_outer;
end $$;
revoke all on function public.bty_reward_outermost_function() from public;
grant execute on function public.bty_reward_outermost_function() to anon, authenticated, service_role;

-- Release writers allowed to start a shared reward write. bty_event_scan_award and
-- run_season_carryover are unchanged single-transaction RPCs shared by both releases.
create or replace function public.bty_reward_fence_shared_writer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_outer text := public.bty_reward_outermost_function();
begin
  if public.bty_reward_writes_paused() then
    raise exception 'REWARD_WRITES_PAUSED' using errcode = 'P0001', detail = tg_table_name;
  end if;
  if v_outer is null or not (v_outer = any (array[
      'bty_record_legacy_choice_reward', 'bty_complete_beginner_reward',
      'bty_foundry_award_core_atomic', 'bty_foundry_redeem_completion_claim_atomic',
      'bty_claim_weekly_reflection_quest', 'bty_award_xp_v2', 'bty_award_run_xp_v2',
      'bty_award_activity_xp_v2', 'bty_award_lab_xp_v2', 'bty_apply_arena_run_rewards_v2',
      'bty_e2e_set_core_xp', 'bty_event_scan_award', 'run_season_carryover'])) then
    raise exception 'REWARD_WRITE_FENCED' using errcode = 'P0001',
      detail = 'shared_xp:' || tg_table_name || ':' || coalesce(v_outer, 'direct');
  end if;
  return new;
end $$;
revoke all on function public.bty_reward_fence_shared_writer() from public, anon, authenticated, service_role;

drop trigger if exists bty_reward_fence_profile_xp on public.arena_profiles;
create trigger bty_reward_fence_profile_xp
  before update on public.arena_profiles for each row
  when (new.core_xp_total is distinct from old.core_xp_total or new.core_xp_buffer is distinct from old.core_xp_buffer
    or new.lifetime_xp > old.lifetime_xp or new.weekly_xp > old.weekly_xp)
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_profile_xp_insert on public.arena_profiles;
create trigger bty_reward_fence_profile_xp_insert
  before insert on public.arena_profiles for each row
  when (new.core_xp_total <> 0 or new.core_xp_buffer <> 0 or new.lifetime_xp > 0 or new.weekly_xp > 0)
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_weekly_xp on public.weekly_xp;
create trigger bty_reward_fence_weekly_xp
  before update on public.weekly_xp for each row when (new.xp_total > old.xp_total)
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_weekly_xp_insert on public.weekly_xp;
create trigger bty_reward_fence_weekly_xp_insert
  before insert on public.weekly_xp for each row when (new.xp_total > 0)
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_run_xp on public.arena_runs;
create trigger bty_reward_fence_run_xp
  before update on public.arena_runs for each row when (new.total_xp > old.total_xp)
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_run_xp_insert on public.arena_runs;
create trigger bty_reward_fence_run_xp_insert
  before insert on public.arena_runs for each row when (new.total_xp > 0)
  execute function public.bty_reward_fence_shared_writer();
-- Reward anchors written before (or, for the old quest, after) their payment by the
-- previous release: accepting one without its payment would make a later retry treat
-- the reward as already applied.
drop trigger if exists bty_reward_fence_run_reward_anchor on public.arena_events;
create trigger bty_reward_fence_run_reward_anchor
  before insert on public.arena_events for each row when (new.event_type = 'RUN_COMPLETED_APPLIED')
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_activity_anchor on public.activity_xp_events;
create trigger bty_reward_fence_activity_anchor
  before insert on public.activity_xp_events for each row
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_quest_claim_anchor on public.arena_weekly_quest_claims;
create trigger bty_reward_fence_quest_claim_anchor
  before insert on public.arena_weekly_quest_claims for each row
  execute function public.bty_reward_fence_shared_writer();
drop trigger if exists bty_reward_fence_core_ledger_anchor on public.core_xp_ledger;
create trigger bty_reward_fence_core_ledger_anchor
  before insert on public.core_xp_ledger for each row when (new.source_type in ('LAB', 'ARENA'))
  execute function public.bty_reward_fence_shared_writer();

-- One locked profile update: optional weekly XP, seasonal XP converted to Core with
-- applySeasonalXpToCore's arithmetic, and direct Core as applyDirectCoreXp.
create or replace function public.bty_award_xp_v2(
  p_user_id uuid, p_league_id uuid, p_weekly_delta integer, p_seasonal_core_xp integer, p_direct_core_xp integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set extra_float_digits = 1
as $$
declare
  v_profile public.arena_profiles%rowtype;
  v_weekly_total integer;
  v_core_before integer;
  v_core_after integer;
  v_buffer_before double precision;
  v_buffer_after double precision;
  v_exact double precision;
  v_whole integer := 0;
  v_buffer_whole integer := 0;
  v_tier integer;
  v_code integer;
  v_group integer;
  v_default_sub_name text;
begin
  if public.bty_reward_writes_paused() then
    raise exception using message = 'REWARD_WRITES_PAUSED', errcode = 'P0001';
  end if;
  if p_user_id is null or p_weekly_delta is null or p_seasonal_core_xp is null or p_direct_core_xp is null
     or p_weekly_delta < 0 or p_seasonal_core_xp < 0 or p_direct_core_xp < 0
     or p_weekly_delta > 100000 or p_seasonal_core_xp > 100000 or p_direct_core_xp > 100000 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  insert into public.arena_profiles(
    user_id, core_xp_total, core_xp_buffer, tier, code_index, sub_name, sub_name_renamed_in_code, stage, code_hidden
  ) values (p_user_id, 0, 0, 0, 0, 'Spark', false, 1, false)
    on conflict (user_id) do nothing;
  select * into v_profile from public.arena_profiles where user_id = p_user_id for update;
  if not found then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;
  if p_weekly_delta > 0 then
    v_weekly_total := public.increment_weekly_xp(p_user_id, p_league_id, p_weekly_delta);
    if v_weekly_total is null then
      raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
    end if;
  end if;
  v_core_before := greatest(0, coalesce(v_profile.core_xp_total, 0));
  v_buffer_before := greatest(0::double precision, coalesce(v_profile.core_xp_buffer, 0)::double precision);
  v_buffer_after := v_buffer_before;
  if p_seasonal_core_xp > 0 then
    v_exact := p_seasonal_core_xp::double precision / case when v_core_before < 200 then 45::double precision else 60::double precision end;
    v_whole := floor(v_exact)::integer;
    v_buffer_after := v_buffer_before + (v_exact - v_whole);
    v_buffer_whole := floor(v_buffer_after)::integer;
    v_buffer_after := v_buffer_after - v_buffer_whole;
  end if;
  v_core_after := v_core_before + v_whole + v_buffer_whole + p_direct_core_xp;
  if p_seasonal_core_xp > 0 or p_direct_core_xp > 0 then
    v_tier := greatest(0, floor(v_core_after::double precision / 10)::integer);
    v_code := least(6, greatest(0, floor(v_tier::double precision / 100)::integer));
    v_group := least(3, greatest(0, floor((v_tier % 100)::double precision / 25)::integer));
    v_default_sub_name := case v_code
      when 0 then (array['Spark', 'Ember', 'Flame', 'Inferno'])[v_group + 1]
      when 1 then (array['Echo', 'Rhythm', 'Resonance', 'Surge'])[v_group + 1]
      when 2 then (array['Outline', 'Structure', 'Framework', 'Foundation'])[v_group + 1]
      when 3 then (array['Lift', 'Rise', 'Elevation', 'Summit'])[v_group + 1]
      when 4 then (array['Glimmer', 'Radiance', 'Brilliance', 'Supernova'])[v_group + 1]
      when 5 then (array['Draft', 'Design', 'Blueprint', 'Grand Architect'])[v_group + 1]
      else null end;
    update public.arena_profiles set
      core_xp_total = v_core_after,
      core_xp_buffer = case when p_seasonal_core_xp > 0 then v_buffer_after::text::numeric else core_xp_buffer end,
      tier = v_tier, code_index = v_code,
      stage = least(7, floor(v_core_after::double precision / 100)::integer + 1),
      code_hidden = v_core_after >= 700,
      sub_name = case when coalesce(v_profile.sub_name_renamed_in_code, false)
        or v_default_sub_name is null then v_profile.sub_name else v_default_sub_name end,
      updated_at = now()
      where user_id = p_user_id;
    if not found then
      raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
    end if;
  end if;
  return jsonb_build_object('policyVersion', 'shared-xp/v2', 'weeklyXpTotal', v_weekly_total,
    'coreBefore', v_core_before, 'coreAfter', v_core_after, 'coreGain', v_core_after - v_core_before,
    'coreBufferAfter', v_buffer_after);
end;
$$;

-- Same profile/run XP as increment_arena_xp, under a name only this release calls.
create or replace function public.bty_award_run_xp_v2(p_user_id uuid, p_run_id uuid, p_xp integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if public.bty_reward_writes_paused() then
    raise exception using message = 'REWARD_WRITES_PAUSED', errcode = 'P0001';
  end if;
  if p_user_id is null or p_run_id is null or p_xp is null or p_xp < 0 or p_xp > 100000 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  perform public.increment_arena_xp(p_user_id, p_run_id, p_xp);
  return jsonb_build_object('policyVersion', 'shared-xp/v2', 'xp', p_xp);
end $$;

-- Activity event (daily-cap basis), weekly XP and seasonal Core in one transaction.
create or replace function public.bty_award_activity_xp_v2(p_user_id uuid, p_activity_type text, p_delta integer, p_league_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_award jsonb;
begin
  if p_activity_type is null or length(p_activity_type) not between 1 and 64 or p_delta is null or p_delta <= 0 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  insert into public.activity_xp_events(user_id, activity_type, xp) values (p_user_id, p_activity_type, p_delta);
  v_award := public.bty_award_xp_v2(p_user_id, p_league_id, p_delta, p_delta, 0);
  return v_award || jsonb_build_object('xp', p_delta);
end $$;

-- Lab: the LAB ledger row is the idempotency key, committed with its Core.
create or replace function public.bty_award_lab_xp_v2(p_user_id uuid, p_amount integer, p_source_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_award jsonb;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_source_id is null or length(p_source_id) not between 1 and 200 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  insert into public.core_xp_ledger(user_id, delta_xp, source_type, source_id)
    values (p_user_id, p_amount, 'LAB', p_source_id) on conflict do nothing;
  if not found then
    return jsonb_build_object('policyVersion', 'shared-xp/v2', 'outcome', 'already_applied');
  end if;
  v_award := public.bty_award_xp_v2(p_user_id, null, 0, 0, p_amount);
  return v_award || jsonb_build_object('outcome', 'awarded');
end $$;

-- Verified run completion: the RUN_COMPLETED_APPLIED anchor, weekly XP, Core and the
-- ARENA ledger row commit together, once per run under the run's row lock.
create or replace function public.bty_apply_arena_run_rewards_v2(
  p_user_id uuid, p_run_id uuid, p_scenario_id text, p_weekly_delta integer, p_core_xp integer
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_award jsonb;
begin
  if p_user_id is null or p_run_id is null or p_weekly_delta is null or p_core_xp is null
     or p_weekly_delta < 0 or p_core_xp < 0 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  perform 1 from public.arena_runs where run_id = p_run_id and user_id = p_user_id for update;
  if not found then
    raise exception using message = 'REWARD_RUN_NOT_FOUND', errcode = 'P0001';
  end if;
  if exists (select 1 from public.arena_events where user_id = p_user_id and run_id = p_run_id
      and event_type = 'RUN_COMPLETED_APPLIED') then
    return jsonb_build_object('policyVersion', 'shared-xp/v2', 'applied', false);
  end if;
  insert into public.arena_events(user_id, run_id, event_type, step, scenario_id, xp)
    values (p_user_id, p_run_id, 'RUN_COMPLETED_APPLIED', 7, coalesce(nullif(p_scenario_id, ''), 'unknown'), 0);
  v_award := public.bty_award_xp_v2(p_user_id, null, p_weekly_delta, 0, p_core_xp);
  if p_core_xp > 0 then
    insert into public.core_xp_ledger(user_id, delta_xp, source_type, source_id)
      values (p_user_id, p_core_xp, 'ARENA', p_run_id::text) on conflict do nothing;
  end if;
  return v_award || jsonb_build_object('applied', true, 'weeklyXp', p_weekly_delta, 'coreXp', p_core_xp);
end $$;

-- Test-fixture seeding only (guarded in TypeScript by assertDestructiveTargetAllowed).
create or replace function public.bty_e2e_set_core_xp(p_user_id uuid, p_core integer)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_user_id is null or p_core is null or p_core < 0 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  update public.arena_profiles set core_xp_total = p_core, core_xp_buffer = 0, updated_at = now() where user_id = p_user_id;
end $$;

do $grants$
declare fn text;
begin
  foreach fn in array array[
    'public.bty_award_xp_v2(uuid,uuid,integer,integer,integer)', 'public.bty_award_run_xp_v2(uuid,uuid,integer)',
    'public.bty_award_activity_xp_v2(uuid,text,integer,uuid)', 'public.bty_award_lab_xp_v2(uuid,integer,text)',
    'public.bty_apply_arena_run_rewards_v2(uuid,uuid,text,integer,integer)', 'public.bty_e2e_set_core_xp(uuid,integer)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $grants$;
