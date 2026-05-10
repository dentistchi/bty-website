# AL-2-D-P1+ R3 — Bump Trigger Condition Draft (Area 4)

**Sprint**: AL-2-D-P1+ R3 (Identity Continuity Verification)
**Date (issuance)**: 2026-05-09
**Mode**: draft (every line marked [REQUIRES_P0_RECONCILIATION] until 24h observe paste-back)
**Guard 7 + 12**: applied — every observation-dependent statement carries the marker.

---

## §1 Trigger taxonomy

The dispatch enumerates 4 candidate scenarios T1-T4 from AL-2-D-P0 active-state proof. Each requires a draft of:
- bump-required condition
- bump-not-required condition
- 24h observe paste-back reconciliation hook

The trigger taxonomy is built around the determinism-impact cone identified in [archetype-determinism-trace.md §6](AL-2-D-P1-R3-archetype-determinism-trace.md):
1. axisVector change without V bump = HASH CHANGE without VERSION CHANGE (already permitted at V=1 by alias map mutation; not a V bump trigger by itself)
2. RULE_REGISTRY semantics change = SELECTOR CHANGE without HASH CHANGE per V (Lock 4 freeze prevents this; bump considered only if Lock 4 is unfrozen by Commander)
3. patternFamilies content semantics change = HASH CHANGE because patterns is hashed raw (alias map does NOT clean it)

---

## §2 [REQUIRES_P0_RECONCILIATION] T1 — alias resolution이 archetype 결과 변경

[D-P1.R3.A4.1] T1_definition: AL-2-D-P0 alias-aware activePatterns Set ([buildFingerprintInput.ts:27-29](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L27-L29)) resolves an alias literal that hits a pen() canonical literal. The user's axisVector consequently shifts; selectArchetype returns a different `archetype_name` than at V=1 pre-AL-2-D-P0.

[D-P1.R3.A4.2] T1_bump_required_condition_draft: A bump is required *only if* the new alias resolution behavior is intended to be a **per-version semantic** that should be queryable separately from the pre-resolution behavior. In other words, if Commander/Council declares "AL-2-D-P0's alias-aware activePatterns is the V=2 semantic, and pre-AL-2-D-P0 raw lookup is the V=1 semantic," then a bump is required to attach a version label that distinguishes the two computations historically.

[D-P1.R3.A4.3] T1_bump_not_required_condition_draft: A bump is NOT required if the alias resolution is treated as a continuation of the V=1 semantic (Method X with corrected pen() lookup site). This is the [AL-2-C R3.5.2](AL-2-C-R3-decision-template.csv) closure interpretation: the activePatterns gap is a bug in V=1, not a V=2 feature. Under this interpretation, the 24h observe data establishes corrected V=1 behavior, not a new version. **This is the favored interpretation per Lock 6 (FINGERPRINT_VERSION = 1) carry-forward in [AL-2_SPRINT_CLOSURE.md §4.1](AL-2_SPRINT_CLOSURE.md).**

[D-P1.R3.A4.4] T1_reconciliation_hook: 24h observe paste-back reports the actual archetype_name change events for any user. If 0 events → T1 did not fire materially → bump unjustified. If N>0 events → Commander chooses interpretation per [D-P1.R3.A4.2] vs [D-P1.R3.A4.3]. Reconciliation must include: (a) per-user archetype_name pre/post AL-2-D-P0, (b) per-user axisVector delta breakdown by axis, (c) confirmation that the change is alias-induced and not signal-induced.

---

## §3 [REQUIRES_P0_RECONCILIATION] T2 — pattern_family aggregation이 pre-bump signature와 충돌

[D-P1.R3.A4.5] T2_definition: A user holds a `user_pattern_signatures` row at (user_id, pattern_family=X, axis=Y) that was written under V=1 semantic, where X is now an alias of canonical Z. After AL-2-D-P0 resolution, downstream pen() lookup for canonical Z hits — but the raw `patternFamilies` array passed to the hash still contains X (raw, no normalization at [buildFingerprintInput.ts:50](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L50)). The user's input_hash differs from a hypothetical user with the canonical Z literal directly.

[D-P1.R3.A4.6] T2_bump_required_condition_draft: A bump is required *only if* Commander adopts a normalized patternFamilies hash (i.e., the patterns array is changed to apply `normalizePatternFamilyId` before hashing). That is itself a V change (the canonical form changes). Pre-bump and post-bump users with the same logical pattern set would compute different hashes only if the normalization is applied differently per version → bump required to mark the change.

[D-P1.R3.A4.7] T2_bump_not_required_condition_draft: A bump is NOT required if Commander preserves raw `patternFamilies.map(p => p.pattern_family)` in the hash (status quo per [buildFingerprintInput.ts:50](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L50)). The signature/hash conflict is then an *expected* feature of V=1 — different alias literals produce different hashes by design. Lock 6 carry-forward favors this option.

[D-P1.R3.A4.8] T2_reconciliation_hook: 24h observe paste-back reports whether any production user has a `user_pattern_signatures` row whose `pattern_family` is in `PATTERN_FAMILY_ALIAS` keys ([pattern-family.ts:26-118](../bty-app/src/domain/pattern-family.ts#L26-L118)) but whose latest fingerprint hash differs from a same-user, same-axis canonical literal version. If 0 such users → T2 inactive → bump unjustified. If N>0 → Commander decides normalization adoption [D-P1.R3.A4.6] vs status quo [D-P1.R3.A4.7].

---

## §4 [REQUIRES_P0_RECONCILIATION] T3 — Lock 4 baseline user archetype이 alias 활성화로 변경 시도

[D-P1.R3.A4.9] T3_definition: Either of the two pre-AL-2-B locked baseline users (38ce28d2 → QUIETFLAME, 85bd8f1f → STILLWATER per [AL-2_SPRINT_CLOSURE.md §3.8](AL-2_SPRINT_CLOSURE.md)) experiences a `selectArchetype(axisVector)` outcome that differs from the locked archetype_name, when re-evaluated under AL-2-D-P0 alias-aware activePatterns.

[D-P1.R3.A4.10] T3_bump_required_condition_draft: A bump is required *only if* Commander chooses to surface the change as a separate version (allowing both V=1 archetype name and V=2 archetype name to be queryable) — this requires Path P1 (dual-version coexist) per [backward-compat-path-matrix.md §2](AL-2-D-P1-R3-backward-compat-path-matrix.md), with `bty_archetype_naming_locks` exclude constraint relaxed.

[D-P1.R3.A4.11] T3_bump_not_required_condition_draft: A bump is NOT required if Commander chooses Path P4 (bump skip) — Lock 4 invariant takes precedence (archetype name freeze) and the alias resolution is allowed but its effect on these specific users is suppressed by transition gate or by Lock 4 carry-forward enforcement at the lockService level. Alternative: Path P3 (lazy) lets the supersede chain run; if the new archetype name is acceptable per Lock 4 carry-forward semantics (R3.1.1 ratified preserve), the supersede represents organic evolution under V=1, not a V=2 event.

[D-P1.R3.A4.12] T3_reconciliation_hook: 24h observe paste-back reports `selectArchetype(axisVector_AL-2-D-P0)` for 38ce28d2 and 85bd8f1f, side-by-side with their locked archetype names. If both unchanged → T3 inactive → bump unjustified by these users. If 1 or 2 changed → Commander picks Path P1/P3/P4 per [D-P1.R3.A4.10] vs [D-P1.R3.A4.11]. The 5-baseline-user carry-forward = 0 inventory ([AL-2_SPRINT_CLOSURE.md §3.8](AL-2_SPRINT_CLOSURE.md)) suggests this trigger should not fire materially in production for the 5 baseline users.

---

## §5 [REQUIRES_P0_RECONCILIATION] T4 — production traffic이 alias entry를 user_pattern_signatures에 기록

[D-P1.R3.A4.13] T4_definition: Any production user submits an Arena run that produces a `user_pattern_signatures` row whose `pattern_family` value is an alias key (in `PATTERN_FAMILY_ALIAS`, [pattern-family.ts:26-118](../bty-app/src/domain/pattern-family.ts#L26-L118)) rather than a canonical-12 / NEW_AXIS-canonical literal. This evidences scenario JSON or signal-write-path emitting alias literals in active production traffic.

[D-P1.R3.A4.14] T4_bump_required_condition_draft: A bump is required *only if* Commander adopts patternFamilies normalization (per T2 [D-P1.R3.A4.6]) and decides that the historical alias-entry rows must be queryable as V=1 evidence vs the post-bump canonical-only rows as V=2 evidence. Otherwise, T4 is purely an AL-2-E (scenario JSON re-tag) signal — alias entries enter production because scenario JSON authors them, and Lock 5 freezes scenario JSON re-tag.

[D-P1.R3.A4.15] T4_bump_not_required_condition_draft: A bump is NOT required if T4 is treated as an AL-2-E backlog item (scenario re-tag) rather than a determinism-version event. The fingerprint chain at V=1 already correctly emits a hash from raw alias literals; AL-2-D-P0 alias-aware activePatterns correctly resolves them at pen() time. The continued production of alias entries is a scenario authoring concern, not a fingerprint version concern.

[D-P1.R3.A4.16] T4_reconciliation_hook: 24h observe paste-back enumerates `user_pattern_signatures` rows whose `pattern_family ∈ keys(PATTERN_FAMILY_ALIAS)` and whose `created_at` (or `last_seen_at`) is within the observe window (post-AL-2-D-P0 deploy). If 0 rows → T4 inactive → bump unjustified by traffic evidence. If N>0 rows → enumerate by pattern_family; Commander redirects to AL-2-E or accepts as V=1 status quo per Lock 5.

---

## §6 Aggregate trigger logic

[D-P1.R3.A4.17] aggregate_logic: T1 ∨ T2 ∨ T3 ∨ T4 may fire independently. Bump justification accumulates only if Commander (a) decides to surface the change as a per-version distinction AND (b) accepts the migration cost per [backward-compat-path-matrix.md §2](AL-2-D-P1-R3-backward-compat-path-matrix.md) Path P1 or P2.

[D-P1.R3.A4.18] no_trigger_alone_forces_bump: None of T1-T4 alone *forces* a bump; all four can be absorbed at V=1 per Lock 6 carry-forward semantics. Bump becomes mandatory only under additional Commander decisions:
- adopting patternFamilies normalization (T2/T4)
- mandating per-version queryability of pre/post AL-2-D-P0 archetype name distinction (T1/T3)

[D-P1.R3.A4.19] favored_default: Lock 6 carry-forward (V=1 preserved) is the favored interpretation per [AL-2_SPRINT_CLOSURE.md §4.1](AL-2_SPRINT_CLOSURE.md), absorbing T1-T4 effects at V=1 via either the alias map (already at V=1) or scenario JSON re-tag at AL-2-E.

---

## §7 Reconciliation contract (24h observe paste-back)

[D-P1.R3.A4.20] paste_back_required_fields: The 24h observe paste-back must report, for each of T1-T4:
- (T1) per-user archetype_name event count + axisVector delta breakdown
- (T2) per-user signature/hash conflict count
- (T3) per-baseline-user pre/post archetype outcome (specifically 38ce28d2 + 85bd8f1f + 3 other baseline users)
- (T4) `user_pattern_signatures` alias-entry write count + per pattern_family enumeration

[D-P1.R3.A4.21] reconciliation_replaces_marker: Each `[REQUIRES_P0_RECONCILIATION]` line in this draft is replaced by the actual observation outcome on paste-back. The Commander dispatches the bump decision after reconciliation, not before.

---

## §8 Cross-references

- [docs/AL-2-D-P1-R3-archetype-determinism-trace.md](AL-2-D-P1-R3-archetype-determinism-trace.md) §4-§7 — divergence point inventory
- [docs/AL-2-D-P1-R3-backward-compat-path-matrix.md](AL-2-D-P1-R3-backward-compat-path-matrix.md) §2-§7 — path consequences per trigger
- [docs/AL-2-D-P1-R3-lock4-impact-decision-template.csv](AL-2-D-P1-R3-lock4-impact-decision-template.csv) — per-user decision rows
- [docs/AL-2_SPRINT_CLOSURE.md](AL-2_SPRINT_CLOSURE.md) §3.8 (5 baseline users), §4.1 (Lock 6), §5.1 (AL-2-D backlog)
- [docs/AL-2-C-R3-decision-template.csv](AL-2-C-R3-decision-template.csv) §R3.5.2 (activePatterns gap closure)
- [bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts) — alias dictionary (53 entries post-AL-2-B + AL-2-C R3 closure)
