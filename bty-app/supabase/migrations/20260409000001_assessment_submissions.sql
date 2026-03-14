-- Assessment 자존감 진단 50문항 제출 이력 저장 (DOJO_DEAR_ME_DB_NEXT_PHASE_DESIGN §2-2).
-- Center 영역. RLS: 본인만 읽기/쓰기.

create table if not exists public.assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers_json jsonb not null,
  scores_json jsonb not null,
  pattern_key text,
  recommended_track text,
  created_at timestamptz not null default now()
);

create index if not exists assessment_submissions_user_created_idx
  on public.assessment_submissions(user_id, created_at desc);

alter table public.assessment_submissions enable row level security;

drop policy if exists "assessment_submissions_select_own" on public.assessment_submissions;
create policy "assessment_submissions_select_own" on public.assessment_submissions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "assessment_submissions_insert_own" on public.assessment_submissions;
create policy "assessment_submissions_insert_own" on public.assessment_submissions
  for insert to authenticated with check (auth.uid() = user_id);

comment on table public.assessment_submissions is 'Assessment 자존감 진단 50문항 제출. answers_json={q01:4,...}, scores_json={core:68,...}, pattern_key, recommended_track.';
