# RESULT_ORIGIN_CLOSURE_SPEC

**Status:** NORMATIVE
**Date:** 2026-05-17
**Track:** result_origin closure authoring / STEP 1

**Authority.** This document is normative for the **XP / verified reward closure** of
`result_origin`. Every normative claim is corroborated by raw code measurement (STEP 0 and
STEP 0.5 corroboration reports); `file:line` references are given inline. Items marked
**[OPEN — separate track]** are NOT settled here and carry no normative force.

Related: [`docs/ARENA_CANONICAL_CONTRACT.md`](ARENA_CANONICAL_CONTRACT.md),
[`docs/LEADERSHIP_ENGINE_SPEC.md`](LEADERSHIP_ENGINE_SPEC.md).

---

## §1 Scope

### Closes (normative)

- XP eligibility of a re-exposure validation outcome.
- `verified` reward eligibility of a re-exposure validation outcome.
- The total-XP-zero invariant for `insufficient_signal`.
- The `verified = false` value for `insufficient_signal`.

### Does NOT close

- The `le_activation_log` `micro_win` activation footprint emitted on every re-exposure
  validation.
- Downward dilution of AIR / LRI / team-AIR / TII caused by that footprint.
- The Stage-3 forced-reset contributory-input behaviour of that footprint.
- Whether the AIR footprint is intended integrity-metric behaviour or a fallback-penalty
  defect.

The non-closed items are described as a boundary in §5. They are not invariants fixed by
this document.

---

## §2 Definition

`ValidationResultOrigin = "computed" | "insufficient_signal"` —
`src/domain/leadership-engine/patternShift.ts:24`.

The value tags every re-exposure validation payload as
`ReexposureValidationPayload.result_origin` (`reexposureValidation.server.ts:36`).

### Set sites — 5 sites across 2 files

| Literal | Site | Condition |
|---|---|---|
| `insufficient_signal` | `route.ts:189` | `computeReexposureValidation` returned `ok:false` — `elite_axis_missing` |
| `insufficient_signal` | `reexposureValidation.server.ts:250` | `after_second_choice_missing` (no `afterEv`) |
| `insufficient_signal` | `reexposureValidation.server.ts:283` | `no_prior_run` (no `priorRunId`) |
| `insufficient_signal` | `reexposureValidation.server.ts:316` | `prior_second_choice_missing` (no `priorEv`) |
| `computed` | `reexposureValidation.server.ts:361` | success path — band derived |

**Non-authoritative note.** The STEP 2 closure ledger described "four fallback collapse
sites in `reexposureValidation.server.ts`". Measured: only three `insufficient_signal`
tags are physically in that file (`:250` / `:283` / `:316`); the fourth condition
(`elite_axis_missing`) returns `ok:false` from `reexposureValidation.server.ts:227` and is
tagged in `route.ts:189`. Accurate description: **four `insufficient_signal` conditions
across two files.**

---

## §3 computed path (normative)

A re-exposure validation is `computed` when all required inputs are present: axis resolved,
`afterEv` present, `priorRunId` present, `priorEv` present. The pattern-shift band is then
derived by `patternShiftBandFromReexposure` and the payload tagged
`result_origin: "computed"` (`reexposureValidation.server.ts:361`).

For a `computed` outcome, XP and `verified` are taken from the per-band reward table
`profileByOutcome` (`reflectionRewards.server.ts:176-178`):

| band | coreXp | weeklyXp | verified |
|---|---|---|---|
| `changed` | 12 | 8 | true |
| `unstable` | 5 | 3 | true |
| `no_change` | 0 | 1 | false |

`verified` is written to `le_verification_log.verified` (`reflectionRewards.server.ts:222`);
XP is applied via `upsertWeeklyXp` / `applyDirectCoreXp` and recorded on `arena_events.xp`
(`reflectionRewards.server.ts:233`).

---

## §4 insufficient_signal path (normative invariant)

A re-exposure validation is `insufficient_signal` when any one of the four conditions in §2
holds — a required input was absent, so no measured pattern-shift judgement was made.

### Core invariant

```
insufficient_signal  ⟹  (coreXp = 0) ∧ (weeklyXp = 0) ∧ (verified = false)
```

- **Total XP zero** (`coreXp = 0 ∧ weeklyXp = 0`) is the **distinguishing invariant** of
  `insufficient_signal`.
- `verified = false` is a **necessary but not sufficient** marker. A `computed` `no_change`
  outcome is also `verified = false` (with `weeklyXp = 1`). Therefore:

```
verified = false  ⇏  insufficient_signal
```

  This converse MUST NOT be asserted. The discriminator between a `computed no_change` and
  an `insufficient_signal` outcome is total XP (`0/0` vs `0/1`), not the `verified` flag.

### Single enforcement point

The invariant is enforced at one decision site — the ternary at
`reflectionRewards.server.ts:185-186`:

```
resultOrigin === "insufficient_signal"
  ? { coreXp: 0, weeklyXp: 0, verified: false }
  : profileByOutcome[validationResult]
```

The four downstream read-sites of the resulting `outcome` object —
`reflectionRewards.server.ts:189` (`weeklyXp > 0` guard), `:193` (`coreXp > 0` guard),
`:222` (`verified`), `:233` (`xp`) — are mechanical realizations of that single decision,
not independent enforcement points.

A secondary, parallel consumer holds the analytics aggregate:
`patternSignatureAggregation.ts:63` excludes `insufficient_signal` events from
confidence / repeat evidence. That path is outside the XP/verified closure and is not
re-specified here.

---

## §5 Boundary — what result_origin does NOT close (AIR footprint)

`result_origin` closes the XP/verified path (§4). It does **not** close the
activation-log path.

- Every re-exposure validation — `computed` and `insufficient_signal` alike — emits an
  **unconditional** `le_activation_log` row, `type: "micro_win"`, `weight: 1.0`
  (`reflectionRewards.server.ts:199-211`). The insert is not gated by `resultOrigin`.
- **Structural cause.** `le_activation_log` has no `result_origin` column (no such column
  in its migrations; the insert writes only
  `user_id, session_id, type, weight, chosen_at, due_at, completed_at`). AIR / LRI / TII
  consumers therefore cannot distinguish a fallback activation from a genuine one.
- **Effect (measured, STEP 0.5).** An `insufficient_signal` activation has `completed_at`
  set but `verified = false`. In `computeAIR` (`air.ts:124-130`, `:181-183`) it adds `1.0`
  to `weightedChosen` (denominator) and `0` to `weightedCompleted` (numerator). Net: it
  dilutes AIR downward. LRI, team-AIR, and TII derive from the same activation set and
  inherit the dilution.
- **Forced-reset linkage.** `evaluateForcedReset` (`forced-reset.ts:59-77`) triggers
  Stage 4 when any two of four conditions hold; one condition is
  `air7dBelow70ForTwoConsecutiveWeeks` (AIR_7d below
  `FORCED_RESET_AIR_7D_THRESHOLD = 0.80`). For a user at LE Stage 3
  (`runForcedResetAfterAirIfStage3`, `forced-reset-runtime.server.ts:16-39`), an
  `insufficient_signal` activation that drags AIR_7d below `0.80` across two consecutive
  weeks can supply one of the two reasons required. It is contributory — never a sole
  trigger — and gated on Stage 3.

**Sign.** This footprint moves AIR **downward**; it is anti-reward (an integrity-score
drag), not a reward leak. This document does not characterize it as a reward leak.

> **[OPEN — separate track]** Whether the AIR footprint is intended integrity-metric
> behaviour or a fallback-penalty defect is outside this document's scope. STEP 0.5
> classified it as grade D (conditional latent escalation input). The intent/defect
> determination and any remediation are a separate-track decision.

---

## §6 Open questions / non-authoritative notes

> **[OPEN]** `PatternSignatureEvent.result_origin` is an optional field
> (`patternSignatureAggregation.ts:30`); an absent value is currently treated as
> equivalent to `computed`. Whether absent-as-`computed` is spec-legal back-compat or
> should be tightened is undecided.

> **[OPEN]** AIR footprint intent vs defect — see §5.

**Non-authoritative note.** A first-ever `insufficient_signal` event seeds a neutral
aggregate row with `repeat_count_delta: 1` (`patternSignatureAggregation.ts:67`) despite
the general "no repeat increment" rule for `insufficient_signal`; this is the row seed,
not repeat evidence. Analytics-side only; no XP/verified impact.
