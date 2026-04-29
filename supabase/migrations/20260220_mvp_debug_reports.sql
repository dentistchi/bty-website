-- MVP 디버그 제보: 에러 내용 올리고, 교정/패치 배포 연동
create table if not exists public.mvp_debug_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  context jsonb default '{}',  -- route, user_message, assistant_message, etc.
  route text check (route in ('chat', 'mentor', 'arena', 'other')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text
);

create index if not exists mvp_debug_reports_status_created_idx
  on public.mvp_debug_reports(status, created_at desc);

alter table public.mvp_debug_reports enable row level security;

-- 로그인한 사용자: 전체 목록 조회, 본인이 제보한 것만 insert, 누구나 update(교정 완료 등)
drop policy if exists "mvp_debug_select" on public.mvp_debug_reports;
create policy "mvp_debug_select" on public.mvp_debug_reports for select to authenticated using (true);
drop policy if exists "mvp_debug_insert" on public.mvp_debug_reports;
create policy "mvp_debug_insert" on public.mvp_debug_reports for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "mvp_debug_update" on public.mvp_debug_reports;
create policy "mvp_debug_update" on public.mvp_debug_reports for update to authenticated using (true) with check (true);

comment on table public.mvp_debug_reports is 'MVP 에러 제보. 디버그 페이지에서 교정/패치 배포 연동.';
