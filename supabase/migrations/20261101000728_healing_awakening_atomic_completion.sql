-- Source preparation only. Apply separately after fencing every old completion writer.
-- Existing owner reads remain; completion writes must pass authenticated server validation.
revoke insert, update, delete, truncate, references, trigger
  on public.user_healing_awakening_acts, public.user_healing_milestones
  from public, anon, authenticated;
grant select, insert, update on public.user_healing_awakening_acts, public.user_healing_milestones to service_role;
grant select, insert on public.user_advanced_unlocks to service_role;

create or replace function public.bty_complete_healing_awakening_act(p_user_id uuid, p_act_id integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_acts integer[];
  v_milestone public.user_healing_milestones%rowtype;
  v_at timestamptz;
  v_written timestamptz;
  v_days integer;
begin
  if p_user_id is null then
    raise exception using message='INVALID_HEALING_INPUT', errcode='P0001';
  end if;
  if p_act_id is null or p_act_id not between 1 and 3 then
    raise exception using message='INVALID_ACT_ID', errcode='P0001';
  end if;
  -- Both completion modes serialize by the same canonical user, including absent milestone rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bty-healing-completion:' || p_user_id::text, 0));
  select * into v_milestone from public.user_healing_milestones where user_id=p_user_id for update;
  select coalesce(array_agg(act_id::integer order by act_id), '{}'::integer[]) into v_acts
    from public.user_healing_awakening_acts where user_id=p_user_id;
  if v_acts not in ('{}'::integer[], array[1], array[1,2], array[1,2,3])
     or (v_acts=array[1,2,3] and v_milestone.second_awakening_completed_at is null)
     or (v_milestone.second_awakening_completed_at is null and v_milestone.starter_unlock_granted is not null) then
    raise exception using message='HEALING_COMPLETION_REVIEW_REQUIRED', errcode='P0001';
  end if;
  if v_milestone.second_awakening_completed_at is not null and v_milestone.starter_unlock_granted is not null
     and not exists(select 1 from public.user_advanced_unlocks
       where user_id=p_user_id and advanced_stat_name=v_milestone.starter_unlock_granted) then
    raise exception using message='HEALING_COMPLETION_REVIEW_REQUIRED', errcode='P0001';
  end if;
  if p_act_id=any(v_acts) then
    raise exception using message='ACT_ALREADY_COMPLETED', errcode='P0001';
  end if;
  if cardinality(v_acts)<>p_act_id-1 then
    raise exception using message='ACT_PREREQUISITE', errcode='P0001';
  end if;
  if v_milestone.second_awakening_completed_at is not null then
    raise exception using message='NOT_ELIGIBLE', errcode='P0001';
  end if;
  -- The canonical train table stores integer day keys; match the existing DISTINCT count == 28.
  select count(distinct day) into v_days from public.train_day_completions where user_id=p_user_id;
  if v_days<>28 then
    raise exception using message='NOT_ELIGIBLE', errcode='P0001';
  end if;
  insert into public.user_healing_awakening_acts(user_id,act_id,completed_at) values(p_user_id,p_act_id,clock_timestamp())
    returning completed_at into v_at;
  if v_at is null or not exists(select 1 from public.user_healing_awakening_acts
      where user_id=p_user_id and act_id=p_act_id and completed_at=v_at) then
    raise exception using message='HEALING_WRITE_FAILED', errcode='P0001';
  end if;
  if p_act_id=3 then
    insert into public.user_healing_milestones(user_id,second_awakening_completed_at) values(p_user_id,v_at)
      on conflict(user_id) do update set second_awakening_completed_at=excluded.second_awakening_completed_at
      where public.user_healing_milestones.second_awakening_completed_at is null
      returning second_awakening_completed_at into v_written;
    if v_written is distinct from v_at or not exists(select 1 from public.user_healing_milestones
        where user_id=p_user_id and second_awakening_completed_at=v_at) then
      raise exception using message='HEALING_WRITE_FAILED', errcode='P0001';
    end if;
  end if;
  return jsonb_build_object('policyVersion','healing-completion/v1','operation','act',
    'userId',p_user_id,'actId',p_act_id,'completedActs',v_acts || p_act_id,
    'actCompletedAt',v_at,'completedAt',v_written,'idempotent',false);
end;
$$;
revoke all on function public.bty_complete_healing_awakening_act(uuid,integer) from public,anon,authenticated;
grant execute on function public.bty_complete_healing_awakening_act(uuid,integer) to service_role;

create or replace function public.bty_complete_second_awakening(p_user_id uuid, p_starter_unlock text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_milestone public.user_healing_milestones%rowtype;
  v_acts integer[];
  v_days integer;
  v_at timestamptz;
  v_written timestamptz;
  v_unlock_user uuid;
begin
  if p_user_id is null or (p_starter_unlock is not null and p_starter_unlock not in ('PRM','SAG')) then
    raise exception using message='INVALID_HEALING_INPUT', errcode='P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bty-healing-completion:' || p_user_id::text, 0));
  select * into v_milestone from public.user_healing_milestones where user_id=p_user_id for update;
  -- A healthy durable completion is read-only replay. Never infer a missing historical unlock.
  if v_milestone.second_awakening_completed_at is not null then
    if v_milestone.starter_unlock_granted is not null and not exists(
      select 1 from public.user_advanced_unlocks where user_id=p_user_id and advanced_stat_name=v_milestone.starter_unlock_granted
    ) then
      raise exception using message='HEALING_COMPLETION_REVIEW_REQUIRED', errcode='P0001';
    end if;
    return jsonb_build_object('policyVersion','healing-completion/v1','operation','ritual','userId',p_user_id,
      'completedAt',v_milestone.second_awakening_completed_at,'starterUnlockGranted',v_milestone.starter_unlock_granted,'idempotent',true);
  end if;
  select coalesce(array_agg(act_id::integer order by act_id), '{}'::integer[]) into v_acts
    from public.user_healing_awakening_acts where user_id=p_user_id;
  if v_acts not in ('{}'::integer[], array[1], array[1,2])
     or v_milestone.starter_unlock_granted is not null
     or (p_starter_unlock is not null and exists(select 1 from public.user_advanced_unlocks
       where user_id=p_user_id and advanced_stat_name=p_starter_unlock)) then
    raise exception using message='HEALING_COMPLETION_REVIEW_REQUIRED', errcode='P0001';
  end if;
  select count(distinct day) into v_days from public.train_day_completions where user_id=p_user_id;
  if v_days<>28 then
    raise exception using message='NOT_ELIGIBLE', errcode='P0001';
  end if;
  v_at := clock_timestamp();
  insert into public.user_healing_milestones(user_id,second_awakening_completed_at,starter_unlock_granted)
    values(p_user_id,v_at,p_starter_unlock)
    on conflict(user_id) do update set second_awakening_completed_at=excluded.second_awakening_completed_at,
      starter_unlock_granted=excluded.starter_unlock_granted
    where public.user_healing_milestones.second_awakening_completed_at is null
    returning second_awakening_completed_at into v_written;
  if v_written is distinct from v_at or not exists(select 1 from public.user_healing_milestones
      where user_id=p_user_id and second_awakening_completed_at=v_at and starter_unlock_granted is not distinct from p_starter_unlock) then
    raise exception using message='HEALING_WRITE_FAILED', errcode='P0001';
  end if;
  if p_starter_unlock is not null then
    insert into public.user_advanced_unlocks(user_id,advanced_stat_name,unlocked_at)
      values(p_user_id,p_starter_unlock,v_at) on conflict(user_id,advanced_stat_name) do nothing
      returning user_id into v_unlock_user;
    if v_unlock_user is distinct from p_user_id or not exists(select 1 from public.user_advanced_unlocks
        where user_id=p_user_id and advanced_stat_name=p_starter_unlock and unlocked_at=v_at) then
      raise exception using message='HEALING_WRITE_FAILED', errcode='P0001';
    end if;
  end if;
  return jsonb_build_object('policyVersion','healing-completion/v1','operation','ritual','userId',p_user_id,
    'completedAt',v_at,'starterUnlockGranted',p_starter_unlock,'idempotent',false);
end;
$$;
revoke all on function public.bty_complete_second_awakening(uuid,text) from public,anon,authenticated;
grant execute on function public.bty_complete_second_awakening(uuid,text) to service_role;
