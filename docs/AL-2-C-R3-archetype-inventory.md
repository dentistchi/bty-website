# AL-2-C R3: 7 Archetype Semantic Inventory

**Sprint context**: AL-2-C R3 (semantic inventory)
**Date**: 2026-05-09
**Decision authority**: Hanbit Commander OR BTY Semantic Council session
**Force-map invariant**: semantic decision = R3 input 위에서; R3 = audit only

---

## §1 Source

- [bty-app/src/lib/bty/archetype/rules.ts](../bty-app/src/lib/bty/archetype/rules.ts) (Step R3.0a)
- [bty-app/src/lib/bty/archetype/selector.ts](../bty-app/src/lib/bty/archetype/selector.ts) (Step R3.0c)
- [docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §5.1-§5.7](specs/ARCHETYPE_DETERMINISM_LOCK_V1.md#5-archetype-definitions) (Step R3.0b)
- production cite: `bty_archetype_naming_locks.archetype_name` per AL-2-B Phase 1+2 baseline (Step R3.0c)

---

## §2 ⚠ Critical finding — patternRequires does NOT exist in v1

ARCHETYPE_DETERMINISM_LOCK_V1.md §4.1 invariant cite:

> v1에서 `ruleMatches`는 `AxisVector`만 평가한다. `patternFamilies`, `airBand`, `volatility`, `growthDirection`는 ruleMatches에서 직접 평가되지 않는다.

Confirmed by [rules.ts:84-91](../bty-app/src/lib/bty/archetype/rules.ts#L84-L91): `ruleMatches` iterates `rule.conditions` (axis-only), no pattern field.
Confirmed by [selector.ts:33-62](../bty-app/src/lib/bty/archetype/selector.ts#L33-L62): `selectArchetype` accepts `AxisVector` only.

**Implication**: The R3 dispatch term "patternRequires recalculation" presupposes a field that doesn't exist. The actual decision is:

- **R3.1.2 reframed**: Should AL-2-C **ADD** patternRequires to `ArchetypeRule`? (Method Y) Or preserve axis-only matching (Method X)?
  - AL-1.5 history: Method X chosen, Method Y deferred to AL-2 §10 AL2-3.
  - Pattern-based encoding currently routed via `pen()` axis penalty in `buildFingerprintInput.ts` (lossy per spec §4.1).

The "recalculation" framing only applies if Method Y is adopted. Otherwise the question is "extend `ArchetypeRule` type with new `patternRequires?` field."

---

## §3 7 Archetype Inventory Table

| # | archetype | spec § | rules.ts line | class | specificity | axis conditions | NEW_AXIS dependency | production lock |
|--:|---|---|---|---|--:|---|---|---|
| 1 | **CLEARANCHOR** | §5.2 | [21-29](../bty-app/src/lib/bty/archetype/rules.ts#L21-L29) | truth | 300 | `truth ≥ 0.70`, `accountability ≥ 0.65`, `integrity ≥ 0.65` | **truth (NEW)**, **integrity (NEW)** | — |
| 2 | **IRONROOT** | §5.3 | [30-38](../bty-app/src/lib/bty/archetype/rules.ts#L30-L38) | pressure | 300 | `authority ≥ 0.65`, `control ≥ 0.65`, `courage ≥ 0.55` | **authority (NEW)**, **control (NEW)**, courage (deferred) | — |
| 3 | **TRUEBEARING** | §5.4 | [39-47](../bty-app/src/lib/bty/archetype/rules.ts#L39-L47) | truth | 300 | `truth ≥ 0.60`, `identity ≥ 0.60`, `accountability ≥ 0.55` | **truth (NEW)**, identity (deferred) | — |
| 4 | **OPENHAND** | §5.5 | [48-55](../bty-app/src/lib/bty/archetype/rules.ts#L48-L55) | identity | 200 | `visibility ≥ 0.65`, `identity ≥ 0.65` | **visibility (NEW)**, identity (deferred) | — |
| 5 | **QUIETFLAME** | §5.6 | [56-63](../bty-app/src/lib/bty/archetype/rules.ts#L56-L63) | repair | 200 | `repair ≥ 0.60`, `truth ≥ 0.50` | **truth (NEW)** | user `38ce28d2` (pre-AL-2-B) |
| 6 | **NIGHTFORGE** | §5.7 | [64-67](../bty-app/src/lib/bty/archetype/rules.ts#L64-L67) | courage | 100 | `courage ≥ 0.65` | courage (deferred) | — |
| 7 | **STILLWATER** | §5.1 *(v1 fully specified)* | [68-76](../bty-app/src/lib/bty/archetype/rules.ts#L68-L76) | stability | 70 (explicit) | `conflict ≤ 0.40`, `repair ≤ 0.40`, `integrity ∈ [0.40, 0.70]` | **integrity (NEW)** | user `85bd8f1f` (pre-AL-2-B) |

**Type definition** ([rules.ts:11-16](../bty-app/src/lib/bty/archetype/rules.ts#L11-L16)):
```ts
export type ArchetypeRule = {
  name: string;
  archetypeClass: ArchetypeClass;
  specificity?: number; // explicit override; default = conditions.length * 100
  conditions: AxisCondition[];
};
```

**Specificity computation** ([rules.ts:80-82](../bty-app/src/lib/bty/archetype/rules.ts#L80-L82)): `rule.specificity ?? rule.conditions.length * 100`. Tie-break: alphabetical name ASC ([selector.ts:43](../bty-app/src/lib/bty/archetype/selector.ts#L43)).

---

## §4 patternRequires "Rule Matrix" — currently empty (Method X)

Per §2 finding, no archetype has `patternRequires`. The pattern→archetype encoding flows indirectly via `pen()` penalty wiring in [buildFingerprintInput.ts:24-40](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L24-L40):

| canonical pattern (active) | -0.30 penalty on axis | downstream archetype impact |
|---|---|---|
| `ownership_escape` | ownership | (no current archetype gates ownership) |
| `future_deferral` | time | (no current archetype gates time) |
| `repair_avoidance` | repair | STILLWATER (max 0.40) ↑ likelihood; QUIETFLAME (min 0.60) ↓ likelihood |
| `delegation_deflection` | conflict | STILLWATER (max 0.40) ↑ likelihood |
| `explanation_substitution` | accountability | CLEARANCHOR (min 0.65) ↓; TRUEBEARING (min 0.55) ↓ |
| `truth_naming` *(AL-2-B P1)* | truth | CLEARANCHOR ↓, TRUEBEARING ↓, QUIETFLAME ↓ |
| `integrity_compromise` *(AL-2-B P1)* | integrity | CLEARANCHOR ↓, STILLWATER (range) ↓ if pushes below 0.40 |
| `authority_protection` *(AL-2-B P1)* | authority | IRONROOT ↓ |
| `reputation_protection` *(AL-2-B P1)* | visibility | OPENHAND ↓ |
| `self_protection` *(AL-2-B P1)* | control | IRONROOT ↓ |

**Interpretation**: AL-2-B Phase 1 NEW_AXIS pen() shape change is the runtime mechanism by which patterns gate archetype matching. There is no separate "patternRequires" field; the wiring lives in `buildFingerprintInput.ts`.

---

## §5 AL-2-B alias dictionary impact

Each archetype's effective pattern coverage = canonical anchor + AL-2-B Phase 1+2 alias entries that resolve to that anchor. Coverage cite from [docs/AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv) + [bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts).

| archetype | gating axes | canonical anchors that penalize gating axis | alias entries (Phase 1+2) | total effective pattern coverage |
|---|---|---|---:|---:|
| CLEARANCHOR | truth, accountability, integrity | `truth_naming` (truth), `explanation_substitution` (accountability), `integrity_compromise` (integrity) | 7 truth + 6 accountability + 12 integrity = 25 | **3 anchors + 25 aliases = 28 families** |
| IRONROOT | authority, control, courage | `authority_protection` (authority), `self_protection` (control); courage = direct (no anchor) | 5 authority + 5 control = 10 | **2 anchors + 10 aliases + 0 courage = 12 families** |
| TRUEBEARING | truth, identity, accountability | `truth_naming`, `explanation_substitution`; identity = direct (no anchor) | 7 truth + 6 accountability = 13 | **2 anchors + 13 aliases = 15 families** |
| OPENHAND | visibility, identity | `reputation_protection` (visibility); identity = direct (no anchor) | 0 visibility (Decision V-1-A) | **1 anchor + 0 aliases = 1 family** |
| QUIETFLAME | repair, truth | `repair_avoidance`, `truth_naming` | 4 repair + 7 truth = 11 | **2 anchors + 11 aliases = 13 families** |
| NIGHTFORGE | courage | (no anchor — direct emotionalRegulation) | 0 | **0 families gated by pattern** |
| STILLWATER | conflict, repair, integrity | `delegation_deflection` (conflict), `repair_avoidance`, `integrity_compromise` | 5 conflict + 4 repair + 12 integrity = 21 | **3 anchors + 21 aliases = 24 families** |

**Aggregate**: 5 of 7 archetypes have ≥10 pattern families gating their conditions post-AL-2-B. NIGHTFORGE has 0 pattern coverage (courage axis unwired). OPENHAND has only the `reputation_protection` anchor (visibility cluster has 0 alias entries per V-1-A).

---

## §6 Semantic Decision Surface (Hanbit Commander 영역)

### §6.1 v1 archetype preserve OR redesign?

5 of 6 axes condition matrices use NEW_AXIS axes that became *meaningfully penalty-wired* in AL-2-B Phase 1. Pre-AL-2-B these axes received baseline metric directly; post-AL-2-B they can drop −0.30 when a NEW_AXIS canonical pattern is active.

- **Preserve (Lock 4 carry-forward)**: keep §5.2-§5.7 spec values. AL-2-B inactive-state proof + 24h post-deploy 0 traffic means no observed determinism shift yet. AL-1.7 ±0.05 tuning window applies.
- **Redesign**: AL-2-C reopens cutoff values per archetype. Risk: 38ce28d2 (QUIETFLAME) / 85bd8f1f (STILLWATER) production locks may drift if cutoffs shift.

### §6.2 patternRequires field — ADD or stay Method X?

- **Stay Method X** (axis-only): preserve current `ArchetypeRule` shape; pattern→archetype encoding via `pen()` only. Lossy per §4.1 ("패턴이 활성화되어 conflict가 낮음" indistinguishable from "본래 conflict 점수가 낮음").
- **Add patternRequires** (Method Y, §10 AL2-3): extend type with `patternRequires?: string[]` and ruleMatches to evaluate it. Disambiguates pattern-vs-base axis values. Requires FINGERPRINT_VERSION bump (AL-2-D).

### §6.3 axis condition matrix reflects NEW_AXIS 5?

5 of 5 NEW_AXIS axes (truth/integrity/authority/control/visibility) ALREADY appear in v1 archetype conditions:
- truth: CLEARANCHOR, TRUEBEARING, QUIETFLAME
- integrity: CLEARANCHOR, STILLWATER
- authority: IRONROOT
- control: IRONROOT
- visibility: OPENHAND

The 12-dim `AxisVector` was always defined; only `pen()` wiring was incomplete. §6.3 question = whether to ADD MORE conditions (e.g., add `truth: ≥0.X` to NIGHTFORGE), not whether to introduce new axes.

---

## §7 Production lock summary

| user_id (truncated) | locked archetype | source | drift risk under AL-2-C redesign |
|---|---|---|---|
| `38ce28d2` | QUIETFLAME | pre-AL-2-B (`bty_archetype_naming_locks` dispatch cite) | Medium — repair (≥0.60) + truth (≥0.50) gates; AL-2-B truth pen() now active |
| `85bd8f1f` | STILLWATER | pre-AL-2-B | Low — conflict/repair max gates align with AL-2-B pen() direction (lower = more match) |

Other 3 production users (`2322beb7`, `3c732192`, `ee9d2075`) have no pre-AL-2-B archetype lock per Phase 1 baseline cite.

---

## §8 Output — Hanbit Commander decision surface

3 decision questions surface per this inventory:

1. **R3.1.1**: §5.2-§5.7 v1 spec values **preserve** or **redesign** (AL-2-C scope unlock)?
2. **R3.1.2**: Method X (axis-only, current) or Method Y (add `patternRequires?` field)?
3. **R3.1.3**: Add new axis conditions to existing archetypes (e.g., visibility/control to additional archetypes)?

Decisions feed into [docs/AL-2-C-R3-decision-template.csv](AL-2-C-R3-decision-template.csv) §R3.1.* rows.
