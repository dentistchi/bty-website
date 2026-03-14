-- Dear Me 나에게 쓰는 편지 저장 (DOJO_DEAR_ME_DB_NEXT_PHASE_DESIGN §2-3).
-- Center 영역. center_letters와 별도 (시스템 경계 분리). RLS: 본인만 읽기/쓰기.

create table if not exists public.dear_me_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null default 'ko' check (locale in ('ko', 'en')),
  body text not null,
  reply text,
  created_at timestamptz not null default now()
);

create index if not exists dear_me_letters_user_created_idx
  on public.dear_me_letters(user_id, created_at desc);

alter table public.dear_me_letters enable row level security;

drop policy if exists "dear_me_letters_select_own" on public.dear_me_letters;
create policy "dear_me_letters_select_own" on public.dear_me_letters
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "dear_me_letters_insert_own" on public.dear_me_letters;
create policy "dear_me_letters_insert_own" on public.dear_me_letters
  for insert to authenticated with check (auth.uid() = user_id);

comment on table public.dear_me_letters is 'Dear Me 나에게 쓰는 편지. 비공개, RLS로 본인만 접근.';
