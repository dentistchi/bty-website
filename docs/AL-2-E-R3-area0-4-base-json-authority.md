# AL-2-E R3 — Area 0.4: base.json Authority Verification

**Sprint**: AL-2-E R3 Phase 1
**Mode**: read-only

## §1 base.json existence audit

[E.R3.A0.4.1] core_scenario_folder_count: 27 (all under `bty-app/src/data/scenario/core_*/`)
[E.R3.A0.4.2] base_json_present_count: 27/27
[E.R3.A0.4.3] en_json_present_count: 27/27
[E.R3.A0.4.4] ko_json_present_count: 27/27
[E.R3.A0.4.5] missing_files: 0
[E.R3.A0.4.6] folder_audit_result: COMPLETE — every Path 1 scenario folder has all 3 locale files

## §2 base.json structure schema

[E.R3.A0.4.7] sample_files_audited:
- `core_01_training_system_exposure/base.json`
- `core_02_new_doctor_reexposure_compromise_loop/base.json`
- `core_03_training_failure_hidden_as_performance_issue/base.json`
- `core_04_manager_neutrality_as_abandonment/base.json` (24h hit scenario)
- `core_27_identity_repair_commitment/base.json`

[E.R3.A0.4.8] required_top_level_keys (all sampled files): `["dbScenarioId", "incident", "scenarioId", "structure"]`

[E.R3.A0.4.9] incident_object_schema:
```
incident: {
  incidentId: string,           // e.g., "incident_01_small_compromise_to_trust_repair"
  stage: number,                 // 1-9 within incident
  axisGroup: string,             // e.g., "Ownership", "Repair", "Truth"
  axisIndex: number,
  previousScenarioId: string,    // state transition entry
  nextScenarioId: string,        // state transition exit
  roleShift: string,
  propagation: {
    exitEffect: string,
    entryEffect: string,
    reExposureNote: string
  }
}
```

[E.R3.A0.4.10] structure_object_schema:
```
structure: {
  primary: [{ choiceId, dbChoiceId } × 4]    // A, B, C, D
  tradeoff: {
    A: [{ choiceId, dbChoiceId } × 2],       // X, Y
    B: ..., C: ..., D: ...
  },
  action_decision: {
    A_X: [{ choiceId, dbChoiceId, is_action_commitment: bool } × 2],   // AD1, AD2
    A_Y: ..., B_X: ..., ..., D_Y: ...        // 8 keys total
  }
}
```

## §3 Decision-structure field locations

[E.R3.A0.4.11] field_authority_map:

| field | base.json location | en/ko.json location | authority |
|---|---|---|---|
| `pattern_family` | NOT in base | en/ko `escalationBranches[*].second_choices[*].pattern_family` AND `choices[*].pattern_family` AND `meaning.pattern_family` | en/ko (drift surface — see Area 1) |
| `axis` (label) | derived from `incident.axisGroup` | en/ko `axis_primary`, `axis_secondary[]`, per-choice `axis` | en/ko (drift surface — see Area 2) |
| `escalation_text` | NOT in base | en/ko `escalationBranches[A-D].escalation_text` | en/ko |
| `escalationBranches` | NOT in base (uses `structure` instead) | en/ko top-level | en/ko |
| `dbChoiceId` | base `structure.primary[].dbChoiceId` + `structure.tradeoff[*][].dbChoiceId` + `structure.action_decision[*][].dbChoiceId` | partial in en/ko (inconsistent — see Area 0.5) | **base (sole authority)** |
| state transition (`next_map`) | base `incident.previousScenarioId` + `incident.nextScenarioId` | NOT in en/ko | **base (sole authority)** |
| `is_action_commitment` (exit condition) | base `structure.action_decision[*][].is_action_commitment` | en/ko `escalationBranches[*].action_decision.choices[*].meaning.is_action_commitment` | **base (sole authority)** + en/ko (translation mirror) |

## §4 en/ko top-level fields (translation layer)

[E.R3.A0.4.12] en_ko_top_level_keys: `[id, title, role, pressure, tradeoff, bty_tension_axis, axis_primary, axis_secondary, difficulty_level, action_contract, air_logic, forced_reset, pattern_detection, choices, escalationBranches]`

[E.R3.A0.4.13] fields_in_en_ko_only:
- `id` (mirrors base.scenarioId)
- `title`, `role`, `pressure`, `tradeoff` (narrative)
- `bty_tension_axis` (narrative axis name)
- `axis_primary`, `axis_secondary` (semantic axis label)
- `difficulty_level`
- `action_contract`, `air_logic`, `forced_reset` (narrative blocks)
- `pattern_detection` (string array of pattern_family literals)
- `choices` (array with labels + per-choice axis + pattern_family + intensity)
- `escalationBranches` (object A/B/C/D → narrative escalation + second_choices + action_decision)

[E.R3.A0.4.14] fields_in_base_only:
- `dbScenarioId`
- `scenarioId`
- `incident` (with `axisGroup`, `axisIndex`, `previousScenarioId`, `nextScenarioId`, `propagation`)
- `structure` (graph-level decision tree with `dbChoiceId` mapping)

## §5 dbChoiceId authority drift (Area 0.5 cross-ref)

[E.R3.A0.4.15] ko_json_dbchoiceid_consistency: ko.json **always** includes `dbChoiceId` in `choices` array (sample: core_01, core_03, core_27 all consistent)
[E.R3.A0.4.16] en_json_dbchoiceid_consistency: **inconsistent** — sampled state:
- `core_01/en.json` — NO `dbChoiceId` in primary `choices`
- `core_03/en.json` — YES `dbChoiceId` in primary `choices`
- `core_05/en.json` — YES `dbChoiceId` in primary `choices`
- `core_10/en.json` — NO `dbChoiceId` in primary `choices`
- `core_27/en.json` — YES `dbChoiceId` in primary `choices`

[E.R3.A0.4.17] drift_classification: en.json `dbChoiceId` presence is hand-edit residual; this is **NOT a structural drift** because base.json carries authoritative dbChoiceId mapping. en.json's optional dbChoiceId is **redundant or stale mirror** — runtime should bind from base. **[SEMANTIC_DRIFT_DETECTED]** if any runtime path reads dbChoiceId from en/ko instead of base. (See Area 3 wiring code for verification — runtime reads from base.structure per `bty-app/src/app/api/arena/choice/route.ts:481-498`.)

[E.R3.A0.4.18] runtime_authority_verified: base.json — confirmed by Area 3 wiring inventory (choice handler reads `base.structure.primary[].dbChoiceId` for validation, NOT en/ko)

## §6 base.json authority conclusion

[E.R3.A0.4.19] base_authority_scope:
- **scenario routing**: `incident.previousScenarioId`, `incident.nextScenarioId` (sole authority)
- **axis taxonomy**: `incident.axisGroup`, `incident.axisIndex` (sole authority for state machine; en/ko `axis_primary` is DISPLAY mirror, see Area 2)
- **database binding**: `structure.primary/tradeoff/action_decision[*].dbChoiceId` (sole authority)
- **action commitment exit condition**: `structure.action_decision[*][*].is_action_commitment` (sole authority for state transition; en/ko `meaning.is_action_commitment` is DISPLAY mirror)

[E.R3.A0.4.20] en_ko_authority_scope: **DISPLAY-ONLY translation** — narrative text, locale-specific phrasing. Decision-structure changes MUST originate in base.json.

[E.R3.A0.4.21] hanbit_definition_verified: YES — base.json is the sole authority for decision structure; en/ko is translation layer. Runtime wiring confirms (Area 3).

[E.R3.A0.4.22] semantic_implication_for_lock5: per Area 4, Lock 5 explicitly freezes `pattern_family` literals (en/ko surface) + `bty_tension_axis` (en/ko surface). base.json structure (incident routing, dbChoiceId, action_decision exit) carries no Lock 5 explicit freeze citation — **[DEFERRED_NO_CITATION]** for base.json structural mutability scope.
