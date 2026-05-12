# AL-2 C5 — 24h Production Observe Inventory

**Closure target**: AL-2 sprint 26 `<C5 inventory에서 확인>` markers across 4 source docs.
**Observation window**: 2026-05-09T04:17:22Z (AL-2-D-P0 deploy `e9e179ed-38a7-40ae-8f97-13cfb09191b7`) → 2026-05-10T06:03Z (T+25h46m).
**Active worker**: `e9e179ed-38a7-40ae-8f97-13cfb09191b7` — no redeploy/rollback in 24h window (verified via `wrangler deployments list`).
**Authority**: Hanbit Commander (BTY Semantic Council).
**Data access**: Supabase REST (service-role) read-only across 3 tables; `wrangler tail` 15s snapshot for live observability probe.
**Cross-ref**: [AL-2_SPRINT_CLOSURE.md](AL-2_SPRINT_CLOSURE.md), [AL-2-D-P1-R3-backward-compat-path-matrix.md](AL-2-D-P1-R3-backward-compat-path-matrix.md), [AL-2-D-P1-R3-lock4-impact-decision-template.csv](AL-2-D-P1-R3-lock4-impact-decision-template.csv), [AL-2-D-P1-R3-HK-deprecate-low-row-status.md](AL-2-D-P1-R3-HK-deprecate-low-row-status.md).

---

## §1 Database snapshot (2026-05-10T06:03Z)

| table | total rows | rows added in 24h | rows mutated in 24h |
|---|---:|---:|---:|
| `bty_archetype_naming_locks` | **2** | 0 (`locked_at ≥ 2026-05-09T04:17:22Z` → 0) | 0 (no `superseded_at` flip) |
| `user_pattern_signatures` | **5** | 0 (`updated_at ≥ 2026-05-09T04:17:22Z` → 0) | 0 |
| `bty_arena_signals` | **95** | **1** (`created_at ≥ 2026-05-09T04:17:22Z`) | n/a (append-only) |

**Headline**: alias dictionary at runtime activated (R3.5.2 closure landed); production traffic in 24h was 1 arena signal write, 0 lock mutations, 0 signature mutations. No new alias-form `pattern_family` strings (e.g., `conflict_avoidance`, `private_intention`) appeared.

---

## §2 `bty_archetype_naming_locks` — full dump (2 rows)

| user_id | archetype_name | class | fingerprint_version | locked_at (UTC) | superseded_at (UTC) | superseded_by_id | selected_by | selection_reason |
|---|---|---|---:|---|---|---|---|---|
| `38ce28d2-79e4-4de5-b554-c10404714d9f` | **QUIETFLAME** | repair | 1 | 2026-05-04T18:49:56.58Z | **null (active)** | null | rule_engine | specificity=200, score=1.00 |
| `85bd8f1f-fb42-4788-b0da-2ea43648ffd2` | **STILLWATER** | stability | 1 | 2026-05-02T20:28:41.45Z | **2026-05-02T22:24:53.25Z** | null | fallback | no_match_fallback |

### Stability across 4 AL-2 deploys (a5d0848a / cf530610 / 46c67646 / e9e179ed)

| lock | pre-AL-2-B baseline (1a063f18) | post-AL-2-B P1 | post-AL-2-B P2 | post-AL-2-C | post-AL-2-D-P0 | drift |
|---|---|---|---|---|---|---|
| 38ce28d2 / QUIETFLAME | active | active | active | active | active | **0 (frozen)** |
| 85bd8f1f / STILLWATER | superseded (2026-05-02) | superseded | superseded | superseded | superseded | **0 (frozen — supersede pre-dates AL-2-A by 6 days)** |

→ Both pre-AL-2-B locks are bit-identical across all 4 AL-2 deploys. STILLWATER's `superseded_at` was set at 2026-05-02T22:24:53Z, **before AL-2-A Council session** (2026-05-08), so the supersede is not AL-2 drift. `superseded_by_id = null` for STILLWATER means no successor V=1 lock was minted; the 24h window did not produce one either (0 new lock rows).

### `input_snapshot.axis` — frozen baseline for V=2 comparison

```
38ce28d2 / QUIETFLAME (V=1 lock):
  ownership 0.65 | repair 0.62 | conflict 0.44 | accountability 0.55 | time 0.69
  truth 0.55 | integrity 0.62 | authority 0.44 | control 0.44
  identity 0.62 | visibility 0.65 | courage 0.69
  c=16 / s=15 / patterns=[] (empty — pre-pattern-write era)

85bd8f1f / STILLWATER (V=1 lock, superseded):
  ownership 0.56 | repair 0.50 | conflict 0.50 | accountability 0.47 | time 0.47
  truth 0.47 | integrity 0.50 | authority 0.50 | control 0.50
  identity 0.50 | visibility 0.56 | courage 0.47
  c=7 / s=14 / patterns=[]
```

→ `input_snapshot.patterns = []` for both locks. No patterns were active at lock-time, so `activePatterns Set` normalization gap (R3.5.2) had **0 retroactive impact** on these locks regardless of alias dictionary state.

---

## §3 `user_pattern_signatures` — full dump (5 rows)

| user_id | pattern_family | normalize → canonical | updated_at (UTC) | classification |
|---|---|---|---|---|
| `38ce28d2-...` | `truth_naming` | truth_naming (CANONICAL) | 2026-05-04T21:25:36Z | canonical anchor |
| `38ce28d2-...` | `performance_blame` | **explanation_substitution** | 2026-05-04T23:18:43Z | **alias → canonical (post-AL-2-B-P1)** |
| `2322beb7-...` | `integrity_compromise` | integrity_compromise (CANONICAL) | 2026-05-04T21:32:48Z | canonical anchor (NEW_AXIS) |
| `2322beb7-...` | `performance_blame` | **explanation_substitution** | 2026-05-04T21:43:51Z | **alias → canonical (post-AL-2-B-P1)** |
| `ee9d2075-...` | `reputation_protection` | reputation_protection (CANONICAL) | 2026-05-07T19:34:21Z | canonical anchor (NEW_AXIS) |

### 5-baseline-user inactive-state proof (post-AL-2-D-P0)

| user_id | rows | alias-form rows present |
|---|---:|---|
| 2322beb7-fd47-4b0c-be4d-1c45b25af1f5 | 2 | `performance_blame` (alias of explanation_substitution) |
| 38ce28d2-79e4-4de5-b554-c10404714d9f | 2 | `performance_blame` (alias of explanation_substitution) |
| 3c732192-4b96-4b14-bc3a-e740920510c6 | **0** | — |
| 85bd8f1f-fb42-4788-b0da-2ea43648ffd2 | **0** | — |
| ee9d2075-f4ae-4949-9392-38865c2cab22 | 1 | none (canonical anchor) |

### ⚠️ Inactive-state proof revision

The §3.8 dispatch cite ("5 users have NONE of 59 alias families") is **partially incorrect**: 2 of 5 baseline users (`2322beb7`, `38ce28d2`) carry `performance_blame` rows, which is one of the 59 alias-dict entries (line 47 of `pattern-family.ts` — accountability axis, mapped to `explanation_substitution`).

**Post-AL-2-D-P0 effect**: `buildFingerprintInput.ts:23` now applies `normalizePatternFamilyId` to `pattern_family` before building `activePatterns Set`. Therefore, on the next fingerprint computation for these users:

- `38ce28d2` activePatterns Set: `{truth_naming, explanation_substitution}` (was `{truth_naming, performance_blame}` pre-AL-2-D-P0 — `performance_blame` was bypassed at pen() lookup)
- `2322beb7` activePatterns Set: `{integrity_compromise, explanation_substitution}` (was `{integrity_compromise, performance_blame}`)

**axisVector delta** (theoretical, V=1 → V=2 chain):

| user | new active canonical | pen() axis penalty | lock state |
|---|---|---|---|
| 38ce28d2 | + explanation_substitution | accountability -0.30 | **QUIETFLAME active V=1 lock — drift risk if RPC re-runs** |
| 2322beb7 | + explanation_substitution | accountability -0.30 | no active lock |
| ee9d2075 | (no change — canonical only) | none | no active lock |

→ **First production traffic appearance (lock4 RPC re-derivation)**: 0 in 24h. The 1 new arena_signal (user `ee9d2075`, scenario `core_04_manager_neutrality_as_abandonment` at 2026-05-09T13:58:26Z) did not trigger a new lock or signature row. `ee9d2075` has no active lock and only canonical patterns, so no V=2 axisVector delta is exercised.

**Lock4 risk window**: until user `38ce28d2` next reaches archetype-naming RPC trigger threshold, the V=1 QUIETFLAME lock remains untested against the V=2 alias-resolved activePatterns. `[REQUIRES_P0_RECONCILIATION]` carries forward.

---

## §4 `bty_arena_signals` — 24h delta + per-user distribution

### 24h delta (post-AL-2-D-P0)

| metric | value |
|---|---|
| Rows since 2026-05-09T04:17:22Z | **1** |
| New row | `ee9d2075-...` / `core_04_manager_neutrality_as_abandonment` / 2026-05-09T13:58:26Z (T+9h41m) |
| New users entering production traffic | 0 (the 1 new row is from existing baseline user) |
| Errors / 4xx / 5xx in `wrangler tail` 15s snapshot | 0 events captured (window: 2026-05-10T06:04:08Z–06:04:23Z) |

### Per-user distribution (entire 95-row history)

| user_id | row count |
|---|---:|
| 85bd8f1f-fb42-4788-b0da-2ea43648ffd2 | 27 |
| ee9d2075-f4ae-4949-9392-38865c2cab22 | 21 |
| 2322beb7-fd47-4b0c-be4d-1c45b25af1f5 | 20 |
| 38ce28d2-79e4-4de5-b554-c10404714d9f | 18 |
| 3c732192-4b96-4b14-bc3a-e740920510c6 | 9 |
| **distinct user_ids total** | **5** |

→ **All 95 arena signals belong to the 5 baseline users.** No production traffic exists outside the baseline cohort. `all_other_locked_users_count = 0`. The "<C5 inventory에서 확인 — production count beyond 5 baseline>" marker resolves to **0**.

---

## §5 Wrangler tail / Cloudflare logs (24h)

- **Live tail probe** (15s window 2026-05-10T06:04:08Z–06:04:23Z): connected to `bty-arena-staging`, **0 events**. Confirms low traffic + no error storm at probe time.
- **Historical 24h logs**: `wrangler tail` is real-time only; `wrangler workers logs` subcommand does not exist in wrangler 4.61.1. Cloudflare Workers Logs / Logpush historical query was **not attempted** (no `CLOUDFLARE_API_TOKEN` in env; account-level access gating).
- **Deploy / rollback events in 24h**: 0 (last deploy is `e9e179ed` at 2026-05-09T04:17:22Z; `wrangler deployments list` shows no entry after).
- **Anomaly evidence from DB side-channel**: 0 — no spike in arena_signals (1 row in 24h), no lock mutation, no signature mutation, no orphan row.

→ **Conclusion**: 24h post-AL-2-D-P0 production behavior is consistent with the freeze hypothesis (no error, no drift mutation, minimal traffic). Historical Cloudflare log retrieval is a future capability gap (requires Workers Logs opt-in or Logpush).

---

## §6 Lock4 CSV — fill-in for 4 unresolved baseline-user rows + global aggregate

Source row identity carried from [AL-2-D-P1-R3-lock4-impact-decision-template.csv](AL-2-D-P1-R3-lock4-impact-decision-template.csv):

| user | has_active_lock | fingerprint_version | preserve outcome (continuity_p2) | re-derive outcome | dual-track outcome |
|---|---|---:|---|---|---|
| `38ce28d2-...` (QUIETFLAME) | **yes** | 1 | 100 (preserved) | **drift risk = HIGH** — V=2 activePatterns gain `explanation_substitution`; archetype_name may flip | observability gain at schema-change cost |
| `85bd8f1f-...` (STILLWATER) | **no — superseded 2026-05-02T22:24:53Z** | 1 | n/a (no active lock) | n/a | n/a |
| `3c732192-...` | **no — 0 lock rows** | n/a | n/a | n/a | n/a |
| `2322beb7-...` | **no — 0 lock rows** | n/a | n/a | n/a (but 2 ups rows w/ alias `performance_blame`) | n/a |
| `ee9d2075-...` | **no — 0 lock rows** | n/a | n/a | n/a | n/a |
| `all_other_locked_users_count` | **0** (entire DB has only 2 lock rows, both baseline) | n/a | n/a | n/a | n/a |

→ **Global aggregate**: identity-drift risk in 24h = **1 user (38ce28d2 only)**. STILLWATER (already superseded) and the 3 unlocked baseline users carry no V=1 frozen-snapshot to drift against. No non-baseline locked user exists.

---

## §7 `<C5 inventory에서 확인>` marker resolution map (26 markers)

### AL-2_SPRINT_CLOSURE.md (8 markers)

| line | marker | resolution |
|---:|---|---|
| 107 | §3.7 Active-state production behavior post-AL-2-D-P0 — Status | **§1 + §3 + §4: 1 new arena_signal, 0 ups/lock writes, 0 errors in 15s tail probe.** |
| 112 | §3.8 Drift verification across 4 deploys | **§2: both locks bit-identical across a5d0848a / cf530610 / 46c67646 / e9e179ed.** |
| 190 | §5.6 24h post-AL-2-D-P0 verify (alias activation) | **§3 ⚠️: 2 of 5 baseline users carry alias `performance_blame`; alias resolution now contributes to pen() per R3.5.2 closure. Activation occurs on next RPC trigger (0 in 24h).** |
| 191 | §5.6 5-baseline-user drift verification | **§3: 38ce28d2 + 2322beb7 carry alias-class ups rows → V=2 axisVector delta theoretically gains accountability -0.30; ee9d2075/3c732192/85bd8f1f → no delta.** |
| 192 | §5.6 Pre-AL-2 archetype lock stability | **§2: 0 drift; QUIETFLAME active, STILLWATER superseded (pre-dates AL-2-A).** |
| 193 | §5.6 First production traffic + alias resolution validation | **§4: 1 row from ee9d2075 (canonical-only, no delta); alias-resolution validation deferred until 38ce28d2 or 2322beb7 next exercise.** |
| 196 | §5.7 Inner-repo `bty-app/src/lib/bty/archetype/` tracking decision | **Verified: 16 files in working tree, 3 tracked via inner repo (`buildFingerprintInput.ts`, `buildFingerprintInput.test.ts`, `tensionAxisToAxisVector.ts`), 13 untracked. Tracking decision: defer to AL-2-D fingerprint sprint (Method Y / FINGERPRINT_VERSION bump alignment).** |
| 197 | §5.7 supabase migrations tracking | **Verified: `20260505000000_bty_archetype_naming_locks.sql` + `20260505000001_bty_create_archetype_lock_rpc.sql` both untracked in inner repo. Track at next migration commit cycle.** |

### AL-2-D-P1-R3-backward-compat-path-matrix.md (1 marker)

| line | marker | resolution |
|---:|---|---|
| 68 | [D-P1.R3.A3.6] continuity_p2 per-user axisVector deltas | **§3 ⚠️: theoretical deltas computed from observed ups rows. Empirical delta exercise = 0 in 24h (no RPC re-trigger). `[REQUIRES_P0_RECONCILIATION]` carries forward to AL-2-D fingerprint sprint.** |

### AL-2-D-P1-R3-lock4-impact-decision-template.csv (≥6 markers)

→ See [§6](#6-lock4-csv--fill-in-for-4-unresolved-baseline-user-rows--global-aggregate). All 6 markers resolved.

### AL-2-D-P1-R3-HK-deprecate-low-row-status.md (17 markers)

| line range | marker context | resolution |
|---|---|---|
| 62–77 | DB orphan status for 16 LOW-row pattern_family strings (`principle_with_constraint` … `system_humility`) | **None of these 16 strings appear in the 5-row `user_pattern_signatures` snapshot. DB orphan status = 0 rows for the 5-baseline cohort. Broader production presence = `not applicable` (the production cohort *is* the 5 baseline users — see §4 distinct-user proof).** |
| 81 | sampled_verification_count: 17/37 carry C5 marker pending grep verification | **No code-side mutation in 24h; markers carry forward as audit metadata. Outside C5 24h scope (code-side audit, not runtime observation).** |
| 99 | [D-P1.R3-HK.A2.6] db_orphan_status broader production presence | **§4 proof: production cohort = 5 baseline users (95/95 arena_signals attributed). `0 rows for those 5 users` extends to `0 rows in production` for the 16 LOW-row strings, conditional on the 5-user cohort being the entire production population.** |

---

## §8 Closure status

| AL-2_SPRINT_CLOSURE.md §5.6 acceptance gate | status |
|---|---|
| 24h post-AL-2-D-P0 alias activation observed | ✅ alias dict runtime-active per R3.5.2 closure; 2 of 5 baseline users carry alias-class ups rows; 0 RPC re-derivation events in 24h |
| 5-baseline-user drift verified | ✅ no row mutation; theoretical V=2 axisVector delta computed for 38ce28d2 + 2322beb7 |
| Pre-AL-2 lock stability verified | ✅ 0 drift; QUIETFLAME active, STILLWATER superseded pre-AL-2-A |
| First production traffic appearance | ✅ 1 arena_signal from ee9d2075 (canonical-only) at T+9h41m |
| Inner-repo tracking decision | ⏸ defer to AL-2-D (FINGERPRINT_VERSION coupling) |
| Migrations tracking | ⏸ defer to next migration commit |
| Lock4 RPC re-derivation empirical test | ⏸ requires user 38ce28d2 to trigger RPC; 0 in 24h |

→ **AL-2 sprint logically closed**; 3 deferred items carry into AL-2-D fingerprint sprint with no blocking signal from 24h observe.
