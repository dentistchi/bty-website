-- Learning participation rewards are independent of legacy Arena Core / Weekly XP.
-- Apply only after source review and separate migration authorization. No historical backfill.
begin;

create table if not exists public.learning_reward_policy (
  policy_version text primary key check (policy_version = 'learning-rewards/v1'),
  started_at timestamptz not null default statement_timestamp()
);
insert into public.learning_reward_policy (policy_version)
values ('learning-rewards/v1') on conflict (policy_version) do nothing;

create table if not exists public.learning_reward_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  timezone text not null,
  seen_achievement_ids text[] not null default '{}',
  featured_badge_id text check (featured_badge_id in (
    'first','circle','second','weeks','patient','clinical','follow','insight',
    'together','return','level10','level50'
  ))
);

create table if not exists public.learning_reward_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null references public.learning_reward_policy(policy_version),
  source_type text not null check (source_type in ('foundry_learn','clinical_practice','assigned_revisit','foundry_followup')),
  source_id text not null check (length(source_id) between 1 and 200),
  assignment_key text not null check (length(assignment_key) between 1 and 300),
  content_key text not null check (length(content_key) between 1 and 300),
  content_version text not null check (length(content_version) between 1 and 200),
  action text not null check (action in ('learn','practice','revisit','followup')),
  completed_at timestamptz not null,
  timezone text not null,
  bty_day date not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  xp integer not null check (xp in (0,10,20)),
  disposition text not null check (disposition in ('awarded','daily_cap')),
  recorded_at timestamptz not null default statement_timestamp(),
  unique (user_id,policy_version,source_type,source_id),
  unique (user_id,policy_version,assignment_key,action,content_key,content_version),
  check ((disposition = 'daily_cap' and xp = 0) or
    (disposition = 'awarded' and xp = case when action in ('learn','followup') then 10 else 20 end)),
  check ((source_type,action) in (('foundry_learn','learn'),('clinical_practice','practice'),
    ('assigned_revisit','revisit'),('foundry_followup','followup')))
);
create index if not exists learning_reward_completions_user_time_idx
  on public.learning_reward_completions (user_id,policy_version,completed_at,id);
-- Database uniqueness is a second guard behind the per-user transaction lock.
create unique index if not exists learning_reward_daily_credit_idx
  on public.learning_reward_completions (user_id,policy_version,bty_day,action)
  where disposition = 'awarded';

create table if not exists public.learning_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null unique references public.learning_reward_completions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null references public.learning_reward_policy(policy_version),
  xp integer not null check (xp in (10,20)),
  occurred_at timestamptz not null,
  bty_day date not null,
  timezone text not null,
  created_at timestamptz not null default statement_timestamp()
);
create index if not exists learning_reward_ledger_user_time_idx
  on public.learning_reward_ledger (user_id,policy_version,occurred_at,id);

alter table public.learning_reward_policy enable row level security;
alter table public.learning_reward_profiles enable row level security;
alter table public.learning_reward_completions enable row level security;
alter table public.learning_reward_ledger enable row level security;
revoke all on table public.learning_reward_policy, public.learning_reward_profiles,
  public.learning_reward_completions, public.learning_reward_ledger from public, anon, authenticated, service_role;
grant select on public.learning_reward_policy to service_role;
grant select,insert on public.learning_reward_profiles to service_role;
grant update (featured_badge_id,seen_achievement_ids) on public.learning_reward_profiles to service_role;
grant select,insert on public.learning_reward_completions, public.learning_reward_ledger to service_role;

-- Caller is the authenticated application server after reading canonical, user-owned evidence.
-- No client supplies XP, achievement flags, completion dates, or arbitrary reward evidence.
-- SECURITY INVOKER: no privileged bypass is introduced by this function.
create or replace function public.bty_record_learning_reward(p_user_id uuid,p_evidence jsonb)
returns table (completion_id uuid,disposition text,xp integer,total_xp bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  v_policy constant text := 'learning-rewards/v1';
  v_started timestamptz;
  v_action text;
  v_source text;
  v_source_id text;
  v_assignment text;
  v_content text;
  v_version text;
  v_completed timestamptz;
  v_timezone text;
  v_day date;
  v_metadata jsonb;
  v_id uuid;
  v_xp integer;
  v_disposition text;
begin
  if p_user_id is null or jsonb_typeof(p_evidence) is distinct from 'object'
    or p_evidence->>'policy_version' is distinct from v_policy then
    raise exception 'INVALID_REWARD_EVIDENCE' using errcode = '22023';
  end if;
  select p.started_at into strict v_started from public.learning_reward_policy p where p.policy_version = v_policy;
  v_action := p_evidence->>'action';
  v_source := p_evidence->>'source_type';
  v_source_id := p_evidence->>'source_id';
  v_assignment := p_evidence->>'assignment_key';
  v_content := p_evidence->>'content_key';
  v_version := p_evidence->>'content_version';
  v_metadata := coalesce(p_evidence->'metadata','{}'::jsonb);
  if (v_source,v_action) not in (('foundry_learn','learn'),('clinical_practice','practice'),
      ('assigned_revisit','revisit'),('foundry_followup','followup'))
    or v_source is null or v_action is null
    or coalesce(length(v_source_id),0) not between 1 and 200
    or coalesce(length(v_assignment),0) not between 1 and 300
    or coalesce(length(v_content),0) not between 1 and 300
    or coalesce(length(v_version),0) not between 1 and 200
    or jsonb_typeof(v_metadata) is distinct from 'object'
    or octet_length(v_metadata::text) > 4000
    or exists (select 1 from jsonb_object_keys(v_metadata) as k(key)
      where k.key not in ('moduleKey','requiredSteps','path','clinicalCaseId','followupDays',
        'revisitBaselineAt','revisitVariant','baselineVariant')) then
    raise exception 'INVALID_REWARD_EVIDENCE' using errcode = '22023';
  end if;
  v_completed := (p_evidence->>'completed_at')::timestamptz;
  if v_completed is null or not isfinite(v_completed) or v_completed < v_started
    or v_completed > statement_timestamp() then
    raise exception 'REWARD_OUTSIDE_POLICY_WINDOW' using errcode = '22023';
  end if;
  if v_action = 'revisit' and (
      nullif(v_metadata->>'revisitBaselineAt','') is null
      or v_completed < (v_metadata->>'revisitBaselineAt')::timestamptz + interval '72 hours'
      or nullif(v_metadata->>'revisitVariant','') is null
      or nullif(v_metadata->>'baselineVariant','') is null
      or v_metadata->>'revisitVariant' = v_metadata->>'baselineVariant') then
    raise exception 'INVALID_REVISIT_EVIDENCE' using errcode = '22023';
  end if;
  if v_action = 'followup' and coalesce(v_metadata->>'followupDays','') not in ('7','30') then
    raise exception 'INVALID_FOLLOWUP_EVIDENCE' using errcode = '22023';
  end if;
  v_timezone := p_evidence->>'timezone';
  if v_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = v_timezone) then
    raise exception 'INVALID_REWARD_TIMEZONE' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('learning-rewards/v1:' || p_user_id::text,0));
  insert into public.learning_reward_profiles (user_id,started_at,timezone)
    values (p_user_id,v_started,v_timezone) on conflict (user_id) do nothing;
  -- Freeze the reward timezone once: changing the device clock/zone cannot reset the daily cap.
  select p.timezone into strict v_timezone from public.learning_reward_profiles p where p.user_id = p_user_id;
  v_day := ((v_completed at time zone v_timezone) - interval '5 hours')::date;

  select c.id into v_id from public.learning_reward_completions c
    where c.user_id = p_user_id and c.policy_version = v_policy and (
      (c.source_type = v_source and c.source_id = v_source_id) or
      (c.assignment_key = v_assignment and c.action = v_action and c.content_key = v_content and c.content_version = v_version))
    order by c.recorded_at,c.id limit 1;
  if v_id is not null then
    return query select v_id,'duplicate'::text,0,coalesce(sum(l.xp),0)
      from public.learning_reward_ledger l where l.user_id = p_user_id and l.policy_version = v_policy;
    return;
  end if;
  if exists (select 1 from public.learning_reward_completions c where c.user_id = p_user_id
    and c.policy_version = v_policy and c.bty_day = v_day and c.action = v_action and c.disposition = 'awarded') then
    v_xp := 0;
    v_disposition := 'daily_cap';
  else
    v_xp := case when v_action in ('learn','followup') then 10 else 20 end;
    v_disposition := 'awarded';
  end if;
  insert into public.learning_reward_completions
    (user_id,policy_version,source_type,source_id,assignment_key,content_key,content_version,
      action,completed_at,timezone,bty_day,metadata,xp,disposition)
    values (p_user_id,v_policy,v_source,v_source_id,v_assignment,v_content,v_version,
      v_action,v_completed,v_timezone,v_day,v_metadata,v_xp,v_disposition) returning id into v_id;
  if v_xp > 0 then
    insert into public.learning_reward_ledger (completion_id,user_id,policy_version,xp,occurred_at,bty_day,timezone)
      values (v_id,p_user_id,v_policy,v_xp,v_completed,v_day,v_timezone);
  end if;
  return query select v_id,v_disposition,v_xp,coalesce(sum(l.xp),0)
    from public.learning_reward_ledger l where l.user_id = p_user_id and l.policy_version = v_policy;
end;
$$;

-- One statement / one MVCC snapshot: concurrent writes cannot expose half a reward to the UI.
-- JSON aggregates intentionally bypass the Data API's default row limit.
create or replace function public.bty_get_learning_reward_state(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'started_at', p.started_at,
    'timezone', (select r.timezone from public.learning_reward_profiles r where r.user_id = p_user_id),
    'featured_badge_id', (select r.featured_badge_id from public.learning_reward_profiles r where r.user_id = p_user_id),
    'seen_achievement_ids', coalesce((select to_jsonb(r.seen_achievement_ids) from public.learning_reward_profiles r where r.user_id = p_user_id),'[]'::jsonb),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at,c.id)
      from public.learning_reward_completions c where c.user_id = p_user_id and c.policy_version = p.policy_version),'[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.occurred_at,l.id)
      from public.learning_reward_ledger l where l.user_id = p_user_id and l.policy_version = p.policy_version),'[]'::jsonb)
  ) from public.learning_reward_policy p where p.policy_version = 'learning-rewards/v1';
$$;
-- Presentation acknowledgement only: never creates XP or a completion. Concurrent devices union
-- their acknowledged identifiers atomically rather than overwriting one another's progress.
create or replace function public.bty_acknowledge_learning_achievements(p_user_id uuid,p_ids text[])
returns text[] language plpgsql security invoker set search_path = '' as $$
declare v_seen text[];
begin
  if p_user_id is null or p_ids is null or cardinality(p_ids) > 32
    or exists (select 1 from unnest(p_ids) x(id) where x.id is null or x.id not in (
      'badge:first','badge:circle','badge:second','badge:weeks','badge:patient','badge:clinical',
      'badge:follow','badge:insight','badge:together','badge:return','badge:level10','badge:level50',
      'level:5','level:10','level:20','level:50')) then
    raise exception 'INVALID_ACHIEVEMENT_ACKNOWLEDGEMENT' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('learning-rewards/v1:' || p_user_id::text,0));
  update public.learning_reward_profiles p set seen_achievement_ids =
    array(select distinct x.id from unnest(p.seen_achievement_ids || p_ids) x(id) order by x.id)
    where p.user_id = p_user_id returning p.seen_achievement_ids into v_seen;
  if not found then raise exception 'LEARNING_REWARDS_PROFILE_NOT_FOUND' using errcode = '22023'; end if;
  return v_seen;
end;
$$;
revoke all on function public.bty_record_learning_reward(uuid,jsonb),
  public.bty_get_learning_reward_state(uuid), public.bty_acknowledge_learning_achievements(uuid,text[])
  from public,anon,authenticated;
grant execute on function public.bty_record_learning_reward(uuid,jsonb),
  public.bty_get_learning_reward_state(uuid), public.bty_acknowledge_learning_achievements(uuid,text[]) to service_role;

comment on table public.learning_reward_completions is 'Verified participation since policy activation; daily-cap completions remain evidence. No learner text.';
comment on table public.learning_reward_ledger is 'Append-only Learning XP; never merged with legacy Arena Core or Weekly XP.';
commit;
