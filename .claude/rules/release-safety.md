---
description: Release gate — auth/deploy/weekly reset/leaderboard safety
paths:
  - bty-app/src/middleware.ts
  - bty-app/src/app/api/**
  - bty-app/src/lib/auth/**
  - bty-app/supabase/**
---

# Release Safety Rule

이 문서는 다음 2개 룰을 통합합니다:
- bty-auth-deploy-safety
- bty-release-gate

배포·인증·주간 리셋·리더보드·XP 저장·시즌 경계 변경 시 적용.

---

## SCOPE

- BTY Arena business rules apply ONLY inside `bty-app/**` unless explicitly stated.
- **Operating docs single source**: 보드·CURRENT_TASK·Release Gate·backlog·architecture·plans·specs·execution 은 **repo root `docs/`** 단일 진실. `bty-app/docs/`는 앱 내부 기술 문서 전용.

---

## Non-negotiable Invariants (재확인)

1. **Season progression MUST NOT affect leaderboard ranking.**
2. **Core XP is permanent (lifetime)** and must NEVER decrease due to weekly resets.
3. **Weekly XP resets** at the weekly boundary and is used **ONLY** for weekly ranking.
4. **UI must NOT compute** XP/League/Season business rules; UI renders results from API/engine.

---

## A) Auth / Cookies / Session

### Cookie Flags

- **Secure** — must be `true` in production (HTTPS only)
- **SameSite** — `Lax` or `Strict`; avoid `None` unless cross-site is required and Secure is set
- **Path** — scope of the cookie (e.g. `/` vs `/api`)
- **Domain** — leave unset for current host, or set explicitly for subdomains

### Release Gate Contract

- Valid login → **200**
- **`Set-Cookie`** on success
- Authenticated **`GET /api/arena/session/next`** succeeds
- **No** in-memory-only session/auth on **production** or **release-gate** path
- **Demo-auth** or test bypass in prod → **blocking**

### Logout

- Clears cookies and session state

### Runtime Changes (Edge vs Node)

- Explain impact (e.g. Node-only APIs, cold starts, env availability)
- Provide a **rollback plan** (revert deploy, feature flag, or config switch)

---

## B) Weekly Reset Safety

- Define reset boundary source of truth (e.g., `week_start_date` or `week_id`)
- Confirm weekly reset does **NOT** modify Core XP storage/history
- Provide **idempotency plan**: running reset twice does not corrupt totals
- Provide **race condition plan**: concurrent XP awards during reset window

---

## C) Leaderboard Correctness

- Confirm ranking sort uses **Weekly XP only** (within active weekly window)
- Specify deterministic **tie-breakers**: e.g., `weekly_xp desc, updated_at asc, user_id asc`
- Confirm season progress fields are **NOT** used in leaderboard ordering

---

## D) Data / Migration Safety

(See `.claude/rules/migrations.md` for migration-specific rules)

- Provide migration path(s) and summary
- List new/changed constraints and indexes and why
- State rollback approach
- Confirm Core XP and Weekly XP storage remain clearly separated

---

## E) API Contract Stability

- List endpoints changed and expected request/response fields
- Confirm UI receives computed values (no rule duplication in UI)
- Note caching behavior (if any) for leaderboard endpoints

---

## F) Verification Steps (MANDATORY)

Provide step-by-step checklist:

1. **Local**: login → earn XP → view profile + leaderboard
2. **Local**: simulate weekly boundary/reset (time injected or test `week_id`)
3. **Preview**: login persistence across refresh and navigation
4. **Production**: cookie behavior + leaderboard loads + no 401 loops

---

## Forbidden in Auth/Deploy code

- **Do not change domain rules** in auth/deploy code. Domain/engine/XP/leaderboard rules live in `src/domain/` or engine only.
- **Do not implement XP/leaderboard computations** in API handlers. Call engine/domain; handlers orchestrate and return results.

---

## Output Format (MANDATORY)

When making release-gated changes, output in this order:

1. **Assumptions**
2. **Release Gate Results**: PASS / FAIL
3. **Findings** (grouped by A–F above)
4. **Required patches** (file paths + minimal diffs)
5. **Next steps checklist**
6. **Reflect results in common docs**: 매번 write to `docs/BTY_RELEASE_GATE_CHECK.md` (and `docs/CURSOR_TASK_BOARD.md` Exit/status as applicable). 경로는 repo root 기준. Do not leave gate outcome only in chat.

---

## Examples

### Auth change

```markdown
Cookie flags: Secure=true (prod), SameSite=Lax, Path=/.
Reasoning: session cookie must not leak to HTTP or cross-site; path / so app-wide.

How to verify:
- Local: npm run dev → sign in → check Application > Cookies for Secure/SameSite
- Preview: Deploy preview → sign in → confirm cookie on HTTPS
- Prod: After deploy, sign in on production URL; confirm no redirect loops or 401s
```

### Runtime change

```markdown
Impact: Moving /api/auth/callback to Edge removes Node-only APIs (e.g. fs);
Supabase client is Edge-compatible.
Rollback: revert to Node runtime in route config or redeploy previous build.

How to verify:
- Local: Run in Edge mode (if possible) and test callback URL
- Preview: Deploy and complete OAuth flow on preview URL
- Prod: Deploy during low traffic; verify callback and session; rollback if errors spike
```

---

## Default Safe Assumptions (use if not specified)

- Leaderboard uses weekly window key (`week_id` or `week_start_date`)
- Weekly XP is computed from weekly ledger or weekly totals table scoped by `week_id`
- Core XP is stored separately (core ledger or core totals table) and never reset
- UI only formats presentation and never computes ranking or XP rules

---

## Required: Minimal Changes

- **Smallest diff** that achieves the goal
- **No refactors or "cleanups"** in the same change
- End with **"How to verify"** steps for local, preview, and prod
