-- Dojo 50문항 제출 이력 저장 (DOJO_DEAR_ME_DB_NEXT_PHASE_DESIGN §2-1).
-- user_id별 여러 번 제출 가능. RLS: 본인만 읽기/쓰기.

create table if not exists public.dojo_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers_json jsonb not null,
  scores_json jsonb not null,
  summary_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists dojo_submissions_user_created_idx
  on public.dojo_submissions(user_id, created_at desc);

alter table public.dojo_submissions enable row level security;

drop policy if exists "dojo_submissions_select_own" on public.dojo_submissions;
create policy "dojo_submissions_select_own" on public.dojo_submissions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "dojo_submissions_insert_own" on public.dojo_submissions;
create policy "dojo_submissions_insert_own" on public.dojo_submissions
  for insert to authenticated with check (auth.uid() = user_id);

comment on table public.dojo_submissions is 'Dojo 50문항 제출 이력. answers_json={1:3,...50:4}, scores_json={perspective_taking:72,...}, summary_key=high|mid|low.';
