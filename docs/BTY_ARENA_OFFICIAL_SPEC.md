==============================
BTY ARENA — OFFICIAL SYSTEM SPEC (MVP + CORE ENGINE)
==============================

This document defines the official XP / Level / Tier / Stage / League structure.
Do NOT alter the structure. Only extend it.

----------------------------------
1) XP ARCHITECTURE (DUAL-TRACK)
----------------------------------

BTY Arena uses TWO XP systems:

A) Weekly XP (Competition Engine)
- Used for leaderboard ranking
- 30-day season (MVP)
- Reset at season end
- Top 5% = Elite group
- Stored in: weekly_xp.xp_total

B) Core XP (Growth Engine)
- Never resets
- Determines Stage and Code Name
- Cultural progression indicator
- Based on 7-stage (777 symbolic structure)
- Stored in: arena_profiles.core_xp_total

----------------------------------
2) MVP STRUCTURE — WEEKLY XP
----------------------------------

Level Calculation:
level = floor(xpTotal / 100) + 1

Tier Ranges:
0–99     → Bronze
100–199  → Silver
200–299  → Gold
300+     → Platinum

Progress Bar:
progress = (xpTotal % 100) / 100

UI must display:
- Level
- Tier
- Progress percentage

----------------------------------
3) CORE XP — STAGE STRUCTURE
----------------------------------

Stage Calculation:
stage = floor(coreXp / 100) + 1
stageProgress = coreXp % 100

Stage System:
- Stage 1–7
- 100 XP per Stage
- Max structured stage = 700 XP
- 700+ XP → Code Name hidden (777 symbolic zone)

----------------------------------
4) CODE NAME SYSTEM
----------------------------------

- Assigned upon Stage entry
- Change permission unlocked at defined Stage milestones
- 700+ XP users → Code hidden publicly
- Leaderboard shows Code Name only (no real names)

Example format:
Builder-07
Forge-21
Nova-88

----------------------------------
5) LEAGUE STRUCTURE
----------------------------------

Table: leagues
- id
- season_number
- start_date
- end_date
- status (active / closed)

Table: weekly_xp
- user_id
- league_id
- xp_total

Season Rules:
- MVP season = 30 days
- End of season:
  - Top 5% by weekly_xp → Elite announcement
  - weekly_xp resets
  - core_xp remains

----------------------------------
6) XP AWARD PRINCIPLES
----------------------------------

- XP is universal unit.
- Higher difficulty → higher xpBase.
- Higher role → higher difficulty scaling.
- Higher difficulty naturally slows XP gain.

Competition = Weekly XP.
Growth = Core XP.

----------------------------------
7) HIDDEN STATS (NOT EXPOSED)
----------------------------------

Core XP internally reflects:

- Integrity
- Communication
- Insight
- Resilience
- Gratitude

UI shows only aggregated XP.
Calculation logic remains undisclosed.

----------------------------------
8) DESIGN PRINCIPLES (DO NOT CHANGE)
----------------------------------

1. Weekly XP drives competition.
2. Core XP drives identity.
3. 777 is symbolic structure.
4. Code Name builds culture.
5. Elite announcement builds pride.

----------------------------------
9) MVP IMPLEMENTATION ORDER
----------------------------------

1. Create weekly_xp table
2. Create arena_profiles table
3. Implement Level/Tier display
4. Implement leaderboard
5. Implement season reset logic

==============================
END OF SPEC
==============================
