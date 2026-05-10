# AL-2-E Phase 2 — Commander Escalation Queue

**Sprint**: AL-2-E Ψ-1 Step 3 (Phase 2 audit, Component 3)
**Mode**: read-only — entries route to Commander review (자동 mutation 불가)
**Authority**: Hanbit Commander (BTY Semantic Council)
**Authoring date**: 2026-05-10
**Inner HEAD**: `50317b8` · **Outer HEAD**: `d513c6e` · **Worker**: `e9e179ed`

**Cross-ref**: [Component 1 matrix](AL-2-E-PHASE2-mutation-eligibility-matrix.csv), [Component 2 integrity](AL-2-E-PHASE2-semantic-fingerprint-integrity.md), [Component 4 heatmap](AL-2-E-PHASE2-drift-density-heatmap.md), [Lock 5 spec](LOCK_5_SEMANTIC_BOUNDARY_SPEC.md)

---

## §Q1 — action_decision semantic ambiguity (substantive 1 + aggregate 1)

### Q1.1 [REQUIRES_COMMANDER_REVIEW] — core_01 architectural OUTLIER

| field | value |
|---|---|
| scenario_id | `core_01_training_system_exposure` |
| classification | FORBIDDEN (Lock 5 default) |
| ambiguity description | core_01 uses **8 action_decision branch keys** (A_X, A_Y, B_X, B_Y, C_X, C_Y, D_X, D_Y) × 2 choices = 16 total. The standard 26 scenarios use only **4 keys** (A_X, B_X, C_X, D_X) × 2 = 8 total. core_01 branches all 4 primary × 2 tradeoff combinations through action_decision; standard collapses tradeoff Y branches. |
| current text excerpt | base.json `structure.action_decision`: `{A_X, A_Y, B_X, B_Y, C_X, C_Y, D_X, D_Y}` (each with `[AD1, AD2]` choices and `is_action_commitment` boolean) — vs. core_02 standard: `{A_X, B_X, C_X, D_X}` only |
| invariant status | i4 INTACT (commit/avoid balance preserved 8/8); architectural variant only |
| runtime impact | Higher action_decision granularity for core_01 means more branching → potentially more `bty_arena_signals` rows per run. No determinism break. |
| Commander review question | "Is core_01's 8-key action_decision granularity intentional architectural design (chain workspace bridge / training_system semantic) or scenario-authoring drift to be normalized to standard 4-key structure?" |
| if intentional | document architectural variant in Lock 5 spec §2.1 as exception; preserve as-is |
| if drift | scope new sub-sprint to refactor to 4-key (FORBIDDEN under current Lock 5 — requires Lock 5 unlock for action_decision text) |

### Q1.2 [REQUIRES_COMMANDER_REVIEW] — 26 standard scenarios action_decision default confirmation (aggregate)

| field | value |
|---|---|
| scenarios | core_02 ... core_27 (26 scenarios, excluding core_01) |
| classification | FORBIDDEN (Lock 5 default per spec §2 #4) |
| ambiguity description | Per Guard P2-4, all 27 action_decision-text cells with escalation_required=YES must enumerate. 26 scenarios maintain standard 4-key × 2-choice action_decision structure with balanced commitment (4 yes / 4 no). No reclassification candidate proposed by C5 (Guard P2-5 + Guard 12 — C5 cannot self-classify). |
| invariant status | i4 INTACT 26/26 |
| runtime impact | 0 (FORBIDDEN preserved) |
| Commander review question | "Confirm Lock 5 default FORBIDDEN classification for action_decision text across 26 standard scenarios. No reclassification candidates surfaced in Phase 2 audit." |
| default outcome (no Commander action) | Lock 5 default FORBIDDEN holds; action_decision text mutation forbidden until explicit Lock 5 unlock per Lock 5 spec §5 mutation procedure. |

---

## §Q2 — propagation identity drift (substantive 0)

### Q2.0 — no substantive entries

Component 2 i5 invariant (re-exposure continuity) = 27/27 INTACT. All scenarios have non-empty `incident.propagation.reExposureNote`. AL-1.8-D filter (`bty-app/src/lib/bty/arena/noChangeRisk.server.ts:117`) operates on accrual math (`axisTotal >= 2 || riskCount >= 2`), not on propagation text — propagation text is author-facing semantic only.

| field | value |
|---|---|
| substantive entries | **0** |
| matrix entries with classification = RISKY | 27 (Lock 5 default per spec §2 #9) |
| reclassification candidates | **0** (no specific edit candidate without Commander direction) |
| default outcome | RISKY classification preserved; propagation text edits require Commander pre-approval per Lock 5 spec §5 mutation procedure. |

→ Phase 2 outstanding question carry-forward: <C5 inventory에서 확인> on `propagation.{exitEffect, entryEffect, reExposureNote}` runtime consumer status (per AL-2-E R3 Area 3 §9). [PHASE_2_DEFERRED] until Commander confirms whether these fields are runtime-consumed or audit-only metadata.

---

## §Q3 — title-body pressure mutation (substantive 0)

### Q3.0 — no substantive entries

Component 1 matrix classifies all 27 title-body cells as CONDITIONAL (Lock 5 spec §2.2 — pressure shift → RISKY; non-pressure clarity edit → SAFE). Phase 2 audit detected no specific edit candidate triggering pressure-shift sub-rule.

| field | value |
|---|---|
| substantive entries | **0** |
| matrix entries with classification = CONDITIONAL | 27 (Lock 5 default per spec §2.2) |
| pressure-shift candidates surfaced | **0** (no Commander-defined edit input) |
| default outcome | CONDITIONAL classification holds; SAFE-class edits (typo / grammar / clarity) routine; RISKY-class edits (pressure narrative shift) require Commander pre-approval per Lock 5 spec §3 5-invariants pre-mutation check. |

→ Q3 entries populate when Commander identifies specific title-body edit candidate; deferred until then.

---

## §Q4 — phantom lineage overlap (substantive 1) [HK4_MERGE_CANDIDATE]

### Q4.1 [REQUIRES_COMMANDER_REVIEW] [HK4_MERGE_CANDIDATE] — F1 phantom signal × 3 baseline user overlap

| field | value |
|---|---|
| phantom signal id | `patient-complaint-revised-estimate` |
| total phantom rows | **20** in `bty_arena_signals` |
| date range | 2026-03-20T18:30:08Z → 2026-04-18T18:15:51Z (29 days, pre-AL-2-A Council 2026-05-08 by 20+ days) |
| distinct users | **3** |
| user breakdown | `3c732192-...` (9 rows) · `2322beb7-...` (7 rows) · `38ce28d2-...` (4 rows) |
| baseline overlap | **3/3 phantom users ARE among 5 AL-2-D-P1 baseline users** (per AL-2-D-P1 reconciliation appendix §4.3): 3c732192 ✓ · 2322beb7 ✓ · 38ce28d2 ✓ (lock 4 active QUIETFLAME holder) |
| Path 1 27 scenarios overlap | 3 users continue to appear in Path 1 scenarios post-2026-04-28 (e.g., 38ce28d2: core_03 / core_04 / core_27 entries; 2322beb7: core_02 / core_03; 3c732192: core_01 / core_05 etc.) |
| temporal lineage | phantom 2026-03-20 → 2026-04-18; first Path 1 hit 2026-04-28 → engine version migration boundary (10-day gap); phantom users transitioned to Path 1 scenarios |
| current operational impact | 0 (phantom signal pre-dates AL-2 by 20+ days; 0 post-AL-2-D-P0 hits; historical-only) |
| historical operational impact | 20 rows in production DB use scenario_id with no JSON definition in current Path 1/2/3 enumeration; predates Lock 5 + Lock 6 issuance |
| HK4 merge rationale | (a) HK4 = 5 baseline UUID 정밀 식별 (`bty_arena_signals` oldest 5 + cross-validation); (b) phantom forensic = same 3 users + same `bty_arena_signals` enumeration sweep; (c) merge eliminates duplicate forensic methodology (history archaeology) |
| Commander review question | "Confirm HK4 + F1 phantom forensic merge: combine into single forensic sub-sprint covering (a) 5 baseline UUID provenance enumeration, (b) `patient-complaint-revised-estimate` scenario_id origin trace (engine version archaeology), (c) impact assessment of 20 historical rows on AL-2-D-P1 freeze invariants (expected: 0 impact since pre-Lock 6)." |
| default outcome | merge approved per Phase 1 reconciliation appendix §7.4 backlog handoff; HK4 sprint scope updated when issued. |

---

## §5 — Aggregate enumeration

| queue | substantive entries | aggregate / default entries | total |
|---|---:|---:|---:|
| Q1 (action_decision) | 1 (core_01 OUTLIER) | 1 (26 standard scenarios) | 2 |
| Q2 (propagation) | 0 | 0 | 0 |
| Q3 (title-body) | 0 | 0 | 0 |
| Q4 (phantom lineage) | 1 (F1 + 3 baseline overlap) | 0 | 1 |
| **total** | **2** | **1** | **3** |

→ **3 [REQUIRES_COMMANDER_REVIEW] markers** · 1 [HK4_MERGE_CANDIDATE] marker

---

## §6 — Guard P2-4 verification

Guard P2-4: "All escalation_required entries in Component 1 matrix must enumerate in Component 3 queue."

| matrix escalation_required = YES | Component 3 coverage |
|---|---|
| 27 action_decision text cells | Q1.1 (core_01) + Q1.2 (26 aggregate) — **27/27 enumerated** ✓ |
| **other** matrix cells (escalation_required = NO) | n/a |

→ **Guard P2-4 PASS** — all escalation_required cells enumerated.

---

## §7 — Closure status

| acceptance gate | status |
|---|---|
| Q1 entries (action_decision) | ✅ 2 entries (1 substantive + 1 aggregate) |
| Q2 entries (propagation) | ✅ 0 substantive (i5 INTACT 27/27); default RISKY classification preserved |
| Q3 entries (title-body) | ✅ 0 substantive (CONDITIONAL default; Commander candidate awaited) |
| Q4 entries (phantom lineage) | ✅ 1 substantive — F1 + 3 baseline user overlap [HK4_MERGE_CANDIDATE] |
| Guard P2-4 (escalation_required ↔ queue enumeration) | ✅ 27/27 covered |
| Guard P2-5 (action_decision ambiguity auto-escalation) | ✅ core_01 OUTLIER auto-escalated to Q1.1 |

→ **Component 3 logically closed.** All Commander-bound decisions enumerated; default (no-action) outcomes documented.
