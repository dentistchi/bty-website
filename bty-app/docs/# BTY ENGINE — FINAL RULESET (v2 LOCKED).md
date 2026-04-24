# BTY ENGINE — FINAL RULESET (v2 LOCKED)

---

# 1. CORE PRINCIPLE

BTY is not a reflection system.  
BTY is a behavior enforcement and validation system.

Core rule:

- No Action → No Progression
- Action without change → No Growth
- Repeated inaction → Forced Intervention

---

# 2. SYSTEM LAYERS (LOCKED)

BTY operates in 3 independent layers:

---

## LAYER 1 — EXECUTION (AIR)

Measures:
👉 Did the user execute actions?

Metric:
👉 AIR (Action Integrity Rate)

---

## LAYER 2 — BEHAVIOR CHANGE

Measures:
👉 Did behavior change after action?

Metric:
👉 Pattern Shift (changed / unstable / no_change)

---

## LAYER 3 — READINESS

Measures:
👉 Is the user ready for leadership?

Metrics:
- LRI
- Certified Leader
- Intervention Level

---

# 3. AIR (Action Integrity Rate) — OFFICIAL DEFINITION

## Formula

AIR = weighted_completed_actions / selected_actions

---

## Weights

- Normal action completion = 1.0
- Forced Reset completion = 2.0

---

## Penalty

- Missed action = -0.10
- Missed 3 times consecutively:
  → integrity_slip = true

---

## Important Rule

AIR measures:
👉 execution completion ONLY

AIR does NOT measure:
- behavior change
- correctness
- intention

---

## Exposure Rule

- Raw AIR score is NEVER shown
- Only band is shown:

| Band | Range |
|------|------|
| high | ≥ 0.80 |
| mid  | 0.50 ~ 0.79 |
| low  | < 0.50 |

**Implementation baseline (locked to code):** `docs/BTY_AIR_PATTERN_SHIFT_BASELINE_V2.md` (repo root).

### Forced reset — AIR weekly signal (not Pattern Shift)

- When evaluating **two-of-four** Stage 4 triggers, the AIR leg is: **AIR_7d strictly below the high-band floor (0.80)** for **two consecutive weeks**.
- **Machine reason string:** `air_7d_below_high_band_two_consecutive_weeks`
- **Obsolete:** numeric cutoff **0.70** and reason id **`air_7d_below_70_two_consecutive_weeks`** for this condition — do not use in new contracts or copy.

---

# 4. PATTERN SHIFT (BEHAVIOR CHANGE LAYER)

Measured AFTER re-exposure.

---

## Validation States

- changed
- unstable
- no_change

---

## Rules

- exit → entry = changed
- exit → same exit pattern = no_change
- exit → different exit OR lower intensity = unstable

---

## Critical Rule

Pattern Shift is NOT AIR.

Pattern Shift answers:
👉 “Did the user's decision change after action?”

**AIR** = execution integrity (Layer 1). **Pattern Shift** = behavior validation after re-exposure (Layer 2). Do not merge metrics, bands, or storage.

### Persistence (implementation scope)

- **`pattern_shift_results`** (or equivalent table/API): **not implemented** — no canonical persistence yet.
- **Domain hook:** `patternShift.ts` (`patternShiftBandFromReexposure`, etc.) is **ready** for a future classifier + storage integration.

### Implementation status (post–C3 baseline)

| Item | Status |
|------|--------|
| AIR math (`computeAIR`, penalties, slip) | **Implemented** |
| AIR band (`airToBand`, 0.50 / 0.80 edges) | **Implemented** |
| Forced reset (incl. `air_7d_below_high_band_two_consecutive_weeks`) | **Implemented** |
| Pattern Shift domain hook | **Implemented** (no merge into AIR) |
| `pattern_shift_results` persistence / public API | **Pending** |

---

# 5. TRIGGER ENGINE

QR is triggered when:
👉 thought must become action

---

## Trigger Conditions

1. Immediate trigger  
- exit + intensity ≥ 3

2. Repeated axis trigger  
- same axis exit ≥ 3

3. Pressure trigger  
- axis pressure score ≥ threshold

---

## Output

→ Action Request 생성

---

# 6. ACTION REQUEST (QR CONTRACT)

QR is NOT a check.

QR is:
👉 a real-world execution contract

---

## Structure

- who
- what
- how
- when
- evidence_type

---

## Requirements

Action must be:

- concrete
- observable
- executable within 48~72h
- uncomfortable (real cost)
- not abstract
- not intention
- not explanation

---

## Forbidden

- “I will try”
- “I will improve”
- “I will be better”

---

# 7. QR EXECUTION FLOW

Action Request
→ Submit
→ Approval (required)
→ Completed

---

## Roles

- Actor (executes)
- Approver (validates)

Rule:
👉 Actor ≠ Approver

---

## QR Types

- bound → approver required
- open → optional approver

---

# 8. RE-EXPOSURE ENGINE

Re-exposure is mandatory.

---

## Rules

- same axis
- different surface scenario
- same distortion tested

---

## Purpose

👉 verify behavioral change

---

# 9. VALIDATION RESULT

After re-exposure:

| Result | Meaning |
|--------|--------|
| changed | real growth |
| unstable | partial shift |
| no_change | no learning |

---

# 10. FAILURE ENGINE

---

## Missed Logic

- missed → streak +1
- approved → streak reset

---

## Integrity Slip

- missed_streak ≥ 3
→ integrity_slip = true

---

## Effect

- Arena 제한
- Forced Reset 진입
- Intervention Level 상승

---

# 11. USER STATE SNAPSHOT

System must output:

- action_integrity_band (AIR 기반)
- pattern_shift_band
- readiness_signal
- intervention_level
- next_intervention

---

# 12. LRI (Leadership Readiness Index)

Formula:

LRI =
(14-day avg AIR × 0.50)
+ (MWD × 0.30)
+ (pulse × 0.20)

---

## Readiness Condition

- LRI ≥ 0.80
- integrity_slip = false

---

# 13. CERTIFIED LEADER

Conditions:

- AIR ≥ 0.80 for 14 days
- sufficient MWD
- forced reset compliance
- no integrity_slip in 14 days

---

## Rule

- Not permanent
- Re-evaluated every 90 days

---

# 14. SYSTEM TRUTH (FINAL)

BTY does NOT measure:

- intention
- explanation
- correctness

BTY measures:

👉 action  
👉 followed by changed decision  

---

# 15. FINAL EQUATION

Execution (AIR)
+
Behavior Change (Pattern Shift)
=
Leadership Growth

---

# 16. NON-NEGOTIABLE RULES

1. AIR and Pattern Shift must NEVER be merged  
2. QR must always produce real-world action  
3. Re-exposure must always exist  
4. No Action → No Progression  
5. Repeated failure → Forced Reset  

---

# END OF SPEC