-- Leadership Lab: daily attempt limit per docs/spec/ARENA_LAB_XP_SPEC.md
-- Lab = 3 completed attempts per user per day (counted on submit success).

create table if not exists public.daily_lab_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  attempts_used int not null default 0 check (attempts_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create index if not exists daily_lab_usage_user_date_idx on public.daily_lab_usage(user_id, usage_date desc);

alter table public.daily_lab_usage enable row level security;

-- Users can read their own usage only
drop policy if exists "daily_lab_usage_select_own" on public.daily_lab_usage;
create policy "daily_lab_usage_select_own"
  on public.daily_lab_usage for select
  using (auth.uid() = user_id);

-- Server route (authenticated as user) may insert/update own row when recording a Lab submit
drop policy if exists "daily_lab_usage_insert_own" on public.daily_lab_usage;
create policy "daily_lab_usage_insert_own"
  on public.daily_lab_usage for insert
  with check (auth.uid() = user_id);

drop policy if exists "daily_lab_usage_update_own" on public.daily_lab_usage;
create policy "daily_lab_usage_update_own"
  on public.daily_lab_usage for update
  using (auth.uid() = user_id);

comment on table public.daily_lab_usage is 'Lab attempts per user per day. Limit 3 per ARENA_LAB_XP_SPEC. Consumed on submit success.';

-- Atomic consume: increment today only if under 3. Caller may only consume for self (p_user_id = auth.uid()).
create or replace function public.consume_lab_attempt(p_user_id uuid default auth.uid())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := current_date;
  v_used int;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    return -1;
  end if;
  insert into public.daily_lab_usage (user_id, usage_date, attempts_used, updated_at)
  values (p_user_id, v_date, 1, now())
  on conflict (user_id, usage_date) do update
  set attempts_used = daily_lab_usage.attempts_used + 1,
      updated_at = now()
  where daily_lab_usage.attempts_used < 3
  returning daily_lab_usage.attempts_used into v_used;
  if v_used is null then
    return -1;
  end if;
  return v_used;
end;
$$;

grant execute on function public.consume_lab_attempt(uuid) to authenticated;
grant execute on function public.consume_lab_attempt(uuid) to service_role;

comment on function public.consume_lab_attempt(uuid) is 'Consume one Lab attempt for today. Returns new attempts_used (1-3) or -1 if limit reached. Caller must pass own user_id.';
