-- Tracks mirror / perspective-switch deliveries for scenario-type-router (optional; router also counts mirror:* arena_events).

create table if not exists public.perspective_switch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ref text,
  created_at timestamptz not null default now()
);

comment on table public.perspective_switch_history is
  'Mirror/perspective delivery audit; scenario-type-router may count rows per user vs arena_events mirror:*.';

create index if not exists perspective_switch_history_user_created_idx
  on public.perspective_switch_history (user_id, created_at desc);

alter table public.perspective_switch_history enable row level security;
