-- Defer/snooze feedback prompts (e.g. 24h) without blocking Arena session.

alter table public.scenario_feedback_queue
  add column if not exists deferred_until timestamptz null;

comment on column public.scenario_feedback_queue.deferred_until is
  'When set and in the future, getFeedbackPrompt skips this row (user chose “later”).';

drop policy if exists "scenario_feedback_queue_update_own" on public.scenario_feedback_queue;
create policy "scenario_feedback_queue_update_own"
  on public.scenario_feedback_queue for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
