# BTY Arena — Domain Rules (Single Source of Truth)

This document is the **authoritative specification** for BTY Arena domain rules. Implementations in `src/domain/**` and references in API/UI must align with this spec.

---

## 1. Core XP vs Weekly XP

| Concept | Meaning | Storage | Reset | Use |
|--------|---------|---------|--------|-----|
| **Core XP** | Permanent, long-term growth | `arena_profiles.core_xp_total` | **Never** | Tier, Code, Sub Name, Stage; identity on leaderboard |
| **Weekly XP** | Competition XP for current time window | `weekly_xp.xp_total` (per user, per league/window) | **Yes** — at each season/league end (with carryover) | **Leaderboard ranking only** |

### Rules

- **Core XP is permanent.** It is never reset. It accumulates from Seasonal → Core conversion (see §4).
- **Weekly XP resets** at the end of each league/season window. Only a defined carryover (e.g. 10%) may persist into the next window.
- **Leaderboard rank** is determined **only** by Weekly XP (current window). Core XP must not affect ranking order.
- When a run (or activity) awards XP: the same amount is added to Weekly XP for the current window and, via conversion, to Core XP. No separate “season progression” value affects leaderboard position.

---

## 2. Level / Tier / Stage Mapping

### 2.1 Tier (internal, not shown as a number)

- **Tier** = `floor(coreXp / 10)`.
- Used only internally for Code and Sub Tier. **Tier number is not exposed** in UI or leaderboard.

### 2.2 Code (identity on leaderboard)

- **Code index** = `floor(tier / 100)`, clamped to 0..6.
- **7 Codes** (in order): FORGE, PULSE, FRAME, ASCEND, NOVA, ARCHITECT, CODELESS ZONE.
- **1 Code** = 100 tiers = 1,000 Core XP.
- **CODELESS ZONE** (code index 6): Core XP ≥ 700. Code name may be hidden or user-defined per product rules.

### 2.3 Sub Tier (Sub Name)

- **Sub tier group** = `floor((tier % 100) / 25)` → 0, 1, 2, or 3.
- Each of the first 6 codes has 4 default Sub Names per group. Code 6 (CODELESS ZONE) has no defaults; user-defined only.
- Sub Name is the user-facing label (e.g. Spark, Ember) and may have rename rules (e.g. once per code at a milestone).

### 2.4 Stage (optional alias)

- **Stage** (1–7) can be defined as `min(7, floor(coreXp / 100) + 1)` for display. Stage 7+ or 700+ may be treated as “beyond” or CODELESS ZONE.
- Stage is derived from Core XP only; it is not a separate stored value for ranking.

### 2.5 Summary

- **Level** (if used in UI) = from Weekly XP only (e.g. level = floor(weeklyXp/100)+1). Not used for leaderboard rank.
- **Leaderboard display identity** = Code Name + Sub Name, both derived from **Core XP** (tier/code). Ranking = **Weekly XP** only.

---

## 3. Season Lifecycle (Start / End / Reset)

### 3.1 League window

- **MVP:** One active league per 30-day window. Start/end are fixed from an epoch (e.g. 2026-01-25).
- **Active league** = the league whose `start_at ≤ now ≤ end_at`.

### 3.2 Season start

- When there is no active league, a new league is created for the next window. That is the “season start” for that window.

### 3.3 Season end / reset

- At **season end** (when the active league’s `end_at` is reached):
  - **Weekly XP** for that league is reset, except a defined **carryover** (e.g. 10%): `new_weekly_xp = floor(weekly_xp_total * 0.10)` or equivalent.
  - **Core XP is unchanged.** No reset, no deduction.
- After reset, the next league/window starts. Leaderboard for the new season is based only on Weekly XP in that new window (including carried-over amount).

### 3.4 What “season progression” means

- **Season progression** = advancement in Tier/Code/Stage (driven by Core XP). This is **personal growth**.
- **Leaderboard ranking** = order by Weekly XP in the current window only.
- **Rule:** Season progression (Core XP, Tier, Code, Stage) **must not** affect leaderboard ranking. Ranking uses only Weekly XP for the current league/window.

---

## 4. League Leaderboard Rules and Separation from Season Progression

### 4.1 Ranking

- **Leaderboard rank** = sort by **Weekly XP** (current league/window) **descending**. No other factor (Core XP, Tier, Code, Stage, real name) may influence order.

### 4.2 Display (Code Name only)

- **Shown:** Rank, Code Name, Sub Name, Weekly XP (and optionally Core XP for context).
- **Not shown:** Real name, email, Tier number, internal identifiers that could identify the person.
- **Code Name only:** Leaderboard and any public arena views must use Code + Sub Name (or equivalent pseudonym), never real names.

### 4.3 Elite

- **Elite** = top N% (e.g. top 5%) by **Weekly XP** in the current window. Same ranking source as leaderboard; no Core XP or season-progression metric in the formula.

### 4.4 Separation rule

- **Season progression** (Core XP, Tier, Code, Stage) is used only for:
  - Identity display (Code Name, Sub Name) on leaderboard,
  - Unlocks, sub-name rename eligibility, and similar progression features.
- It is **never** used to compute leaderboard rank or Elite membership.

---

## 5. Seasonal XP → Core XP Conversion

- When Weekly/Seasonal XP is awarded (e.g. run complete, activity), a portion is converted to Core XP:
  - **Core XP < 200 (Beginner):** 45 Seasonal → 1 Core.
  - **Core XP ≥ 200:** 60 Seasonal → 1 Core.
- Fractional remainder may be stored in an internal buffer and applied when a full Core unit is reached. Conversion rates and buffer are not exposed.

---

## 6. Constants Summary (reference)

| Item | Value |
|------|--------|
| XP per Tier | 10 Core XP |
| Tiers per Code | 100 |
| Core XP per Code | 1,000 |
| Beginner threshold | Core XP 200 |
| Seasonal → Core (Beginner) | 45 : 1 |
| Seasonal → Core (default) | 60 : 1 |
| Season carryover | 10% (of Weekly XP at reset) |
| MVP season length | 30 days |
| Leaderboard rank by | Weekly XP only |
| Display identity | Code Name + Sub Name only (no real name) |

---

*Domain spec version: 1.0. Implementations: `bty-app/src/domain/**`.*
