-- L4 (Partner): admin-granted only. Not unlocked by tenure or XP.
-- Only admins can set l4_access for a user (via admin API with service role or RLS).

alter table public.arena_profiles
  add column if not exists l4_access boolean not null default false;

comment on column public.arena_profiles.l4_access is 'Partner level (L4) access. Admin-granted only; not earned by tenure or XP.';
