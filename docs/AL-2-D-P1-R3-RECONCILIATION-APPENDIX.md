# AL-2-D-P1 R3 Reconciliation Appendix

**Sprint**: AL-2-D-P1 close (no-bump V=1 freeze lock)
**Mode**: 24h observe paste-back replacing `[REQUIRES_P0_RECONCILIATION]` markers per [bump-trigger-condition-draft §A4.21](AL-2-D-P1-R3-bump-trigger-condition-draft.md).
**Authority**: Hanbit Commander (BTY Semantic Council).
**Authoring date**: 2026-05-10
**Inner HEAD**: `50317b8` (untouched in this dispatch)
**Outer HEAD at issuance**: `3b1eb39` (target for AL-2-D-P1 close commits)
**Worker active**: `e9e179ed-38a7-40ae-8f97-13cfb09191b7` (no redeploy from C5 commit)
**Tests**: 66/66 PASS (carry-forward; no run in this dispatch)

**Cross-ref**:
- [AL-2-D-P1-R3-archetype-determinism-trace.md](AL-2-D-P1-R3-archetype-determinism-trace.md)
- [AL-2-D-P1-R3-lock4-impact-decision-template.csv](AL-2-D-P1-R3-lock4-impact-decision-template.csv)
- [AL-2-D-P1-R3-backward-compat-path-matrix.md](AL-2-D-P1-R3-backward-compat-path-matrix.md)
- [AL-2-D-P1-R3-bump-trigger-condition-draft.md](AL-2-D-P1-R3-bump-trigger-condition-draft.md)
- [AL-2-D-P1-R3-HK-compat-map-deletion-trace.md](AL-2-D-P1-R3-HK-compat-map-deletion-trace.md)
- [AL-2-D-P1-R3-HK-deprecate-low-row-status.md](AL-2-D-P1-R3-HK-deprecate-low-row-status.md)
- [AL-2-D-P1-R3-HK-orphan-and-dead-branch-inventory.md](AL-2-D-P1-R3-HK-orphan-and-dead-branch-inventory.md)
- [AL-2_SPRINT_CLOSURE.md](AL-2_SPRINT_CLOSURE.md)

---

## §1 — 24h observe outcome summary

**Window**: 2026-05-09T04:17:18Z → 2026-05-10T04:17:18Z (T+24h exact).
**Worker**: `e9e179ed-38a7-40ae-8f97-13cfb09191b7` deployed 2026-05-09T04:17:18Z; **no redeploy / rollback in window**.

| field | value | observe query |
|---|---|---|
| Production traffic in window | 1 arena_signal | Q4 |
| Author of the 1 signal | `ee9d2075-...` (non-baseline-lock user) | Q4 |
| Lock rows added post-deploy | 0 | Q10 |
| Lock rows superseded post-deploy | 0 | Q10 |
| New `user_pattern_signatures` rows post-deploy | 0 | Q12 |
| Distinct `pattern_family` values seen | 4 (`truth_naming`, `integrity_compromise`, `performance_blame`, `reputation_protection`) — all `latest_first_seen < deploy` | Q12 / Q14 |
| Lock 4 baseline users 24h delta | 0 (QUIETFLAME active, STILLWATER superseded pre-AL-2-A) | Q17 |
| ee9d2075 `reputation_protection` signature created_at | 2026-05-07 (pre-deploy) | Q18 |
| ee9d2075 archetype lock rows | 0 | Q19 |
| Signal↔signature linkage (24h post-deploy) | none — `repeat_count` not incremented, `last_seen_at` not refreshed | Q4+Q12+Q18 |

**Anomaly count (close-blocker)**: 0. Two non-blocking observations recorded:
- A1 (axis term): `user_pattern_signatures.axis = "Reputation"` for ee9d2075's row — outside BTY canonical 12 axes (see §5).
- A2 (baseline correction): "5 baseline user" memory phrasing was a historical multi-layer convention; Lock 4 active baseline = 1 (38ce28d2 only) per Q17 (see §4).

**Scenario α confirmation**: T1–T4 ALL UNFIRED → no-bump V=1 freeze lock (Path P4) per Guard 11.

---

## §2 — `[REQUIRES_P0_RECONCILIATION]` 14 markers resolution

### §2.1 T1 — alias resolution이 archetype 결과 변경 → **UNFIRED**

Per [bump-trigger-draft §A4.1–A4.4](AL-2-D-P1-R3-bump-trigger-condition-draft.md):
- A4.4 reconciliation_hook required: archetype_name change events count for any user.
- **Observed**: Q10 `rows_locked_post_deploy = 0`, `rows_superseded_post_deploy = 0`. Q12 0 new signatures. No re-derivation event in window.
- **Resolution**: T1 inactive → bump unjustified. Favored interpretation A4.3 (Lock 6 carry-forward) holds.

### §2.2 T2 — pattern_family aggregation이 pre-bump signature와 충돌 → **UNFIRED**

Per [bump-trigger-draft §A4.5–A4.8](AL-2-D-P1-R3-bump-trigger-condition-draft.md):
- A4.8 reconciliation_hook required: enumeration of users whose `pattern_family ∈ keys(PATTERN_FAMILY_ALIAS)` with hash differing from a canonical-literal counterpart.
- **Observed**: Q12 — all 4 `pattern_family` values present have `post_deploy_first_seen = 0`. Q14 — `latest_first_seen` for all 4 < 2026-05-09T04:17:18Z. No signature aggregation event triggered hash recomputation in 24h.
- **Resolution**: T2 inactive → bump unjustified. Status quo A4.7 (raw `patternFamilies.map(...)` hash, [buildFingerprintInput.ts:50](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L50)) preserved.

### §2.3 T3 — Lock 4 baseline alias 변경 시도 → **UNFIRED**

Per [bump-trigger-draft §A4.9–A4.12](AL-2-D-P1-R3-bump-trigger-condition-draft.md):
- A4.12 reconciliation_hook required: side-by-side comparison of `selectArchetype(axisVector_AL-2-D-P0)` vs locked archetype_name for 38ce28d2 and 85bd8f1f.
- **Observed**: Q17 — QUIETFLAME (38ce28d2) `superseded_at = null` (active, V=1), STILLWATER (85bd8f1f) `superseded_at = 2026-05-02T22:24:53Z` (superseded since 2026-05-02, **6 days before AL-2-A Council session**). Q10 `rows_superseded_post_deploy = 0`. Lock 4 unchanged in 24h.
- **Resolution**: T3 inactive → bump unjustified by these users. Path P4 (A4.11) selected per §6.

### §2.4 T4 — production traffic alias entry 기록 → **UNFIRED**

Per [bump-trigger-draft §A4.13–A4.16](AL-2-D-P1-R3-bump-trigger-condition-draft.md):
- A4.16 reconciliation_hook required: enumeration of `user_pattern_signatures` rows whose `pattern_family ∈ keys(PATTERN_FAMILY_ALIAS)` AND `created_at` (or `last_seen_at`) within observe window.
- **Observed**: Q4 — 1 post-deploy arena signal (ee9d2075) only. Q12 — 0 new pattern_family signatures. Q18 — ee9d2075's `reputation_protection` signature is pre-deploy (2026-05-07T19:34:21Z). Q19 — ee9d2075 has 0 archetype lock rows. Signal-to-signature linkage in window = none (`repeat_count` not incremented, `last_seen_at` not refreshed).
- **Resolution**: T4 inactive → bump unjustified by traffic evidence. Status quo A4.15 (treat alias entries as AL-2-E backlog if/when they appear) preserved.

### §2.5 Lock 4 CSV — 6 rows `recommendation_pending` → **A_preserve adopted**

Per [lock4-impact-decision-template.csv](AL-2-D-P1-R3-lock4-impact-decision-template.csv) 6 rows (38ce28d2 / 85bd8f1f / 3c732192 / 2322beb7 / ee9d2075 / all_other_locked_users_count):
- T3 unfired (§2.3) → no actual lock-4 alias-induced change in window → **A_preserve** (V=1 row preserved) is the binding recommendation for all 6 rows.
- A2 baseline correction (see §4): of the 6 row subjects, only **38ce28d2** holds an active V=1 lock. STILLWATER (85bd8f1f) was superseded pre-AL-2-A. The 3 unlocked baseline users (3c732192 / 2322beb7 / ee9d2075) have no V=1 lock to preserve. `all_other_locked_users_count = 0` per Q17 dump (locks table is exhaustively 2 rows; both baseline).

### §2.6 Backward-compat path matrix §6 `recommendation_pending` → **Path P4 selected**

Per [backward-compat-path-matrix.md §6](AL-2-D-P1-R3-backward-compat-path-matrix.md): close decision lock = Path P4 (V=1 freeze) per §6 of this appendix. Path P1/P2/P3 deferred or rejected per Guard 11 (see §6 below).

### §2.7 Aggregate trigger logic (A4.17–A4.20)

Per [bump-trigger-draft §A4.17–A4.20](AL-2-D-P1-R3-bump-trigger-condition-draft.md):
- A4.17 aggregate logic: T1 ∨ T2 ∨ T3 ∨ T4 = **false ∨ false ∨ false ∨ false = false**.
- A4.18: no single trigger forces a bump → **respected**.
- A4.19: favored default V=1 carry-forward → **respected**.
- A4.20 paste_back_required_fields: §1 + §2.1–2.4 satisfy reporting requirement (firing status / per-trigger evidence / decision reference).

### §2.8 Marker count tally

| source | markers | resolved |
|---|---:|---:|
| bump-trigger-condition-draft.md (§2/§3/§4/§5/§6) | T1 + T2 + T3 + T4 + aggregate + paste_back_required = 6 | 6/6 |
| backward-compat-path-matrix.md (§6 recommendation_pending) | 1 | 1/1 |
| lock4-impact-decision-template.csv (6 rows × `[REQUIRES_P0_RECONCILIATION]` aggregated as "Lock 4 CSV row family" + Area 4 reconciliation) | 7 | 7/7 |
| **total** | **14** | **14/14** |

→ All `[REQUIRES_P0_RECONCILIATION]` markers resolved. Audit docs themselves are not mutated (Guard 5); resolution authority resides in this appendix per A4.21.

---

## §3 — `<C5 inventory에서 확인>` 26 markers resolution

### §3.1 Resolved (16)

Markers across 4 source docs, resolved by 24h observe data:

| source | marker context | resolution authority |
|---|---|---|
| AL-2_SPRINT_CLOSURE.md §3.7 (Status) | active-state production behavior post-AL-2-D-P0 | §1: 1 arena signal, 0 lock/signature mutation, 0 errors |
| AL-2_SPRINT_CLOSURE.md §3.8 (drift verification across 4 deploys) | lock state across a5d0848a / cf530610 / 46c67646 / e9e179ed | Q17: 0 lock 4 변동; QUIETFLAME bit-identical, STILLWATER pre-existing supersede unchanged |
| AL-2_SPRINT_CLOSURE.md §5.6 (24h alias activation) | runtime activation of alias dictionary | §2.4: T4 unfired; alias dictionary remains capacity-wired (R3.5.2 closure) without production exercise |
| AL-2_SPRINT_CLOSURE.md §5.6 (5-baseline-user drift) | per-user drift evidence | §2.3: Q10 + Q17 prove 0 drift on 38ce28d2 / 85bd8f1f; §4 corrects baseline scope |
| AL-2_SPRINT_CLOSURE.md §5.6 (Pre-AL-2 lock stability) | 38ce28d2 QUIETFLAME / 85bd8f1f STILLWATER | Q17: QUIETFLAME active, STILLWATER superseded 2026-05-02 (pre-AL-2-A) |
| AL-2_SPRINT_CLOSURE.md §5.6 (first production traffic + alias resolution) | first traffic event after deploy | Q4 + Q18 + Q19: ee9d2075 1 signal at T+9h41m, no signature/lock linkage |
| backward-compat-path-matrix.md §A3.6 [continuity_p2 per-user delta] | axisVector deltas for each user | §2.3 + §2.4 + §3 of this appendix; T1 unfired → 0 empirical delta |
| lock4-impact-decision-template.csv row 38ce28d2 col `continuity_p2_observable` | actual V=2 axisVector vs V=1 | Q17: 0 V=2 derivation event; observable = "no event in 24h window" |
| lock4-impact-decision-template.csv row 85bd8f1f col `continuity_p2_observable` | (same column for STILLWATER) | Q17: superseded since 2026-05-02; no V=1 active row to compare |
| lock4-impact-decision-template.csv row 3c732192 cols (has_active_lock / FP version / multi cells) | unknown lock state | Q17 dump: 0 lock rows for 3c732192 → `has_active_lock = no, fingerprint_version = n/a` |
| lock4-impact-decision-template.csv row 2322beb7 cols | unknown lock state | Q17 dump: 0 lock rows for 2322beb7 → `has_active_lock = no, fingerprint_version = n/a` |
| lock4-impact-decision-template.csv row ee9d2075 cols | unknown lock state | Q17 + Q19: 0 lock rows for ee9d2075 → `has_active_lock = no, fingerprint_version = n/a` |
| lock4-impact-decision-template.csv row `all_other_locked_users_count` | production count beyond 5 baseline | Q17: locks table is exhaustively 2 rows (both baseline) → count = 0 |
| HK-deprecate-low-row-status.md [A2.6] db_orphan_status (1 aggregate marker conditional on §1 cohort proof) | broader production presence | §1 distinct-user proof + Q12: 0 new pattern_family in 24h; 16 LOW-row strings remain unobserved in production cohort |
| AL-2_SPRINT_CLOSURE.md §5.7 (inner-repo `bty-app/src/lib/bty/archetype/` tracking) | 16-file working tree tracking decision | Inspected: 3 tracked (`buildFingerprintInput.{ts,test.ts}`, `tensionAxisToAxisVector.ts`), 13 untracked. Decision: defer to AL-2-D fingerprint sprint (FINGERPRINT_VERSION coupling). |
| AL-2_SPRINT_CLOSURE.md §5.7 (supabase migrations tracking) | `20260505000000_bty_archetype_naming_locks.sql` + companion RPC | Inspected: both `20260505000000_bty_archetype_naming_locks.sql` and `20260505000001_bty_create_archetype_lock_rpc.sql` untracked in inner repo. Decision: track at next migration commit cycle (out of AL-2-D-P1 close scope). |

### §3.2 Deferred to AL-2-HK (10)

Per Guard 8 (no new sprint dispatch), these markers are registered as backlog candidates without resolution in this dispatch:

| source | marker context | deferral target |
|---|---|---|
| HK-deprecate-low-row-status.md row 33 `principle_with_constraint` (scenario_data_presence) | `<C5 inventory에서 확인>` per [A2.2] sampled_verification gap | AL-2-HK HK2 (37-row policy) |
| HK-deprecate-low-row-status.md row 34 `scaling_control` | (same column class) | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md row 35 `self_correction_protocol` | (same column class) | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md row 36 `successor_ownership_mechanism` | (same column class) | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md row 37 `system_constraint` | (same column class) | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md row 38 `system_independence` | (same column class) | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md row 39 `system_reinforcement` | (same column class) | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md row 40 `system_reliability` | (same column class) | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md rows 41–48 (`decentralized_correction` … `system_humility`, 8 rows) | aggregated as remaining HK marker class | AL-2-HK HK2 |
| HK-deprecate-low-row-status.md [A2.2] sampled_verification_count (17/37 carry C5 marker pending grep verification) | code-side audit metadata | AL-2-HK HK2 |

→ Aggregated in this appendix as **10 deferred markers**. Per Guard 6 (no resolution by inference), these remain marked in source docs and migrate to AL-2-HK scope.

### §3.3 미해결-별도-sprint scope (Q15/Q16 baseline 후보)

Q15 (`user_pattern_signatures` oldest 5 user) / Q16 (`bty_arena_signals` oldest 5 user) were not part of this paste-back's executed query set. Baseline candidate identification at user_pattern_signatures / bty_arena_signals layer migrates to **AL-2-HK HK4** (5 baseline UUID 정밀 식별).

### §3.4 Marker count tally

| status | count |
|---:|---:|
| Resolved by §3.1 | 16 |
| Deferred to AL-2-HK §3.2 | 10 |
| **total** | **26** |

→ 16/26 resolved + 10/26 deferred. Per dispatch §3 spec.

---

## §4 — Lock 4 baseline 정정 (memory #10 historical phrasing)

Memory #10 phrasing **"5 baseline user"** is a *historical* multi-layer convention covering candidates seen across `user_pattern_signatures`, `bty_arena_signals`, and `bty_archetype_naming_locks`. The Lock 4 dimension (specifically `bty_archetype_naming_locks`) carries a stricter scope.

### §4.1 Lock 4 active baseline (post-Q17)

**1 active V=1 lock**:

| user_id | archetype_name | class | locked_at | superseded_at | superseded_by_id |
|---|---|---|---|---|---|
| `38ce28d2-79e4-4de5-b554-c10404714d9f` | **QUIETFLAME** | repair | 2026-05-04 11:49:56-07 | **null (active)** | null |

### §4.2 Lock 4 historical (superseded)

**1 superseded row**:

| user_id | archetype_name | class | locked_at | superseded_at | superseded_by_id |
|---|---|---|---|---|---|
| `85bd8f1f-fb42-4788-b0da-2ea43648ffd2` | STILLWATER | stability | 2026-05-02 13:28:41-07 | **2026-05-02 15:24:53-07** | null |

→ STILLWATER's supersede event (2026-05-02 15:24:53-07) **predates AL-2-A Council session (2026-05-08) by 6 days** — *not* AL-2 drift. `superseded_by_id = null` indicates no successor lock was minted.

### §4.3 Other baseline-named users (not Lock 4 active)

Per Q17 lock dump (exhaustively 2 rows):

| user_id | Lock 4 row count | Lock 4 status |
|---|---:|---|
| 2322beb7-fd47-4b0c-be4d-1c45b25af1f5 | 0 | none |
| 3c732192-4b96-4b14-bc3a-e740920510c6 | 0 | none |
| ee9d2075-f4ae-4949-9392-38865c2cab22 | 0 | none |

→ These 3 users belong to "5 baseline" historical phrasing but have no Lock 4 footprint. Baseline candidate identification for `user_pattern_signatures` / `bty_arena_signals` layers is **AL-2-HK HK4 scope** (Q15/Q16 deferred per §3.3).

### §4.4 Memory phrasing handoff

| memory key | prior phrasing | post-AL-2-D-P1-close phrasing |
|---|---|---|
| #10 | "5 baseline user" | "Lock 4 active baseline = 1 (38ce28d2 QUIETFLAME); 'baseline' at user_pattern_signatures / bty_arena_signals layers = AL-2-HK HK4 scope" |

→ Anthropic memory update marker queued for Commander turn (post C5 paste-back).

---

## §5 — Axis term anomaly (A1) — `axis = "Reputation"`

### §5.1 Observation

A `user_pattern_signatures` row for `ee9d2075-f4ae-4949-9392-38865c2cab22` contains `axis = "Reputation"`.

### §5.2 BTY canonical 12 axes

Per [docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §4.1](specs/ARCHETYPE_DETERMINISM_LOCK_V1.md) and [pattern-family.ts](../bty-app/src/domain/pattern-family.ts) anchor map:

```
Ownership · Time · Authority · Truth · Repair · Conflict ·
Integrity · Visibility · Accountability · Courage(Risk) · Control · Identity
```

→ `"Reputation"` ∉ canonical 12 axes.

### §5.3 Schema analysis (Q7)

`user_pattern_signatures.axis` column = **`text NOT NULL`** with **no enum constraint** — accepts arbitrary string literals.

### §5.4 Determinism / Lock 4 / FINGERPRINT_VERSION impact

- **Determinism impact**: 0. The activePatterns Set normalization (R3.5.2 closure) and pen() lookup operate on `pattern_family` (canonical/alias-resolved), not on the `axis` text column. Free-text `axis` values do not flow into `selectArchetype(axisVector)` because axis-name-to-axisVector mapping is code-side ([buildFingerprintInput.ts](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts)).
- **Lock 4 impact**: 0. Lock 4 freeze applies to `archetype_name` minted from `axisVector`, not from `user_pattern_signatures.axis`. Q17 confirms 0 lock 4 mutation in window.
- **FINGERPRINT_VERSION impact**: 0. Hash input uses `axisVector` (typed, 12-dim), not `user_pattern_signatures.axis` text.
- **Scenario α (no-bump V=1 freeze) impact**: 0.

### §5.5 Audit registration

Treated as audit-only finding; no AL-2-D-P1 close blocker. Registered as **AL-2-HK HK5** (axis term 자유 텍스트 정책 검토 — schema enum 도입 vs application-side validation 결정).

---

## §6 — AL-2-D-P1 close 결정 lock — Path P4 (V=1 freeze)

### §6.1 Decision

**FINGERPRINT_VERSION = 1** (Lock 6 carry-forward) preserved. Path **P4 (V=1 freeze, no bump)** selected.

### §6.2 근거 (audit + observe combined)

| evidence source | finding |
|---|---|
| [A4.18] no_trigger_alone_forces_bump | None of T1–T4 alone forces bump (audit assertion) |
| [A4.19] favored_default | Lock 6 carry-forward (V=1 preserved) is favored interpretation per [AL-2_SPRINT_CLOSURE.md §4.1](AL-2_SPRINT_CLOSURE.md) (audit assertion) |
| §1 + §2 (24h observe) | T1 ∨ T2 ∨ T3 ∨ T4 = false (empirical) |
| Guard 11 (Determinism > convenience) | P4 is the only path that PASSes Guard 11 fully (P1 = schema change required; P2 = forced migration → PARTIAL; P3 = lazy migration → PARTIAL) |

### §6.3 Locked invariants (post-AL-2-D-P1-close)

- `FINGERPRINT_VERSION = 1` (Lock 6 carry-forward)
- `bty_archetype_naming_locks` schema and contents unchanged
- `user_pattern_signatures` schema and contents unchanged (1 free-text axis term registered as AL-2-HK HK5; not a Lock 4 close blocker)
- `bty_arena_signals` 정상 운영 지속
- 59-entry alias dictionary at [pattern-family.ts:26-118](../bty-app/src/domain/pattern-family.ts#L26-L118) — capacity wired AND runtime-activated (R3.5.2 closure preserved)
- Lock 7 R3.5.2 — raw `patternFamilies.map(p => p.pattern_family)` passthrough at [buildFingerprintInput.ts:50](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L50) preserved (T2 status quo A4.7)

### §6.4 Bump 미실행 — Paths considered

| path | content | Guard 11 | status in this close |
|---|---|---|---|
| P1 | dual-version coexist (V=1 + V=2 rows queryable; schema relax of `bty_archetype_naming_locks` exclude constraint) | PASS only after schema migration | **NOT SELECTED** — schema 변경 불필요, T3 unfired |
| P2 | forced migration (V=2 supersede chain on all locked users) | **PARTIAL** | **NOT SELECTED** — Guard 11 violation |
| P3 | lazy migration (supersede chain on next eligible event per user) | **PARTIAL** | **NOT SELECTED** — Guard 11 violation |
| P4 | V=1 freeze (Lock 6 carry-forward; alias map + R3.5.2 closure absorb effects at V=1) | **PASS** | **SELECTED** |

→ See [backward-compat-path-matrix.md §2](AL-2-D-P1-R3-backward-compat-path-matrix.md) for full path matrix.

---

## §7 — Worker / runtime authority 상태 (close 시점)

| key | value |
|---|---|
| Inner HEAD | `50317b8` (unchanged across this dispatch) |
| Outer HEAD (at this appendix authoring) | `3b1eb39` (Step 2/3 commits will advance) |
| Worker active | `e9e179ed-38a7-40ae-8f97-13cfb09191b7` (unchanged) |
| Worker name | `bty-arena-staging` |
| Worker deployed at | 2026-05-09T04:17:18Z |
| Observe window | 2026-05-09T04:17:18Z → 2026-05-10T04:17:18Z (T+24h exact) |
| Observe outcome | scenario α confirmed (T1–T4 unfired) |
| Tests | 66/66 PASS (carry-forward; no run in this dispatch) |
| Deploy in this dispatch | 0 |
| `src/` mutation in this dispatch | 0 |
| Runtime impact | 0 |

---

## §8 — Backlog handoff to AL-2-HK / AL-2-E

Per Guard 8 (no new sprint dispatch), the following are **registered as backlog only**.

### §8.1 AL-2-HK cleanup sprint candidates (P0-independent)

| ID | content | source / authority |
|---|---|---|
| HK1 | `patternFamilyCompatibilityMap` 코드 deletion (data/scenario/index.ts:542-556) | [HK-compat-map-deletion-trace.md HK A1](AL-2-D-P1-R3-HK-compat-map-deletion-trace.md): deletion_blocker = none, import_hits = 0, replacement authority = `PATTERN_FAMILY_ALIAS` |
| HK2 | 37 DEPRECATE LOW row 정책 결정 (axisVector 영향 0, determinism violation 0, 처리 정책 결정 필요) | [HK-deprecate-low-row-status.md HK A2](AL-2-D-P1-R3-HK-deprecate-low-row-status.md); [AL-2-B-low-confidence-deferred.md §3.3](AL-2-B-low-confidence-deferred.md) |
| HK3 | 3 dead enum arms 처리 (selector classification: fallback / ai_assisted / cached_match-write-side) | [HK-orphan-and-dead-branch-inventory.md HK A3.8](AL-2-D-P1-R3-HK-orphan-and-dead-branch-inventory.md) |
| HK4 | 5 baseline UUID 정밀 식별 (Q15/Q16 미실행 영역: user_pattern_signatures oldest 5 + bty_arena_signals oldest 5 + cross-validation) | §3.3 of this appendix; §4 baseline 정정 carry-forward |
| HK5 | axis term 자유 텍스트 정책 검토 ("Reputation" ∉ canonical 12 axes; schema axis text NOT NULL no enum) | §5 of this appendix |

### §8.2 AL-2-E (scope TBD)

Hanbit scope 정의 선행 후 dispatch. 현재 메모리 표기: **"AL-2-E (scope TBD)"**. Inventory-first 원칙으로 scope 미정의 상태 진입 금지. Candidate inputs already known: scenario JSON re-tag (Lock 5 deferral), bty_tension_axis literal alignment, 12 Type 4 OUTSIDE literal rewrite (per [AL-2_SPRINT_CLOSURE.md §5.3](AL-2_SPRINT_CLOSURE.md)).

### §8.3 Sprint family closure status

```
AL-2-A      CLOSED (2026-05-08)
AL-2-B      CLOSED (P0/P1/P2/P3, 2026-05-08 → 2026-05-09)
AL-2-C      CLEAN CLOSE (R3 + mutation, 2026-05-09)
AL-2-D-P0   CLEAN CLOSE (R3.5.2 closure deploy e9e179ed, 2026-05-09T04:17:18Z)
AL-2-D-P1   CLEAN CLOSE (this appendix; V=1 freeze lock, 2026-05-10)
AL-2-HK     BACKLOG (5 candidates registered)
AL-2-E      BACKLOG (scope TBD)
```

→ AL-2 sprint family clean closure achieved with Lock 6 (FINGERPRINT_VERSION = 1) carry-forward intact.
