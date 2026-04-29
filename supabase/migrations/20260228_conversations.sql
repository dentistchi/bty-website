-- 챗/멘토 대화 저장 (선택적). "대화 기억하기" 켜면 Supabase에 저장, 끄면 저장 안 함.
-- 데이터 축적 완화: 보관 기간 정책(예: 90일)은 앱/크론에서 적용 가능.

-- 1) 사용자별 대화 기억 설정 (기본값: false = 저장 안 함, 불안 최소화)
create table if not exists public.user_conversation_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  remember_chat boolean not null default false,
  remember_mentor boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_conversation_preferences enable row level security;

drop policy if exists "prefs_select_own" on public.user_conversation_preferences;
create policy "prefs_select_own" on public.user_conversation_preferences for select to authenticated using (auth.uid() = user_id);
drop policy if exists "prefs_insert_own" on public.user_conversation_preferences;
create policy "prefs_insert_own" on public.user_conversation_preferences for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "prefs_update_own" on public.user_conversation_preferences;
create policy "prefs_update_own" on public.user_conversation_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) 세션 (챗 한 번 열었을 때 = 1 세션, 멘토 주제별 1 세션)
create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('chat', 'mentor')),
  topic text, -- mentor일 때만: clinical | patient | team | financial | selflove
  created_at timestamptz not null default now()
);

create index if not exists conversation_sessions_user_created_idx on public.conversation_sessions(user_id, created_at desc);

alter table public.conversation_sessions enable row level security;

drop policy if exists "sessions_select_own" on public.conversation_sessions;
create policy "sessions_select_own" on public.conversation_sessions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "sessions_insert_own" on public.conversation_sessions;
create policy "sessions_insert_own" on public.conversation_sessions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "sessions_update_own" on public.conversation_sessions;
create policy "sessions_update_own" on public.conversation_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sessions_delete_own" on public.conversation_sessions;
create policy "sessions_delete_own" on public.conversation_sessions for delete to authenticated using (auth.uid() = user_id);

-- 3) 메시지 (세션당 여러 줄)
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_session_created_idx on public.conversation_messages(session_id, created_at asc);

alter table public.conversation_messages enable row level security;

drop policy if exists "messages_select_own" on public.conversation_messages;
create policy "messages_select_own" on public.conversation_messages for select to authenticated using (auth.uid() = user_id);
drop policy if exists "messages_insert_own" on public.conversation_messages;
create policy "messages_insert_own" on public.conversation_messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "messages_delete_own" on public.conversation_messages;
create policy "messages_delete_own" on public.conversation_messages for delete to authenticated using (auth.uid() = user_id);

comment on table public.user_conversation_preferences is '챗/멘토 대화 기억 여부. false면 저장 안 함(기본).';
comment on table public.conversation_sessions is '대화 세션(챗 한 창, 멘토 한 주제).';
comment on table public.conversation_messages is '세션별 메시지. 보관 기간 정책은 앱/스케줄러에서 적용.';
