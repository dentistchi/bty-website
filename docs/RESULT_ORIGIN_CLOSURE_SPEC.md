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

### §5.1 Judgment (NORMATIVE)

The AIR drag caused by an `insufficient_signal` `micro_win` activation is **partially
legitimate / partially over-broad** — classified **semantic over-collapse**. It is **not**
a catastrophic punitive defect.

Basis (all from STEP 0 corroboration measurement):

- The escalation effect is gated on LE Stage 3 (`runForcedResetAfterAirIfStage3`).
- It is never a single-trigger escalation: `evaluateForcedReset` requires two of four
  reasons, and `insufficient_signal` can influence at most one
  (`air7dBelow70ForTwoConsecutiveWeeks`).
- The footprint is anti-reward only (an AIR drag); there is no XP leak — the §4 invariant
  `insufficient_signal ⟹ coreXp=0 ∧ weeklyXp=0 ∧ verified=false` holds (cited from §4, not
  redefined here).

### §5.2 Trigger attribution heterogeneity (NORMATIVE)

The four `insufficient_signal` triggers do not share one semantics (STEP 0 PHASE 1
attribution table):

- **Legitimate drag** — absence attributable to a behavioral / verification gap:
  - `after_second_choice_missing` — carries a user-action component; recoverable.
- **Over-broad drag** — absence attributable to system / data / sequencing:
  - `no_prior_run` — runtime sequencing absence.
  - `prior_second_choice_missing` — pipeline / data absence.
  - `elite_axis_missing` — registry-dependent / mixed dependency; not a user action.

The proposition "a fallback is always user failure" is therefore **false**.

### §5.3 Representation collapse (NORMATIVE)

Trigger attribution is heterogeneous (§5.2), but `le_activation_log` has no `result_origin`
column, so the AIR graph processes every fallback activation as one identical penalty
footprint. The distinction is lost at hop 1 — the `le_activation_log` insert
(`reflectionRewards.server.ts:199-211`) — and is permanently absent at every downstream hop
(STEP 0 PHASE 3 drag chain). Independent of intent, the system's inability to preserve the
distinction is a **representation defect**.

### §5.4 AIR drag legitimacy boundary (NORMATIVE)

- **Legitimate:** a fallback with a user-action component / a verification-incomplete
  behavioral absence / a recoverable engagement failure.
- **Over-broad:** treating runtime-sequencing absence, pipeline/data absence, and
  registry-dependent absence under the same penalty footprint.

### §5.5 behavioral absence vs system absence (NORMATIVE term)

- **behavioral absence** — a gap in user action or verification; the AIR drag is
  legitimate.
- **system absence** — a gap in sequencing, pipeline, or registry; the AIR drag is
  over-broad.

### §5.6 Future mutation track (record only — not a recommendation)

Resolving the §5.3 representation collapse would require preserving `result_origin` on
`le_activation_log`, or an AIR carve-out for `insufficient_signal` activations. Any such
runtime / schema mutation is **out of scope here** and requires a separate track with
separate approval. This paragraph records the candidate; it is neither a recommendation
nor a proposal.

---

## §6 Open questions / non-authoritative notes

> **[OPEN]** `PatternSignatureEvent.result_origin` is an optional field
> (`patternSignatureAggregation.ts:30`); an absent value is currently treated as
> equivalent to `computed`. Whether absent-as-`computed` is spec-legal back-compat or
> should be tightened is undecided.

**Resolved.** AIR footprint intent vs defect — closed by §5 (NORMATIVE judgment:
semantic over-collapse — partially legitimate / partially over-broad; not a catastrophic
punitive defect).

**Non-authoritative note.** A first-ever `insufficient_signal` event seeds a neutral
aggregate row with `repeat_count_delta: 1` (`patternSignatureAggregation.ts:67`) despite
the general "no repeat increment" rule for `insufficient_signal`; this is the row seed,
not repeat evidence. Analytics-side only; no XP/verified impact.

---

## §7 Escalation legitimacy

### §7.1 Scope (NORMATIVE)

§7 governs the legitimacy of the path by which an `insufficient_signal` fallback can
contribute to LE Stage-4 escalation. This is a layer distinct from §5: §5 judges the
legitimacy of the AIR **drag**; §7 judges the **authority consequence** — escalation. §7
cites §4 and §5 and does not redefine them.

### §7.2 Two Stage-4 ingress paths (NORMATIVE — measured)

Stage 4 has two code-level ingress paths (STEP 0 / STEP 0.1 corroboration):

- **(a) ACTIVE** — `evaluateForcedReset` → `triggerForcedResetToStage4`. Two-of-three
  effective aggregation (`evaluateForcedReset` requires `reasons.length >= 2`;
  `stage3SelectedCountIn14d` is hardcoded `0`, leaving three live inputs); threshold
  `FORCED_RESET_AIR_7D_THRESHOLD = 0.80` on AIR_7d; invoked as a `GET /air` side effect
  (`runForcedResetAfterAirIfStage3`), Stage-3 gated.
- **(b) DORMANT** — `getNextStage(STAGE_3, "air_below_threshold")` → `STAGE_4`, via
  `POST /api/arena/leadership-engine/transition`. `getNextStage` is a pure switch (no
  aggregation). Threshold constant `AIR_THRESHOLD_STAGE_ESCALATION = 0.50`. No in-repo
  caller supplies the `air_below_threshold` context, and the `0.50` constant has no
  runtime comparison site — the path is dormant.

### §7.3 Judgment — (a) active ingress (NORMATIVE)

The (a) ingress is **partially legitimate / structurally indiscriminate /
aggregation-gated**.

- The fallback AIR drag participates in the `air7dBelow70ForTwoConsecutiveWeeks` input.
  A system-absence fallback drags AIR identically to a behavioral-absence fallback — the
  escalation path cannot distinguish them (structurally indiscriminate; the §5.3
  representation collapse, cited).
- It is nonetheless aggregation-gated: `evaluateForcedReset` requires two of three
  effective inputs, and the whole evaluation is Stage-3 gated. The fallback reaches only
  one of the three inputs, so it is **never a single-trigger escalation** on (a).
- It is over-broad but **not a catastrophic punitive defect** — the footprint is
  anti-reward only, with no XP leak (§5.1, cited; the §4 invariant holds).

Conclusion: on the (a) ingress the §5 "semantic over-collapse" judgment re-appears at the
escalation layer — the drag's over-collapse is transmitted indiscriminately, but
aggregation and Stage-3 gating bound the blast radius.

### §7.4 Judgment — (b) dormant ingress = latent governance hazard (NORMATIVE)

The (b) ingress has **no effect on current runtime legitimacy — it is not a defect
today.** But it is, by measurement, a complete latent path: the context is registered in
`VALID_CONTEXTS`, the `getNextStage` Stage mapping exists, the `POST /transition` route
ingress exists, the topology is single-signal, and the `0.50` constant is defined — only
activation (a caller) is missing.

If activated, (b) introduces a **single-signal Stage-4 escalation path** whose authority
character differs from (a)'s two-of-N aggregation and gating.

**NORMATIVE.** Any change that activates the (b) ingress — adding a caller that supplies
the `air_below_threshold` context, or giving the `0.50` constant a runtime comparison
site — is **not innocuous wiring**; it is a change to escalation authority semantics. A
governance review is **REQUIRED before** such activation.

### §7.5 Single-trigger characterization — boundary (NORMATIVE)

The "never single-trigger / two-of-N" characterization is valid for ingress (a) and is
true in the current runtime. Ingress (b) is structurally single-signal but dormant;
therefore no single-trigger Stage-4 escalation occurs in the current runtime. This
statement holds **only while (b) remains inactive**.

### §7.6 Future track (record only — not a recommendation)

Governance handling of the (b) ingress — explicit deactivation, an added aggregation
gate, or documented deprecation — is a separate track requiring separate approval. §7
fixes the latent hazard as NORMATIVE; it records this candidate without recommending it.

---

## §8 Loop containment ↔ integrity metrics boundary

### §8.1 Scope (NORMATIVE)

§8 governs the coupling relationship between the reinforcement loop **containment**
subsystem and the **integrity metric** subsystem (AIR / forced-reset). This is a layer
distinct from §5 (AIR footprint) and §7 (escalation legitimacy): §8 fixes system-coupling
semantics. §8 cites §5 and §7 and does not redefine them.

### §8.2 Measured decoupling (NORMATIVE — measured)

From lane #2 STEP 0 PHASE 5 corroboration:

- **Shared mutable state / table = 0.** Reinforcement containment operates on
  `arena_pending_outcomes.validation_payload.reinforcement_loop` / loop-iteration state;
  the integrity metrics operate on `le_activation_log` / AIR aggregation. The two
  persistence stores are disjoint.
- **The cap does not gate the AIR footprint emit.** `applyReexposureOutcomeReflection`
  (which emits the `le_activation_log` `micro_win`) is called unconditionally, outside the
  `capReached` branch; only the follow-up reinforcement insert is gated `&& !capReached`.
- **Shared points are limited to** (1) a common trigger event — the re-exposure validate
  `POST` — and (2) a shared *read* of `payload.validation_result`. Neither is shared
  mutable authority state: a shared trigger and a shared read only.
- **Classification: functionally decoupled.**

### §8.3 Normative guarantee — governance isolation

A shared trigger event is **not** a shared authority graph. A mutation that changes
reinforcement containment (loop iteration cap tuning, recurrence pacing, containment
heuristics) does **not** implicitly change `le_activation_log` / AIR aggregation /
forced-reset / escalation semantics. The converse also holds.

Therefore a reinforcement-containment track may proceed **without reopening** AIR
legitimacy (§5) or escalation legitimacy (§7) — provided the change does not cross the
§8.4 boundary.

### §8.4 Boundary condition (NORMATIVE)

The §8.3 isolation holds only while both of the following hold:

- The reinforcement-containment change does not touch the `le_activation_log` emit path —
  the call site or call condition of `applyReexposureOutcomeReflection`.
- The change does not convert the `payload.validation_result` read into a write, and does
  not introduce new shared mutable state between the two subsystems.

A change that crosses this boundary is outside §8 isolation and is subject to AIR /
escalation impact review. This condition is a self-check criterion for future tracks, not
a prohibition.

### §8.5 Future track relationship (record only)

The Deferred Queue *reinforcement delay policy* track may proceed under the §8.3 guarantee
without an AIR-legitimacy review, applying the §8.4 boundary self-check. §8 canonicalizes
the boundary and makes no further recommendation.

---

## §9 Reinforcement cadence legitimacy

### §9.1 Scope (NORMATIVE)

§9 governs the legitimacy of the reinforcement loop's **cadence** — delay, iteration,
retry, and recurrence. This is a layer distinct from §5 (AIR footprint), §7 (escalation),
and §8 (containment boundary): §9 fixes reinforcement-cadence semantics. Per §8.5, this
track proceeds under the §8.3 guarantee without reopening §5 or §7; §8.3 and §8.5 are
cited, not redefined.

### §9.2 Cadence topology (NORMATIVE — measured)

From the reinforcement delay policy STEP 0 corroboration:

- **Delay is band-driven, not iteration-driven** — `no_change` → 3 days, `unstable` → 5
  days (`REINFORCEMENT_NO_CHANGE_DELAY_DAYS = 3`, `REINFORCEMENT_UNSTABLE_DELAY_DAYS = 5`).
  Flat per band.
- **The iteration number is cosmetic only** — it affects copy text (`${loopIteration}차`)
  and has no effect on timing. The cadence neither diminishes nor intensifies with
  iteration.
- **Iteration cap** = `REINFORCEMENT_LOOP_ITERATION_CAP = 3` — per chain: an initial row
  plus at most two chained follow-ups.
- **Retry is pull-based** (`getDueOutcomes` surfaces a due pending row on the user's next
  session activity) — not cron-pushed.

### §9.3 Judgment — bounded reinforcement, legitimate (NORMATIVE)

The reinforcement cadence is **bounded reinforcement** and is **legitimate**. The judgment
is resolved in three layers:

- **(per-chain) Structurally bounded.** Cap = 3; a guaranteed minimum spacing of ≥ 3 days
  (`no_change`) / ≥ 5 days (`unstable`) between follow-ups; no system-initiated retry;
  pull-based surfacing. The loop advances only on a re-exposure validation `POST`. Five
  prevention guards: the cap constant, `reinforcementCapReached`, the `&& !capReached`
  insert gate, idempotency dedup (plus `23505` handling), and pull-based surfacing.
- **(aggregate) The aggregate upper bound is not system-fixed.** Total reinforcement load
  scales with the number of user-initiated parallel chains — a new scenario run is a new
  `source_choice_history_id`, hence a new chain with a fresh cap budget; it does not reset
  an existing chain's cap. This load growth is **user-initiated**, not system-coercive
  retry: the agent increasing the load is the user, not the system.
- **(abandonment) No escalation on non-response.** If the user does not respond to a
  scheduled reinforcement, the absence of a validation `POST` yields zero new rows, zero
  iteration increment, and zero intensity escalation. The same pending row re-surfaces via
  `getDueOutcomes` on each session-route entry — a UX-level recurrence, not the creation
  of new pressure. (The `isMissed` / AIR consequence of abandonment is the §8-decoupled
  integrity-metric side and is outside §9.)

### §9.4 Classification disposition (NORMATIVE)

- **bounded reinforcement** — **CORROBORATED** (§9.3).
- **coercive recurrence** — **REBUTTED.** Its only supporting fact (the same row
  re-surfacing on abandonment) is UX-level recurrence; with iteration-independent
  intensity, the cap, ≥3d spacing, and zero new rows on abandonment, it does not reach a
  coercive classification.
- **unbounded retry pressure** — **REBUTTED.** Every chain is cap-bounded and there is no
  system-initiated retry; parallel chains are user-initiated.
- **diminishing cadence** — **CONTRADICTED.** Delay is flat per band and iteration-
  independent.

### §9.5 Boundary note (NORMATIVE)

The §9 judgment is confined to cadence legitimacy. The integrity-metric consequences of
abandonment (`isMissed` / AIR drag) are handled in §5 / §8; §9 does not reopen that
boundary. A future track that changes the cadence is subject to the §8.4 boundary
self-check.
