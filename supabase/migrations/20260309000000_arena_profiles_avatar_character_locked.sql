-- Lock character after first save: once set, only outfit theme can change until next "code evolution".
alter table public.arena_profiles
  add column if not exists avatar_character_locked boolean not null default false;

comment on column public.arena_profiles.avatar_character_locked is 'True after first avatar character save; character cannot be changed, only outfit theme. Reset on code evolution.';
