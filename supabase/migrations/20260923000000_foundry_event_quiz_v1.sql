-- Quick Training Quiz V1: additive immutable assessment snapshots and attempts.
create table if not exists public.foundry_event_quizzes (
  event_id uuid primary key references public.foundry_events(id) on delete restrict,
  schema_version integer not null default 1 check (schema_version = 1),
  source_kind text not null check (source_kind in ('csv','generated','manual')),
  quiz_snapshot jsonb not null,
  question_count integer not null check (question_count between 1 and 20),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.foundry_event_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events(id) on delete restrict,
  participant_id uuid not null references public.foundry_event_participants(id) on delete restrict,
  answers jsonb not null,
  correct_count integer not null check (correct_count >= 0),
  total_count integer not null check (total_count between 1 and 20 and correct_count <= total_count),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, participant_id),
  unique (id, event_id, participant_id)
);
create index if not exists foundry_event_quiz_attempts_event_idx on public.foundry_event_quiz_attempts(event_id);

-- A quiz attempt is durable evidence in its own right.  It is deliberately
-- distinct from response_text: no quiz completion may fabricate a written
-- completion answer.  The composite FK prevents an attempt from another event
-- or participant from being used to complete this progress row.
alter table public.foundry_event_training_progress
  add column if not exists quiz_attempt_id uuid;
alter table public.foundry_event_training_progress
  drop constraint if exists foundry_training_progress_quiz_attempt_fk;
alter table public.foundry_event_training_progress
  add constraint foundry_training_progress_quiz_attempt_fk
  foreign key (quiz_attempt_id, event_id, participant_id)
  references public.foundry_event_quiz_attempts (id, event_id, participant_id)
  on delete restrict;
alter table public.foundry_event_training_progress
  drop constraint if exists foundry_training_progress_completed_needs_evidence_and_response_check;
alter table public.foundry_event_training_progress
  add constraint foundry_training_progress_completed_needs_evidence_or_quiz_attempt_check
  check (
    completed_at is null
    or (
      (response_text is not null and char_length(btrim(response_text)) between 1 and 1000)
      or quiz_attempt_id is not null
    )
  );
alter table public.foundry_event_quizzes enable row level security;
alter table public.foundry_event_quiz_attempts enable row level security;
revoke all on public.foundry_event_quizzes, public.foundry_event_quiz_attempts from public, anon, authenticated;
