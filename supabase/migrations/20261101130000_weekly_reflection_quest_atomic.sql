-- Weekly reflection quest (+15 seasonal XP once per user and UTC week), atomic.
-- Apply only through scripts/reward-write-fence-cutover.mjs with the PR91 migrations.
--
-- The route previously read the claim, paid weekly XP, applied Core in TypeScript and
-- only then inserted the claim, ignoring its error: concurrent requests, or a claim
-- insert failure followed by a retry, paid more than once. Here the claim row is the
-- idempotency key and is inserted first; weekly XP, Core and the claim commit or roll
-- back together. A concurrent duplicate waits on the uncommitted claim and then
-- returns already_claimed. Existing claims and learner rows are not rewritten.
create or replace function public.bty_claim_weekly_reflection_quest(p_user_id uuid, p_week_start date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set extra_float_digits = 1
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'UTC')::date;
  v_reflections integer;
  v_profile public.arena_profiles%rowtype;
  v_weekly_total integer;
  v_core_before integer;
  v_core_after integer;
  -- Same IEEE754 arithmetic as applySeasonalXpToCore and bty_complete_beginner_reward.
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
begin
  -- Monday of the current or previous UTC week: a request that crosses Monday 00:00
  -- still claims the week it counted, and no future week can be claimed.
  if p_user_id is null or p_week_start is null or extract(isodow from p_week_start) <> 1
     or p_week_start > v_today or p_week_start < v_today - 13 then
    raise exception using message = 'INVALID_REWARD_INPUT', errcode = 'P0001';
  end if;
  select count(*) into v_reflections from public.arena_events
    where user_id = p_user_id and event_type in ('REFLECTION_SELECTED', 'BEGINNER_REFLECTION')
      and created_at >= (p_week_start::timestamp at time zone 'UTC')
      and created_at < ((p_week_start + 7)::timestamp at time zone 'UTC');
  if v_reflections < 3 then
    return jsonb_build_object('policyVersion', 'weekly-reflection-quest/v1', 'outcome', 'not_eligible',
      'weekStart', p_week_start, 'reflectionCount', v_reflections);
  end if;

  insert into public.arena_weekly_quest_claims(user_id, week_start, quest_type)
    values (p_user_id, p_week_start, 'reflection')
    on conflict (user_id, week_start, quest_type) do nothing;
  if not found then
    return jsonb_build_object('policyVersion', 'weekly-reflection-quest/v1', 'outcome', 'already_claimed',
      'weekStart', p_week_start);
  end if;

  insert into public.arena_profiles(
    user_id, core_xp_total, core_xp_buffer, tier, code_index, sub_name,
    sub_name_renamed_in_code, stage, code_hidden
  ) values (p_user_id, 0, 0, 0, 0, 'Spark', false, 1, false)
    on conflict (user_id) do nothing;
  select * into v_profile from public.arena_profiles where user_id = p_user_id for update;
  if not found then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;

  v_weekly_total := public.increment_weekly_xp(p_user_id, null, 15);
  if v_weekly_total is null then
    raise exception using message = 'REWARD_WRITE_FAILED', errcode = 'P0001';
  end if;
  v_core_before := greatest(0, coalesce(v_profile.core_xp_total, 0));
  v_buffer_before := greatest(0::double precision, coalesce(v_profile.core_xp_buffer, 0)::double precision);
  v_exact := 15::double precision / case when v_core_before < 200 then 45::double precision else 60::double precision end;
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

  return jsonb_build_object('policyVersion', 'weekly-reflection-quest/v1', 'outcome', 'awarded',
    'weekStart', p_week_start, 'seasonalXp', 15, 'coreGain', v_core_gain,
    'coreBefore', v_core_before, 'coreAfter', v_core_after, 'weeklyXpTotal', v_weekly_total);
end;
$$;

revoke all on function public.bty_claim_weekly_reflection_quest(uuid, date) from public, anon, authenticated;
grant execute on function public.bty_claim_weekly_reflection_quest(uuid, date) to service_role;
