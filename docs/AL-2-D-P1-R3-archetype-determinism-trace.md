# AL-2-D-P1+ R3 — Archetype Determinism Trace (Area 1)

**Sprint**: AL-2-D-P1+ R3 (Identity Continuity Verification)
**Date (issuance)**: 2026-05-09
**Mode**: read-only inventory (Guard 1-4 applied)
**Authoritative HEAD at issuance**: Inner `50317b8` / Outer `3b1eb39`

---

## §1 Scope

Trace the determinism chain from input vector → SHA-256 `inputHash`, identify every site where `FINGERPRINT_VERSION` enters the chain, and enumerate the divergence points where a `V=1 → V=2` bump produces a different `inputHash` for the same upstream user state.

Identity chain reference (dispatch reframe):
> Core XP / archetype / Lock 4 / Identity axis (pattern_family + axis 결합) / re-exposure validation / pattern continuity

---

## §2 FINGERPRINT_VERSION reference inventory

`grep -rn "FINGERPRINT_VERSION" bty-app/src/` (10 hits across 4 files):

| # | site | file:line | role |
|--:|---|---|---|
| 1 | declaration | [bty-app/src/lib/bty/archetype/fingerprint.ts:3](../bty-app/src/lib/bty/archetype/fingerprint.ts#L3) | `export const FINGERPRINT_VERSION = 1 as const;` |
| 2 | type re-export | [bty-app/src/lib/bty/archetype/fingerprint.ts:56](../bty-app/src/lib/bty/archetype/fingerprint.ts#L56) | return-type carrier `version: typeof FINGERPRINT_VERSION` |
| 3 | **canonical hash mix** | [bty-app/src/lib/bty/archetype/fingerprint.ts:71](../bty-app/src/lib/bty/archetype/fingerprint.ts#L71) | `v: FINGERPRINT_VERSION` inside the canonical object that is JSON-stringified and SHA-256-hashed |
| 4 | return value | [bty-app/src/lib/bty/archetype/fingerprint.ts:77](../bty-app/src/lib/bty/archetype/fingerprint.ts#L77) | passes version to caller |
| 5 | barrel re-export | [bty-app/src/lib/bty/archetype/index.ts:1](../bty-app/src/lib/bty/archetype/index.ts#L1) | `export { ..., FINGERPRINT_VERSION } from "./fingerprint";` |
| 6 | service import | [bty-app/src/lib/bty/archetype/lockService.ts:3](../bty-app/src/lib/bty/archetype/lockService.ts#L3) | imports for RPC payload |
| 7 | **RPC payload field** | [bty-app/src/lib/bty/archetype/lockService.ts:211](../bty-app/src/lib/bty/archetype/lockService.ts#L211) | `p_fingerprint_version: FINGERPRINT_VERSION` written to lock row |
| 8 | test import | [bty-app/src/lib/bty/archetype/fingerprint.test.ts:2](../bty-app/src/lib/bty/archetype/fingerprint.test.ts#L2) | test fixture |
| 9 | test invariant | [bty-app/src/lib/bty/archetype/fingerprint.test.ts:106](../bty-app/src/lib/bty/archetype/fingerprint.test.ts#L106) | asserts `result.version === FINGERPRINT_VERSION` |
| 10 | test invariant | [bty-app/src/lib/bty/archetype/fingerprint.test.ts:107](../bty-app/src/lib/bty/archetype/fingerprint.test.ts#L107) | asserts `JSON.parse(canonicalForm).v === FINGERPRINT_VERSION` |

**Determinism-affecting sites (V change → hash change)**:
- Site 3 ([fingerprint.ts:71](../bty-app/src/lib/bty/archetype/fingerprint.ts#L71)) — sole hash mix point.
- Site 7 ([lockService.ts:211](../bty-app/src/lib/bty/archetype/lockService.ts#L211)) — sole DB persistence point (column `fingerprint_version`).

Sites 1, 2, 4, 5, 6, 8-10 are passive references (declaration / re-export / type / test) and do **not** independently affect the hash output.

---

## §3 Hash chain trace map

The chain from observable user state → `inputHash`:

```
ArenaSignal[]                           UserPatternSignaturePublic[]
  │                                       │
  │  computeMetrics()                     │
  ▼                                       ▼
LeadershipMetrics                       patterns[].pattern_family (raw)
  AIR / TII /                             │
  relationalBias /                        │
  operationalBias /                       │
  emotionalRegulation                     │
  │                                       │
  └──────► buildFingerprintInput() ◄──────┘
              [bty-app/src/lib/bty/archetype/buildFingerprintInput.ts]
              │
              │   activePatterns Set construction (line 27-29):
              │     ↳ normalizePatternFamilyId(p.pattern_family) ?? p.pattern_family
              │     ↳ .toLowerCase()
              │     ↳ Set dedup
              │   pen() lookup (line 30-31):
              │     ↳ canonical-literal keys ("ownership_escape", "future_deferral", ...)
              │   AxisVector assembly (line 33-46):
              │     ↳ 12 axes; courage / identity un-pen()
              │   FingerprintInput emission (line 48-53):
              │     ↳ axisVector
              │     ↳ patternFamilies = patterns.map(p => p.pattern_family)   [RAW, not aliased]
              │     ↳ scenariosCompleted, contractsCompleted
              ▼
          buildArchetypeFingerprint()
              [bty-app/src/lib/bty/archetype/fingerprint.ts:53]
              │
              │   normalize axis (line 58-62):
              │     ↳ keys sorted alphabetically
              │     ↳ truncate(x): floor(clamp01(x) * 100) / 100
              │   normalize patterns (line 64):
              │     ↳ patternFamilies.map(toLowerCase) → Set → sort
              │   canonical object (line 66-72):
              │     ↳ { axis, patterns, s, c, v: FINGERPRINT_VERSION }   ◄── VERSION MIX
              │   JSON.stringify (line 74)
              │   SHA-256 (line 75)
              ▼
          inputHash + canonicalForm + version
              │
              ▼
          lockService.resolveArchetypeForUser()
              [bty-app/src/lib/bty/archetype/lockService.ts]
              │
              │   (A) findActiveLockByHash(user_id, inputHash) → cached_match terminal
              │   (B) findCurrentActiveLock(user_id) → supersede target
              │   (C) checkTransitionEligibility() → transition_blocked terminal
              │   (D) selectArchetype(axisVector) → name + class + candidatePool
              │   (E) RPC bty_create_archetype_lock(p_fingerprint_version, ...)
              ▼
          bty_archetype_naming_locks row
              [bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql]
              columns: input_hash, fingerprint_version (smallint default 1),
                       archetype_name, input_snapshot (jsonb), superseded_at
```

---

## §4 Version-change divergence points (V=1 → V=2)

[D-P1.R3.A1.1] divergence_point_1: `bty-app/src/lib/bty/archetype/fingerprint.ts:71` — `v: FINGERPRINT_VERSION` mixed into canonical object → `inputHash` differs for the *same* axisVector + patterns + scenariosCompleted + contractsCompleted.

[D-P1.R3.A1.2] divergence_point_2: `bty-app/src/lib/bty/archetype/lockService.ts:211` — `p_fingerprint_version` column write → row tagged with new version even when `inputHash` collision could not occur (different rows under different versions).

[D-P1.R3.A1.3] divergence_point_count: 2 (the only sites that observably alter hash output or row tag).

[D-P1.R3.A1.4] non_divergent_v_sites: 8 — sites 1, 2, 4, 5, 6, 8-10 (declaration / re-export / type / tests). V change here does not affect runtime hash output beyond reflecting the new constant.

---

## §5 Identity continuity impact at each divergence point

[D-P1.R3.A1.5] continuity_at_site_3: For any user U with axisVector=A, patterns=P, scenariosCompleted=s, contractsCompleted=c:
- pre-bump:  hash_pre  = SHA256(JSON.stringify({axis:A, patterns:P, s, c, v:1}))
- post-bump: hash_post = SHA256(JSON.stringify({axis:A, patterns:P, s, c, v:2}))
- hash_pre ≠ hash_post (deterministic, by SHA-256 collision resistance assumption).

[D-P1.R3.A1.6] cache_lookup_consequence: `findActiveLockByHash(userId, hash_post)` returns null because the existing active row stores hash_pre. Step (A) cache miss → falls through to step (B)+(C)+(D)+(E) → **new lock row inserted** under the same user_id, **superseding** the V=1 lock via the RPC's Step 1 + Step 3 atomic supersede chain.

[D-P1.R3.A1.7] archetype_re_derivation: Step (D) `selectArchetype(axisVector)` is **independent of FINGERPRINT_VERSION** — selector reads only axisVector against `RULE_REGISTRY`. Therefore archetype *name* may or may not change at version bump depending on whether axisVector changed.

[D-P1.R3.A1.8] axisVector_invariance_under_v_bump: V change alone does not change axisVector. axisVector change requires upstream change in (i) AL-2-D-P0 alias-aware activePatterns Set ([buildFingerprintInput.ts:27-29](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L27-L29)), (ii) computeMetrics output, or (iii) raw signal/pattern input. Pure version bump alone leaves axisVector untouched.

[D-P1.R3.A1.9] archetype_name_continuity_corollary: Under pure V bump (no axis change), `selectArchetype(axisVector)` returns the same archetypeName as pre-bump. The new lock row carries the same archetype_name as the old, but a new input_hash. **Identity (archetype name) is preserved; fingerprint identity (hash equality) is broken.**

[D-P1.R3.A1.10] supersede_audit_trail: RPC Step 3 sets `superseded_by_id = v_new_id` on the old V=1 row, preserving the chain ([20260505000001_bty_create_archetype_lock_rpc.sql:74-80](../bty-app/supabase/migrations/20260505000001_bty_create_archetype_lock_rpc.sql#L74-L80)).

[D-P1.R3.A1.11] continuity_at_site_7: V=2 row carries `fingerprint_version=2` while the superseded V=1 row remains queryable by `fingerprint_version=1`. The `bty_archetype_naming_locks` schema natively supports per-version coexistence at the row level (column already present).

---

## §6 What the chain does NOT depend on

[D-P1.R3.A1.12] no_alias_dict_in_hash: `PATTERN_FAMILY_ALIAS` ([bty-app/src/domain/pattern-family.ts:26-118](../bty-app/src/domain/pattern-family.ts#L26-L118)) is consulted by `normalizePatternFamilyId` only inside `activePatterns` Set construction at [buildFingerprintInput.ts:28](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L28). The alias map mutates `pen()` lookup behavior (axisVector mutation); it is NOT consulted when assembling `patternFamilies` for the hash (raw `p.pattern_family` at [buildFingerprintInput.ts:50](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L50)).

[D-P1.R3.A1.13] alias_dict_change_independence_of_v: A change to PATTERN_FAMILY_ALIAS does not require a V bump for the patterns array (it stays raw). It DOES change axisVector via pen() resolution → which DOES change inputHash even at V=1. **Alias-induced hash drift can occur without a version bump.**

[D-P1.R3.A1.14] scenario_json_role: Scenario JSON authors `pattern_family` literals that flow into `user_pattern_signatures` and downstream into `patterns[].pattern_family`. Lock 5 freezes scenario JSON re-tag (→ AL-2-E). Within current freeze, scenario JSON does not push new literals into the system.

[D-P1.R3.A1.15] selector_v_independence: `selectArchetype` ([selector.ts:33-62](../bty-app/src/lib/bty/archetype/selector.ts#L33-L62)) consumes only AxisVector + `RULE_REGISTRY`. It does NOT read FINGERPRINT_VERSION. Re-tuning rule cutoffs (R3.1.1 redesign path, declined per Lock 4) would change selection without a V bump being mandatory at the type level — but Lock 6 (FINGERPRINT_VERSION = 1) constrains rule changes to V bump per existing closure (`AL-2_SPRINT_CLOSURE.md §4.1`).

---

## §7 Hash-chain summary

[D-P1.R3.A1.16] hash_chain_components: { axis (12 keys, sorted, truncated to 0.01), patterns (raw lowercased dedup-sorted), scenariosCompleted (int), contractsCompleted (int), v (FINGERPRINT_VERSION literal) }.

[D-P1.R3.A1.17] hash_function: SHA-256 over `JSON.stringify(canonical)` ([fingerprint.ts:74-75](../bty-app/src/lib/bty/archetype/fingerprint.ts#L74-L75)).

[D-P1.R3.A1.18] determinism_invariant: Same input → same hash, every time. V bump breaks the hash collision but not the upstream input identity. Recovery path = re-derive new V=N row, supersede V=N-1 row, preserve archetype_name continuity per §5.

---

## §8 Cross-references

- [bty-app/src/lib/bty/archetype/fingerprint.ts](../bty-app/src/lib/bty/archetype/fingerprint.ts) — declaration site + hash mix
- [bty-app/src/lib/bty/archetype/buildFingerprintInput.ts](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts) — activePatterns Set + pen() + AxisVector
- [bty-app/src/lib/bty/archetype/rules.ts](../bty-app/src/lib/bty/archetype/rules.ts) — V-independent rule registry
- [bty-app/src/lib/bty/archetype/selector.ts](../bty-app/src/lib/bty/archetype/selector.ts) — V-independent selection
- [bty-app/src/lib/bty/archetype/lockService.ts](../bty-app/src/lib/bty/archetype/lockService.ts) — RPC entry / version persistence
- [bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql](../bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql) — schema (fingerprint_version column native)
- [bty-app/supabase/migrations/20260505000001_bty_create_archetype_lock_rpc.sql](../bty-app/supabase/migrations/20260505000001_bty_create_archetype_lock_rpc.sql) — atomic supersede RPC
- [docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md](specs/ARCHETYPE_DETERMINISM_LOCK_V1.md) — V1 spec
- [docs/AL-2_SPRINT_CLOSURE.md](AL-2_SPRINT_CLOSURE.md) §4.1 — Lock 6 (V=1 freeze) carry-forward
