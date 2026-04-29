-- Elite 1:1 mentor session request (PHASE_4_ELITE_5_PERCENT_SPEC §10 3차, PROJECT_BACKLOG §5).
-- Elite만 신청 가능. 신청 큐(pending 목록)·승인/거절 플로우. 비즈니스 규칙은 도메인(mentorRequest.ts)에서만.

create table if not exists public.elite_mentor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  message text,
  mentor_id text not null default 'dr_chi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz null,
  responded_by text null
);

comment on table public.elite_mentor_requests is 'Elite 1:1 멘토(Dr. Chi) 세션 신청. pending → approved|rejected 승인 플로우.';
comment on column public.elite_mentor_requests.responded_at is '승인/거절 시각.';
comment on column public.elite_mentor_requests.responded_by is '승인/거절 처리자 식별자.';

create index if not exists elite_mentor_requests_user_id_idx on public.elite_mentor_requests(user_id);
create index if not exists elite_mentor_requests_status_pending_idx on public.elite_mentor_requests(status) where status = 'pending';

-- RLS: 본인은 자신의 행만 select, insert. update/delete는 서비스 역할에서만(승인 플로우).
alter table public.elite_mentor_requests enable row level security;

create policy "Users can view own mentor requests"
  on public.elite_mentor_requests for select
  using (auth.uid() = user_id);

create policy "Users can insert own mentor requests"
  on public.elite_mentor_requests for insert
  with check (auth.uid() = user_id);
