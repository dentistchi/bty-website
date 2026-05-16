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
