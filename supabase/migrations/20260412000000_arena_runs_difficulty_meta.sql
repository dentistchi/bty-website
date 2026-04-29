-- Arena run: optional difficulty (for XP formula) and meta (e.g. time_remaining, time_limit).
-- Per ARENA_LAB_XP_SPEC: run/complete can use stored difficulty and timeFactor from meta.

alter table public.arena_runs
  add column if not exists difficulty text null,
  add column if not exists meta jsonb null;

comment on column public.arena_runs.difficulty is 'Optional: easy|mid|hard|extreme for Arena XP formula. When set, run/complete uses it instead of inferring from event sum.';
comment on column public.arena_runs.meta is 'Optional: e.g. {"time_remaining": 120, "time_limit": 300} for time bonus. time_factor = clamp((time_remaining/time_limit - 0.5)*0.5, 0, 0.25).';
