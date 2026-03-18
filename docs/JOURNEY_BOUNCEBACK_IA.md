# BTY Journey & Bounce-back IA (v1)

## 1. Purpose

This document defines the product IA and UX policy for Journey (28-day recovery loop) and bounce-back.

The goal is to remove ambiguity so engineering can implement Journey-related UI and navigation without further product decisions.

This is a locked decision document.

---

## 2. IA Position

Journey is part of Growth.

Journey is:

- a recovery loop
- a re-alignment system
- not a gameplay feature
- not a dashboard feature

Top-level navigation:

- Arena (Play)
- Growth (Understand / Recover)
- My Page (Status)

Growth contains:

- Dojo
- Integrity
- Guidance
- Journey

Journey is NOT:

- in Arena
- in My Page
- a top-level navigation item

---

## 3. Entry Points

Journey is NOT shown on the main entry screen.

Journey can be entered from:

1. **Comeback trigger**
   - condition: 3+ days inactivity
   - system shows comeback modal
   - CTA leads to Journey

2. **Growth menu**
   - Journey appears as one of the options

3. **Deep link**
   - direct access allowed

Journey is NOT:

- a homepage CTA
- a dashboard primary action

---

## 4. Bounce-back Definition

Bounce-back is a recovery event.

Bounce-back is NOT:

- a score
- a reward system
- a competitive metric

Bounce-back does NOT affect:

- XP (Core or Weekly)
- Leaderboard
- Season progression

Bounce-back is used only for:

- recovery tracking
- system messaging
- re-entry into Journey

---

## 5. Progression Rules

**Default behavior:**

- User continues from `current_day`
- No forced reset

**Example:**

Day 7 → inactivity (3+ days) → comeback → continue from current path

**Reset policy:**

- Reset is NOT automatic
- Reset is optional and user-initiated only

**Design principle:**

Recovery > Restart

---

## 6. UX Meaning of Comeback

Comeback represents:

- interruption detection
- re-entry opportunity
- recovery continuation

**Tone requirements:**

- calm
- observational
- non-judgmental
- no emotional pressure

**Approved tone examples:**

- "System detected interruption."
- "Resume your Journey."
- "Recovery sequence available."
- "Continue from your current path."

**Disallowed tone:**

- guilt-inducing language
- reward hype
- punishment framing

---

## 7. Visibility Policy

`bounce_back_count`:

- should NOT be emphasized
- should NOT be used as a competitive stat
- should NOT appear in leaderboard or XP UI

**If displayed:**

- minimal
- contextual (Journey or recovery history only)

**Avoid:**

- large numeric display
- gamified badges for comeback count

---

## 8. Relationship to Other Systems

**Arena:**

- execution
- simulation
- Weekly XP

**Growth:**

- reflection
- internal alignment
- recovery

**Journey:**

- structured 28-day recovery loop inside Growth

**My Page:**

- identity
- progress
- team status

**Season:**

- competition cycle
- leaderboard reset
- independent from Journey

---

## 9. Engineering Notes

**Existing backend components:**

- `GET /api/journey/profile`
- `POST /api/journey/bounce-back`
- JourneyBoard
- Comeback modal (3+ days inactivity)

**Current blocker:**

- Not missing backend functionality
- Missing IA and UX definition

**This document resolves:**

- entry points
- progression logic
- bounce-back meaning
- visibility policy

---

## 10. Unblock Statement

C5 TASK1 is unblocked once implementation follows this IA and policy.

Engineering can proceed with:

- JourneyBoard routing
- comeback modal → Journey flow
- Growth integration
- UI implementation based on defined visibility and tone rules

**UX copy & behavior detail:** `docs/JOURNEY_COMEBACK_UX_SPEC.md` (comeback modal, wireframes, bounce-back POST on Resume only).
