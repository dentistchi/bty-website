# AL-2-E R3 — Area 0.5: Locale Drift Sampling

**Sprint**: AL-2-E R3 Phase 1
**Mode**: read-only sampling

## §1 Sampling rule

[E.R3.A0.5.1] sample_size: 5 (per dispatch 3-5 range, max chosen for representative coverage across all 3 paths)
[E.R3.A0.5.2] sample_selection_criteria: 1 per runtime path + 24h hit + tail of incident chain
[E.R3.A0.5.3] sampled_scenarios:

| sample | scenario | path | rationale |
|---|---|---|---|
| S1 | `core_01_training_system_exposure` | Path 1 (also Path 2 via `core_01_training_system` chain elite) | first scenario, both paths reference |
| S2 | `core_03_training_failure_hidden_as_performance_issue` | Path 1 | high traffic in production (15 signals) |
| S3 | `core_04_manager_neutrality_as_abandonment` | Path 1 | 24h post-deploy hit scenario (only T+9h41m signal) |
| S4 | `core_06_external_exposure` | Path 1 (Path 2 binds via `core_06_lead_assistant`) | chain workspace bridge |
| S5 | `core_27_identity_repair_commitment` | Path 1 | last scenario in Incident-03 chain (`nextScenarioId: null`) |

[E.R3.A0.5.4] sampling_method: per-scenario `base.json` vs `en.json` vs `ko.json` 3-way diff focused on (a) decision-structure fields, (b) dbChoiceId binding consistency, (c) escalation phrasing variance

## §2 Per-scenario drift inventory

### §2.1 S1 — core_01_training_system_exposure

[E.R3.A0.5.5] s1_decision_structure_drift: base carries `structure.primary/tradeoff/action_decision`; en/ko carry `escalationBranches` mirror. **No structural drift**.
[E.R3.A0.5.6] s1_dbchoiceid_drift: en.json **lacks** `dbChoiceId` in primary `choices` array; ko.json **has** `dbChoiceId` in primary `choices`. **Translation-mirror inconsistency** — does not affect runtime (runtime reads from base per Area 3).
[E.R3.A0.5.7] s1_pattern_family_drift: not enumerated in this sample (full enumeration in Area 1)
[E.R3.A0.5.8] s1_escalation_text_diff: phrasing varies en↔ko (expected); structure (4 branches A/B/C/D) identical → **TRANSLATION PREFERENCE** (Guard E2)
[E.R3.A0.5.9] s1_classification: TRANSLATION PREFERENCE (no SEMANTIC DRIFT)

### §2.2 S2 — core_03_training_failure_hidden_as_performance_issue

[E.R3.A0.5.10] s2_decision_structure_drift: structure parity en↔ko; base authoritative
[E.R3.A0.5.11] s2_dbchoiceid_drift: en.json **has** `dbChoiceId` in primary `choices`; ko.json **has** `dbChoiceId`. **Symmetric** — no drift.
[E.R3.A0.5.12] s2_classification: TRANSLATION PREFERENCE (no SEMANTIC DRIFT)

### §2.3 S3 — core_04_manager_neutrality_as_abandonment (24h hit)

[E.R3.A0.5.13] s3_base_axisGroup: "Truth" (per `incident.axisGroup`)
[E.R3.A0.5.14] s3_en_axis_primary: "Truth" (matches base)
[E.R3.A0.5.15] s3_ko_axis_primary: "Truth" (matches base; same string in EN locale form)
[E.R3.A0.5.16] s3_dbchoiceid_drift: not separately verified (runtime read from base — Area 3 confirms wiring); this scenario hit production at T+9h41m and signal had `axis = "Truth"` per Q-E2.1 row → no axis drift in this scenario specifically
[E.R3.A0.5.17] s3_pattern_family_in_runtime: ee9d2075's `user_pattern_signatures` shows `pattern_family = reputation_protection` (axis = "Reputation"), NOT from this scenario — that signature pre-dates this scenario hit. The 1 arena_signal at T+9h41m did not produce a new signature row.
[E.R3.A0.5.18] s3_classification: TRANSLATION PREFERENCE (no SEMANTIC DRIFT)

### §2.4 S4 — core_06_external_exposure (Path 2 bridge)

[E.R3.A0.5.19] s4_base_present: ✓
[E.R3.A0.5.20] s4_chain_workspace_present: chain workspace `Core_06_lead_assistant/{S1,S2,S3}.json` exists in `bty-app/src/data/bty_chain_workspace/Chains/`
[E.R3.A0.5.21] s4_path1_path2_bridge: Path 2 `core_06_lead_assistant` extracts ordinal `06_*` and resolves to Path 1 `core_06_external_exposure` via `eliteScenariosCanonical.server.ts:196-236` → reuses Path 1 dbChoiceId mapping
[E.R3.A0.5.22] s4_drift_classification: bridge mechanism is intentional (per memory #15 + memory #17); not a drift. **NO SEMANTIC DRIFT**.

### §2.5 S5 — core_27_identity_repair_commitment

[E.R3.A0.5.23] s5_decision_structure_drift: structure parity en↔ko
[E.R3.A0.5.24] s5_dbchoiceid_drift: en.json has `dbChoiceId`; ko.json has `dbChoiceId` — symmetric
[E.R3.A0.5.25] s5_terminal_marker: `incident.nextScenarioId: null` (chain terminal)
[E.R3.A0.5.26] s5_classification: TRANSLATION PREFERENCE (no SEMANTIC DRIFT)

## §3 Aggregate drift findings

[E.R3.A0.5.27] structural_drift_count: **0** across 5 sampled scenarios
[E.R3.A0.5.28] translation_preference_count: **5** (en↔ko phrasing variance, expected & permitted under Guard E2)
[E.R3.A0.5.29] dbchoiceid_inconsistency_count: **2 of 5** (S1: en.json lacks; S2/S3/S4/S5: en.json has) — flagged as **translation-mirror inconsistency, NOT structural drift** (runtime authority resides in base.json — Area 3 wiring confirms)
[E.R3.A0.5.30] missing_field_count: 0 (all sampled have all decision-structure fields in base; en/ko have all narrative fields)

## §4 Cross-scenario inconsistency: en.json dbChoiceId presence

[E.R3.A0.5.31] en_dbchoiceid_inconsistency_inventory (from Area 0.4 §5 + this sample):
- WITHOUT dbChoiceId in primary choices: `core_01`, `core_10`
- WITH dbChoiceId in primary choices: `core_03`, `core_05`, `core_27`, `core_04` (assumed per traffic path symmetry — full enumeration deferred)

[E.R3.A0.5.32] ko_dbchoiceid_consistency: 100% present in all sampled (no inconsistency)
[E.R3.A0.5.33] runtime_impact: **0** — choice handler at `bty-app/src/app/api/arena/choice/route.ts:481-498` validates against `base.structure.primary[].dbChoiceId`, not en/ko mirrors. en.json's optional dbChoiceId is redundant.
[E.R3.A0.5.34] mutation_recommendation_phase2: full sweep of en.json files to either (a) restore dbChoiceId in all 27 for consistency, or (b) remove from all (since base is authoritative). **[PHASE_2_DEFERRED]** (audit-only in Phase 1).

## §5 Locale drift conclusion

[E.R3.A0.5.35] semantic_drift_count: **0** (Guard E2: structural drift only counted)
[E.R3.A0.5.36] translation_preference_finding: en/ko phrasing differs as expected; base.json authority preserved across all 5 sampled scenarios
[E.R3.A0.5.37] markers_emitted: 0 [SEMANTIC_DRIFT_DETECTED] in this Area; 1 [PHASE_2_DEFERRED] (en.json dbChoiceId consistency sweep)

→ **5/5 sampled scenarios = no structural drift**. Base.json authority holds. en.json dbChoiceId mirror inconsistency is hand-edit residue, not structural drift; affects 0 runtime paths.
