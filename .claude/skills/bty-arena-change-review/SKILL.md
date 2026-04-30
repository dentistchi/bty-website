---
name: bty-arena-change-review
description: Reviews proposed BTY Arena changes (diffs or summaries) for rule violations: season vs leaderboard, Core vs Weekly XP, UI logic duplication, DB schema/reset/auditing, auth/cookie runtime risks. Returns red flags, files to inspect, concrete fixes, and a safe-to-merge verdict. Use when the user pastes a diff or change summary in <<< >>> and asks for a review or "check for violations."
---

# BTY Arena Change Review

When the user provides proposed changes in the form `<<< ... >>>` (diff or summary), run a **rule compliance review** and respond using the exact output structure below.

## Violations to Check

1. **Season affecting leaderboard** — Leaderboard (weekly) rank must be derived from **Weekly XP** only (current league/window). Any use of season state, season boundaries, or Core XP to compute or sort leaderboard rank is a violation.
2. **Core XP vs Weekly XP mixed** — Core XP is permanent (lifetime). Weekly XP resets and is only for weekly ranking. Flag: using weekly XP for league/level/tier, or using Core XP for weekly ranking in a way that conflates the two (e.g. same column or same formula for both).
3. **XP/League logic in UI** — UI must not compute `levelFromXp`, `tierFromLevel`, `levelToTier`, season boundaries, or leaderboard ordering. Components should only consume precomputed data from API/engine (e.g. `LeaderboardRow[]`, `level`, `tier` passed as props).
4. **DB schema and reset/auditing** — Migrations or schema changes that: drop/rename ledger or event tables, remove audit columns, or break weekly reset (e.g. losing ability to reset weekly XP or snapshot state) are red flags.
5. **Auth / cookie / runtime** — Changes to auth callbacks, middleware, cookie settings, or runtime (edge vs node) that could break sessions, logout, or deployment. Flag: cookie attribute changes, new redirects without clearing session, runtime switches without rollback plan.

## Review Steps

1. Parse the diff or summary for touched areas: domain, API, UI, DB migrations, auth/middleware.
2. For each violation type above, scan for matching patterns (keywords, file paths, and logic).
3. Collect red flags with file paths and line numbers (or approximate locations) when possible.
4. Propose concrete fixes (file path + minimal diff or pseudocode); if no violation, say "None."
5. Answer "Safe to merge?" with **Yes** or **No**, and list any conditions (e.g. "Yes after removing UI tier computation" or "No until leaderboard sort uses Weekly XP only").

## Output Template

Use this structure in your response:

```markdown
## 1) Red flags
- [Violation type]: [brief description]. [File:line or area]
- (None for categories with no issues.)

## 2) Files / lines to inspect
- `path/to/file` — [reason]
- (List only where attention is needed.)

## 3) Concrete fixes
- **[Violation or file]**: [Minimal diff or step-by-step fix.]
- (If none: "No changes required for [category].")

## 4) Safe to merge?
**Verdict:** Yes / No  
**Conditions:** [e.g. "Yes, after applying fixes in section 3" or "No. Leaderboard must use Weekly XP only; fix in api/arena/leaderboard/route.ts."]
```

## Pattern Hints

- **Season/leaderboard:** Look for `season` and `rank`/`order`/`sort` together; leaderboard queries ordering by season fields.
- **Core vs Weekly:** Look for `weekly_xp`/`weeklyXp` used for level/tier/league; `core_xp`/`coreXp` used in weekly-only views without separation.
- **UI logic:** Grep UI components (e.g. under `components/bty-arena/`, `app/**/page.client.tsx`) for `levelFromXp`, `tierFromLevel`, `levelToTier`, `season`, or inline sort by XP.
- **DB:** Check migrations for `DROP`, `RENAME`, or removal of `*_ledger`, `*_snapshot`, or audit columns.
- **Auth:** Check `api/auth/**`, `middleware`, cookie opts (`SameSite`, `Secure`, `maxAge`), and runtime/edge config changes.

Keep the review scoped to the provided changes; do not invent diffs. If the user pastes only a summary, infer likely files from the description and label findings as "likely" where uncertain.
