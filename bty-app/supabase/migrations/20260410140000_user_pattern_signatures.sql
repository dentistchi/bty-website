-- Phase B: durable pattern signature read-model (reinforcement + re-exposure validation evidence).
-- One row per (user_id, pattern_family, axis). Updated after POST /api/arena/re-exposure/validate.

create table if not exists public.user_pattern_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_family text not null,
  axis text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  repeat_count int not null default 1
    constraint user_pattern_signatures_repeat_count_check check (repeat_count >= 1),
  current_state text not null
    constraint user_pattern_signatures_state_check check (
      current_state in ('active', 'unstable', 'improving', 'resolved')
    ),
  last_validation_result text not null
    constraint user_pattern_signatures_last_vr_check check (
      last_validation_result in ('changed', 'unstable', 'no_change')
    ),
  confidence_score real not null default 0.35
    constraint user_pattern_signatures_confidence_check check (confidence_score >= 0 and confidence_score <= 1),
  last_source_pending_outcome_id uuid,
  last_source_choice_history_id uuid,
  next_watchpoint timestamptz,
  updated_at timestamptz not null default now(),
  lifetime_changed_count int not null default 0
    constraint user_pattern_signatures_lifetime_changed_check check (lifetime_changed_count >= 0)
);

comment on table public.user_pattern_signatures is
  'Arena Phase B: aggregated pattern signature per user / pattern_family / axis (re-exposure validation + reinforcement).';

create unique index if not exists user_pattern_signatures_user_family_axis_uidx
  on public.user_pattern_signatures (user_id, pattern_family, axis);

create index if not exists user_pattern_signatures_user_last_seen_idx
  on public.user_pattern_signatures (user_id, last_seen_at desc);

alter table public.user_pattern_signatures enable row level security;

drop policy if exists "user_pattern_signatures_select_own" on public.user_pattern_signatures;
create policy "user_pattern_signatures_select_own"
  on public.user_pattern_signatures for select
  to authenticated
  using (auth.uid() = user_id);
