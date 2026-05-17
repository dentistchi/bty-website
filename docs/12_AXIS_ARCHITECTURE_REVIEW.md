# 12-Axis Architecture Review

Measurement record produced by the 12-AXIS-ARCHITECTURE-REVIEW track (Phase 1: 12AXIS-1).

---

## 1. Purpose

The 12-AXIS-ARCHITECTURE-REVIEW track is an **observability-first, measurement-first**
review of the 12-Axis runtime semantics. It absorbs, under a single ownership, the
divergence surfaces formerly grouped as R2-b candidates (#1, #4, #5) together with the
R2-a residue (#2).

**Non-goals:** rewrite, proposal, and normative semantics change are out of scope. Phase 1
records scope, freeze verification, and ownership only.

**Archival note:** the label "R2-b" is retained as an archival reference only. No
independent R2-b track is opened; its candidates are now workstreams of this track.

---

## 2. Baseline (measurement time)

Each repository is judged independently.

| repo | HEAD | branch | working tree | origin ahead/behind |
|------|------|--------|--------------|---------------------|
| outer | `44c9d6f` | `main` | CLEAN | 0 / 0 |
| inner (`bty-app/`) | `ec42eba1` | `inner-main` | CLEAN | — |

---

## 3. Runtime invariants freeze (R2-b precondition)

The precondition recorded at R2-b inception is a "runtime invariants freeze." Phase 1
verified its four components by measurement. All four are intact.

| # | invariant | measured state | freeze |
|---|-----------|----------------|--------|
| #28 | `accountability_system` KEEP | live literal in `core_27_identity_repair_commitment/{ko,en}.json`; not present in `pattern-family.ts` (canonical/alias); retained, not pruned | INTACT |
| Lock 7 | raw passthrough | `buildFingerprintInput.ts:50` — `patternFamilies: patterns.map((p) => p.pattern_family)` raw map preserved | INTACT |
| Lock 5 | scenario JSON freeze | `LOCK_5_SEMANTIC_BOUNDARY_SPEC.md` present; recent `src/data/scenario` commits touch only the export aggregator `index.ts`, not scenario JSON content | INTACT |
| FINGERPRINT_VERSION | version stamp | `fingerprint.ts:3` — `= 1 as const`; no bump | INTACT |

All four freeze components are intact at measurement time; no variance observed. The
R2-b precondition is satisfied.

---

## 4. Freeze boundary

Runtime semantics surfaces not touched during Phase 1, with the protection basis for each.

| surface | location | protection basis |
|---------|----------|------------------|
| pen() wiring + axisVector 12 fields | `buildFingerprintInput.ts:30-46` | Lock 7 (`patternFamilies` field) |
| axisVector values / inputHash | `buildFingerprintInput.ts`, `fingerprint.ts:53-78` | FINGERPRINT_VERSION freeze (5-invariant #1) |
| canonical 24-row table | `BTY_12_CORE_AXIS.md:144-169` | R2 freeze; §NOTES "no axis remapping authority" |
| `CANONICAL_PATTERN_FAMILIES` | `pattern-family.ts:5-11` | `ENGINE_ARCHITECTURE_V1.md §5`, `PATTERN_ACTION_MODEL_V1.md §2` |
| `PATTERN_FAMILY_ALIAS` | `pattern-family.ts:26-118` | SCENARIO_CONTENT_GUIDELINES 5-invariant #2 |
| `RULE_REGISTRY` | `rules.ts:19-78` | Archetype Determinism Lock v1 |
| scenario JSON content | `src/data/scenario/**` | Lock 5 |

Semantic subtraction, where it is in scope for any later phase, is residency-gated by
`RESIDENCY_VALIDATION_PROCEDURE.md` (9e21fb5). Phase 1 performs no subtraction. All Phase 1
steps were read-only; the freeze boundary was not crossed.

---

## 5. Workstream ownership map

### WS-1 — cross-axis pen() mapping divergence (former R2-b #1)
- **Location.** `buildFingerprintInput.ts` axisVector, two entries:
  - L39 `conflict: pen("delegation_deflection", operationalBias)` — the conflict axis
    (Axis 6) is penalized by `delegation_deflection`, which the 24-row table assigns to
    Axis 3 Authority (exit, canonical).
  - L42 `accountability: pen("explanation_substitution", AIR)` — the accountability axis
    (Axis 9) is penalized by `explanation_substitution`, which the table assigns to Axis 4
    Truth (exit, canonical).
- **R2-a coverage.** Not measured under R2-a (R2-a covered #3 and #2). WS-1 is an
  unmeasured surface.
- **Dependency.** Same file and adjacent lines as WS-2 (axisVector block). Thematically
  adjacent to WS-5 (both concern "accountability" semantics, at different layers — WS-1 at
  axisVector pen() wiring, WS-5 at scenario JSON axis tagging).

### WS-2 — courage / identity pattern-runtime non-linkage (R2-a residue #2)
- **Status: measurement-complete / reuse-only.** Measured under R2-a Phase 2 (provenance,
  dependency surface, fingerprint impact, invariant preservation) and recorded in
  `BTY_12_CORE_AXIS.md §NOTES`. This track holds ownership for the residue; the R2-a
  Phase 2 measurement output is reused and is not re-measured.
- **Location.** `buildFingerprintInput.ts:43` `courage: emotionalRegulation`, `:45`
  `identity: TII` (pen()-bypass).

### WS-4 — scenario JSON axis-tag drift (former R2-b #4)
- **Location.** `"axis"` tags in `src/data/scenario/**` JSON. Measured axis-tag varieties
  outside the canonical 12 fall into three classes:
  - **Non-canonical labels (~21):** `belonging`, `Documentation`, `System`,
    `transferability`, `system_identity`, `scalability`, `Image`, `Comfort`,
    `self_correction`, `correction`, `consistency`, `Support`, `Self-Protection`,
    `Reputation`, `Explanation`, `Compliance`, `awareness`, `system_integrity`,
    `system_inheritance`, `system_correction`, `scaling_integrity`.
  - **Case-drift (2):** `integrity`, `truth` (lowercase variants of canonical names).
  - **Format-drift (5):** `"Axis 1 — Ownership"`, `"Axis 2 — Time"`,
    `"Axis 3 — Authority"`, `"Axis 9 — Accountability"`, `"Axis 4 — Truth"`.
  - Total ≈ 28 drift varieties.
- **R2-a coverage.** Not measured under R2-a.
- **Dependency.** WS-5 is a sub-case of WS-4 (WS-5 ⊂ WS-4).

### WS-5 — accountability_system doc conflict (former R2-b #5)
- **Location.** `core_27_identity_repair_commitment/{ko,en}.json` tags
  `pattern_family: "accountability_system"` with `"axis": "Repair"`, while
  `BTY_12_CORE_AXIS.md:162` assigns `accountability_system` to Axis 9 Accountability. The
  conflict is documented in `BTY_12_CORE_AXIS.md §NOTES` (α-1c Task B) and the 🟡 detail.
- **R2-a coverage.** Not measured under R2-a; the conflict's existence is recorded in
  §NOTES.
- **Dependency.** Sub-case of WS-4. Coupled to invariant #28 (`accountability_system`
  KEEP) — the KEEP state is the preservation state of this conflict.

---

## 6. Workstream dependency graph

```
WS-1 ─┬─ same file (buildFingerprintInput axisVector) ─┬─ WS-2 (measurement-complete, reuse-only)
      │
      └─ "accountability" theme adjacency ── WS-5 ⊂ WS-4 (scenario JSON axis tags)
```

Two surface classes:
- **code-side** — WS-1, WS-2 (`buildFingerprintInput.ts` axisVector).
- **data-side** — WS-4, WS-5 (`src/data/scenario/**` JSON axis tags).

WS-2 is measurement-complete; this track carries its ownership for Verdict input only.

---

## 7. Subsequent phase structure

| phase | batch | scope |
|-------|-------|-------|
| 12AXIS-2A | code-side | WS-1 measurement |
| 12AXIS-2B | data-side | WS-4 + WS-5 taxonomy measurement |

WS-4 mutation is not discussed before WS-1 measurement is complete. WS-4/WS-5 begin with
taxonomy measurement. Semantics normalization is not undertaken before a Verdict.

Phase 1 records scope and ownership only. Subsequent-phase scopes above are expected
ranges, not measurement execution.

---

## 8. Freeze

> Phase 1 does not enter rewrite or proposal. Normative semantics are not changed before a
> Verdict.

This document records what the review covers and who owns each workstream. It does not
design or recommend any change to the 12-Axis runtime semantics.

---

## WS-1 Measurement (Evidence-Only)
Provenance measurement of the two cross-axis pen() mappings in buildFingerprintInput.ts
axisVector (L39 conflict ← delegation_deflection, L42 accountability ←
explanation_substitution). No divergence character decided; this is Verdict input.

### Provenance
- Both lines reached their current form in commit 52f784c9 (2026-05-02, outer authoritative
  history). The inner repo history is flattened by the 2026-05-14 filter-repo rewrite.
- At introduction, the code canonical model already treated delegation_deflection as the
  conflict-axis family and explanation_substitution as the accountability-axis family —
  pattern-family.ts carries explicit comments to this effect, and buildFingerprintInput.ts
  is consistent with pattern-family.ts. Code internal self-consistency confirmed: this is
  not a single-file cross-map.
- The doc-named same-axis families (conflict_avoidance, accountability_deflection) are not
  independent canonical families: conflict_avoidance is an alias, accountability_deflection
  is absent from pattern-family.ts at introduction and now.
- Design-intent for the axis assignment is not stated in buildFingerprintInput.ts inline
  comments; pattern-family.ts carries a code-layer axis↔family declaration; specs confirm
  the family ids as canonical but do not name an axis.

### Nature of the divergence
- The divergence is a doc↔code axis-assignment divergence: the 24-row table assigns
  delegation_deflection to Axis 3 (Authority) and explanation_substitution to Axis 4
  (Truth), while the code assigns them to the conflict and accountability axes.
  "Cross-axis" is a relative label measured against the 24-row table.

### Fingerprint impact (S-A / S-B)
- pen() wiring (L39/L42) is an S-B surface — it produces live axisVector numeric values.
- doc-table conformity is an S-A surface.
- doc relabel does not reach runtime delta: relabelling the 24-row table leaves axisVector
  unchanged. Only a change to the code wiring alters axisVector (S-B).
- Downstream: conflict and accountability axes are both RULE_REGISTRY rule inputs; the
  penalty reaches ruleMatches/ruleScore, confined to the archetype subsystem (per R2-a
  Phase 2 — leaderboard / XP unaffected).

### Invariant preservation
- Collision ZERO: invariant #28 (accountability_system is a scenario-JSON literal on a
  separate layer; the axisVector field name "accountability" is an incidental lexical
  overlap), the 24-row table / CANONICAL_PATTERN_FAMILIES / RULE_REGISTRY (untouched by a
  wiring change), 7-step canonical.
- FINGERPRINT_VERSION = a potential collision surface only if the code wiring (S-B) is
  changed. Lock 7 = an adjacent surface (same file), not a confirmed collision.

WS-1 provenance measurement-complete. No mutation, no canonicalization, no proposal.

---

## WS-4 / WS-5 Measurement (Evidence-Only)
Taxonomy measurement of scenario-JSON axis-tag drift (WS-4) and the accountability_system
case (WS-5, a WS-4 sub-case). No divergence character decided; this is Verdict input.

### WS-4 — drift taxonomy
- Scenario JSON corpus: 27 directories (core_01–27), 81 files. The "axis" tag appears at
  choice-level and step-level.
- Three observed groups: ~21 genuine non-canonical labels, 2 case-variant labels
  (lowercase integrity / truth), 5 format-variant labels ("Axis N — Name").
- Among the ~21 genuine non-canonical labels, 4 are lexically close to a code anchor or
  family (Self-Protection / Explanation / Reputation / Compliance); ~17 have no lexical
  correspondent in the 12 canonical axes or code anchors.
- Case variants are file-consistent: no within-file mixing of integrity/Integrity or
  truth/Truth. The variation is between authoring batches, not within a file.
- Format variants originate in the initial commit (fa0b86d6) and appear in
  core_01 (en.json uses "Axis N — Name", ko.json uses bare canonical names).
- Higher taxonomy count is recorded as a measured fact; it is not read as a defect.

### WS-4 — runtime reach
- buildFingerprintInput does not read p.axis; it consumes pattern_family only. The
  scenario-JSON axis tag reaches pen() / axisVector / fingerprint / archetype with zero
  reach. Axis tag changes do not currently affect fingerprint/archetype runtime.
- The axis tag is runtime-carried (binding snapshot → DB pattern_signatures → fetch) and
  is read by the re-exposure same-axis guard, which compares strings for equality. The
  guard depends on label self-consistency, not on canonical membership — the label value
  does not change guard correctness.
- The axis tag is therefore runtime-neutral for both fingerprint and the re-exposure
  guard. This is an S-A (semantic / documentation) surface.

### WS-5 — accountability_system
- accountability_system appears in core_27 only (2 files), as a pattern_family literal
  18 times; all 18 instances carry axis: "Repair".
- WS-5 is a 2-party divergence: scenario JSON axis "Repair" vs the doc 24-row table
  (Axis 9, Accountability). No code-canonical anchor currently exists for
  accountability_system (it is absent from pattern-family.ts), so the 3-party
  (code / doc / wiring) frame used for WS-1 does not fully apply.
- accountability_system is a non-pen()-matching literal; its axisVector contribution is
  zero.
- invariant #28 (accountability_system KEEP) is INTACT — the literal is preserved
  (18 occurrences). This measurement is read-only and does not touch the #28 freeze.

### Invariant preservation
- Lock 5 (scenario-JSON freeze) is a potential mutation-sensitive surface — the axis tag
  is scenario-JSON content. No collision is active; Phase 2B performs no scenario-JSON
  edit.
- Collision ZERO: FINGERPRINT_VERSION (axis tag does not reach fingerprint), Lock 7,
  pen() wiring, the 24-row table, CANONICAL_PATTERN_FAMILIES, the alias map, RULE_REGISTRY.
- invariant #28 is an adjacent surface for WS-5 (a hypothetical axis-tag change is not the
  removal of the family literal), not a confirmed collision.

WS-1 / WS-2 / WS-4 / WS-5 measurement is complete. The 12-Axis Architecture Review is at
a measurement-complete pause; the Verdict phase is not entered. No mutation, no
canonicalization, no proposal.
