-- 프로필 표시용 필드 display_name (예: 닉네임). PATCH /api/arena/profile에서 수신·저장.

alter table public.arena_profiles
  add column if not exists display_name text null;

comment on column public.arena_profiles.display_name is '표시용 이름(닉네임). 최대 64자. 리더보드/랭킹 계산에 사용하지 않음.';
