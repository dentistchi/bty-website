# Lock 5 Semantic Boundary Specification (V1)

**Sprint**: AL-2-E Ψ-1 sequence Step 2 (Lock 5 spec 보강)
**Mode**: Commander session output — 9 [DEFERRED_NO_CITATION] field categories classified
**Authority**: Hanbit Commander (BTY Semantic Council)
**Authoring date**: 2026-05-10
**Citation source**: Commander decision (semantic anchor: `lock5_semantic_boundary`)
**Predecessor**: [AL-2-E R3 Phase 1 Reconciliation Appendix §3.3](AL-2-E-R3-PHASE1-RECONCILIATION-APPENDIX.md), [Area 4](AL-2-E-R3-area4-lock5-protection-boundary.md)

**Inner HEAD at issuance**: `50317b8` (untouched)
**Outer HEAD at issuance**: `d896de7` (Phase 1 close lock)
**Worker active**: `e9e179ed-38a7-40ae-8f97-13cfb09191b7`

This spec resolves the 9 categories that AL-2-E Phase 1 Area 4 classified as `[DEFERRED_NO_CITATION]` (Guard E4: 추정 금지 — 명시 결정 입력 후 분류). Lock 5 boundary is now fully specified for AL-2-E Phase 2 mutation decisions.

---

## §1 — 4-tier classification system

| tier | meaning | mutation policy | invariants check |
|---|---|---|---|
| **FORBIDDEN** | structural / referential integrity field; mutation breaks runtime | NEVER edit during Lock 5 freeze; AL-2-E unlock only after schema migration | n/a (mutation forbidden) |
| **RISKY** | semantic-decision field; mutation possible but requires Commander pre-approval + 5-invariants pre-mutation check | edit only with explicit Commander authorization | 5-invariants check MANDATORY |
| **CONDITIONAL** | classification depends on edit content (sub-rules apply) | follow sub-rule path | 5-invariants check per sub-rule path |
| **SAFE** | edit-class scope — typo / grammar / locale phrasing / clarity edits | routine maintenance allowed | 5-invariants check MANDATORY (for any scenario JSON edit) |

→ All scenario JSON edits — including SAFE-class edits — MUST run the 5-invariants pre-mutation check. SAFE distinguishes the *edit class* (low-risk content), not the procedural exemption.

---

## §2 — 9 categories classified

Citation: Phase 1 Area 4 §6 [E.R3.A4.27] table — 9 [DEFERRED_NO_CITATION] field categories.

| # | field category | tier | rationale (Commander decision) | source location |
|---:|---|---|---|---|
| 1 | primary choice text (`choices[*].label` in en/ko) | **RISKY** | choice text is decision-surface; wording shift can change user interpretation of pattern direction | `bty-app/src/data/scenario/core_*/{en,ko}.json` `choices[]` |
| 2 | escalation text wording (`escalationBranches[*].escalation_text` in en/ko) | **RISKY** | escalation defines tradeoff framing; wording shift alters semantic weight | `escalationBranches[A-D].escalation_text` |
| 3 | second-choice text (`escalationBranches[*].second_choices[*].label`) | **RISKY** | second-choice carries tradeoff resolution semantic | `escalationBranches[A-D].second_choices[X,Y]` |
| 4 | action_decision text (`escalationBranches[*].action_decision.choices[*].label`, prompt) | **FORBIDDEN** (default) | action_decision text bound to `is_action_commitment` exit condition; semantic mutation breaks state-transition determinism | `escalationBranches[A-D].action_decision.{prompt, choices[].label}` |
| 5 | title / body / pressure narrative (en/ko `title`, `pressure`, body) | **CONDITIONAL** | title + body editable as SAFE (clarity/grammar); pressure-narrative changes shift difficulty/escalation semantic → RISKY | en/ko top-level `title`, `pressure` |
| 6 | `bty_tension_axis` phrasing edit (vs literal re-tag) | **RISKY** | category-swap is FORBIDDEN per Lock 5 §5.3 cite; phrasing edit is decision-surface adjacent | en/ko top-level `bty_tension_axis` |
| 7 | `dbChoiceId` literal value (base.json `structure.*.dbChoiceId`) | **FORBIDDEN** | DB referential integrity; mutation breaks `bty_arena_signals` ↔ scenario binding | `base.json` `structure.{primary, tradeoff, action_decision}.[].dbChoiceId` |
| 8 | `next_map` / state-transition graph (`incident.previousScenarioId`, `incident.nextScenarioId`) | **FORBIDDEN** | state-machine graph; mutation breaks scenario rotation chain | `base.json` `incident.{previousScenarioId, nextScenarioId}` |
| 9 | `incident.propagation.{exitEffect, entryEffect, reExposureNote}` text | **RISKY** | author-facing semantic; runtime consumption unverified ([Phase 1 Area 3 §9 outstanding](AL-2-E-R3-area3-escalation-semantic-continuity.md)); conservative RISKY pending Phase 2 verification | `base.json` `incident.propagation.*` |

### §2.1 Tier breakdown

- **FORBIDDEN (3)**: action_decision text · `dbChoiceId` · `next_map` (categories #4, #7, #8)
- **RISKY (5)**: primary choice / escalation / second-choice / `bty_tension_axis` phrasing / propagation (categories #1, #2, #3, #6, #9)
- **CONDITIONAL (1)**: title / body / pressure narrative (category #5)
- **SAFE (cross-cutting)**: typo / grammar / locale phrasing / clarity edits to RISKY-tier or CONDITIONAL-tier fields (where edit class qualifies)

### §2.2 CONDITIONAL sub-rule (category #5: title / body / pressure)

| edit class | tier | rationale |
|---|---|---|
| typo / grammar fix | SAFE (cross-cutting) | no semantic shift; clarity edit |
| translation polish (en/ko phrasing for same meaning) | SAFE (cross-cutting) | per [SCENARIO_CONTENT_GUIDELINES.md:38-39](SCENARIO_CONTENT_GUIDELINES.md) Ko optional |
| **pressure narrative change** (difficulty / escalation framing shift) | **RISKY** | pressure governs scenario tension; semantic mutation alters user response distribution |
| title rewrite that changes scenario subject | RISKY | title is identity-surface; subject change requires Commander review |

→ Default: title-body edits are SAFE unless they shift pressure-narrative semantic, in which case RISKY tier applies.

### §2.3 SAFE class scope (cross-cutting)

SAFE applies to the following edit classes within RISKY-tier or CONDITIONAL-tier fields (NEVER FORBIDDEN-tier):

- typo correction
- grammar / punctuation fix
- locale phrasing polish (en/ko parity for same semantic content)
- clarity edit (no semantic shift)

SAFE-class edits still require **5-invariants pre-mutation check** (§3 below).

---

## §3 — 5-invariants pre-mutation checklist

Before ANY scenario JSON edit (RISKY / CONDITIONAL / SAFE), the editor MUST verify all 5 AL-2-D-P1 freeze invariants are intact:

| # | invariant | verification |
|---:|---|---|
| 1 | `FINGERPRINT_VERSION = 1` (Lock 6 carry-forward) | `bty-app/src/lib/bty/archetype/buildFingerprintInput.ts` constant unchanged; no version bump |
| 2 | alias dictionary 59 entries | `bty-app/src/domain/pattern-family.ts:26-118` — entry count = 59; no add/remove |
| 3 | Lock 7 raw passthrough | `buildFingerprintInput.ts` `patternFamilies.map(p => p.pattern_family)` raw passthrough preserved |
| 4 | Lock 4 active baseline = QUIETFLAME 1 (38ce28d2) | `bty_archetype_naming_locks` — 1 active row (QUIETFLAME) + 1 superseded (STILLWATER); no new active lock |
| 5 | R3.5.2 closure (activePatterns Set normalization) | `buildFingerprintInput.ts:23` `normalizePatternFamilyId` applied at activePatterns Set construction |

**FAIL on any invariant** → mutation forbidden until invariant restored or Commander explicitly authorizes deviation (which would be a Lock 6 / Lock 7 / Lock 4 boundary discussion, not a Lock 5 issue).

---

## §4 — Determinism rationale

Any scenario JSON edit changes `input_hash` for users whose Arena run touched the edited scenario (per [AL-2-D-P1-R3-HK-deprecate-low-row-status.md:117](AL-2-D-P1-R3-HK-deprecate-low-row-status.md)). The 4-tier classification therefore acts as a *risk gradient* on identity continuity:

- **FORBIDDEN**: input_hash mutation = guaranteed identity break (DB referential / state graph / commitment exit)
- **RISKY**: input_hash mutation = potential semantic drift; requires Commander review of impact
- **CONDITIONAL**: depends on edit's pressure-narrative shift potential
- **SAFE**: input_hash mutation = clerical only; semantically equivalent (same scenario decision, polished surface)

→ Lock 5 + Lock 6 (`FINGERPRINT_VERSION = 1`) operate as paired protections. Lock 5 governs *what* can be edited in scenario JSON; Lock 6 governs *whether* the resulting identity-continuity break warrants a version bump (default: NO bump per AL-2-D-P1 close decision).

---

## §5 — Mutation procedure (post-Lock 5 unlock)

Phase 2 audit (Step 3 of Ψ-1 sequence) deep-audits Path 1 (27 scenarios). Mutation phase (separate dispatch, post-Phase 2):

1. **Pre-mutation** — verify 5 invariants (§3); identify edit category (§2); classify edit class for CONDITIONAL fields (§2.2)
2. **Authorization** — RISKY edits require Commander pre-approval; FORBIDDEN edits require Lock 5 unlock decision (separate Council session)
3. **Edit** — apply mutation to base.json or en/ko.json; respect `dbChoiceId` immutability
4. **Verification** — re-run 5-invariants check (§3); confirm no Path 1 ↔ Path 2 binding break (`resolveCanonicalBindingForEliteId()`)
5. **Identity-continuity decision** — assess `input_hash` change impact; if breaking, escalate to Lock 6 review; otherwise document as SAFE-class clerical drift

---

## §6 — Lock 5 explicit citations carried forward

From Phase 1 Area 4:

| original cite | scope | status post-this-spec |
|---|---|---|
| `AL-2_SPRINT_CLOSURE.md:126` (Lock 5 definition) | scenario JSON re-tag deferred | **PRESERVED** — re-tag remains forbidden; this spec governs *content* edits, not category re-tag |
| `AL-2_SPRINT_CLOSURE.md §5.3` (`bty_tension_axis` literal re-tag) | category swap | **PRESERVED** — literal re-tag remains FORBIDDEN; phrasing edit (same category) classified RISKY (category #6 above) |
| `AL-2-D-P1-R3-archetype-determinism-trace.md:147` (`pattern_family` Lock 5) | pattern_family literals | **PRESERVED** — pattern_family literals remain FORBIDDEN (this spec does not extend Lock 5 to mutate canonical literals) |
| `AL-2-D-P1-R3-HK-deprecate-low-row-status.md:117` (input_hash determinism) | any scenario JSON edit changes input_hash | **PRESERVED** — determinism rationale is the foundation of §4 |
| `AL-2-D-P1-R3-HK-compat-map-deletion-trace.md:61` (export aggregator NOT in Lock 5) | TS export aggregator | **PRESERVED** — TS files (`bty-app/src/data/scenario/index.ts`) outside Lock 5 scope; this spec governs JSON-side only |
| `SCENARIO_CONTENT_GUIDELINES.md:23-26` (numericStructure MUTABLE) | numericStructure block | **PRESERVED** — numericStructure remains explicit MUTABLE; not re-classified by this spec |
| `SCENARIO_CONTENT_GUIDELINES.md:38-39` (Ko optional) | Ko locale phrasing | **PRESERVED** — Ko optional remains MUTABLE |

→ This spec is **additive only** to existing Lock 5 citations; no override / repeal.

---

## §7 — AL-2-D-P1 freeze invariants verification

This spec is documentation-only; mutation count = 0 to scenario JSON / alias dict / archetype rules / fingerprint logic.

| invariant | status |
|---|---|
| FINGERPRINT_VERSION = 1 | ✓ PRESERVED |
| alias dictionary 59 entries | ✓ PRESERVED |
| Lock 7 raw passthrough | ✓ PRESERVED |
| Lock 4 active baseline = QUIETFLAME 1 | ✓ PRESERVED |
| R3.5.2 closure | ✓ PRESERVED |

→ **5/5 PRESERVED**. This spec issuance does not perturb runtime.

---

## §8 — Phase 2 entry condition

Per [AL-2-E R3 Phase 1 Reconciliation Appendix §7](AL-2-E-R3-PHASE1-RECONCILIATION-APPENDIX.md):

| step | status |
|---|---|
| Step 1 (Phase 1 audit + commit) | **CLEAN CLOSE** (outer `d896de7`) |
| Step 2 (Lock 5 spec 보강 — this doc) | **CLEAN CLOSE** (this commit) |
| Step 3 (Phase 2 audit, Path 1 27-scenario deep audit) | **ENTRY CONDITION MET** — awaiting Commander dispatch |

→ Phase 2 audit may proceed with Lock 5 boundary fully classified. Mutation phase (separate dispatch post-Phase 2) follows §5 procedure.

---

## §9 — Cross-references

- [AL-2-E R3 Phase 1 Reconciliation Appendix](AL-2-E-R3-PHASE1-RECONCILIATION-APPENDIX.md) — Phase 1 closure synthesis
- [AL-2-E R3 Area 4 — Lock 5 protection boundary](AL-2-E-R3-area4-lock5-protection-boundary.md) — original 9-category enumeration
- [AL-2_SPRINT_CLOSURE.md](AL-2_SPRINT_CLOSURE.md) §4.1 — Lock 5 / Lock 6 carry-forward
- [AL-2-D-P1-R3-RECONCILIATION-APPENDIX.md](AL-2-D-P1-R3-RECONCILIATION-APPENDIX.md) — AL-2-D-P1 close & 5 invariants
- [SCENARIO_CONTENT_GUIDELINES.md](SCENARIO_CONTENT_GUIDELINES.md) — author-facing summary (this spec link target)
