# AL-2-C R3: courage / identity Axis 처리 방향

**Sprint context**: AL-2-C R3 (audit + option cite)
**Date**: 2026-05-09
**Decision authority**: Hanbit Commander
**Force-map invariant**: anchor lock 영역 = R3 input only; decision = Commander/Council

---

## §1 Current state (AL-2-B closure)

[buildFingerprintInput.ts:36-39](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L36-L39) post-Phase 1+2:

```ts
const axisVector: AxisVector = {
  // ... 10 pen()-wired axes ...
  courage: emotionalRegulation,  // ← direct assign, no pen()
  control: pen("self_protection", operationalBias),
  identity: TII,                  // ← direct assign, no pen()
};
```

- **courage axis**: direct assign `emotionalRegulation` (Phase 1 deferred)
- **identity axis**: direct assign `TII` (Phase 1 deferred)

Both: no `pen()` wrapper → no penalty applies even if a courage/identity-aligned pattern is active in `user_pattern_signatures`.

---

## §2 Anchor family candidate evidence

### §2.1 courage axis

**Council CSV evidence** (per [AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv)):
- Anchor candidate: **none** (Phase 2 prep cite: "courage / identity → AL-2-C scope, no high-confidence anchor")
- Cluster freq: 0 families currently mapped to courage axis in 110-row inventory
- Production family validation: 0 (none of 4 production families reference courage)

**Phase 2 enum table evidence** (per [tensionAxisToAxisVector.ts](../bty-app/src/lib/bty/archetype/tensionAxisToAxisVector.ts)):
- `Patient Autonomy vs. Retroactive Disclosure Risk` → courage (single literal, Type 1 HIGH from "Risk" keyword)
- `Self-Protection vs. Institutional Courage` → control (Set 1 lock, NOT courage despite Council member containing "Courage")
- Total enum entries mapping to courage: **1 of 47** (2.1%)

**LOW row impact** (per [AL-2-B-low-confidence-deferred.md](AL-2-B-low-confidence-deferred.md)):
- 0 LOW rows propose MERGE_INTO=courage anchor

**Archetype dependency** (per [AL-2-C-R3-archetype-inventory.md](AL-2-C-R3-archetype-inventory.md) §3):
- IRONROOT requires `courage ≥ 0.55`
- NIGHTFORGE requires `courage ≥ 0.65`
- 2 of 7 archetypes gate on courage; courage = NIGHTFORGE's sole condition

### §2.2 identity axis

**Council CSV evidence**:
- Anchor candidate: **none**
- Cluster freq: 0 families currently mapped to identity axis in 110-row inventory

**Phase 2 enum table evidence**:
- `Structural Self-Advocacy vs. Cultural Compliance` → identity (single literal, Type 1 HIGH from "Self" keyword)
- `Self-Protection vs. Clinical Ownership` → control (Set 1 lock, candidate identity rejected)
- `Self-Protection vs. Institutional Courage` → control (same)
- Total enum entries mapping to identity: **1 of 47** (2.1%)

**LOW row impact**: 0 LOW rows propose MERGE_INTO=identity anchor.

**Archetype dependency**:
- TRUEBEARING requires `identity ≥ 0.60`
- OPENHAND requires `identity ≥ 0.65`
- 2 of 7 archetypes gate on identity

---

## §3 Inactive-state proof

5 production users (`2322beb7`, `38ce28d2`, `3c732192`, `85bd8f1f`, `ee9d2075`):
- 0 user_pattern_signatures rows reference any courage- or identity-anchored family (no anchors exist).
- AL-2-B Phase 1+2 24h post-deploy traffic = 0 (paste-ready disclaimer cite).
- → courage/identity axis values = base metric (`emotionalRegulation`, `TII`) for all production users.

---

## §4 Option cite (Hanbit Commander 영역)

### Option A — pen() shape change with current metric (Lock 2 semantic additive)

Mutation:
```ts
courage:  pen("<courage_anchor>", emotionalRegulation),
identity: pen("<identity_anchor>", TII),
```

Precondition: HIGH-confidence anchor lock per axis (Commander semantic decision).

Risk:
- 0 production evidence → "implementation decides ontology" violation if anchor is invented
- forced anchor wiring → ontology drift if anchor lacks empirical scenario backing

### Option B — defer to AL-2-D (FINGERPRINT_VERSION bump)

Mutation: 0 in AL-2-C.
- Direct assign preserved.
- AL-2-D specificity matrix decides metric reassignment + version bump.

Rationale (recommended default per Phase 2 prep): anchor evidence is sparse (1 enum entry per axis, 0 production family validation). Forcing anchor wiring without semantic ground violates force-map invariant.

### Option C — pen() shape change with NEW anchor (Council-authored)

Mutation:
```ts
courage:  pen("<NEW_anchor>", emotionalRegulation),
identity: pen("<NEW_anchor>", TII),
```

Surface candidates from R3 audit (informational only — Commander semantic decision required):

For courage axis:
- No Council CSV row maps to courage. The Phase 2 enum entry (`Patient Autonomy vs. Retroactive Disclosure Risk` → courage) is sentence-level not family-level. **No family-level anchor exists in 110-row inventory.**

For identity axis:
- No Council CSV row maps to identity. Phase 2 enum entry (`Structural Self-Advocacy vs. Cultural Compliance` → identity) is sentence-level. **No family-level anchor exists in 110-row inventory.**

Per force-map invariant: Option C requires Council session to author NEW family names + scenario re-tag (AL-2-E coupling) before meaningful adoption.

---

## §5 Recommendation note (informational, not a decision)

- Production data: 0 family for either axis
- Inactive-state evidence: 0 active in 5 users
- Anchor evidence: sparse (1 enum sentence-literal per axis, 0 family-level)
- Archetype dependency: 4 of 7 archetypes gate on courage or identity (NIGHTFORGE/IRONROOT/TRUEBEARING/OPENHAND)

If courage/identity axes lack anchor wiring indefinitely:
- NIGHTFORGE: only fires when `courage ≥ 0.65` from baseline `emotionalRegulation` alone (no penalty path) → effectively easier to enter than other archetypes if metric runs high
- OPENHAND/TRUEBEARING: identity gate similarly insensitive to active patterns
- Asymmetry across 7 archetypes: 5 axes (truth/integrity/authority/control/visibility) penalty-aware, 2 axes (courage/identity) not

Most-conservative recommendation = **Option B (defer to AL-2-D)** until Council session produces family anchors with scenario coupling.

---

## §6 Decision surface → decision-template.csv

- **R3.2.1** (courage axis pen() shape): Option A | B | C — recommended **B**
- **R3.2.2** (identity axis pen() shape): Option A | B | C — recommended **B**

Cross-reference: if Commander selects Option C, AL-2-E scenario re-tag becomes a precondition (anchor needs scenario coverage before pen() wiring is meaningful).
