# AL-2-D-P1+ R3 — Backward-compat Path Matrix (Area 3)

**Sprint**: AL-2-D-P1+ R3 (Identity Continuity Verification)
**Date (issuance)**: 2026-05-09
**Mode**: read-only inventory; no migration prescribed
**Guard 11 (Determinism > convenience)**: applied throughout

---

## §1 Schema inventory (current state)

### §1.1 `bty_archetype_naming_locks`
Source: [bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql](../bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql)

- `input_hash text not null` — full SHA-256 hash
- `fingerprint_version smallint not null default 1` — **native version column present**
- `superseded_at timestamptz` / `superseded_by_id uuid` — supersede chain
- Constraint `unique_active_lock_per_user`: gist exclude `(user_id with =) where superseded_at is null` — **at most one active row per user_id at any time**
- Index `idx_archetype_lock_active_input`: unique `(user_id, input_hash) where superseded_at is null` — same hash can't double-active
- Index `idx_archetype_lock_hash`: non-unique `(input_hash)` — version-agnostic lookup
- Index `idx_archetype_lock_user_active`: `(user_id, locked_at desc) where superseded_at is null`

### §1.2 `user_pattern_signatures`
Source: [bty-app/supabase/migrations/20260410140000_user_pattern_signatures.sql](../bty-app/supabase/migrations/20260410140000_user_pattern_signatures.sql)

- `pattern_family text` / `axis text` — pattern identity
- Unique index `(user_id, pattern_family, axis)` — one row per triple
- **No `version` / `fingerprint_version` column** — no native per-version segregation
- `current_state` enum: `active | unstable | improving | resolved`
- `last_validation_result` enum: `changed | unstable | no_change`

### §1.3 `bty_arena_signals`
Source: [bty-app/supabase/migrations/20260413000000_bty_identity_flow.sql:8-19](../bty-app/supabase/migrations/20260413000000_bty_identity_flow.sql#L8-L19)

- `traits jsonb` / `meta jsonb` — derive metrics via `computeMetrics(signals)` ([buildFingerprintInput.ts:21](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L21))
- **No pattern_family field** — pattern identity is decoupled from arena signal storage
- **No version column** — signals are version-agnostic raw input

---

## §2 Path-decision matrix

| Path | Storage strategy | Migration cost | Identity continuity | Determinism (Guard 11) |
|---|---|---|---|---|
| **P1** | dual-version coexist (version-tagged rows): `bty_archetype_naming_locks` already has `fingerprint_version` column; relax `unique_active_lock_per_user` exclude to permit one active row *per (user_id, fingerprint_version)* pair; `user_pattern_signatures` would need a `fingerprint_version` column added (default 1, NOT NULL) and the unique index extended to `(user_id, pattern_family, axis, fingerprint_version)` | medium-high (constraint replacement on `bty_archetype_naming_locks` + new column + index rewrite on `user_pattern_signatures`; one concern per migration per `migrations` rule means at minimum 2 migrations) | preserved per user — V=1 active row stays active; V=2 row coexists | per-version determinism preserved (each version has its own deterministic chain); cross-version identity equality is *not* asserted, which is consistent with V being a version axis |
| **P2** | forced migration (rewrite all rows): on bump, run an offline migration that recomputes `inputHash` for every active lock row using the V=2 chain, supersedes V=1 rows in batch | high (offline batch + RPC bypass risk + race with live traffic; would require freeze window beyond the current 24h observe) | drift risk — any user whose axisVector actually changed under new alias resolution gets a new `archetype_name`; users with unchanged axisVector get the same name but a new hash | uniform determinism (one V everywhere) but at cost of erasing V=1 history; supersede chain audit trail preserves it as `superseded_by_id` lineage |
| **P3** | lazy migration (re-derive on access): no batch; the existing supersede chain in `bty_create_archetype_lock` RPC handles re-derivation organically as users trigger lock evaluation; users who never re-trigger remain on V=1 | low (no schema change; no batch; existing RPC already supports the supersede flow) | per-user delay — user's continuity is preserved until first eligible event post-bump, then the same drift risk as P2 applies for that user | hybrid — observable production state holds a mix of V=1 and V=2 active rows during the migration tail; cross-row determinism still holds within each version |
| **P4** | bump skip (defer V=2 indefinitely): preserve Lock 6 (FINGERPRINT_VERSION = 1) carry-forward indefinitely; resolve any production observation that would justify a bump via downstream means (alias dictionary tweaks, scenario JSON re-tag at AL-2-E, etc.) without touching the constant | 0 | preserved (no bump → no chain break) | static — V=1 determinism preserved; semantic changes upstream are absorbed at axisVector level (alias map etc.) which already changes hash without a V bump per [docs/AL-2-D-P1-R3-archetype-determinism-trace.md §6](AL-2-D-P1-R3-archetype-determinism-trace.md) |

---

## §3 Guard 11 evaluation per path

[D-P1.R3.A3.1] guard11_path_p1: PASS. Per-version determinism preserved; cross-version equality not asserted (correctly — that is what V means). Convenience cost = medium-high migration but no determinism compromise.

[D-P1.R3.A3.2] guard11_path_p2: PARTIAL. Uniform V=2 determinism after migration, but the migration window itself produces a transient state where V=1 rows are being superseded in batch — during that window, `findActiveLockByHash` for some users may race with the batch, producing observably non-deterministic responses. Mitigatable via freeze window; cost vs benefit unfavorable.

[D-P1.R3.A3.3] guard11_path_p3: PARTIAL. Each user's chain is deterministic; the *system* shows a mix of V=1 and V=2 active rows for a long tail. Determinism-per-user is preserved; system-wide uniformity is not. Per Guard 11 (Determinism > convenience), system uniformity is convenience; per-user determinism is the determinism that matters → P3 acceptable.

[D-P1.R3.A3.4] guard11_path_p4: PASS. V=1 determinism fully preserved. The implicit assumption is that semantic changes can be absorbed upstream of the version constant. Per [archetype-determinism-trace.md §6](AL-2-D-P1-R3-archetype-determinism-trace.md), alias map changes already alter hash output at V=1 — the V constant is one of *several* invalidation knobs.

---

## §4 Identity continuity preservation per path

[D-P1.R3.A3.5] continuity_p1: 100% — V=1 active rows remain active; V=2 rows added as parallel observation. Lock 4 baseline users (38ce28d2 / 85bd8f1f) keep their archetype_name and input_hash unchanged.

[D-P1.R3.A3.6] continuity_p2: variable — depends on whether each user's axisVector actually changed under the V=2 chain. <C5 inventory에서 확인> until production observation determines per-user axisVector deltas. [REQUIRES_P0_RECONCILIATION]

[D-P1.R3.A3.7] continuity_p3: same as P2 but spread over a long tail; archetype_name change events surface lazily as users trigger eligible events.

[D-P1.R3.A3.8] continuity_p4: 100% — no bump, no chain break.

---

## §5 Coexistence feasibility (dispatch question)

Dispatch Area 3 question: "Pre-bump user (V=1)와 post-bump user (V=2)가 coexistence 가능한가?"

[D-P1.R3.A3.9] coexistence_at_lock_table_level: feasible at column level (`fingerprint_version` exists). NOT feasible under current `unique_active_lock_per_user` exclude constraint without relaxation — at most one active row per user. Path P1 requires constraint replacement.

[D-P1.R3.A3.10] coexistence_at_pattern_signatures_level: NOT feasible without schema addition. `user_pattern_signatures` has no `fingerprint_version` column; the unique index `(user_id, pattern_family, axis)` would collide if one user holds both V=1 and V=2 signatures for the same (family, axis).

[D-P1.R3.A3.11] coexistence_at_arena_signals_level: feasible — `bty_arena_signals` is version-agnostic raw input; both V=1 and V=2 chains derive from the same signals.

[D-P1.R3.A3.12] forced_migration_alternative_paths_existence: P3 (lazy) and P4 (skip) avoid forced migration without schema change. P1 (dual-track) avoids forced migration but requires schema change. Therefore **forced migration (P2) is NOT the only path** — answer to dispatch sub-question.

---

## §6 5-baseline-user observation requirement

[D-P1.R3.A3.13] baseline_user_axis_delta_observability: Per [AL-2_SPRINT_CLOSURE.md §3.8](AL-2_SPRINT_CLOSURE.md): "5 users have NONE of 59 alias families in `user_pattern_signatures`" — so AL-2-D-P0 alias resolution change has zero effect on these 5 users' axisVector at baseline. Carry-forward expected = 0.

[D-P1.R3.A3.14] baseline_user_v_bump_consequence_under_p2: For these 5 users, axisVector should be unchanged → archetype_name unchanged → only input_hash changes. Lock 4 archetype identity preserved even under P2 forced migration **for the 5 baseline users** (provided the carry-forward = 0 inventory holds in production). [REQUIRES_P0_RECONCILIATION] — pending 24h observe paste-back to confirm.

[D-P1.R3.A3.15] baseline_user_v_bump_consequence_under_p4: trivially identity-preserving (no bump).

---

## §7 Recommendation matrix (decision-pending; Commander 영역)

| concern | favored path | reason |
|---|---|---|
| zero schema-mutation | P4 | no bump = no migration |
| Lock 6 invariant (V=1 freeze) preservation | P4 | direct match |
| dual-version observability for analytics | P1 | V column already supports it; constraint relax cost is one-time |
| if T1-T4 trigger fires hard (production demands V=2) | P3 | minimum-disruption path |
| if Commander prioritizes uniform V=2 across all users | P2 | requires offline freeze + batch supersede |

[D-P1.R3.A3.16] recommendation_pending: All 4 paths defer to AL-2-D-P0 24h observe outcome reconciliation. [REQUIRES_P0_RECONCILIATION]

---

## §8 Cross-references

- [docs/AL-2-D-P1-R3-archetype-determinism-trace.md](AL-2-D-P1-R3-archetype-determinism-trace.md) §4-§7 — divergence points
- [docs/AL-2-D-P1-R3-lock4-impact-decision-template.csv](AL-2-D-P1-R3-lock4-impact-decision-template.csv) — per-user decision rows
- [docs/AL-2_SPRINT_CLOSURE.md](AL-2_SPRINT_CLOSURE.md) §3.8, §4.1 — Lock 6 + 5-baseline-user inventory
- [bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql](../bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql) — schema reference
- [bty-app/supabase/migrations/20260410140000_user_pattern_signatures.sql](../bty-app/supabase/migrations/20260410140000_user_pattern_signatures.sql) — signature schema
