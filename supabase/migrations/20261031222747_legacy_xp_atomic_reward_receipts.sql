-- Source preparation only. Applying this migration requires separate authorization.
-- Legacy choice and beginner rewards must commit their evidence, XP and receipt
-- together. Historical partial awards are intentionally neither inferred nor fixed.
create table if not exists public.arena_reward_receipts (
  receipt_id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Deliberately no arena_runs FK: deleting a run must not delete its reward audit.
  run_id uuid not null,
  reward_kind text not null check (reward_kind in ('legacy_choice', 'beginner_completion')),
  scenario_id text not null,
  canonical_request jsonb not null check (jsonb_typeof(canonical_request) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  -- A retained receipt prevents reward-mode changes, even if its run is recreated.
  constraint arena_reward_receipts_run_key unique (run_id)
);
create index if not exists arena_reward_receipts_user_idx
  on public.arena_reward_receipts(user_id);
alter table public.arena_reward_receipts enable row level security;
revoke all on table public.arena_reward_receipts from public, anon, authenticated, service_role;
-- Receipts are frozen. These functions only need to append and read them.
grant select, insert on table public.arena_reward_receipts to service_role;

create or replace function public.bty_record_legacy_choice_reward(
  p_user_id uuid,
  p_run_id uuid,
  p_scenario_id text,
  p_choice_id text,
  p_step integer,
  p_xp integer,
  p_deltas jsonb,
  p_meta jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.arena_runs%rowtype;
  v_profile public.arena_profiles%rowtype;
  v_receipt public.arena_reward_receipts%rowtype;
  v_request jsonb;
  v_result jsonb;
  v_receipt_id uuid := pg_catalog.gen_random_uuid();
  v_event_id uuid;
  v_written_receipt_id uuid;
begin
  -- p_xp and p_deltas are computed from the bundled catalog by the server.
  -- Execute is denied to clients, even when they own the run.
  if p_user_id is null or p_run_id is null
     or p_scenario_id is null or length(p_scenario_id) not between 1 and 200
     or btrim(p_scenario_id) <> p_scenario_id
     or p_choice_id is null or length(p_choice_id) not between 1 and 120
     or btrim(p_choice_id) <> p_choice_id
     or p_step is null or p_step not between 1 and 7
     or p_xp is null or p_xp not between 0 and 10000
     or p_deltas is null or jsonb_typeof(p_deltas) <> 'object'
     or octet_length(p_deltas::text) > 8192
     or (p_meta is not null and jsonb_typeof(p_meta) not in ('object', 'null'))
     or octet_length(coalesce(p_meta, 'null'::jsonb)::text) > 65536 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;

  v_request := jsonb_build_object(
    'userId', p_user_id, 'runId', p_run_id, 'scenarioId', p_scenario_id,
    'choiceId', p_choice_id, 'step', p_step
  );
  -- All new reward paths take run, then profile, then weekly locks in that order.
  select * into v_run from public.arena_runs
    where run_id = p_run_id and user_id = p_user_id for update;
  if not found then
    raise exception using message = 'REWARD_RUN_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_run.scenario_id is distinct from p_scenario_id then
    raise exception using message = 'RUN_SCENARIO_MISMATCH', errcode = 'P0001';
  end if;

  select * into v_receipt from public.arena_reward_receipts
    where run_id = p_run_id;
  if found then
    if v_receipt.reward_kind is distinct from 'legacy_choice'
       or v_receipt.user_id is distinct from p_user_id
       or v_receipt.canonical_request is distinct from v_request then
      raise exception using message = 'REWARD_INPUT_CONFLICT', errcode = 'P0001';
    end if;
    return v_receipt.result || jsonb_build_object('replayed', true);
  end if;
  if exists (select 1 from public.arena_events
       where run_id = p_run_id and event_type = 'CHOICE_CONFIRMED') then
    raise exception using message = 'LEGACY_REWARD_REVIEW_REQUIRED', errcode = 'P0001';
  end if;
  if v_run.run_type is distinct from 'scenario' then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  if v_run.status is distinct from 'IN_PROGRESS' then
    raise exception using message = 'RUN_NOT_ACTIVE', errcode = 'P0001';
  end if;

  insert into public.arena_profiles(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select * into v_profile from public.arena_profiles
    where user_id = p_user_id for update;
  if not found then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;

  insert into public.arena_events(
    run_id, user_id, step, event_type, scenario_id, choice_id, xp, deltas, meta
  ) values (
    p_run_id, p_user_id, p_step, 'CHOICE_CONFIRMED', p_scenario_id,
    p_choice_id, p_xp, p_deltas, nullif(p_meta, 'null'::jsonb)
  ) returning event_id into v_event_id;
  if v_event_id is null then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;

  -- Keep legacy Step 1 compatibility; reaching Step 2 is never inferred at Step 1.
  if p_step >= 2 then
    update public.arena_runs set current_step = p_step,
      reached_step_2_at = coalesce(reached_step_2_at, now())
      where run_id = p_run_id and user_id = p_user_id;
    if not found then
      raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
    end if;
  end if;
  if p_xp > 0 then
    perform public.increment_arena_xp(p_user_id, p_run_id, p_xp);
    -- The existing void RPC cannot report a trigger-suppressed UPDATE. Verify
    -- its required effects against the rows locked before the call.
    if not exists (select 1 from public.arena_profiles
         where user_id = p_user_id
           and lifetime_xp = v_profile.lifetime_xp + p_xp
           and weekly_xp = v_profile.weekly_xp + p_xp)
       or not exists (select 1 from public.arena_runs
         where run_id = p_run_id and user_id = p_user_id
           and total_xp = v_run.total_xp + p_xp) then
      raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
    end if;
  end if;
  v_result := jsonb_build_object(
    'policyVersion', 'legacy-xp-atomic/v1', 'kind', 'legacy_choice',
    'runId', p_run_id, 'scenarioId', p_scenario_id, 'receiptId', v_receipt_id,
    'replayed', false, 'eventId', v_event_id,
    'choiceId', p_choice_id, 'step', p_step, 'xp', p_xp
  );
  insert into public.arena_reward_receipts(
    receipt_id, user_id, run_id, reward_kind, scenario_id, canonical_request, result
  ) values (
    v_receipt_id, p_user_id, p_run_id, 'legacy_choice', p_scenario_id, v_request, v_result
  ) returning receipt_id into v_written_receipt_id;
  if v_written_receipt_id is distinct from v_receipt_id then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;
  return v_result;
end;
$$;
revoke all on function public.bty_record_legacy_choice_reward(uuid, uuid, text, text, integer, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.bty_record_legacy_choice_reward(uuid, uuid, text, text, integer, integer, jsonb, jsonb)
  to service_role;

create or replace function public.bty_complete_beginner_reward(
  p_user_id uuid,
  p_run_id uuid,
  p_scenario_id text,
  p_responses jsonb,
  p_score integer,
  p_feedback jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set extra_float_digits = 1
as $$
declare
  v_run public.arena_runs%rowtype;
  v_profile public.arena_profiles%rowtype;
  v_receipt public.arena_reward_receipts%rowtype;
  v_request jsonb;
  v_result jsonb;
  v_receipt_id uuid := pg_catalog.gen_random_uuid();
  v_event_id uuid;
  v_written_receipt_id uuid;
  v_weekly_total integer;
  v_core_before integer;
  v_core_after integer;
  -- Deliberate IEEE754 arithmetic: the existing TypeScript domain helper and
  -- applySeasonalXpToCore use Number, including its fractional-buffer rounding.
  v_buffer_before double precision;
  v_buffer_after double precision;
  v_exact double precision;
  v_whole integer;
  v_buffer_whole integer;
  v_core_gain integer;
  v_tier integer;
  v_code integer;
  v_group integer;
  v_default_sub_name text;
  v_field text;
begin
  if p_user_id is null or p_run_id is null
     or p_scenario_id is null or length(p_scenario_id) not between 1 and 200
     or btrim(p_scenario_id) <> p_scenario_id
     or p_responses is null or jsonb_typeof(p_responses) <> 'object'
     or octet_length(p_responses::text) > 100000
     or p_score is null or p_score not between 0 and 20
     or p_feedback is null or jsonb_typeof(p_feedback) <> 'object'
     or octet_length(p_feedback::text) > 8192 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  -- Server computes score and localized feedback. Validate their bounded envelope
  -- here; do not introduce a second catalog or a different maturity/reward policy.
  foreach v_field in array array['emotionIndex', 'riskIndex', 'integrityIndex', 'decisionIndex'] loop
    if jsonb_typeof(p_responses -> v_field) is distinct from 'number' then
      raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
    end if;
  end loop;
  if (p_responses ->> 'emotionIndex')::numeric not between 0 and 3
     or (p_responses ->> 'riskIndex')::numeric not between 0 and 2
     or (p_responses ->> 'integrityIndex')::numeric not between 0 and 1
     or (p_responses ->> 'decisionIndex')::numeric not between 0 and 2
     or jsonb_typeof(p_responses -> 'reflectionText') is null
     or jsonb_typeof(p_responses -> 'reflectionText') not in ('string', 'null')
     or length(p_responses ->> 'reflectionText') > 20000
     or jsonb_typeof(p_feedback -> 'band') is distinct from 'string'
     or (p_feedback ->> 'band') not in ('reactive', 'aware', 'intentional')
     or jsonb_typeof(p_feedback -> 'label') is distinct from 'string'
     or length(p_feedback ->> 'label') not between 1 and 200
     or jsonb_typeof(p_feedback -> 'message') is distinct from 'string'
     or length(p_feedback ->> 'message') not between 1 and 4000 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;

  v_request := jsonb_build_object(
    'userId', p_user_id, 'runId', p_run_id, 'scenarioId', p_scenario_id,
    'responses', p_responses
  );
  select * into v_run from public.arena_runs
    where run_id = p_run_id and user_id = p_user_id for update;
  if not found then
    raise exception using message = 'REWARD_RUN_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_run.scenario_id is distinct from p_scenario_id then
    raise exception using message = 'RUN_SCENARIO_MISMATCH', errcode = 'P0001';
  end if;
  select * into v_receipt from public.arena_reward_receipts
    where run_id = p_run_id;
  if found then
    if v_receipt.reward_kind is distinct from 'beginner_completion'
       or v_receipt.user_id is distinct from p_user_id
       or v_receipt.canonical_request is distinct from v_request then
      raise exception using message = 'REWARD_INPUT_CONFLICT', errcode = 'P0001';
    end if;
    return v_receipt.result || jsonb_build_object('replayed', true);
  end if;
  if v_run.run_type is distinct from 'beginner' then
    raise exception using message = 'NOT_BEGINNER_RUN', errcode = 'P0001';
  end if;
  if v_run.status = 'DONE' or exists (select 1 from public.arena_events
       where run_id = p_run_id and event_type = 'BEGINNER_REFLECTION') then
    raise exception using message = 'LEGACY_REWARD_REVIEW_REQUIRED', errcode = 'P0001';
  end if;
  if v_run.status is distinct from 'IN_PROGRESS' then
    raise exception using message = 'RUN_NOT_ACTIVE', errcode = 'P0001';
  end if;

  insert into public.arena_profiles(
    user_id, core_xp_total, core_xp_buffer, tier, code_index, sub_name,
    sub_name_renamed_in_code, stage, code_hidden
  ) values (p_user_id, 0, 0, 0, 0, 'Spark', false, 1, false)
    on conflict (user_id) do nothing;
  select * into v_profile from public.arena_profiles
    where user_id = p_user_id for update;
  if not found then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;

  -- This fixed 30 seasonal XP award matches the legacy beginner route.
  v_weekly_total := public.increment_weekly_xp(p_user_id, null, 30);
  if v_weekly_total is null then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;
  v_core_before := greatest(0, coalesce(v_profile.core_xp_total, 0));
  v_buffer_before := greatest(0::double precision, coalesce(v_profile.core_xp_buffer, 0)::double precision);
  v_exact := 30::double precision / case when v_core_before < 200 then 45::double precision else 60::double precision end;
  v_whole := floor(v_exact)::integer;
  v_buffer_after := v_buffer_before + (v_exact - v_whole);
  v_buffer_whole := floor(v_buffer_after)::integer;
  v_buffer_after := v_buffer_after - v_buffer_whole;
  v_core_gain := v_whole + v_buffer_whole;
  v_core_after := v_core_before + v_core_gain;
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
    -- Float text preserves the same shortest representation written by JSON/JS;
    -- direct float8::numeric would round its precision differently.
    core_xp_buffer = v_buffer_after::text::numeric,
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
  update public.arena_runs set status = 'DONE', completed_at = now(),
    beginner_maturity_score = p_score
    where run_id = p_run_id and user_id = p_user_id;
  if not found then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;
  insert into public.arena_events(
    run_id, user_id, step, event_type, scenario_id, meta
  ) values (
    p_run_id, p_user_id, 7, 'BEGINNER_REFLECTION', p_scenario_id,
    case when coalesce(p_responses ->> 'reflectionText', '') <> ''
      then jsonb_build_object('reflectionText', p_responses ->> 'reflectionText') else null end
  ) returning event_id into v_event_id;
  if v_event_id is null then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;

  v_result := jsonb_build_object(
    'policyVersion', 'legacy-xp-atomic/v1', 'kind', 'beginner_completion',
    'runId', p_run_id, 'scenarioId', p_scenario_id, 'receiptId', v_receipt_id,
    'replayed', false, 'eventId', v_event_id,
    'score', p_score, 'feedback', p_feedback, 'seasonalXp', 30,
    'coreGain', v_core_gain, 'coreBefore', v_core_before, 'coreAfter', v_core_after,
    'coreBufferBefore', v_buffer_before, 'coreBufferAfter', v_buffer_after,
    'weeklyXpTotal', v_weekly_total
  );
  insert into public.arena_reward_receipts(
    receipt_id, user_id, run_id, reward_kind, scenario_id, canonical_request, result
  ) values (
    v_receipt_id, p_user_id, p_run_id, 'beginner_completion', p_scenario_id, v_request, v_result
  ) returning receipt_id into v_written_receipt_id;
  if v_written_receipt_id is distinct from v_receipt_id then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;
  return v_result;
end;
$$;
revoke all on function public.bty_complete_beginner_reward(uuid, uuid, text, jsonb, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.bty_complete_beginner_reward(uuid, uuid, text, jsonb, integer, jsonb)
  to service_role;
