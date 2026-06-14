# BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md  (v1.0)

> Status: Commander-APPROVED (3 revisions applied). Authority on repo materialize.
> Scope: Governs the Character / Axis architecture split. Procedural + factual record only.
> This document does NOT define axis meanings (Layer 1 Canon body = Commander authorship, separate doc).
> "Locked" = session-locked decision. "Downstream / NOT locked" = explicitly deferred.

---

## 0. Purpose

Stop taxonomy drift. During design, three mutually-incompatible "12-axis/character" proposals
appeared in one session (engine-distortion axes / growth-virtue avatars / scenario tags).
This document locks the separation that resolves them, and records the verified production
substrate so no future work rebuilds Canon on a phantom or dead foundation.

The single most important outcome of this lock is one line:
**Avatar ≠ Axis ≠ Axis Actor.**

---

## 1. Three-Layer Separation (LOCKED)

The word "character" was overloaded across incompatible meanings. It is split into three layers.

| Layer | Name | What it is | Source / substrate | Used for |
|-------|------|-----------|--------------------|----------|
| **Layer 1** | **Engine Axis Canon** | 12 leadership decision-distortion axes | `AxisVector` (12 keys) derived from `pattern_family` | scenarios, pattern detection, QR / Action Contract, re-exposure, Layer 3 placement |
| **Layer 2** | **Avatar Roster** | User-selected self-expression characters (cosmetic) | existing `avatarCharacters.ts` roster + outfits/accessories | user identity, appearance, items, companion |
| **Layer 3** | **Scene NPC Role (Axis Actor)** | pressure-actors appearing in landscape scenario scenes | MUST be based on Layer 1 Axis Canon | scenario dramatization |

Hard rule: Layer 1 (Axis) and Layer 2 (Avatar) are different namespaces and must never be merged.
Layer 3 (Axis Actor) draws from Layer 1, never from Layer 2.

---

## 2. Commander Locks

### LOCK-1 — Axis Canon = engine-distortion taxonomy
The 12-axis Canon is the engine decision-distortion set (Version A).
The growth-virtue roster (Scout / Guardian / Mage / Healer …) is NOT Axis Canon; it is Layer 2 cosmetic.

### LOCK-2 — "Character" word split
- **Avatar** = user-selected self-expression character (Layer 2).
- **Axis Actor** = in-scenario pressure-dramatization NPC (Layer 3).
These two are distinct concepts and must be named distinctly in all specs/code/docs.

### LOCK-3 — MBTI excluded from Canon
MBTI mapping is excluded from Canon. It may exist later only as an optional onboarding-resonance layer,
never as Layer 1 substrate or axis definition.

### LOCK-D-FIELD — Canon derives from the live fingerprint path
Layer 1 Axis Canon is derived from the production path:
`pattern_family → normalizePatternFamilyId → AxisVector(12)`.
The legacy `axis` field is non-canonical for Layer 1 / Axis Actor / QR / Action Contract / Character Layer.
Do NOT build Canon on `axis`. Do NOT revive `axis`.

---

## 3. Verified Production Substrate (factual — STEP 0 / 0B / 0C, HEAD cdf028ff)

### 3.1 AxisVector — Layer 1 substrate (12 keys)
`ownership, time, authority, truth, repair, conflict, integrity, visibility, accountability, courage, control, identity`
Defined: `fingerprint.ts:6-18`. Display labels = Title Case. `Courage-Risk` = description label only; key = `courage`.

### 3.2 Live path (single source of truth)
- `pattern-family.ts:5-11` `CANONICAL_PATTERN_FAMILIES` (the original 5).
- `pattern-family.ts:26-118` `PATTERN_FAMILY_ALIAS` (~60-entry exact dict).
- `pattern-family.ts:120-129` `normalizePatternFamilyId` = pure dictionary resolver, **no substring/keyword fallback**.
- `buildFingerprintInput.ts:33-46` derives AxisVector via exact trigger literals (reads `pattern_family` only).
- Coverage: of 111 distinct `pattern_family`, **69 CLAIMED / 42 UNCLAIMED** (passthrough, zero AxisVector effect).

### 3.3 Current Pattern-Derived Axis Triggers
NOTE: These 10 triggers are the *current pattern-derived supply* into the 12-axis Canon — NOT the 12 axes
themselves. The 12-axis Canon is the authority; today 10 axes are fed by pattern_family triggers, and
courage / identity are fed from other substrates (see §3.4). Trigger count ≠ axis count.

`ownership_escape→ownership · future_deferral→time · authority_protection→authority · truth_naming→truth ·
repair_avoidance→repair · delegation_deflection→conflict · integrity_compromise→integrity ·
reputation_protection→visibility · explanation_substitution→accountability · self_protection→control`

### 3.4 Truths the Axis Canon body MUST state (honesty clauses)
1. **5-vs-10 canonical split.** Action-contract persistence gates on canonical-5 (`isCanonicalPatternFamily`,
   `recordPatternSignal.ts:26`); fingerprint uses 10 trigger literals (5 + Phase-2 five). Different gates.
2. **courage & identity are not currently pattern-derived.** At the time of this lock, courage and identity
   are NOT derived from scenario `pattern_family` data. Current implementation:
   `courage ← emotionalRegulation`, `identity ← TII` (`buildFingerprintInput.ts:43,45`).
   The Canon requires explicit documentation whenever these axes are sourced from non-pattern substrates.
   (Current implementation ≠ permanent definition; Canon is above implementation.)
3. **Coverage asymmetry.** Strong: repair/time/truth/conflict/accountability/integrity/ownership/authority.
   Weak: control; **visibility (2 families only)**. None (pattern): courage, identity (currently metric-sourced).

### 3.5 `axis` field caveat (do not overstate "dead")
`axis` is non-canonical for AxisVector / fingerprint / QR / Action Contract (verified, STEP 0C §E).
But it is NOT globally dead — it is a live **secondary fallback matcher** in re-exposure validation
(`reexposureValidation.server.ts:64,225`) and a **display value** in the pattern-signature panel.
Therefore: "not used for Layer 1 Canon" is correct; "delete / revive `axis`" is out of scope (touches live consumers).

---

## 4. Naming Collision Warning (Layer 3, advisory — NOT yet locked)
7 of the 12 proposed Axis-Actor names already exist as LIVE archetype identities in `rules.ts` RULE_REGISTRY,
scored against AxisVector thresholds and consumed by `selector.ts` / `computeLeadershipState.ts` /
lock RPC migrations / 100+ tests:
`STILLWATER, QUIETFLAME, IRONROOT, CLEARANCHOR, TRUEBEARING, OPENHAND, NIGHTFORGE`.

Status: **RESERVED — DO NOT REUSE WITHOUT EXPLICIT COMMANDER DECISION.**
These names occupy a live scored namespace (archetype). A future Commander decision MAY unify
archetype = Axis Actor (e.g. QUIETFLAME as both), or keep them separate — that is a Layer 3 design choice.
Until that decision, treat as a reserved namespace: do not silently repurpose.
Unused / free: `STORMWALKER, LIGHTKEEPER, SYSTEMSMITH, DAWNSTRIKE, ARCHETYPE_ONE`.

---

## 5. Downstream Work Order (NOT locked — sequence only)
1. (a) `pattern_family → AxisVector` coverage table — factual transcription (this-chat authorable).
2. (b) unclaimed-42 Commander decision table — skeleton this-chat; **verdict body = Commander**.
3. 12 Axis Canon body (axis definitions, entry/exit meaning, pressure narrative) = **Commander authorship**.
4. Claude Code materialize approved bodies → commit / push / authority lock.

### Parked (out of current scope — retained here for the lock's own history)
These four are all discoveries OF this session; kept in-document so the reason this lock exists is not lost.
- `AxisGroup` type (3 keys) omits `Integrity` while data emits it (`types.ts:3` vs `core_10/base.json:9`) — type drift, code hygiene.
- 2-canonical discrepancy: `pattern_signals` (5-gated) vs `user_pattern_signatures` (ungated upsert reaches AxisVector) — Canon note or hygiene item.
- legacy `archetype` field (avoid/structure/confront) ≠ RULE_REGISTRY — word-overload note.
- Layer 3 visibility/courage/identity cannot be dramatized from scenario pattern data (metric/weak coverage) — Layer 3 design must handle separately.

---

*Authored: this-chat dispatch author (NON-MUTATING). Commander-approved; authority on repo materialize.*
*Source evidence: STEP 0 / 0B / 0C read-only inventories, HEAD cdf028ff.*
