-- Minimal FAITHFUL dependency contract for replaying the historical migrations 20260726–20260729
-- on a disposable PostgreSQL, so their EXPECTED catalog definitions can be extracted. It creates
-- ONLY dependencies that pre-existed those migrations (FK targets, roles, auth.users) — never an
-- object whose creation is an effect being audited (those come from the real migration files).
--
-- check_function_bodies is disabled so a `language sql` function (get_my_followup) can be created
-- without scaffolding the entire application schema it reads. This does NOT change the STORED
-- definition (prosrc / pg_get_functiondef / proconfig) that we extract — only skips validation.
alter database proofdb set check_function_bodies = off;
set check_function_bodies = off;

-- Supabase roles referenced by REVOKE/GRANT in the migrations.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;

-- auth.users — FK target for several audited columns/tables.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);

-- Pre-existing application tables the migrations ALTER or FK-reference. Stubs carry only the
-- base columns needed for the ALTERs / FKs / constraints to apply; the audited effect is the
-- columns/constraints the migration ADDS.
create table if not exists public.foundry_events (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid);
create table if not exists public.foundry_event_assignments (
  id uuid primary key default gen_random_uuid());
create table if not exists public.foundry_event_training_progress (
  id uuid primary key default gen_random_uuid(), event_id uuid, participant_id uuid,
  updated_at timestamptz not null default now());
create table if not exists public.foundry_event_training_content (
  id uuid primary key default gen_random_uuid());
create table if not exists public.foundry_event_document_content (
  id uuid primary key default gen_random_uuid());
create table if not exists public.user_conversation_preferences (
  user_id uuid primary key);
