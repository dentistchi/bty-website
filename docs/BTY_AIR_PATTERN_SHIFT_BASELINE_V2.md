# BTY AIR & Pattern Shift — Implementation Baseline (v2 LOCKED)

**Frozen:** post–C3 alignment (2026-04-05). **Philosophy unchanged:** BTY remains execution-first; this file only locks **numbers, reason strings, and implementation scope** to the codebase.

**Normative product rules:** `bty-app/docs/# BTY ENGINE — FINAL RULESET (v2 LOCKED).md`  
**Code vocabulary:** `bty-app/docs/AIR_PATTERN_SHIFT_VOCABULARY_MAP.md`

---

## AIR bands (dashboard / API `band` field)

| Band | Numeric range (inclusive edges) |
|------|----------------------------------|
| **low** | AIR **&lt; 0.50** |
| **mid** | **0.50** ≤ AIR **≤ 0.79** |
| **high** | AIR **≥ 0.80** |

**Domain constants:** `AIR_BAND_LOW_MID = 0.5`, `AIR_BAND_MID_HIGH = 0.8` in `bty-app/src/domain/leadership-engine/air.ts` — `airToBand()`.

**Obsolete (do not use in new docs or contracts):** AIR band cutoffs **0.40 / 0.70** (pre–v2). Historical reason id **`air_7d_below_70_two_consecutive_weeks`** — replaced below.

---

## Forced reset — AIR weekly condition

- **Rule:** Rolling **AIR_7d** is **strictly below** the **high-band floor (0.80)** for **two consecutive weeks** (weekly snapshot inputs to `evaluateForcedReset`).
- **Threshold constant:** `FORCED_RESET_AIR_7D_THRESHOLD` = `AIR_BAND_MID_HIGH` (**0.80**) — “below **high** band”, not “below 0.70”.
- **Machine reason string (current):** **`air_7d_below_high_band_two_consecutive_weeks`**
- **Implementation:** `bty-app/src/domain/leadership-engine/forced-reset.ts` (legacy field name `air7dBelow70ForTwoConsecutiveWeeks` on `ResetEvalInputs` — semantics = below 0.80, not 0.70).

---

## Layer semantics (must not merge)

| Layer | Official role | Domain module (hook) |
|-------|----------------|----------------------|
| **AIR** | **Execution integrity** — did the user complete chosen actions in-window? | `air.ts`, activation + verification logs |
| **Pattern Shift** | **Behavior validation** after re-exposure — did decision/exit pattern change? | `patternShift.ts` — **not** folded into AIR math |

Pattern Shift **must never** be merged into AIR scoring or band logic.

---

## `pattern_shift_results` persistence

- **Storage / API:** **Not implemented** — no canonical table or public API yet.
- **Domain hook:** **`patternShiftBandFromReexposure`** (and related types) in `patternShift.ts` — ready for a future classifier + persistence integration.

---

## Implementation status (compact)

| Area | Status | Notes |
|------|--------|--------|
| **AIR math** | **Implemented** | `computeAIR`, weights, missed penalty, `integrity_slip` — `air.ts` |
| **AIR band** | **Implemented** | `airToBand`, API exposes `band` — `GET .../leadership-engine/air` |
| **Forced reset** | **Implemented** | `evaluateForcedReset`, reasons include `air_7d_below_high_band_two_consecutive_weeks`; lockout wiring `engine/forced-reset/lockout.service.ts` |
| **Pattern Shift hook** | **Implemented (domain only)** | `patternShift.ts`; no merge into AIR |
| **`pattern_shift_results` persistence/API** | **Pending** | Integrate when re-exposure storage ships |

---

## Related release / gate note

See `docs/BTY_RELEASE_GATE_CHECK.md` — **AIR bands LOCKED v2 (2026-04-05)** entry for API/UI regression scope.
