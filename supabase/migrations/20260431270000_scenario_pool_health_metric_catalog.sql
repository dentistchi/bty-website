-- SCENARIO_AUDIT_STANDARDS_V1 §3.1 — rename metric PH-DET-UUID → PH-DET-UUID-CATALOG (mirror ids excluded from scan).

alter table public.scenario_pool_health_snapshots
  drop constraint if exists scenario_pool_health_snapshots_metric_id_check;

alter table public.scenario_pool_health_snapshots
  add constraint scenario_pool_health_snapshots_metric_id_check
  check (
    metric_id in (
      'PH-CHOICE-CONC',
      'PH-ZERO-EXIT',
      'PH-DET-UUID',
      'PH-DET-UUID-CATALOG'
    )
  );
