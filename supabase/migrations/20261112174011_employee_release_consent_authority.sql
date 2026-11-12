-- The old profile fields and ledger could be written by an authenticated owner.
-- Keep that history and require one server-recorded acceptance for future access.
-- Apply before switching the Worker. The old consent writer cannot write once this
-- commits, and only Workers using the verified projection can enforce the new gate.
begin;

alter table public.arena_profiles
  add column if not exists consent_version text,
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_locale text default 'en-US',
  add column if not exists consent_verified_version text;
comment on column public.arena_profiles.consent_verified_version is
  'Consent version from the server-owned consent transaction. Historical profile fields do not establish current consent.';
grant select (user_id, consent_version, consent_accepted_at, consent_locale, consent_verified_version),
  insert (user_id, consent_version, consent_accepted_at, consent_locale, consent_verified_version),
  update (consent_version, consent_accepted_at, consent_locale, consent_verified_version)
  on public.arena_profiles to service_role;
grant select (consent_verified_version) on public.arena_profiles to authenticated;

-- The consent table originated in a held migration that was applied separately.
create table if not exists public.arena_consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  consent_version text not null,
  consent_locale text not null,
  action text not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  notes jsonb
);

alter table public.arena_consent_log
  add column if not exists server_verified boolean not null default false;

create index if not exists idx_arena_consent_log_user
  on public.arena_consent_log (user_id, consent_type, accepted_at desc);

alter table public.arena_consent_log enable row level security;
drop policy if exists consent_log_insert_own on public.arena_consent_log;
drop policy if exists consent_log_select_own on public.arena_consent_log;
create policy consent_log_select_own on public.arena_consent_log
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.arena_consent_log from public, anon, authenticated, service_role;
grant select on public.arena_consent_log to authenticated;
grant select, insert on public.arena_consent_log to service_role;

-- The profile has table-level INSERT/UPDATE grants for legitimate profile writes.
-- Check the actual calling role and protect only the consent projection.
create or replace function public.bty_guard_profile_consent()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.consent_verified_version is not null
      or new.consent_version is not null
      or new.consent_accepted_at is not null
      or (new.consent_locale is not null and new.consent_locale <> 'en-US') then
      raise exception 'Consent is server-managed' using errcode = '42501';
    end if;
  elsif new.consent_verified_version is distinct from old.consent_verified_version
    or new.consent_version is distinct from old.consent_version
    or new.consent_accepted_at is distinct from old.consent_accepted_at
    or new.consent_locale is distinct from old.consent_locale then
    raise exception 'Consent is server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.bty_guard_profile_consent() from public, anon, authenticated, service_role;

drop trigger if exists bty_guard_profile_consent on public.arena_profiles;
create trigger bty_guard_profile_consent
  before insert or update on public.arena_profiles for each row
  execute function public.bty_guard_profile_consent();

-- The authenticated server validates the active document and binds p_user_id to
-- the verified session. Serialize per user, including when no profile exists.
create or replace function public.bty_accept_learner_consent(
  p_user_id uuid,
  p_version text,
  p_locale text,
  p_fingerprint text,
  p_placeholder boolean,
  p_ip_address inet,
  p_user_agent text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_accepted_at timestamptz;
  v_oldest timestamptz;
  v_count integer;
begin
  if p_user_id is null
    or p_version is null or pg_catalog.length(p_version) > 50
    or p_version !~ '^[0-9]{4}-[0-9]{2}-[a-z0-9-]+$'
    or p_locale is null or p_locale not in ('en-US', 'ko-KR')
    or p_fingerprint is null or p_fingerprint !~ '^bty_consent_document_v1:[a-f0-9]{64}$'
    or p_placeholder is null then
    raise exception 'Invalid consent record' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 984610));
  v_accepted_at := pg_catalog.clock_timestamp();

  select count(*), min(log.accepted_at) into v_count, v_oldest
    from public.arena_consent_log log
   where log.user_id = p_user_id and log.consent_type = 'tos'
     and log.action = 'accepted' and log.server_verified
     and log.accepted_at > v_accepted_at - interval '15 minutes';

  if v_count >= 5 then
    return pg_catalog.jsonb_build_object(
      'status', 'rate_limited',
      'retryAfterSeconds', greatest(1, ceil(extract(epoch from (
        v_oldest + interval '15 minutes' - v_accepted_at
      )))::integer)
    );
  end if;

  insert into public.arena_consent_log (
    user_id, consent_type, consent_version, consent_locale, action,
    accepted_at, ip_address, user_agent, notes, server_verified
  ) values (
    p_user_id, 'tos', p_version, p_locale, 'accepted',
    v_accepted_at, p_ip_address, left(p_user_agent, 500),
    pg_catalog.jsonb_build_object(
      'sprint', 'AL-LAUNCH-D3',
      'placeholder', p_placeholder,
      'documentFingerprint', p_fingerprint
    ),
    true
  );

  insert into public.arena_profiles (
    user_id, consent_version, consent_accepted_at, consent_locale, consent_verified_version
  ) values (
    p_user_id, p_version, v_accepted_at, p_locale, p_version
  ) on conflict (user_id) do update set
    consent_version = excluded.consent_version,
    consent_accepted_at = excluded.consent_accepted_at,
    consent_locale = excluded.consent_locale,
    consent_verified_version = excluded.consent_verified_version;

  return pg_catalog.jsonb_build_object('status', 'accepted');
end;
$$;

revoke all on function public.bty_accept_learner_consent(uuid, text, text, text, boolean, inet, text)
  from public, anon, authenticated, service_role;
grant execute on function public.bty_accept_learner_consent(uuid, text, text, text, boolean, inet, text)
  to service_role;

-- Diagnostic reports are operator-only through authenticated server handlers.
alter table public.mvp_debug_reports
  drop constraint if exists mvp_debug_reports_route_check;
alter table public.mvp_debug_reports
  add constraint mvp_debug_reports_route_check
  check (route in ('chat', 'mentor', 'arena', 'other', '/teams'));
alter table public.mvp_debug_reports enable row level security;
drop policy if exists mvp_debug_select on public.mvp_debug_reports;
drop policy if exists mvp_debug_insert on public.mvp_debug_reports;
drop policy if exists mvp_debug_update on public.mvp_debug_reports;
drop policy if exists mvp_debug_update_own on public.mvp_debug_reports;
drop policy if exists mvp_debug_resolve on public.mvp_debug_reports;
revoke all on public.mvp_debug_reports from public, anon, authenticated, service_role;
grant select, insert, update on public.mvp_debug_reports to service_role;

commit;
