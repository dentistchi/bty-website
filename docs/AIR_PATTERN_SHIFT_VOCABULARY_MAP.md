# AIR ↔ code vocabulary (BTY ENGINE v2 LOCKED alignment)

Short mapping for operators and implementers.

- **Normative rules:** `bty-app/docs/# BTY ENGINE — FINAL RULESET (v2 LOCKED).md`
- **Implementation baseline (repo root):** `docs/BTY_AIR_PATTERN_SHIFT_BASELINE_V2.md`

## AIR (Layer 1 — execution integrity)

| Official BTY term | Current code / data |
| ----------------- | ------------------- |
| AIR (Action Integrity Rate) | `computeAIR` in `src/domain/leadership-engine/air.ts` |
| Selected actions | Activations in window: `le_activation_log` rows with `chosen_at` in the rolling period |
| Completed actions | `completed_at` set and latest `le_verification_log.verified === true` for that `activation_id` (see `GET .../leadership-engine/air` route) |
| Normal action weight 1.0 | `type !== 'reset'` → `ActivationType` `micro_win` |
| Forced reset weight 2.0 | `type === 'reset'` → `ActivationType` `reset` |
| Missed penalty (−0.10) | `MISSED_WINDOW_PENALTY` in `computeAIR` |
| Missed streak / integrity_slip | `detectIntegritySlip` (3 consecutive missed by `due_at`) |
| Band low / mid / high | `airToBand` using `AIR_BAND_LOW_MID` (0.50) and `AIR_BAND_MID_HIGH` (0.80) |

## Pattern Shift (Layer 2 — behavior validation)

| Official BTY term | Current code / data |
| ----------------- | ------------------- |
| Pattern Shift band (`changed` / `unstable` / `no_change`) | `patternShiftBandFromReexposure` in `src/domain/leadership-engine/patternShift.ts` |
| `pattern_shift_results` (persistence) | **Not implemented** — no table/API yet; classifier is the integration point for future re-exposure storage |

## Forced reset (related to AIR band, not Pattern Shift)

| Concept | Code |
| ------- | ---- |
| “AIR_7d below high band for two weeks” | `ResetEvalInputs.air7dBelow70ForTwoConsecutiveWeeks` (legacy name) + reason string `air_7d_below_high_band_two_consecutive_weeks` |
| Threshold (= high band floor) | `FORCED_RESET_AIR_7D_THRESHOLD` = `AIR_BAND_MID_HIGH` (0.80) |

## Obsolete (do not use)

| Deprecated | Replacement |
|------------|-------------|
| AIR band cutoffs **0.40 / 0.70** (pre–v2) | **low &lt; 0.50**, **mid 0.50–0.79**, **high ≥ 0.80** |
| Reason id **`air_7d_below_70_two_consecutive_weeks`** | **`air_7d_below_high_band_two_consecutive_weeks`** |
| Forced-reset narrative “AIR_7d &lt; 0.70” | **AIR_7d &lt; 0.80** (below high band) |

*Note: Validator / Layer-2 **confidence 0.7** thresholds (e.g. action-contract validation) are unrelated to AIR bands.*

## Implementation status (same as ENGINE ruleset appendix)

| Area | Status |
|------|--------|
| AIR math | Implemented (`air.ts`) |
| AIR band | Implemented (`airToBand`, LE air API) |
| Forced reset (incl. `air_7d_below_high_band_two_consecutive_weeks`) | Implemented (`forced-reset.ts`, lockout service) |
| Pattern Shift hook | Implemented domain-only (`patternShift.ts`) — **not** merged into AIR |
| `pattern_shift_results` persistence / API | **Pending** |
