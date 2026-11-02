-- Prepared source only; no production application is authorized by this file.
-- Keep the old ledger/claim functions unchanged while old runtimes may still call
-- their TypeScript Core updater. Rollout must fence/drain every old split writer.
create table if not exists public.foundry_xp_reward_receipts (
  receipt_id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Retain audit if a progress/event is deleted and its UUID is reused.
  event_id uuid not null,
  progress_id uuid not null unique,
  ledger_id bigint not null unique,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  unique(user_id, event_id)
);
create table if not exists public.foundry_completion_claim_receipts (
  claim_receipt_id uuid primary key default pg_catalog.gen_random_uuid(),
  claim_hash text not null unique check (claim_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_id uuid not null unique,
  event_id uuid not null,
  expires_at timestamptz not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.foundry_xp_reward_receipts enable row level security;
alter table public.foundry_completion_claim_receipts enable row level security;
revoke all on public.foundry_xp_reward_receipts, public.foundry_completion_claim_receipts
  from public, anon, authenticated, service_role;
grant select, insert on public.foundry_xp_reward_receipts, public.foundry_completion_claim_receipts to service_role;

create or replace function public.bty_foundry_award_core_atomic(
  p_user_id uuid, p_event_id uuid, p_progress_id uuid,
  p_day_start timestamptz, p_day_end timestamptz
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_progress public.foundry_event_training_progress%rowtype;
  v_profile public.arena_profiles%rowtype;
  v_receipt public.foundry_xp_reward_receipts%rowtype;
  v_owner uuid;
  v_participant_user uuid;
  v_core_before integer;
  v_core_after integer;
  v_tier integer;
  v_code integer;
  v_group integer;
  v_sub text;
  v_ledger_id bigint;
  v_result jsonb;
  v_outcome text;
  v_receipt_id uuid := pg_catalog.gen_random_uuid();
  v_written uuid;
begin
  if p_user_id is null or p_event_id is null or p_progress_id is null then
    raise exception using message='FOUNDRY_XP_INVALID_INPUT', errcode='P0001';
  end if;
  select * into v_progress from public.foundry_event_training_progress
    where id=p_progress_id for update;
  if not found or v_progress.event_id is distinct from p_event_id then
    raise exception using message='FOUNDRY_XP_SOURCE_MISMATCH', errcode='P0001';
  end if;
  if v_progress.completed_at is null then
    raise exception using message='FOUNDRY_XP_NOT_COMPLETED', errcode='P0001';
  end if;
  select user_id into v_participant_user from public.foundry_event_participants
    where id=v_progress.participant_id and event_id=p_event_id;
  if not found or (v_participant_user is null and v_progress.linked_user_id is null)
     or (v_participant_user is not null and v_participant_user<>p_user_id)
     or (v_progress.linked_user_id is not null and v_progress.linked_user_id<>p_user_id) then
    raise exception using message='FOUNDRY_XP_ACCOUNT_CONFLICT', errcode='P0001';
  end if;
  select owner_user_id into v_owner from public.foundry_events where id=p_event_id;
  if not found or v_owner is null then
    raise exception using message='FOUNDRY_XP_SOURCE_MISMATCH', errcode='P0001';
  end if;
  -- Replay the exact progress only for its original account/event. A retained
  -- receipt must not authorize changing owners after deleting/recreating a row.
  select * into v_receipt from public.foundry_xp_reward_receipts where progress_id=p_progress_id;
  if found then
    if v_receipt.user_id<>p_user_id or v_receipt.event_id<>p_event_id then
      raise exception using message='FOUNDRY_XP_ACCOUNT_CONFLICT', errcode='P0001';
    end if;
    return v_receipt.result || jsonb_build_object('outcome','already_awarded','replayed',true);
  end if;
  select * into v_receipt from public.foundry_xp_reward_receipts where user_id=p_user_id and event_id=p_event_id;
  if found then
    return v_receipt.result || jsonb_build_object('outcome','event_already_awarded',
      'requestedProgressId',p_progress_id,'replayed',true);
  end if;
  -- Eligibility gates new awards, never erases a retained historical receipt.
  if v_owner=p_user_id then
    return jsonb_build_object('policyVersion','foundry-core-atomic/v1','outcome','owner_ineligible');
  end if;
  -- An old timestamp/ledger cannot establish that the old TS Core write worked.
  if v_progress.xp_awarded_at is not null or exists (
    select 1 from public.core_xp_ledger l
      left join public.foundry_event_training_progress pr on pr.id::text=l.source_id
    where l.source_type='foundry_training_completion'
      and (l.source_id=p_progress_id::text or (l.user_id=p_user_id and pr.event_id=p_event_id))
      and not exists (select 1 from public.foundry_xp_reward_receipts r where r.ledger_id=l.id)
  ) then
    raise exception using message='FOUNDRY_XP_REVIEW_REQUIRED', errcode='P0001';
  end if;

  -- Progress -> profile -> the existing daily advisory lock. Every new award
  -- for this user serializes its Core projection, including different events.
  insert into public.arena_profiles(user_id,core_xp_total,core_xp_buffer,tier,code_index,
    sub_name,sub_name_renamed_in_code,stage,code_hidden)
    values(p_user_id,0,0,0,0,'Spark',false,1,false) on conflict(user_id) do nothing;
  select * into v_profile from public.arena_profiles where user_id=p_user_id for update;
  if not found then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED', errcode='P0001';
  end if;
  select * into v_receipt from public.foundry_xp_reward_receipts where user_id=p_user_id and event_id=p_event_id;
  if found then
    return v_receipt.result || jsonb_build_object('outcome','event_already_awarded',
      'requestedProgressId',p_progress_id,'replayed',true);
  end if;
  -- A legacy writer must be fenced at rollout; this recheck additionally refuses
  -- historical evidence that became visible while waiting for the profile lock.
  if exists (select 1 from public.core_xp_ledger l
    left join public.foundry_event_training_progress pr on pr.id::text=l.source_id
    where l.source_type='foundry_training_completion'
      and (l.source_id=p_progress_id::text or (l.user_id=p_user_id and pr.event_id=p_event_id))) then
    raise exception using message='FOUNDRY_XP_REVIEW_REQUIRED', errcode='P0001';
  end if;
  if p_day_start is null or p_day_end is null or not isfinite(p_day_start) or not isfinite(p_day_end)
     or p_day_start>now() or p_day_end<=now()
     or p_day_end-p_day_start not between interval '23 hours' and interval '25 hours' then
    raise exception using message='FOUNDRY_XP_INVALID_INPUT', errcode='P0001';
  end if;
  v_outcome := public.bty_foundry_award_daily_capped(
    p_user_id,p_event_id,p_progress_id::text,10,p_day_start,p_day_end,3
  );
  if v_outcome='daily_limit' then
    return jsonb_build_object('policyVersion','foundry-core-atomic/v1','outcome','daily_limit');
  end if;
  if v_outcome is distinct from 'awarded' then
    raise exception using message='FOUNDRY_XP_REVIEW_REQUIRED', errcode='P0001';
  end if;
  select id into v_ledger_id from public.core_xp_ledger
    where source_type='foundry_training_completion' and source_id=p_progress_id::text
      and user_id=p_user_id and delta_xp=10;
  if not found then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED', errcode='P0001';
  end if;
  v_core_before := greatest(0,coalesce(v_profile.core_xp_total,0));
  v_core_after := v_core_before+10;
  v_tier := greatest(0,floor(v_core_after::double precision/10)::integer);
  v_code := least(6,greatest(0,floor(v_tier::double precision/100)::integer));
  v_group := least(3,greatest(0,floor((v_tier%100)::double precision/25)::integer));
  v_sub := case v_code
    when 0 then (array['Spark','Ember','Flame','Inferno'])[v_group+1]
    when 1 then (array['Echo','Rhythm','Resonance','Surge'])[v_group+1]
    when 2 then (array['Outline','Structure','Framework','Foundation'])[v_group+1]
    when 3 then (array['Lift','Rise','Elevation','Summit'])[v_group+1]
    when 4 then (array['Glimmer','Radiance','Brilliance','Supernova'])[v_group+1]
    when 5 then (array['Draft','Design','Blueprint','Grand Architect'])[v_group+1]
    else null end;
  if coalesce(v_profile.sub_name_renamed_in_code,false) or v_sub is null then v_sub:=v_profile.sub_name; end if;
  update public.arena_profiles set core_xp_total=v_core_after,tier=v_tier,code_index=v_code,
    stage=least(7,floor(v_core_after::double precision/100)::integer+1),
    code_hidden=v_core_after>=700,sub_name=v_sub,updated_at=now() where user_id=p_user_id;
  if not found or not exists (select 1 from public.arena_profiles where user_id=p_user_id
    and core_xp_total=v_core_after and tier=v_tier and code_index=v_code
    and stage=least(7,floor(v_core_after::double precision/100)::integer+1)
    and code_hidden=(v_core_after>=700) and sub_name is not distinct from v_sub
    and core_xp_buffer is not distinct from v_profile.core_xp_buffer
    and weekly_xp is not distinct from v_profile.weekly_xp
    and lifetime_xp is not distinct from v_profile.lifetime_xp) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED', errcode='P0001';
  end if;
  update public.foundry_event_training_progress set linked_user_id=p_user_id,xp_awarded_at=now(),updated_at=now()
    where id=p_progress_id;
  if not found or not exists (select 1 from public.foundry_event_training_progress
    where id=p_progress_id and linked_user_id=p_user_id and xp_awarded_at is not null) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED', errcode='P0001';
  end if;
  v_result:=jsonb_build_object('policyVersion','foundry-core-atomic/v1','outcome','awarded',
    'userId',p_user_id,'eventId',p_event_id,'requestedProgressId',p_progress_id,'awardedProgressId',p_progress_id,
    'receiptId',v_receipt_id,'ledgerId',v_ledger_id,'deltaXp',10,'coreBefore',v_core_before,'coreAfter',v_core_after,'replayed',false);
  insert into public.foundry_xp_reward_receipts(receipt_id,user_id,event_id,progress_id,ledger_id,result)
    values(v_receipt_id,p_user_id,p_event_id,p_progress_id,v_ledger_id,v_result) returning receipt_id into v_written;
  if v_written is distinct from v_receipt_id or not exists(select 1 from public.foundry_xp_reward_receipts
    where receipt_id=v_receipt_id and result=v_result and user_id=p_user_id and event_id=p_event_id
      and progress_id=p_progress_id and ledger_id=v_ledger_id) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED', errcode='P0001';
  end if;
  return v_result;
end;
$$;
revoke all on function public.bty_foundry_award_core_atomic(uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.bty_foundry_award_core_atomic(uuid,uuid,uuid,timestamptz,timestamptz) to service_role;

-- One outer transaction reuses all shipped assignment/follow-up/apply authorities.
-- The legacy claim function is called with XP disabled, so it cannot commit an
-- unaccompanied ledger insert. Any later exception rolls its entire claim back.
create or replace function public.bty_foundry_redeem_completion_claim_atomic(
  p_claim_hash text,p_user_id uuid,p_timezone text,p_source_training_title text,
  p_assignment_id uuid,p_organization_id uuid,p_follow_up_days integer,
  p_fu_completion_bty_day date,p_fu_due_bty_day date,p_fu_due_at timestamptz,
  p_apply_days integer,p_ap_completion_bty_day date,p_ap_due_bty_day date,p_ap_due_at timestamptz,
  p_xp integer,p_xp_eligible boolean,p_day_start timestamptz,p_day_end timestamptz
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_progress public.foundry_event_training_progress%rowtype;
  v_receipt public.foundry_completion_claim_receipts%rowtype;
  v_claim record;
  v_assignment public.foundry_event_assignments%rowtype;
  v_assignment_before public.foundry_event_assignments%rowtype;
  v_assignment_conflict boolean := false;
  v_xp jsonb;
  v_result jsonb;
  v_receipt_id uuid:=pg_catalog.gen_random_uuid();
  v_written uuid;
begin
  if p_claim_hash is null or p_claim_hash !~ '^[0-9a-f]{64}$' or p_user_id is null or p_xp is distinct from 10 then
    return jsonb_build_object('outcome','invalid');
  end if;
  select * into v_progress from public.foundry_event_training_progress where claim_secret_hash=p_claim_hash for update;
  if not found or v_progress.completed_at is null or v_progress.claim_secret_expires_at is null
    or v_progress.claim_secret_expires_at<=now() then return jsonb_build_object('outcome','invalid'); end if;
  select * into v_receipt from public.foundry_completion_claim_receipts where claim_hash=p_claim_hash;
  if found then
    if v_receipt.user_id<>p_user_id or v_receipt.progress_id<>v_progress.id
      or v_receipt.event_id<>v_progress.event_id or v_receipt.expires_at<=now()
      or v_progress.linked_user_id is distinct from p_user_id then return jsonb_build_object('outcome','invalid'); end if;
    return v_receipt.result || jsonb_build_object('replayed',true);
  end if;
  if v_progress.linked_user_id is not null or v_progress.claim_consumed_at is not null then
    return jsonb_build_object('outcome','invalid');
  end if;
  select * into v_assignment_before from public.foundry_event_assignments
    where event_id=v_progress.event_id and user_id_snapshot=p_user_id and status<>'revoked' for update;
  v_assignment_conflict := found and v_assignment_before.participant_id is not null
    and v_assignment_before.participant_id<>v_progress.participant_id;
  select * into v_claim from public.bty_foundry_redeem_completion_claim(
    p_claim_hash,p_user_id,p_timezone,p_source_training_title,p_assignment_id,p_organization_id,
    p_follow_up_days,p_fu_completion_bty_day,p_fu_due_bty_day,p_fu_due_at,
    p_apply_days,p_ap_completion_bty_day,p_ap_due_bty_day,p_ap_due_at,
    10,false,p_day_start,p_day_end
  );
  if not found then return jsonb_build_object('outcome','invalid'); end if;
  if v_claim.progress_id is distinct from v_progress.id or v_claim.event_id is distinct from v_progress.event_id
    or not exists(select 1 from public.foundry_event_training_progress where id=v_progress.id
      and linked_user_id=p_user_id and claim_consumed_at is not null) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED',errcode='P0001';
  end if;
  -- The existing authorities may report success after a trigger suppresses a
  -- required INSERT/UPDATE. Confirm durable effects before acknowledging claim.
  select * into v_assignment from public.foundry_event_assignments
    where event_id=v_progress.event_id and user_id_snapshot=p_user_id and status<>'revoked';
  if v_assignment_conflict then
    -- A legitimate second session must not take over an already-bound assignment.
    if not found or v_assignment is distinct from v_assignment_before then
      raise exception using message='FOUNDRY_XP_WRITE_FAILED',errcode='P0001';
    end if;
  elsif found and (v_assignment.participant_id is distinct from v_progress.participant_id
    or v_assignment.status is distinct from 'completed' or v_assignment.completed_at is null
    or v_assignment.claimed_at is null or not exists(select 1 from public.foundry_event_assignment_audit a
      where a.assignment_id_snapshot=v_assignment.id and a.event_id_snapshot=v_progress.event_id
        and a.changed_by_snapshot=p_user_id and a.action='complete' and a.new_status='completed')) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED',errcode='P0001';
  end if;
  if p_follow_up_days is not null and not exists(select 1 from public.foundry_participant_followups f
    where f.progress_id=v_progress.id and f.event_id=v_progress.event_id and f.user_id_snapshot=p_user_id
      and f.follow_up_days=p_follow_up_days and f.completed_at=v_progress.completed_at
      and exists(select 1 from public.foundry_participant_followup_audit a where a.followup_id=f.id
        and a.event_id=v_progress.event_id and a.user_id_snapshot=p_user_id and a.event_type='CREATED')) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED',errcode='P0001';
  end if;
  if p_apply_days is not null and not exists(select 1 from public.foundry_participant_apply_windows a
    where a.progress_id=v_progress.id and a.event_id=v_progress.event_id and a.user_id_snapshot=p_user_id
      and a.apply_days=p_apply_days and a.completed_at=v_progress.completed_at) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED',errcode='P0001';
  end if;
  v_xp:=public.bty_foundry_award_core_atomic(p_user_id,v_progress.event_id,v_progress.id,p_day_start,p_day_end);
  if v_xp->>'outcome'='review_required' then
    raise exception using message='FOUNDRY_XP_REVIEW_REQUIRED',errcode='P0001';
  end if;
  v_result:=jsonb_build_object('policyVersion','foundry-claim-atomic/v1','progressId',v_progress.id,
    'eventId',v_progress.event_id,'claimReceiptId',v_receipt_id,'expiresAt',v_progress.claim_secret_expires_at,
    'replayed',false,'xp',v_xp);
  insert into public.foundry_completion_claim_receipts(claim_receipt_id,claim_hash,user_id,progress_id,event_id,expires_at,result)
    values(v_receipt_id,p_claim_hash,p_user_id,v_progress.id,v_progress.event_id,v_progress.claim_secret_expires_at,v_result)
    returning claim_receipt_id into v_written;
  if v_written is distinct from v_receipt_id or not exists(select 1 from public.foundry_completion_claim_receipts
    where claim_receipt_id=v_receipt_id and result=v_result and user_id=p_user_id and claim_hash=p_claim_hash
      and progress_id=v_progress.id and event_id=v_progress.event_id and expires_at=v_progress.claim_secret_expires_at) then
    raise exception using message='FOUNDRY_XP_WRITE_FAILED',errcode='P0001';
  end if;
  return v_result;
end;
$$;
revoke all on function public.bty_foundry_redeem_completion_claim_atomic(text,uuid,text,text,uuid,uuid,integer,date,date,timestamptz,integer,date,date,timestamptz,integer,boolean,timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function public.bty_foundry_redeem_completion_claim_atomic(text,uuid,text,text,uuid,uuid,integer,date,date,timestamptz,integer,date,date,timestamptz,integer,boolean,timestamptz,timestamptz) to service_role;
