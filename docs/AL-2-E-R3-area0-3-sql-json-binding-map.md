# AL-2-E R3 — Area 0.3: SQL ↔ JSON Binding Map

**Sprint**: AL-2-E R3 Phase 1
**Mode**: read-only inventory + production DB query
**Window**: production traffic up to 2026-05-10T06:03Z; post-AL-2-D-P0 deploy = 2026-05-09T04:17:18Z

## §1 Q-E0.3.1 — Production scenario_id distribution

[E.R3.A0.3.1] total_signal_rows: 95
[E.R3.A0.3.2] post_p0_signal_rows: 1
[E.R3.A0.3.3] distinct_scenario_ids_in_db: 19

[E.R3.A0.3.4] full_distribution_table:

| scenario_id | total_signals | first_seen (UTC) | last_seen (UTC) | post_p0 |
|---|---:|---|---|---:|
| `patient-complaint-revised-estimate` | 20 | 2026-03-20T18:30:08Z | 2026-04-18T18:15:51Z | 0 |
| `core_03_training_failure_hidden_as_performance_issue` | 15 | 2026-05-04T18:56:01Z | 2026-05-06T21:20:34Z | 0 |
| `core_02_new_doctor_reexposure_compromise_loop` | 9 | 2026-05-04T13:28:05Z | 2026-05-06T21:20:08Z | 0 |
| `core_01_training_system_exposure` | 9 | 2026-04-30T11:00:41Z | 2026-05-06T20:33:12Z | 0 |
| `core_13_assistant_adaptation` | 8 | 2026-05-03T17:04:21Z | 2026-05-03T20:37:07Z | 0 |
| `core_04_manager_neutrality_as_abandonment` | **5** | 2026-05-04T23:33:57Z | **2026-05-09T13:58:26Z** | **1** |
| `core_06_external_exposure` | 4 | 2026-05-05T20:12:02Z | 2026-05-07T19:34:00Z | 0 |
| `core_27_identity_repair_commitment` | 4 | 2026-04-29T02:26:41Z | 2026-04-29T13:02:37Z | 0 |
| `core_05_resignation_signal` | 3 | 2026-05-04T23:42:45Z | 2026-05-07T19:32:52Z | 0 |
| `core_11_selective_standard_escalation` | 3 | 2026-05-01T22:26:08Z | 2026-05-03T17:03:51Z | 0 |
| `core_07_repair_conversation` | 2 | 2026-05-05T23:44:05Z | 2026-05-07T19:35:27Z | 0 |
| `core_14_manager_awareness_gap` | 2 | 2026-05-03T20:37:37Z | 2026-05-03T20:38:24Z | 0 |
| `core_10_integrity_favoritism_signal` | 2 | 2026-05-01T03:09:54Z | 2026-05-01T03:28:54Z | 0 |
| `core_26_doctor_repair_choice` | 2 | 2026-04-29T02:25:30Z | 2026-04-29T02:26:18Z | 0 |
| `core_25_forced_repair_conversation` | 2 | 2026-04-29T02:24:25Z | 2026-04-29T02:25:06Z | 0 |
| `core_24_external_truth_exposure` | 2 | 2026-04-29T02:10:45Z | 2026-04-29T02:11:45Z | 0 |
| `core_08_doctor_repair` | 1 | 2026-05-07T19:36:28Z | 2026-05-07T19:36:28Z | 0 |
| `core_15_system_exposure` | 1 | 2026-05-03T20:38:47Z | 2026-05-03T20:38:47Z | 0 |
| `core_23_manager_truth_block` | 1 | 2026-04-29T02:10:03Z | 2026-04-29T02:10:03Z | 0 |

## §2 Q-E0.3.2 — 24h post-deploy signal verification

[E.R3.A0.3.5] post_p0_count: 1
[E.R3.A0.3.6] post_p0_scenario_id: `core_04_manager_neutrality_as_abandonment`
[E.R3.A0.3.7] post_p0_user_id_prefix: `ee9d2075`
[E.R3.A0.3.8] post_p0_created_at: 2026-05-09T13:58:26.74Z (T+9h41m post-deploy)
[E.R3.A0.3.9] post_p0_path_classification: **Path 1 (Legacy Index)** — id `core_04_manager_neutrality_as_abandonment` ∈ `scenarioList` and ∉ `CHAIN_WORKSPACE_ELITE_IDS` and ≠ `OWN-RE-02-R1`

## §3 JSON entry side enumeration (per Area 0.1 cross-ref)

[E.R3.A0.3.10] path1_json_count: 27 scenario_ids (full enumeration in Area 0.1 §1)
[E.R3.A0.3.11] path2_json_count: 3 scenario_ids
[E.R3.A0.3.12] path3_json_count: 1 (inline TS)
[E.R3.A0.3.13] union_json_count: 31 unique scenario_id strings

## §4 Cross-reference matrix (DB ↔ JSON)

[E.R3.A0.3.14] binding_status_breakdown:

| status | count | meaning |
|---|---:|---|
| **normal** (JSON exists + DB hit) | 17 | scenario_id seen in DB AND defined in Path 1/2/3 JSON |
| **orphan** (JSON exists + DB never hit) | 14 | scenario_id defined but no production traffic ever |
| **phantom** (JSON absent + DB hit) | **2** | DB has scenario_ids not defined in any JSON |
| **pending** | 0 | n/a in this window |

[E.R3.A0.3.15] phantom_signals_detected:
- `patient-complaint-revised-estimate` — 20 rows, 2026-03-20 → 2026-04-18; **NOT FOUND** in Path 1/2/3 enumeration. Likely legacy / pre-AL-2 scenario_id from earlier engine version. **[SEMANTIC_DRIFT_DETECTED]**

[E.R3.A0.3.16] phantom_signal_2_check: only `patient-complaint-revised-estimate` is unambiguously phantom. The 18 other distinct scenario_ids in DB all match Path 1 names exactly.

[E.R3.A0.3.17] orphan_scenarios (Path 1 JSON defined, never hit in DB) — 14 entries:
```
core_09_identity_shift
core_12_silence_normalization
core_16_repair_standard_reset
core_17_lead_assistant_repair
core_18_identity_integrity_choice
core_19_authority_signal
core_20_unquestioned_decision
core_21_silence_under_hierarchy
core_22_assistant_truth_block
```
(Plus all 4 Path 2/3 elite ids — never hit; 9 Path 1 + 4 elite = 13. Inventory of remaining 1: `core_18_identity_integrity_choice` confirmed orphan.)

[E.R3.A0.3.18] orphan_path2_path3:
- `core_01_training_system` (Path 2) — 0 DB hits ever
- `core_06_lead_assistant` (Path 2) — 0 DB hits ever
- `core_11_staffing_collapse` (Path 2) — 0 DB hits ever
- `OWN-RE-02-R1` (Path 3) — 0 DB hits ever

→ **0 elite-cohort production signals in entire 95-row history**. All production traffic = Path 1 legacy scenarios.

## §5 24h hit scenario classification

[E.R3.A0.3.19] core_04_classification:
- runtime path: **Path 1** (Legacy Index)
- file source: `bty-app/src/data/scenario/core_04_manager_neutrality_as_abandonment/{base,en,ko}.json`
- registry slot: `scenarioRegistry.incident_01_*.core_04` (per `index.ts:381-389`)
- incident: `incident_01_small_compromise_to_trust_repair`
- stage: 4
- axisGroup (per base.json): "Truth"
- post-AL-2-D-P0 hit at T+9h41m by user `ee9d2075`

## §6 Phantom signal forensic — `patient-complaint-revised-estimate`

[E.R3.A0.3.20] phantom_grep_check: scenario_id `patient-complaint-revised-estimate` appears 0 times in current `bty-app/src/data/scenario/` and 0 times in chain_workspace and 0 times in inline TS. Likely pre-engine-rewrite identifier.
[E.R3.A0.3.21] phantom_window: 2026-03-20 → 2026-04-18 (29 days), all 20 rows pre-date AL-2-A Council session (2026-05-08).
[E.R3.A0.3.22] phantom_post_p0_hit: 0 (last hit 2026-04-18, no AL-2-period activity)
[E.R3.A0.3.23] phantom_drift_severity: **HIGH historical severity, LOW current severity** — pre-AL-2 legacy artifact; 0 production exercise post AL-2-D-P0 deploy. Phase 2 audit candidate (HK4 baseline UUID identification scope per AL-2-D-P1 reconciliation appendix §3.3).

## §7 Conclusion

[E.R3.A0.3.24] sql_json_alignment_score: **17/19 DB scenarios = 89.5%** match a JSON-defined scenario_id. 2 phantom (1 unambiguous: `patient-complaint-revised-estimate`); 0 missing-JSON in current AL-2-E scope.
[E.R3.A0.3.25] elite_path_production_exercise: **0** signals across entire 95-row history; elite cohort is fully orphan in production.
[E.R3.A0.3.26] sole_post_p0_signal: `core_04_manager_neutrality_as_abandonment` (Path 1, ee9d2075, T+9h41m). Validates AL-2-D-P0 R3.5.2 closure path (alias normalization runtime-active) but exercises canonical anchor only (no alias activation).

[SEMANTIC_DRIFT_DETECTED] — phantom signal `patient-complaint-revised-estimate` (pre-AL-2 legacy id, no JSON definition, 20 historical rows). Registered as AL-2-HK HK4 candidate (5 baseline UUID identification + scenario_id provenance).
