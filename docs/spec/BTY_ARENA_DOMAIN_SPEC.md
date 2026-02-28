# BTY Arena — Domain Spec (Single Source of Truth)

This spec is the **authoritative reference** for domain rules. Implementation (API, DB, UI) must align with these rules.

**Maintained by:** Domain Architect.  
**Allowed locations:** `/docs/spec/**`, `/src/domain/**` (types, constants, pure rules only).

---

## 1. Core XP vs Weekly XP

| Concept | Meaning | Reset | Use |
|--------|---------|--------|-----|
| **Core XP** | Permanent, cumulative growth. Never resets. | Never | Tier / Code / Sub Name derivation; identity progression. |
| **Weekly XP** | Per–time-window XP for the current league/season. | At season end (with carryover rule) | **Leaderboard ranking only.** |

**Non-negotiable:**
- Core XP is permanent.
- Weekly XP resets each season and is used **only** for weekly/season ranking.
- Leaderboard rank is determined **exclusively** by Weekly XP (for the active league/window). Season progression (e.g. Season 1 → 2 → 3 difficulty) must **not** affect leaderboard position.

---

## 2. Level / Tier / Stage Mapping

- **Level** (e.g. S1, S2, L1, L2, L3, L4): Content unlock. **Tenure-based only.** XP and Tier do **not** unlock levels.
- **Tier**: Internal unit. `tier = floor(coreXp / 10)`. Not shown to users; only used for Code/Sub derivation.
- **Stage**: User-facing progress within Core XP. `stage = floor(coreXp / 100) + 1` (1..7). At 700+ Core XP, code name visibility is hidden (CODELESS ZONE / beyond).
- **Code**: 7 codes, 100 tiers each (0–99, 100–199, …). `codeIndex = floor(tier / 100)`.
- **Sub tier**: 4 groups per code. `subTierGroup = floor((tier % 100) / 25)` (0–3).

**Non-negotiable:** Level unlock is tenure-only. Tier/XP never unlock levels.

---

## 3. Season Lifecycle (Start / End / Reset)

- **Season (league) length:** 30 days (MVP). Fixed epoch; windows are contiguous.
- **Start:** When a new league is created (no active league exists), the new league’s window becomes the current season.
- **End:** When the current time is past the league’s `end_at`.
- **Reset:** At season end, Weekly XP is reset with a **10% carryover**: `xp_total = floor(xp_total * 0.1)`. Core XP is **unchanged**.

**Non-negotiable:** Season progression (personal difficulty season) is independent of leaderboard. Resets apply only to Weekly XP, not Core XP.

---

## 4. League Leaderboard Rules

- **Ranking metric:** Weekly XP only (for the active league/window).
- **Display:** Code Name and Sub Name only. **No real names.** No tier number, no raw Core XP in ranking.
- **Separation:** Leaderboard ranking must **not** be affected by:
  - Season progression (Season 1 / 2 / 3),
  - Core XP or tier,
  - Any factor other than Weekly XP in the current window.

**Non-negotiable:** Code Name only (no real name exposure). Leaderboard = Weekly XP rank only.

---

## 5. References

- **Types & constants:** `/src/domain/types.ts`, `/src/domain/constants.ts`
- **Pure rules:** `/src/domain/rules/*.ts`
- **Legacy app docs:** `bty-app/docs/BTY_ARENA_SYSTEM_SPEC.md`, `BTY_ARENA_SEASON_SPEC.md`, `XP_SYSTEM_WEEKLY_SEASONAL_CORE.md`
