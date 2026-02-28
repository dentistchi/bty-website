# BTY Arena — Domain Rules (Single Source of Truth)

This document is the **authoritative specification** for BTY Arena domain rules. Implementation (API, DB, UI) must align with these rules.

---

## 1. Core XP vs Weekly XP

| Aspect | Core XP | Weekly XP |
|--------|---------|-----------|
| **Semantics** | Permanent growth; identity and progression. | Competition-only; resets each league window. |
| **Resets** | Never. | At league/season window end (with carryover). |
| **Used for** | Tier, Code, Sub Name, Stage; long-term identity. | Leaderboard ranking only. |
| **Storage** | `arena_profiles.core_xp_total` (conceptual). | `weekly_xp.xp_total` per league window (conceptual). |

**Rules:**

- Core XP is **permanent**. It is never decreased or reset by season/league lifecycle.
- Weekly XP is **only for weekly (league-window) ranking**. It resets at the end of each league window (see Season lifecycle).
- Season progression (e.g. personal Season 1 → 2 → 3) **must not** affect leaderboard ranking. Leaderboard rank is determined **only** by Weekly XP in the current league window.

---

## 2. Level / Tier / Stage Mapping

### 2.1 Level (content unlock)

- **Level** = content gate: S1, S2, S3 (staff), L1, L2, L3, L4 (leader).
- **Unlock rule:** tenure only. Tier and XP do **not** unlock levels.
- L4 is admin-granted only (not tenure-based).
- New joiners (e.g. first 30 days) are forced to staff track; only S1 is available until tenure rules allow higher levels.

### 2.2 Tier (internal, not user-facing)

- **Tier** = `floor(coreXp / 10)`.
- Tier is **not** shown to users. Progress is communicated via Code, Sub Name, and milestones (e.g. Tier 25/50/75 celebrations).

### 2.3 Code and Stage (from Core XP)

- **1 Code** = 100 tiers = 1,000 Core XP.
- **Code index** = `floor(tier / 100)` → 0..6 (seven codes). 700+ tiers → “CODELESS ZONE” (code index 6); Code Name may be hidden or user-defined.
- **Sub-tier group** (for default Sub Name) = `floor((tier % 100) / 25)` → 0, 1, 2, 3.
- **Stage** (for display/DB): often `floor(coreXp / 100) + 1` (1–7), with 700+ treated as “beyond” or hidden.

**Code names (order 0–6):** FORGE, PULSE, FRAME, ASCEND, NOVA, ARCHITECT, CODELESS ZONE.

---

## 3. Season / League Lifecycle

- **League window:** 30 days (MVP). One active league per window; `start_at` / `end_at` define the window.
- **Start:** When no active league exists, a new league is created for the current 30-day window.
- **End:** At league end (e.g. when creating the next league):
  - **Carryover:** 10% of current window’s Weekly XP is carried over (e.g. `xp_total = floor(xp_total * 0.1)` for the next window). Exact behavior is implementation-defined (e.g. RPC `run_season_carryover`).
  - **Reset:** Remaining Weekly XP for the closed window is not used for ranking; new window starts with carried amount (and new earnings).
- **Core XP:** Unchanged by league start/end. No reset, no carryover logic for Core XP.

**Personal “Season” (e.g. Season 1 / 2 / 3)** is a separate concept: difficulty progression. It does **not** drive leaderboard ranking and does **not** reset Weekly XP by itself.

---

## 4. League Leaderboard Rules

- **Ranking:** By **Weekly XP only** (current league window). No Core XP, no tenure, no level in the ranking formula.
- **Display:** **Code Name only** (and Sub Name if applicable). No real names, no emails, no other PII.
- **Season progression must not affect leaderboard ranking.** So: personal season, level unlock, or Core XP progression do **not** change a user’s rank; only Weekly XP in the current window does.

**Elite (e.g. top 5%):** Computed from the same leaderboard (Weekly XP). Used for rewards/announcements; does not change the rule that ranking is by Weekly XP only.

---

## 5. Identity and Privacy (Code Name only)

- On leaderboard and any public/ranked view: show **Code Name** (and Sub Name). Do **not** expose real name, email, or other identifying information.
- Tier number is internal; user sees progress via Code, Sub Name, Core XP, and milestone celebrations (e.g. Tier 25/50/75).

---

## 6. Seasonal XP → Core XP Conversion (hidden)

- **Core XP < 200 (Beginner):** 45 Seasonal (Weekly-window) XP → 1 Core XP.
- **Core XP ≥ 200:** 60 Seasonal XP → 1 Core XP.
- Fractional remainder may be stored in a buffer and applied when it accumulates to 1 Core. Conversion logic is not disclosed to the user.

---

## 7. Numeric Constants (reference)

| Item | Value |
|------|--------|
| 1 Tier | 10 Core XP |
| 1 Code | 100 Tiers = 1,000 Core XP |
| Beginner threshold | Core XP ≥ 200 (Tier ≥ 20) |
| Seasonal → Core (Beginner) | 45 : 1 |
| Seasonal → Core (general) | 60 : 1 |
| League window | 30 days (MVP) |
| Carryover at league end | 10% |
| Sub Name length | Max 7 characters (when applicable) |

---

*Domain spec version: 1.0. Do not change semantics; extend only via documented amendments.*
