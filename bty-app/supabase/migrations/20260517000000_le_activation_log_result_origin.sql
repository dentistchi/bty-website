-- =============================================================================
-- §5.3 representation-collapse remediation — RESULT_ORIGIN_CLOSURE_SPEC.md.
--
-- le_activation_log previously had no way to distinguish a fallback
-- (insufficient_signal) re-exposure validation activation from a genuine
-- computed micro_win — every fallback was processed by the AIR graph as one
-- identical penalty footprint (§5.3 representation defect).
--
-- This migration preserves result_origin at insert time. Additive and
-- insert-time only: NO UPDATE backfill. Pre-§5.3 historical rows keep
-- result_origin = NULL and are unaffected; AIR stays recomputable from the
-- same two tables (no derived-only storage, no AIR carve-out introduced).
-- =============================================================================

alter table public.le_activation_log
  add column if not exists result_origin text null
    check (result_origin is null or result_origin in ('computed', 'insufficient_signal'));

comment on column public.le_activation_log.result_origin is
  'Re-exposure validation origin (computed | insufficient_signal). NULL = pre-§5.3 historical row. Set once at insert; never UPDATE-backfilled. Representation only — AIR aggregation does not branch on this column.';

-- Audit/review surface: locate fallback activations per user without a full scan.
create index if not exists le_activation_log_result_origin_fallback_idx
  on public.le_activation_log (user_id, chosen_at desc)
  where result_origin = 'insufficient_signal';
