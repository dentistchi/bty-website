-- One Teams reminder 24 hours after a new Save or Track, subject to current eligibility.
-- Source writes and queue inserts commit together. Existing rows are never backfilled.
begin;

create schema if not exists bty_reminder_private;
revoke all on schema bty_reminder_private from public, anon, authenticated, service_role;

alter table public.bty_action_captures
  add column if not exists teams_reminder_actor_oid uuid;
comment on column public.bty_action_captures.teams_reminder_actor_oid is
  'Set only by a verified Teams Save that activates this Saved item; never from the web capture request. Cleared when the item leaves Saved.';

create table if not exists bty_reminder_private.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('save', 'track_owner', 'track_recipient')),
  capture_id uuid references public.bty_action_captures(id) on delete cascade,
  announcement_id uuid references public.bty_tracked_announcements(id) on delete cascade,
  recipient_id uuid references public.bty_tracked_announcement_recipients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  aad_object_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  available_at timestamptz not null default (clock_timestamp() + interval '24 hours'),
  state text not null default 'pending'
    check (state in ('pending', 'claimed', 'sending', 'sent', 'skipped', 'unknown', 'failed')),
  attempts int not null default 0 check (attempts between 0 and 4),
  claim_token uuid,
  lease_until timestamptz,
  check (
    (kind = 'save' and capture_id is not null and announcement_id is null and recipient_id is null)
    or (kind = 'track_owner' and capture_id is null and announcement_id is not null and recipient_id is null)
    or (kind = 'track_recipient' and capture_id is null and announcement_id is not null and recipient_id is not null)
  ),
  check ((state in ('claimed', 'sending')) = (claim_token is not null and lease_until is not null)),
  check ((claim_token is null) = (lease_until is null))
);

alter table bty_reminder_private.jobs enable row level security;
revoke all on table bty_reminder_private.jobs from public, anon, authenticated, service_role;

create index if not exists teams_reminder_due_idx on bty_reminder_private.jobs (available_at, id)
  where state in ('pending', 'claimed');
create index if not exists teams_reminder_lease_idx on bty_reminder_private.jobs (lease_until)
  where state in ('claimed', 'sending');
create index if not exists teams_reminder_capture_idx on bty_reminder_private.jobs (capture_id)
  where capture_id is not null;
create index if not exists teams_reminder_announcement_idx on bty_reminder_private.jobs (announcement_id)
  where announcement_id is not null;
create index if not exists teams_reminder_user_idx on bty_reminder_private.jobs (user_id);
create unique index if not exists teams_reminder_track_owner_unique
  on bty_reminder_private.jobs (announcement_id) where kind = 'track_owner';
create unique index if not exists teams_reminder_track_recipient_unique
  on bty_reminder_private.jobs (recipient_id) where recipient_id is not null;

create or replace function bty_reminder_private.clear_inactive_save_actor()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.status is distinct from 'captured' or new.saved_at is null or new.saved_removed_at is not null then
    new.teams_reminder_actor_oid := null;
  end if;
  return new;
end;
$$;

create or replace function bty_reminder_private.schedule_save()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  was_saved boolean := false;
  is_saved boolean;
  tenant text;
begin
  if new.source_type is distinct from 'teams_message' then return null; end if;
  is_saved := new.status = 'captured' and new.saved_at is not null and new.saved_removed_at is null;
  if tg_op = 'UPDATE' then
    was_saved := old.status = 'captured' and old.saved_at is not null and old.saved_removed_at is null;
  end if;

  if was_saved and not is_saved then
    -- The capture row lock serializes removal and re-save against the next send boundary.
    update bty_reminder_private.jobs
      set state = 'skipped', claim_token = null, lease_until = null
      where capture_id = new.id and state in ('pending', 'claimed');
  elsif is_saved and not was_saved and new.teams_reminder_actor_oid is not null then
    tenant := lower(btrim(new.source_metadata->>'tenant_id'));
    if public.bty_track_participant_user_v1(tenant, new.teams_reminder_actor_oid::text) = new.user_id then
      insert into bty_reminder_private.jobs (kind, capture_id, user_id, tenant_id, aad_object_id)
      values ('save', new.id, new.user_id, tenant, new.teams_reminder_actor_oid::text);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists teams_reminder_clear_inactive_save_actor on public.bty_action_captures;
create trigger teams_reminder_clear_inactive_save_actor
  before insert or update of status, saved_at, saved_removed_at, teams_reminder_actor_oid
  on public.bty_action_captures for each row
  execute function bty_reminder_private.clear_inactive_save_actor();

drop trigger if exists teams_reminder_schedule_save on public.bty_action_captures;
create trigger teams_reminder_schedule_save
  after insert or update of status, saved_at, saved_removed_at
  on public.bty_action_captures for each row
  execute function bty_reminder_private.schedule_save();

create or replace function bty_reminder_private.is_track_pending(
  mode text, acknowledged timestamptz, submitted timestamptz
) returns boolean language sql immutable set search_path = pg_catalog as $$
  select case mode
    when 'acknowledgment' then acknowledged is null
    when 'response' then submitted is null
    else false
  end;
$$;

create or replace function bty_reminder_private.schedule_track()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  announcement public.bty_tracked_announcements%rowtype;
  recipient public.bty_tracked_announcement_recipients%rowtype;
  owner_oids text[];
begin
  -- The Track transaction sets the mode and binds the frozen audience after the INSERT.
  -- This deferred trigger sees those final values, so old tracking modes are excluded.
  select a.* into announcement from public.bty_tracked_announcements a where a.id = new.announcement_id;
  select r.* into recipient from public.bty_tracked_announcement_recipients r where r.id = new.id;
  if announcement.status is distinct from 'active' or announcement.owner_user_id is null or recipient.user_id is null
     or recipient.user_id = announcement.owner_user_id
     or recipient.tenant_id is distinct from announcement.tenant_id
     or not bty_reminder_private.is_track_pending(
        announcement.tracking_mode, recipient.acknowledged_at, recipient.response_submitted_at
     ) then return null;
  end if;
  if public.bty_track_participant_user_v1(recipient.tenant_id, recipient.aad_object_id)
     is distinct from recipient.user_id then return null;
  end if;

  insert into bty_reminder_private.jobs (kind, announcement_id, recipient_id, user_id, tenant_id, aad_object_id)
  values ('track_recipient', announcement.id, recipient.id, recipient.user_id, recipient.tenant_id, recipient.aad_object_id)
  on conflict do nothing;

  -- The run stores the verified source tenant and canonical owner. Reverse lookup
  -- only nested Azure claims within that tenant, then re-resolve through the normal gate.
  if exists (select 1 from bty_reminder_private.jobs j
             where j.announcement_id = announcement.id and j.kind = 'track_owner') then return null;
  end if;
  select array_agg(lower(i.identity_data->'custom_claims'->>'oid')) into owner_oids
    from auth.identities i
    where i.user_id = announcement.owner_user_id and i.provider = 'azure'
      and lower(i.identity_data->'custom_claims'->>'tid') = announcement.tenant_id
      and i.identity_data->'custom_claims'->>'oid' is not null;
  if cardinality(owner_oids) = 1
     and public.bty_track_participant_user_v1(announcement.tenant_id, owner_oids[1]) = announcement.owner_user_id then
    insert into bty_reminder_private.jobs (kind, announcement_id, user_id, tenant_id, aad_object_id)
    values ('track_owner', announcement.id, announcement.owner_user_id, announcement.tenant_id, owner_oids[1])
    on conflict do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists teams_reminder_schedule_track on public.bty_tracked_announcement_recipients;
create constraint trigger teams_reminder_schedule_track
  after insert on public.bty_tracked_announcement_recipients
  deferrable initially deferred for each row execute function bty_reminder_private.schedule_track();

create or replace function bty_reminder_private.job_eligible(job bty_reminder_private.jobs)
returns boolean language sql stable set search_path = pg_catalog as $$
  select public.bty_track_participant_user_v1(job.tenant_id, job.aad_object_id) = job.user_id
    and case job.kind
      when 'save' then exists (
        select 1 from public.bty_action_captures c
        where c.id = job.capture_id and c.user_id = job.user_id and c.source_type = 'teams_message'
          and lower(btrim(c.source_metadata->>'tenant_id')) = job.tenant_id
          and c.teams_reminder_actor_oid::text = job.aad_object_id
          and c.status = 'captured' and c.saved_at is not null and c.saved_removed_at is null
      )
      else exists (
        select 1 from public.bty_tracked_announcements a
        join public.bty_tracked_announcement_recipients r on r.announcement_id = a.id
        where a.id = job.announcement_id and a.tenant_id = job.tenant_id and a.status = 'active'
          and a.owner_user_id is not null
          and bty_reminder_private.is_track_pending(a.tracking_mode, r.acknowledged_at, r.response_submitted_at)
          and case job.kind
            when 'track_owner' then a.owner_user_id = job.user_id
            else r.id = job.recipient_id and r.tenant_id = job.tenant_id
              and r.aad_object_id = job.aad_object_id and r.user_id = job.user_id
          end
      )
    end;
$$;

create or replace function public.bty_claim_due_teams_reminders(p_limit int)
returns table (id uuid, claim_token uuid, kind text, tenant_id text, aad_object_id text, subject_id uuid)
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit int := greatest(0, least(coalesce(p_limit, 0), 100));
begin
  if v_limit = 0 then return; end if;

  -- Once a network send might have happened, an expired lease means unknown delivery.
  -- A process crash before the marked boundary is safe to reclaim up to the attempt cap.
  with expired as (
    select j.id from bty_reminder_private.jobs j
    where j.lease_until <= v_now and (j.state = 'sending' or (j.state = 'claimed' and j.attempts = 4))
    order by j.lease_until limit v_limit for update skip locked
  )
  update bty_reminder_private.jobs j
    set state = case j.state when 'sending' then 'unknown' else 'failed' end,
        claim_token = null, lease_until = null
    from expired e where j.id = e.id;

  return query
    with due as (
      select j.id from bty_reminder_private.jobs j
      where j.available_at <= v_now and j.attempts < 4
        and j.state in ('pending', 'claimed')
        and (j.lease_until is null or j.lease_until <= v_now)
      order by j.available_at, j.id limit v_limit for update skip locked
    ), eligible as materialized (
      select j.id, bty_reminder_private.job_eligible(j) is true as allowed
      from bty_reminder_private.jobs j join due d on d.id = j.id
    ), reserved as (
      update bty_reminder_private.jobs j
        set state = case when e.allowed then 'claimed' else 'skipped' end,
            claim_token = case when e.allowed then gen_random_uuid() end,
            lease_until = case when e.allowed then v_now + interval '12 minutes' end,
            attempts = j.attempts + e.allowed::int
        from eligible e where j.id = e.id
        returning j.*
    )
    select j.id, j.claim_token, j.kind, j.tenant_id, j.aad_object_id, coalesce(j.capture_id, j.announcement_id)
    from reserved j where j.state = 'claimed';
end;
$$;

create or replace function public.bty_start_teams_reminder(p_id uuid, p_claim_token uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare
  job bty_reminder_private.jobs%rowtype;
  announcement public.bty_tracked_announcements%rowtype;
begin
  -- Lock source before job, in the same order as source writes/triggers. The final
  -- UPDATE checks the token again, so cancellation or lease takeover still wins.
  select j.* into job from bty_reminder_private.jobs j
    where j.id = p_id and j.claim_token = p_claim_token and j.state = 'claimed'
      and j.lease_until > clock_timestamp();
  if not found then return false; end if;

  if job.kind = 'save' then
    perform 1 from public.bty_action_captures c where c.id = job.capture_id for share;
    if not found then return false; end if;
  else
    select a.* into announcement from public.bty_tracked_announcements a
      where a.id = job.announcement_id and a.tenant_id = job.tenant_id and a.status = 'active'
        and a.owner_user_id is not null for share;
    if not found then return false; end if;

    perform 1 from public.bty_tracked_announcement_recipients r
      where r.announcement_id = announcement.id
        and bty_reminder_private.is_track_pending(announcement.tracking_mode, r.acknowledged_at, r.response_submitted_at)
        and (job.kind = 'track_owner' or (r.id = job.recipient_id and r.tenant_id = job.tenant_id
          and r.aad_object_id = job.aad_object_id and r.user_id = job.user_id))
      order by r.id limit 1 for share;
    if not found then return false; end if;
  end if;
  if bty_reminder_private.job_eligible(job) is not true then return false; end if;

  update bty_reminder_private.jobs j set state = 'sending', lease_until = clock_timestamp() + interval '12 minutes'
    where j.id = p_id and j.claim_token = p_claim_token and j.state = 'claimed'
      and j.lease_until > clock_timestamp();
  return found;
end;
$$;

create or replace function public.bty_finish_teams_reminder(p_id uuid, p_claim_token uuid, p_result text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
  if p_result is null or p_result not in ('sent', 'retry', 'skipped', 'unknown') then return false; end if;
  update bty_reminder_private.jobs j
    set state = case when p_result <> 'retry' then p_result
                when j.attempts = 4 then 'failed' else 'pending' end,
        available_at = case when p_result = 'retry' and j.attempts < 4
                       then clock_timestamp() + interval '5 minutes' * j.attempts
                       else j.available_at end,
        claim_token = null, lease_until = null
    where j.id = p_id and j.claim_token = p_claim_token
      and ((j.state = 'claimed' and p_result in ('retry', 'skipped'))
           or (j.state = 'sending' and p_result in ('retry', 'sent', 'skipped', 'unknown')));
  return found;
end;
$$;

revoke all on function bty_reminder_private.clear_inactive_save_actor(),
  bty_reminder_private.schedule_save(), bty_reminder_private.is_track_pending(text, timestamptz, timestamptz),
  bty_reminder_private.schedule_track(), bty_reminder_private.job_eligible(bty_reminder_private.jobs)
  from public, anon, authenticated, service_role;
revoke all on function public.bty_claim_due_teams_reminders(int), public.bty_start_teams_reminder(uuid, uuid),
  public.bty_finish_teams_reminder(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.bty_claim_due_teams_reminders(int), public.bty_start_teams_reminder(uuid, uuid),
  public.bty_finish_teams_reminder(uuid, uuid, text) to service_role;

commit;
