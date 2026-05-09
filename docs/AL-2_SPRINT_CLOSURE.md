# AL-2 Sprint Closure

**Sprint envelope**: AL-2-A → AL-2-B (P0/P1/P2/P3) → AL-2-C (R3 + mutation) → AL-2-D-P0
**Closure date**: 2026-05-09
**Authority**: Hanbit Commander (BTY Semantic Council)
**Closure target**: dirty-tree deploy pattern terminates with C5 commit

---

## §1 Timeline

| timestamp (UTC) | event | artifact |
|---|---|---|
| 2026-05-07T21:02Z | pre-AL-2 baseline staging worker | `1a063f18-f9e2-40f6-b77d-f091412b85da` |
| 2026-05-08 (KST) | AL-2-A Council session — 110-row decision template | [docs/AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv) |
| 2026-05-08 | AL-2-B Phase 0 — inventory grep (no deploy) | dispatch closure |
| 2026-05-08T23:22Z | AL-2-B Phase 1 deploy — alias dict + NEW_AXIS pen() shape | `a5d0848a-cab6-4741-bd8e-e05684654570` |
| 2026-05-09T01:47Z | AL-2-B Phase 2 deploy — NEW_AXIS aliases + tensionAxisToAxisVector | `cf530610-8341-4d27-bac7-ba06a7bba631` |
| 2026-05-08 (PT) | AL-2-B Phase 3 docs-only commit (LOW row deferral) | outer commit `8241f5c` |
| 2026-05-08 (PT) | AL-2-C R3 audit — 5 docs new, 19-row decision template | [docs/AL-2-C-R3-decision-template.csv](AL-2-C-R3-decision-template.csv) |
| 2026-05-09T04:05Z | AL-2-C mutation deploy — 7 alias additions | `46c67646-c36a-4aae-9675-2354f714625d` |
| 2026-05-09T04:17Z | AL-2-D-P0 deploy — activePatterns Set normalization (R3.5.2 closure) | `e9e179ed-38a7-40ae-8f97-13cfb09191b7` |
| 2026-05-09 | C5 consolidation — inner repo commit | inner commit `50317b8` |

**Active worker**: `e9e179ed-38a7-40ae-8f97-13cfb09191b7` (no redeploy from C5 commit).

---

## §2 Architecture evolution

### §2.1 Pattern alias dictionary
- **Pre-AL-2**: 0 entries (single hardcoded `LEGACY_EXPLANATION_ALIAS` branch in `normalizePatternFamilyId`)
- **AL-2-B Phase 1**: +23 entries (HIGH+MEDIUM merge → existing canonical 5)
- **AL-2-B Phase 2**: +29 entries (NEW_AXIS aliases → 5 NEW canonical anchors)
- **AL-2-C mutation**: +7 entries (R3 semantic decision lock; V-1-A unlocked for `group_conformity`)
- **Post-AL-2**: **59 entries** at [bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts)

### §2.2 pen() axis wiring (12-dim AxisVector)
- **Pre-AL-2**: 5 of 12 axes pen()-wired (ownership / time / repair / conflict / accountability)
- **AL-2-B Phase 1**: +5 NEW_AXIS pen() shape (truth / integrity / authority / control / visibility)
- **Post-AL-2**: **10 of 12 axes** pen()-wired
- **Deferred**: courage (R3.2.1 → AL-2-D), identity (R3.2.2 → AL-2-D)

### §2.3 Cross-layer mapping (Layer 2 ↔ Layer 1)
- **Pre-AL-2**: 0 (no mapping function)
- **AL-2-B Phase 2**: NEW file [tensionAxisToAxisVector.ts](../bty-app/src/lib/bty/archetype/tensionAxisToAxisVector.ts)
  - Strategy C: 47-row enum primary + 12-axis keyword fallback (Set 4 extension)
  - Cascading Option A (enum wins, narrative primary)
  - 0 consumer (Decision Cn — standalone capacity)

### §2.4 activePatterns Set construction (R3.5.2 closure)
- **Pre-AL-2-D-P0**: raw `pattern_family.toLowerCase()` → alias dictionary had 0 runtime effect
- **Post-AL-2-D-P0**: `normalizePatternFamilyId(p.pattern_family) ?? p.pattern_family` → alias capacity now drives pen() activation

### §2.5 Inventory coverage
| state | coverage | mapped occurrences |
|---|---:|---:|
| Pre-AL-2 (canonical 5 only) | 14.3% | 107 / 748 |
| AL-2-B closure | ~80.1% | 599 / 748 |
| AL-2-C closure (post-7-alias) | ~83.0% | 621 / 748 |
| Deferred LOW rows | 21.0% | 157 / 748 (48 rows) |

---

## §3 Critical findings

### §3.1 patternRequires field does not exist in v1
- ARCHETYPE_DETERMINISM_LOCK_V1.md §4.1 invariant: `ruleMatches` evaluates `AxisVector` only
- v1 pattern→archetype encoding flows via `pen()` axis penalty (lossy per spec)
- AL-2-C R3.1.2 lock: Method X preserved; Method Y (add `patternRequires?` field) deferred to post-AL-2-D
- Source: [bty-app/src/lib/bty/archetype/rules.ts:11-16](../bty-app/src/lib/bty/archetype/rules.ts#L11-L16)

### §3.2 ownership_escape ghost canonical
- 0 scenario JSON coverage (R3 evidence)
- Empirical alternative: `ownership_act` (freq=23, scenario JSONs)
- AL-2-B Phase 1 Flag 1 Option B: additive alias `ownership_act → ownership_escape` (already wired in P1 cluster, Phase 3 finding)
- Source: [docs/AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv) ownership cluster notes

### §3.3 conflict_avoidance > delegation_deflection cardinality reversal
- Anchor: `delegation_deflection` (freq=21)
- Alias: `conflict_avoidance` (freq=34) — merged > anchor
- Spec/code drift: ARCHETYPE_DETERMINISM_LOCK_V1.md §4.1 lists `conflict_avoidance` as canonical, but rules.ts uses `delegation_deflection`
- AL-2-C R3.5.1 lock: swap-B (preserve v1 anchor); swap-A deferred to AL-2-D (FINGERPRINT_VERSION coupling concern)
- Source: [docs/AL-2-C-R3-anchor-swap-review.md](AL-2-C-R3-anchor-swap-review.md)

### §3.4 Phase 2 accountability count drift
- Phase 2 dispatch summary stated `accountability=3`, body had 4 entries (sum=46 vs 47)
- AL-2-C carry-forward lock: enum body authoritative (accountability=4)
- Status: clerical drift in summary; body verbatim implementation
- Source: AL-2-B Phase 2 closure paste-back

### §3.5 R3.5.2 activePatterns Set bypass (closed in AL-2-D-P0)
- Pre-AL-2-D-P0: `buildFingerprintInput.ts:23` raw `.toLowerCase()` bypassed `normalizePatternFamilyId`
- Effect: 59-entry alias dictionary had 0 runtime effect at pen() lookup site
- Resolution: AL-2-D-P0 surgical mutation; backward-compatible (canonical raw passthrough preserved)
- Source: [docs/AL-2-C-R3-anchor-swap-review.md §5](AL-2-C-R3-anchor-swap-review.md)

### §3.6 patternFamilyCompatibilityMap dead artifact
- 13 entries at `bty-app/src/data/scenario/index.ts:542-556`
- 0 imports / 0 usages (Phase 0 + Phase 1 re-verified)
- 8 of 13 entries conflict with Council CSV decisions
- Status: deletion deferred to Housekeeping
- Source: [docs/AL-2-B-cleanup-candidates.md](AL-2-B-cleanup-candidates.md)

### §3.7 Active-state production behavior post-AL-2-D-P0
- 24h verify SQL queries not run by VS Code Claude (no production DB access)
- Status: <C5 inventory에서 확인>

### §3.8 Archetype lock drift verification across 4 deploys
- 5 baseline users: `2322beb7`, `38ce28d2`, `3c732192`, `85bd8f1f`, `ee9d2075`
- Pre-AL-2-B locks: `38ce28d2 → QUIETFLAME`, `85bd8f1f → STILLWATER`
- Drift verification across 4 deploys (a5d0848a / cf530610 / 46c67646 / e9e179ed): <C5 inventory에서 확인>
- Inactive-state proof preserved (5 users have NONE of 59 alias families in `user_pattern_signatures` per dispatch cite)

---

## §4 Locked invariants (carry-forward into AL-2-D)

### §4.1 AL-2-B locks (6 + 7 Decision)
| lock | content | status |
|---|---|---|
| Lock 1 | 5 NEW_AXIS provisional adoption | ✓ wired |
| Lock 2 | SEMANTIC additive only (Decision A) | ✓ |
| Lock 3 | Phase 1 → 2-pre → 2 → 3 sequencing | ✓ |
| Lock 4 | archetype semantics freeze | ✓ (R3.1.1 ratified) |
| Lock 5 | scenario JSON re-tagging deferred | ✓ (→ AL-2-E) |
| Lock 6 | FINGERPRINT_VERSION = 1 | ✓ (→ AL-2-D) |
| Decision A | semantic additive | ✓ |
| Decision B | baseline cite refresh only | ✓ |
| Decision S | Strategy C (enum + keyword fallback) | ✓ wired |
| Decision V-1 | Phase 2 V-1-A; AL-2-C R3.4.1 unlock | ✓ unlocked for group_conformity |
| Decision Cn | Phase 2 mapping function only (0 consumer) | ✓ |
| Decision E | 47-row enum + Set 4 keyword cluster | ✓ wired |
| Cascading Option A | enum table = narrative primary | ✓ |

### §4.2 AL-2-C R3 locks (Recommended-default 7 + Semantic 12 + Option β 3)
| ID | lock | status |
|---|---|---|
| R3.1.1 | 7 archetype v1 spec preserve | ✓ Lock 4 carry-forward |
| R3.1.2 | Method X (axis-only ruleMatches) | ✓ no patternRequires field |
| R3.1.3 | preserve 18 axis conditions | ✓ |
| R3.2.1 | courage axis defer (Option B) | ✓ → AL-2-D |
| R3.2.2 | identity axis defer (Option B) | ✓ → AL-2-D |
| R3.5.1 | delegation_deflection v1 anchor (swap-B) | ✓ |
| R3.5.2 | activePatterns gap | ✓ closed in AL-2-D-P0 |
| R3.3.1 | private_intention → self_protection (control) | ✓ aliased |
| R3.3.2 | group_conformity → reputation_protection (visibility) | ✓ aliased |
| R3.3.3 | successor_protection → authority_protection | ✓ aliased |
| R3.3.4 | system_defensiveness → authority_protection | ✓ aliased |
| R3.3.5 | avoidance_behavior DEPRECATE | ✓ no alias entry |
| R3.3.6 | closure_rush unique NEW (Option β) | ✓ axis deferred |
| R3.3.7 | accountability_application → explanation_substitution | ✓ aliased |
| R3.3.8 | boundary_definition unique NEW (Option β) | ✓ axis deferred |
| R3.3.9 | misuse_correction → truth_naming | ✓ aliased |
| R3.3.10 | re_engagement unique NEW (Option β) | ✓ axis deferred |
| R3.3.11 | visible_correction → truth_naming | ✓ aliased |
| R3.4.1 | group_conformity = visibility | ✓ V-1-A unlocked |

### §4.3 AL-2-D-P0 lock
- Guard 1-8 PASS at deploy: P0 scope only; alias dict / AxisVector type / archetype rule / FINGERPRINT_VERSION / scenario JSON / pen() shape / backward compat all preserved.

---

## §5 Pending backlog

### §5.1 AL-2-D (fingerprint / specificity sprint)
- courage / identity pen() shape change (R3.2.1 / R3.2.2)
- 3 unique NEW axis assignment: `closure_rush`, `boundary_definition`, `re_engagement`
- FINGERPRINT_VERSION bump
- metric source reassignment
- Layer 2-norm storage normalization (`user_pattern_signatures.axis` raw flow)
- tensionAxisToAxisVector consumer wiring (currently 0 caller)
- Anchor swap-A re-evaluation (R3.5.1 carry-forward; conflict_avoidance ↔ delegation_deflection swap)

### §5.2 AL-2-D OR Housekeeping
- avoidance_behavior DEPRECATE migration

### §5.3 AL-2-E (scenario JSON re-tag sprint)
- `bty_tension_axis` literal re-tag
- 12 Type 4 OUTSIDE literal rewrite (Phase 2 enum null entries)

### §5.4 Housekeeping
- `patternFamilyCompatibilityMap` deletion (13-entry dead artifact)
- 37 DEPRECATE LOW rows pruning

### §5.5 Method Y candidate (post-AL-2-D)
- `patternRequires?` field architecture extension (R3.1.2 Method Y option)

### §5.6 Active-state production verification
- 24h post-AL-2-D-P0 verify (alias activation observation): <C5 inventory에서 확인>
- 5-baseline-user drift verification: <C5 inventory에서 확인>
- Pre-AL-2 archetype lock stability (38ce28d2 QUIETFLAME / 85bd8f1f STILLWATER): <C5 inventory에서 확인>
- First production traffic appearance + alias resolution validation: <C5 inventory에서 확인>

### §5.7 Inner-repo housekeeping (out of AL-2 scope but adjacent)
- Inner-repo `bty-app/src/lib/bty/archetype/` directory: 16 files in working tree, 4 committed via inner `50317b8` (AL-2 deliverables); other 12 files (rules.ts, selector.ts, fingerprint.ts, etc.) remain untracked in inner repo. Tracking decision: <C5 inventory에서 확인>
- `supabase/migrations/20260505000000_bty_archetype_naming_locks.sql` + companion RPC: <C5 inventory에서 확인>

---

## §6 Cross-references

### AL-2 source-of-truth docs (outer repo)
- [AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv) — Council 110-row CSV
- [AL-2-A-runtime-path-trace.md](AL-2-A-runtime-path-trace.md) — 6 runtime paths
- [AL-2-A-vocabulary-inventory.csv](AL-2-A-vocabulary-inventory.csv) — empirical vocabulary
- [AL-2-A-vocabulary-lineage.md](AL-2-A-vocabulary-lineage.md) — 4-layer lineage
- [AL-2-B-cleanup-candidates.md](AL-2-B-cleanup-candidates.md) — Phase 1 cleanup cite
- [AL-2-B-low-confidence-deferred.md](AL-2-B-low-confidence-deferred.md) — Phase 3 LOW row deferral
- [AL-2-C-R3-archetype-inventory.md](AL-2-C-R3-archetype-inventory.md) — 7 archetype inventory
- [AL-2-C-R3-courage-identity-deferral.md](AL-2-C-R3-courage-identity-deferral.md) — courage/identity audit
- [AL-2-C-R3-low-row-archetype-resolution.md](AL-2-C-R3-low-row-archetype-resolution.md) — 11 LOW row inventory
- [AL-2-C-R3-anchor-swap-review.md](AL-2-C-R3-anchor-swap-review.md) — anchor swap + R3.5.2 finding
- [AL-2-C-R3-decision-template.csv](AL-2-C-R3-decision-template.csv) — 19-row R3 decisions
- [AL-2-C-decision-lock.md](AL-2-C-decision-lock.md) — 19-row decision lock
- [AL-2-C-deprecate-and-unique-new.md](AL-2-C-deprecate-and-unique-new.md) — DEPRECATE + Option β

### Spec authority
- [docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md](specs/ARCHETYPE_DETERMINISM_LOCK_V1.md)

### Inner-repo source (committed `50317b8`)
- `bty-app/src/domain/pattern-family.ts` — 59-entry alias dictionary
- `bty-app/src/lib/bty/archetype/buildFingerprintInput.ts` — 10/12 pen() wiring + activePatterns normalization
- `bty-app/src/lib/bty/archetype/tensionAxisToAxisVector.ts` — Strategy C cross-layer mapping
- `bty-app/src/lib/bty/archetype/buildFingerprintInput.test.ts` — 9 alias-aware tests
