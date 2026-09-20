-- Preserve abandoned V2 learner attempts as raw-history rows without letting them resume.
alter table public.clinical_reasoning_traces
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_trace_id text;

create index if not exists clinical_reasoning_traces_user_case_current_active_idx
  on public.clinical_reasoning_traces (user_id, case_id, case_version, updated_at desc)
  where status = 'active' and superseded_at is null;

-- A learner may update only a current active row. Once superseded, raw history is immutable.
drop policy if exists "clinical_reasoning_traces_update_own_active_learner" on public.clinical_reasoning_traces;
create policy "clinical_reasoning_traces_update_own_active_learner"
  on public.clinical_reasoning_traces for update to authenticated
  using ((select auth.uid()) = user_id and trace_role = 'learner' and status = 'active' and superseded_at is null)
  with check ((select auth.uid()) = user_id and trace_role = 'learner' and status = 'active');
