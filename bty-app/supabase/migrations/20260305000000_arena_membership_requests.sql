-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- BTY Arena: arena_membership_requests — 멤버십 가입 요청 및 승인
-- Track A: 직군·입사일·리더시작일 제출 → Admin 승인 → tenure 반영.
-- 승인은 API(서비스 역할 또는 Admin 체크)에서만 수행; RLS는 본인 select/insert만 허용.
-- =============================================================================
--
-- 1) ASSUMPTIONS
-- --------------
-- - auth.users(id) is the canonical user reference.
-- - One active request per user (upsert on submit); status pending | approved.
-- - approved_at / approved_by set only by Admin via API (service role or admin-only endpoint).
--
-- 2) TABLE: arena_membership_requests
-- -----------------------------------
-- id, user_id (FK auth.users), job_function, joined_at, leader_started_at (nullable),
-- status (pending | approved), approved_at, approved_by, created_at, updated_at
-- =============================================================================

-- -----------------------------------------------------------------------------
-- arena_membership_requests
-- -----------------------------------------------------------------------------
create table if not exists public.arena_membership_requests (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_function text not null,
  joined_at date not null,
  leader_started_at date null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  approved_at timestamptz null,
  approved_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

comment on table public.arena_membership_requests is 'Arena 멤버십 가입 요청. 승인 시 joined_at/leader_started_at이 tenure 계산에 사용됨.';
comment on column public.arena_membership_requests.job_function is '직군 (staff / leader 등).';
comment on column public.arena_membership_requests.joined_at is '입사일 (승인 시 확정).';
comment on column public.arena_membership_requests.leader_started_at is '리더 시작일 (리더 직군인 경우, nullable).';
comment on column public.arena_membership_requests.status is 'pending: 대기, approved: 승인됨.';
comment on column public.arena_membership_requests.approved_at is '승인 시각 (Admin 승인 시에만 설정).';
comment on column public.arena_membership_requests.approved_by is '승인한 Admin 식별자 (이메일 또는 user_id).';

create index if not exists arena_membership_requests_user_id_idx
  on public.arena_membership_requests(user_id);

create index if not exists arena_membership_requests_status_idx
  on public.arena_membership_requests(status)
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- RLS: 본인만 select / insert. update는 본인 pending row만 가능; status=approved 전환은 API(service role)에서만.
-- -----------------------------------------------------------------------------
alter table public.arena_membership_requests enable row level security;

drop policy if exists "arena_membership_requests_select_own" on public.arena_membership_requests;
create policy "arena_membership_requests_select_own"
  on public.arena_membership_requests for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "arena_membership_requests_insert_own" on public.arena_membership_requests;
create policy "arena_membership_requests_insert_own"
  on public.arena_membership_requests for insert to authenticated
  with check (auth.uid() = user_id);

-- 본인 pending 요청만 수정 가능; status를 approved로 바꾸는 것은 불가 (with check로 새 row의 status = 'pending'만 허용)
drop policy if exists "arena_membership_requests_update_own_pending" on public.arena_membership_requests;
create policy "arena_membership_requests_update_own_pending"
  on public.arena_membership_requests for update to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

-- Admin 승인(status=approved, approved_at, approved_by)은 RLS로 불가 → API에서 service role로만 수행.