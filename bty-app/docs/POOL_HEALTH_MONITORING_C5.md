# Pool health monitoring (C5) — SCENARIO_AUDIT_STANDARDS_V1 §3

Normative metric definitions, **alert thresholds**, and **playbook**: **`SCENARIO_AUDIT_STANDARDS_V1.md`** Section 3 (documentation root).

## Instrumented metrics (C3)

| ID | Meaning | Source |
| --- | --- | --- |
| **PH-CHOICE-CONC** | Max empirical choice share + HHI per `scenario_id` × step (2–4) | RPC `ph_choice_conc_rollup(days)` → `scenario_pool_health_snapshots` |
| **PH-ZERO-EXIT** | Among runs with step 2–4 `pattern_signals`, fraction with **no** `exit` on those steps | RPC `ph_zero_exit_rollup(days)` → snapshots |
| **PH-DET-UUID-CATALOG** | **Catalog only** — UUID heuristics on **`scenarios.id`** (or CMS `content_id`). **Excludes** `mirror_scenario_pool.id` and synthetic **`mirror:`** ids per **§3.1.1**. | TS `detectScenarioIdUuidIssues` (catalog table only) → snapshots |

**Cron:** `POST /api/cron/pool-health-metrics` with `CRON_SECRET` (same pattern as other cron routes). Schedule **hourly** (concentration) / **daily** (full rollup) per ops capacity.

**Statistical floor:** Do not emit **Warning**/**Critical** for **PH-CHOICE-CONC** / **PH-ZERO-EXIT** unless **`n ≥ n_min`** (default **30** per scenario×step; staging **15** with `low_n` flag).

**Env (optional tuning — defaults match SCENARIO_AUDIT_STANDARDS §3.2):**

| Variable | Default | Maps to |
| --- | --- | --- |
| `POOL_HEALTH_WARN_MAX_CHOICE_SHARE` | **0.80** | PH-CHOICE-CONC **Warning** |
| `POOL_HEALTH_CRIT_MAX_CHOICE_SHARE` | **0.90** | PH-CHOICE-CONC **Critical** (single step) |
| `POOL_HEALTH_CRIT_HHI` | **0.82** | PH-CHOICE-CONC **Critical** (HHI) |
| `POOL_HEALTH_WARN_ZERO_EXIT_RATE` | **0.85** | PH-ZERO-EXIT **Warning** (with conc correlation per spec) |
| `POOL_HEALTH_CRIT_ZERO_EXIT_RATE` | **0.95** | PH-ZERO-EXIT **Critical** (with conc correlation per spec) |
| `POOL_HEALTH_MIN_RUNS` | **30** | `n_min` |

## Alert thresholds (C5)

Authoritative table: **`SCENARIO_AUDIT_STANDARDS_V1.md` §3.2**. Summary:

| Condition | Severity | Meaning |
| --- | --- | --- |
| `PH-CHOICE-CONC` ≥ warn share (default **0.80**), `n ≥ n_min` | **Warning** | Extreme concentration — de-facto “correct” path, coaching leakage, or mapping bug. |
| `PH-CHOICE-CONC` ≥ crit share on **≥2** steps **or** HHI ≥ **0.82** | **Critical** | Page C3 + notify C5. |
| `PH-ZERO-EXIT` ≥ **0.85** with correlated concentration | **Warning** | See normative spec. |
| `PH-ZERO-EXIT` ≥ **0.95** + conc **Warning**+ | **Critical** | Content incident. |
| `PH-DET-UUID-CATALOG` ≥ **1** row | **Warning** | Catalog hygiene — block batch promote until triaged. |
| `PH-DET-UUID-CATALOG` ≥ **5** ids or **3** releases repeating | **Critical** | Halt catalog merge; page C3. |
| **≥3** scenarios new **Warning** on concentration within **48h** of one deploy | **Critical** (regression) | C5 copy review + C3 diff. |

The HTTP cron response includes `alerts[]` for Slack/PagerDuty; long-term store is **`scenario_pool_health_snapshots`**.

## Response playbook (process)

Aligned with **`SCENARIO_AUDIT_STANDARDS_V1.md` §3.4** — Ack (≤4h) → Triage → Remediate → Verify → Close; mirror UUID false positives: confirm **§3.1.1** whitelist.

Metrics are **tripwires**, not automatic takedown.

## CLOSED: deterministic mirror UUID (pool defect + false-positive)

1. **Stability fix:** `mirror_scenario_pool.id` is **UUID v5** from namespace `MIRROR_SCENARIO_POOL_ID_NAMESPACE` + `userId + "\n" + origin_scenario_id` (`stableMirrorPoolRowId`) so **`mirror:<id>`** stays stable across upsert — see `mirror-scenario.service.ts`.

2. **Monitoring fix:** **PH-DET-UUID-CATALOG** must **not** scan mirror pool row ids or **`mirror:`** prefixed client scenario ids — those are **by design** deterministic (**`SCENARIO_AUDIT_STANDARDS_V1.md` §3.1.1**). Optional separate metric **PH-MIRROR-ORPHAN** for linkage/content issues only.

## Retention

`scenario_pool_health_snapshots` is append-only; define a **retention job** (e.g. drop rows older than 180 days) in ops backlog if table growth matters.
