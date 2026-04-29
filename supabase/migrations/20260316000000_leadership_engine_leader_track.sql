-- P5: Leader track approval — store is_leader_track and who approved.
-- Ref: docs/LEADERSHIP_ENGINE_SPEC.md §7B, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §4 P5.

alter table public.leadership_engine_state
  add column if not exists is_leader_track boolean not null default false,
  add column if not exists leader_approved_at timestamptz null,
  add column if not exists leader_approver_id uuid null references auth.users(id) on delete set null;

comment on column public.leadership_engine_state.is_leader_track is 'True when user has been promoted to leader track via leader_approval(user_id, approver_id).';
comment on column public.leadership_engine_state.leader_approved_at is 'When leader track was approved (audit).';
comment on column public.leadership_engine_state.leader_approver_id is 'Certified leader who approved this user for leader track.';

-- Rollback (run manually if reverting):
--   alter table public.leadership_engine_state drop column if exists leader_approver_id;
--   alter table public.leadership_engine_state drop column if exists leader_approved_at;
--   alter table public.leadership_engine_state drop column if exists is_leader_track;
