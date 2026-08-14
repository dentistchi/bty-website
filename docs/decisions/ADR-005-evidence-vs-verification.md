# ADR-005 — Evidence vs Verification

**Status:** Accepted  
**Date:** 2026-06-25

## Context

BTY uses multiple concepts that sound similar: evidence, verification, measurement, integrity signals (AIR, LRI, patterns). AI and engineers conflate them and build "award XP on evidence display" or "skip verification because we have AIR."

## Decision

Two layers — **distinct roles**:

| Layer | Role | Examples |
|-------|------|----------|
| **Verification** | Confirms a specific real-world act **happened** and unlocks **Core XP award** | QR scan, event scan, learning proof, contract verification |
| **Evidence** | Observes and reflects **patterns and alignment** over time — does **not** by itself award Core XP | AIR bands, LRI (admin-gated raw), pattern signatures, leader readiness labels |

**Verification → Core XP (root).**  
**Evidence → reflection, gates, culture signals (derived or parallel tracks).**

Verification answers: *"Did this happen?"*  
Evidence answers: *"What does behavior over time suggest?"*

## Reason

- Mixing them lets UI "show a score" and accidentally become an award path — violating reality-as-source.
- Evidence without verification is measurement; verification without evidence is still valid for a single awarded act.
- Keeps Arena practice (scenarios, patterns) separate from Reality Engine award paths unless explicitly wired through verification.

## Consequences

- Do not award Core XP because AIR crossed a threshold unless a separate ADR and verification path exists.
- Player-facing evidence surfaces follow disclosure rules (bands, not raw inflation) — see integrity/evidence intent docs for UI scope.
- When designing Learning Engine: verification of learning ≠ evidence of learning disposition.

## Related

- Constitution Article IV (Reality Engines verify and award)  
- Boot §5 (QR as verification language — one mechanism, not the whole verification layer)  
- `docs/INTEGRITY_EVIDENCE_INTENT.md` (evidence surface scope — complementary, time-scoped)
