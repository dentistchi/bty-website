# AL-2-E R3 — Area 4: Lock 5 Protection Boundary

**Sprint**: AL-2-E R3 Phase 1
**Mode**: read-only citation-only inventory (Guard E4: 추정 금지)

## §1 Lock 5 explicit definition

[E.R3.A4.1] lock5_definition_source: `docs/AL-2_SPRINT_CLOSURE.md:126`
[E.R3.A4.2] lock5_definition_quote (verbatim):
> | Lock 5 | scenario JSON re-tagging deferred | ✓ (→ AL-2-E) |

[E.R3.A4.3] lock5_expanded_scope_source: `docs/AL-2_SPRINT_CLOSURE.md` §5.3
[E.R3.A4.4] lock5_expanded_scope_quote (verbatim):
> **AL-2-E (scenario JSON re-tag sprint)**
> - `bty_tension_axis` literal re-tag
> - 12 Type 4 OUTSIDE literal rewrite (Phase 2 enum null entries)

## §2 Immutable areas (explicit IMMUTABLE citation)

### §2.1 pattern_family literals

[E.R3.A4.5] cite_path: `docs/AL-2-D-P1-R3-archetype-determinism-trace.md:147`
[E.R3.A4.6] cite_quote (verbatim):
> **[D-P1.R3.A1.14] scenario_json_role**: Scenario JSON authors `pattern_family` literals that flow into `user_pattern_signatures` and downstream into `patterns[].pattern_family`. **Lock 5 freezes scenario JSON re-tag (→ AL-2-E). Within current freeze, scenario JSON does not push new literals into the system.**

[E.R3.A4.7] classification: **FORBIDDEN** (pattern_family literal in scenario JSON cannot be re-tagged or rewritten until Lock 5 unlock at AL-2-E)

### §2.2 bty_tension_axis literal re-tag

[E.R3.A4.8] cite_path: `docs/AL-2_SPRINT_CLOSURE.md:126` + §5.3
[E.R3.A4.9] cite_quote (verbatim §5.3 second bullet):
> - `bty_tension_axis` literal re-tag

[E.R3.A4.10] classification: **FORBIDDEN until AL-2-E unlock** (literal re-tag deferred). Note: scope ambiguity — "literal re-tag" suggests CATEGORY swap forbidden; wording-level edit (same axis, different phrasing) is **boundary-ambiguous** (see §4 below).

### §2.3 LOW-row pruning / scenario JSON edits

[E.R3.A4.11] cite_path: `docs/AL-2-D-P1-R3-HK-deprecate-low-row-status.md:117`
[E.R3.A4.12] cite_quote (verbatim):
> **[D-P1.R3-HK.A2.11] option_h1_in_place_pruning**: scenario JSON edit to remove or rename each occurrence **(Lock 5 frozen until AL-2-E unlocks). Cost = high (per-scenario semantic review by author). Determinism impact = changes input_hash for any user whose Arena run touched the edited scenario.**

[E.R3.A4.13] classification: **FORBIDDEN** until AL-2-E unlock (any scenario JSON edit that removes / renames a literal triggers Lock 5)

### §2.4 Determinism-affecting any-edit

[E.R3.A4.14] cite_implication_per_2_3: any scenario JSON edit changes input_hash → breaks archetype identity continuity for users whose Arena run touched the edited scenario. This is the determinism rationale for Lock 5 freeze.

## §3 Mutable areas (explicit MUTABLE citation)

### §3.1 numericStructure block

[E.R3.A4.15] cite_path: `docs/SCENARIO_CONTENT_GUIDELINES.md:23-26`
[E.R3.A4.16] cite_quote (verbatim, table form):
> **Allowed numeric expression:**
> | 영역 | 설명 |
> |------|------|
> | **`numericStructure.impact`** | `percent` · `dollars` · `count` 중 **하나 이상이 유한 수이고 > 0** (0 전용 측정값은 거부). `narrativeEn` 필수, `narrativeKo` 선택. |
> | **`resourceConstraintEn` / `resourceConstraintKo`** | 예산·인력·용량 등 **구체적 제약 문구** (여기서 금액·퍼센트 표현 허용). |
> | **`timeConstraintEn` / `timeConstraintKo`** | SLA·마감·시간 박스. |

[E.R3.A4.17] classification: **PERMITTED** — numericStructure (impact / resourceConstraint* / timeConstraint*) explicitly mutable

### §3.2 Locale-specific phrasing (Ko optional)

[E.R3.A4.18] cite_path: `docs/SCENARIO_CONTENT_GUIDELINES.md:38-39`
[E.R3.A4.19] cite_quote (verbatim):
> **Ko 선택 · En 필수 (fallback)** — `impact.narrativeEn` 필수; `narrativeKo`, `timeConstraintKo`, `resourceConstraintKo`는 선택. 로케일별 표시는 엔진/UI 정책에 따름.

[E.R3.A4.20] classification: **PERMITTED** — `narrativeKo`, `timeConstraintKo`, `resourceConstraintKo` are explicitly optional (mutable / additive)

### §3.3 Export aggregator (NOT scenario JSON)

[E.R3.A4.21] cite_path: `docs/AL-2-D-P1-R3-HK-compat-map-deletion-trace.md:61`
[E.R3.A4.22] cite_quote (verbatim):
> **[D-P1.R3-HK.A1.13] deletion_pre_requirement_scenario_json_lock**: Lock 5 (scenario JSON re-tag deferred to AL-2-E) **does NOT cover** `bty-app/src/data/scenario/index.ts` — **that file is the export aggregator, not scenario JSON content. Deletion of the dead export is permissible without violating Lock 5.**

[E.R3.A4.23] classification: **PERMITTED** — `bty-app/src/data/scenario/index.ts` and other TS aggregators are outside Lock 5 scope

## §4 Boundary-ambiguous areas (no citation — Guard E4: 추정 금지)

[E.R3.A4.24] ambiguous_areas_per_guard_e4 (no citation either way):

| field | classification | reason |
|---|---|---|
| Primary choice text (en/ko `choices[*].label`) | **[DEFERRED_NO_CITATION]** | no doc explicitly marks mutable or immutable |
| Tradeoff (Escalation) text (en/ko `escalationBranches[*].escalation_text`) | **[DEFERRED_NO_CITATION]** | no doc citation |
| Second choice (en/ko `escalationBranches[*].second_choices[*].label`) | **[DEFERRED_NO_CITATION]** | no doc citation |
| Action decision text (en/ko `escalationBranches[*].action_decision.choices[*].label`) | **[DEFERRED_NO_CITATION]** | no doc citation |
| Title / body narrative (en/ko `title`, `pressure`, `tradeoff`) | **[DEFERRED_NO_CITATION]** | SCENARIO_CONTENT_GUIDELINES focuses on numericStructure separation; says nothing about narrative mutability |
| `bty_tension_axis` wording (vs. literal re-tag) | **[DEFERRED_NO_CITATION]** | "literal re-tag" wording in §5.3 is ambiguous between category-swap (forbidden) and phrasing-edit (unclear) |
| base.json `incident.propagation.{exitEffect, entryEffect, reExposureNote}` text | **[DEFERRED_NO_CITATION]** | author-facing semantic; no consumption verified at runtime (per Area 3 §9 outstanding question) |
| `dbChoiceId` literal value | **[DEFERRED_NO_CITATION]** | implicit DB referential integrity — never explicitly called out as immutable, but determinism-affecting per §2.4 → conservative classification |
| `next_map` / `incident.previousScenarioId` / `incident.nextScenarioId` | **[DEFERRED_NO_CITATION]** | state-transition graph editing implicitly determinism-affecting; no explicit Lock 5 citation |

## §5 Determinism & identity continuity rationale

[E.R3.A4.25] determinism_implication_for_lock_5: any scenario JSON edit changes input_hash → breaks archetype identity continuity for users whose Arena run touched the edited scenario (per §2.3 cite). Lock 5 prevents this until AL-2-E unlock plans the hash migration.

[E.R3.A4.26] cross_ref_lock_6: FINGERPRINT_VERSION = 1 (Lock 6 carry-forward per AL-2_SPRINT_CLOSURE.md §4.1). Scenario JSON edit during Lock 5 freeze + Lock 6 V=1 freeze = double protection of identity continuity.

## §6 Mutation candidate classification (citation-bound per Guard E4)

[E.R3.A4.27] classification_summary:

| area | citation | classification | source |
|---|---|---|---|
| `pattern_family` literals | EXPLICIT IMMUTABLE | **FORBIDDEN** | `archetype-determinism-trace.md:147` |
| `bty_tension_axis` literal re-tag | EXPLICIT DEFERRED → AL-2-E | **FORBIDDEN** (until unlock) | `AL-2_SPRINT_CLOSURE.md:126, §5.3` |
| LOW-row pruning (any scenario JSON edit) | EXPLICIT IMMUTABLE | **FORBIDDEN** | `HK-deprecate-low-row-status.md:117` |
| `numericStructure.{impact, resourceConstraint*, timeConstraint*}` | EXPLICIT MUTABLE | **SAFE** | `SCENARIO_CONTENT_GUIDELINES.md:23-26` |
| Locale-specific phrasing (`narrativeKo`, `timeConstraintKo`, `resourceConstraintKo`) | EXPLICIT MUTABLE | **SAFE** | `SCENARIO_CONTENT_GUIDELINES.md:38-39` |
| Export aggregator (TS files in `bty-app/src/data/scenario/index.ts`) | EXPLICIT NOT-IN-LOCK-5 | **SAFE** | `HK-compat-map-deletion-trace.md:61` |
| Primary choice text | NO CITATION | **DEFERRED_NO_CITATION** | — |
| Escalation text wording | NO CITATION | **DEFERRED_NO_CITATION** | — |
| Second choice / action decision text | NO CITATION | **DEFERRED_NO_CITATION** | — |
| Title / body / narrative | NO CITATION | **DEFERRED_NO_CITATION** | — |
| `bty_tension_axis` phrasing edit (same category) | AMBIGUOUS CITATION | **DEFERRED_NO_CITATION** (likely FORBIDDEN under conservative reading) | — |
| `dbChoiceId` literal | NO EXPLICIT CITATION | **DEFERRED_NO_CITATION** (likely FORBIDDEN under determinism rationale §5) | — |
| `next_map` / state transition fields | NO EXPLICIT CITATION | **DEFERRED_NO_CITATION** (likely FORBIDDEN under determinism rationale §5) | — |
| `incident.propagation.{exitEffect, entryEffect, reExposureNote}` | NO CITATION | **DEFERRED_NO_CITATION** (audit-only metadata likely safe but unconfirmed) | — |

## §7 Cross-references & deferred work

[E.R3.A4.28] cross_ref_table:

| sprint | task | status | doc |
|---|---|---|---|
| AL-2-E | Scenario JSON re-tag (`pattern_family`, `bty_tension_axis`, 12 Type 4 OUTSIDE literals) | **registered, scope TBD** | `AL-2_SPRINT_CLOSURE.md §5.3`, `CURSOR_TASK_BOARD.md` |
| AL-2-E | Scenario authoring vocabulary realignment | **deferred** | `docs/AL-2-B-low-confidence-deferred.md §2.2` |
| Lock 5 | freeze active until AL-2-E unlock | **carried forward from AL-2-B** | `AL-2_SPRINT_CLOSURE.md §4.1` |
| AL-2-HK | HK2 — 37 DEPRECATE LOW row policy decision | **registered** | `CURSOR_TASK_BOARD.md` |

## §8 Findings

[E.R3.A4.29] explicit_immutable_count: 3 (pattern_family / bty_tension_axis literal re-tag / any scenario JSON edit triggering input_hash change)
[E.R3.A4.30] explicit_mutable_count: 3 (numericStructure block / locale-specific Ko fields / export aggregator TS)
[E.R3.A4.31] deferred_no_citation_count: **9** [DEFERRED_NO_CITATION] markers — see §6 table
[E.R3.A4.32] phase2_deferred_count: 1 [PHASE_2_DEFERRED] — exhaustive scenario JSON field-by-field mutability enumeration (when AL-2-E unlocks)

[E.R3.A4.33] semantic_drift_count: 0 (this Area is citation inventory; no drift evaluation)

## §9 Conclusion

[E.R3.A4.34] lock5_scope_summary: Lock 5 is a **freeze on `pattern_family` + `bty_tension_axis` literal re-tagging** + any scenario JSON edit that changes input_hash. Numeric structure and locale-specific Ko phrasing are explicitly permitted. Export aggregator TS is outside scope. **All other scenario JSON fields lack explicit mutability citation** (Guard E4: 추정 금지 → DEFERRED_NO_CITATION).

[E.R3.A4.35] commander_decision_required: **YES** — for AL-2-E mutation phase, Commander must define Lock 5 boundary for the 9 [DEFERRED_NO_CITATION] field categories OR adopt conservative interpretation (all = FORBIDDEN until AL-2-E completes the explicit boundary spec).
