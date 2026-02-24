-- Phase 1: Dual XP + Tier/Code/Sub Name (BTY_ARENA_SYSTEM_SPEC)
-- arena_profiles: add columns for core_xp, buffer, tier, code_index, sub_name (Tier hidden from user; used for celebrations and rename)

alter table public.arena_profiles
  add column if not exists core_xp_total int not null default 0,
  add column if not exists core_xp_buffer numeric not null default 0,
  add column if not exists tier int not null default 0,
  add column if not exists code_index int not null default 0,
  add column if not exists sub_name text null,
  add column if not exists sub_name_renamed_in_code boolean not null default false,
  add column if not exists stage int not null default 1,
  add column if not exists code_name text null,
  add column if not exists code_hidden boolean not null default false;

comment on column public.arena_profiles.core_xp_total is 'Permanent Core XP (displayed). Tier = floor(core_xp_total/10) internally.';
comment on column public.arena_profiles.core_xp_buffer is 'Fractional buffer for seasonal→core conversion.';
comment on column public.arena_profiles.tier is 'Internal: floor(core_xp_total/10). Not shown to user.';
comment on column public.arena_profiles.code_index is '0-6: FORGE,PULSE,FRAME,ASCEND,NOVA,ARCHITECT,CODELESS ZONE.';
comment on column public.arena_profiles.sub_name is 'User-renamed (Tier 25 once per code) or default from spec. CODELESS ZONE: free set.';
comment on column public.arena_profiles.sub_name_renamed_in_code is 'True if user used the one-time rename in current code.';
