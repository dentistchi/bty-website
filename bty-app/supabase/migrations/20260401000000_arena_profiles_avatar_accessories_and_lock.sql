-- AVATAR_LAYER_SPEC §1: avatar_accessory_ids, optional timestamps, enforce_avatar_character_lock trigger.

-- 1) arena_profiles: 선택 악세사리 ID 배열
alter table public.arena_profiles
  add column if not exists avatar_accessory_ids text[] not null default '{}'::text[];

comment on column public.arena_profiles.avatar_accessory_ids is 'User-selected accessory keys (e.g. acc_crown_01). Length must not exceed tier-based allowed slots.';

-- 2) (선택) 마지막 변경 추적
alter table public.arena_profiles
  add column if not exists avatar_outfit_updated_at timestamptz,
  add column if not exists avatar_accessories_updated_at timestamptz;

-- 3) 캐릭터 잠금 트리거: avatar_character_locked = true 일 때 avatar_character_id 변경 시 예외
create or replace function public.enforce_avatar_character_lock()
returns trigger language plpgsql as $$
begin
  if (old.avatar_character_locked = true) then
    if (new.avatar_character_id is distinct from old.avatar_character_id) then
      raise exception 'avatar_character_id is locked';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_avatar_character_lock on public.arena_profiles;
create trigger trg_enforce_avatar_character_lock
  before update on public.arena_profiles
  for each row execute function public.enforce_avatar_character_lock();
