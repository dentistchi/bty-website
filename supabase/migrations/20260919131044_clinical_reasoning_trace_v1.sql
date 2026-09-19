-- Clinical Reasoning V1: additive, synthetic-training trace store. Raw JSON is authoritative.
create table if not exists public.clinical_reasoning_traces (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  case_id text not null,
  case_version text not null,
  trace_schema_version text not null,
  trace_role text not null default 'learner' check (trace_role in ('learner','expert_benchmark')),
  raw_trace jsonb not null,
  derived_metrics jsonb not null,
  status text not null default 'active' check (status in ('active','completed')),
  source_product text not null,
  content_provenance jsonb not null default '{}'::jsonb,
  benchmark_source_trace_id uuid references public.clinical_reasoning_traces(id) on delete restrict,
  benchmark_approved_by uuid references auth.users(id) on delete restrict,
  benchmark_approved_at timestamptz,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_reasoning_completed_consistency check ((status = 'active' and completed_at is null) or (status = 'completed' and completed_at is not null)),
  constraint clinical_reasoning_benchmark_provenance check ((trace_role = 'learner' and benchmark_source_trace_id is null and benchmark_approved_by is null and benchmark_approved_at is null) or (trace_role = 'expert_benchmark' and benchmark_source_trace_id is not null and benchmark_approved_by is not null and benchmark_approved_at is not null))
);
create index if not exists clinical_reasoning_traces_user_case_active_idx on public.clinical_reasoning_traces(user_id, case_id, updated_at desc) where status = 'active';
create index if not exists clinical_reasoning_traces_case_completed_idx on public.clinical_reasoning_traces(case_id, completed_at desc) where status = 'completed';
alter table public.clinical_reasoning_traces enable row level security;
create policy "clinical_reasoning_traces_select_own_learner" on public.clinical_reasoning_traces for select to authenticated using ((select auth.uid()) = user_id and trace_role = 'learner');
create policy "clinical_reasoning_traces_insert_own_learner" on public.clinical_reasoning_traces for insert to authenticated with check ((select auth.uid()) = user_id and trace_role = 'learner' and status = 'active');
create policy "clinical_reasoning_traces_update_own_active_learner" on public.clinical_reasoning_traces for update to authenticated using ((select auth.uid()) = user_id and trace_role = 'learner' and status = 'active') with check ((select auth.uid()) = user_id and trace_role = 'learner' and status = 'active');
