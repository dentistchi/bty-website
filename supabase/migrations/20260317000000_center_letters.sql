-- Center 편지 저장 (나에게 쓰는 편지). 비공개, 본인만 접근.
-- FOUNDRY_CENTER_NEXT_CONTENT §2-3.

create table if not exists public.center_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null default 'ko' check (locale in ('ko', 'en')),
  mood text,
  energy smallint check (energy is null or (energy >= 1 and energy <= 5)),
  one_word text,
  body text not null,
  reply text,
  created_at timestamptz not null default now()
);

create index if not exists center_letters_user_created_idx on public.center_letters(user_id, created_at desc);

alter table public.center_letters enable row level security;

drop policy if exists "center_letters_select_own" on public.center_letters;
create policy "center_letters_select_own" on public.center_letters for select to authenticated using (auth.uid() = user_id);
drop policy if exists "center_letters_insert_own" on public.center_letters;
create policy "center_letters_insert_own" on public.center_letters for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "center_letters_update_own" on public.center_letters;
create policy "center_letters_update_own" on public.center_letters for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.center_letters is 'Center 나에게 쓰는 편지. 비공개, RLS로 본인만 접근.';
