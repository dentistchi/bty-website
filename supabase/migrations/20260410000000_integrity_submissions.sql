-- 역지사지(Integrity) 연습 제출 이력. RLS: 본인만 읽기/쓰기.
-- DOJO_DEAR_ME_50_DB_NEXT_STEP_1PAGE § 역지사지 연습 제출 저장.

create table if not exists public.integrity_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text,
  text_response text,
  choice_id text,
  created_at timestamptz not null default now()
);

create index if not exists integrity_submissions_user_created_idx
  on public.integrity_submissions(user_id, created_at desc);

alter table public.integrity_submissions enable row level security;

drop policy if exists "integrity_submissions_select_own" on public.integrity_submissions;
create policy "integrity_submissions_select_own" on public.integrity_submissions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "integrity_submissions_insert_own" on public.integrity_submissions;
create policy "integrity_submissions_insert_own" on public.integrity_submissions
  for insert to authenticated with check (auth.uid() = user_id);

comment on table public.integrity_submissions is '역지사지 연습 제출. text_response 또는 choice_id 중 하나 이상. scenario_id는 선택.';
