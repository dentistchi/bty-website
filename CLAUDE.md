# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ NON-NEGOTIABLE INVARIANTS

These rules MUST NEVER be violated without explicit user approval.

### Scenario / Run / QR
- `user_scenario_history` is the **sole** source of truth for scenario rotation
- `interpretArenaDecision` MUST remain a **pure function** (no I/O, no DB, no side effects)
- QR validation routes **only** through `/api/arena/leadership-engine/qr/validate`
- A run reaches `complete_verified` **only** when approved + `verified_at` is set

### XP / Season / Leaderboard (Arena)
- **Season progression MUST NOT affect leaderboard ranking.** Leaderboard rank = Weekly XP only.
- **Core XP is permanent (lifetime).** Weekly XP resets and is **only** for weekly ranking. Never mix or reuse Weekly XP for league/season logic.
- **UI must NOT compute** XP/League/Season business rules. UI renders results from API/engine only.

### Patterns
- Pattern signals: max 1 per family per run; Steps 2–4 only

### Migrations
- Must be ordered and idempotent
- Never regress the existing test baseline

### Documentation Authority
- `docs/` canonical specs override local assumptions and summaries — read before modifying engine behavior
- `ARENA_CANONICAL_CONTRACT.md` overrides local assumptions

---

## Repository Layout

All application code lives in `bty-app/`. Run every command from that directory.

```
bty-app/
  src/
    app/[locale]/      # Locale-aware Next.js pages (KO default, /en for English)
    app/api/           # Thin API route handlers
    domain/            # Pure business logic — no DB calls, no side effects
    engine/            # Stateful orchestration services
    lib/bty/           # Service layer (arena, pattern, action-contract, leadership, auth, i18n)
    components/        # React components (RSC for data, client for interactivity)
  docs/                # App-internal technical docs only
  e2e/                 # Playwright tests
docs/                  # ⭐ SINGLE SOURCE OF TRUTH for operating docs
                       # (board, CURRENT_TASK, Release Gate, backlog, architecture, plans, specs)
```

**Operating docs single source:** Board · CURRENT_TASK · Release Gate · backlog · architecture · plans · specs · execution all live in **repo root `docs/`**. `bty-app/docs/` is for app-internal technical docs only.

---

## Commands

All commands run from `bty-app/`.

```bash
# Dev
npm run dev                  # Next.js dev server on port 3001

# Build
npm run build                # Production build
npm run build:fast           # Skip source maps (faster)
npm run cf:build             # Cloudflare Pages build

# Lint
npm run lint                 # TypeScript type-check (tsc --noEmit)
npm run lint:eslint          # ESLint
npm run lint:terminology     # Terminology validator

# Unit tests (Vitest, Node environment)
npm test                     # All unit tests
npm run test:watch           # Watch mode
npm test -- src/path/to/file.test.ts   # Single file

# E2E tests (Playwright)
npm run test:e2e             # All projects
npm run test:e2e:bty         # Arena routes only
npm run test:e2e:ci          # CI mode (chromium, 2 workers, 1 retry)
```

---

## Architecture — Layer Rules (strictly enforced)

Imports flow **downward only**: `domain` ← `engine/lib` ← `api` ← `components`

| Layer | Location | Rule |
|-------|----------|------|
| **Domain** | `src/domain/` | Pure functions only. No DB, no side effects. |
| **Service/Engine** | `src/engine/`, `src/lib/bty/` | Calls domain functions + DB side effects. |
| **API** | `src/app/api/` | Deserialize → call service → return JSON. No business logic. |
| **UI** | `src/components/`, `src/app/[locale]/` | Render + hooks only. Data fetching via RSC or service calls. |

### System Boundaries (Arena / Center / Foundry)

Each system modifies **only its own area**:

- **Arena**: `src/domain/arena`, `src/lib/bty/arena`, `src/app/[locale]/bty-arena`
- **Center**: `src/domain/center`, `src/lib/bty/center`, `src/app/[locale]/dear-me`
- **Foundry**: `src/domain/foundry`, `src/lib/bty/foundry`, `src/app/[locale]/bty/(protected)`

Cross-system domain modification is forbidden.

### Core Engines

- **Scenario Engine** — selects and routes the next scenario per user, respecting tier/pool rules
- **Pattern Engine** — records entry/exit signals per family per run (Steps 2–4 only, max 1 per family per run)
- **Action Contract Service** — manages 10-field contracts through Layer 1 (structural/Zod) → Layer 2 (semantic/validator) pipeline
- **Leadership Engine** — tracks role-based distortion (Stage 1–4), computes AIR and TII, enforces Stage 4 forced-transition rules
- **Level Engine** — band progression via `consecutive_verified_completions`
- **Execution Gate** — QR token minting and verification receipts

### Architecture Docs (read before changing engine behaviour)

- `docs/ENGINE_ARCHITECTURE_V1.md` — schema, service boundaries, data models
- `docs/LEADERSHIP_ENGINE_SPEC.md` — single authoritative spec for AIR, TII, Stage transitions
- `docs/PATTERN_ACTION_MODEL_V1.md` — family definitions, thresholds, validator specs
- `docs/ARENA_CANONICAL_CONTRACT.md` — contract field spec
- `docs/ENVIRONMENT.md` — env var single source of truth
- `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md` — layer mapping
- `docs/architecture/CHAT_LAYER_SPEC.md` — chat layer spec
- `docs/agent-runtime/C1_MASTER_COMMANDER.md` — orchestration spec

---

## Path-Scoped Rules (auto-loaded by Claude Code)

| Working in... | Auto-loaded rule |
|---|---|
| `src/domain/**` | `.claude/rules/domain-purity.md` |
| `src/lib/bty/**` | `.claude/rules/service-layer.md` |
| `src/lib/bty/chat/**` | `.claude/rules/chat-boundary.md` |
| `src/app/api/**` | `.claude/rules/api-handlers.md` |
| `src/app/**.tsx`, `src/components/**` | `.claude/rules/ui-render-only.md` |
| `**/*.sql`, `supabase/migrations/**` | `.claude/rules/migrations.md` |
| Auth/middleware/release | `.claude/rules/release-safety.md` |
| Anywhere | `.claude/rules/architecture.md` |

---

## Slash Commands (manual workflows)

| Command | Purpose |
|---|---|
| `/bug-analyze` | Diagnose root cause — no code changes |
| `/bug-fix` | Apply minimal safe fix |
| `/test-safe-change` | Make change while preserving test baseline |
| `/c5-verify` | Run C5 verification (lint/test/build) and update tracking docs |
| `/auto4-prompts` | Inline C1–C5 copy-paste prompts |
| `/continue` | Read CURSOR_TASK_BOARD "이번 런" and resume work |
| `/refresh` | Run REFRESH procedure — output 5 tasks per role (C2–C6) |

---

## Specialized Subagents

Use `Task` tool to delegate to these. Each runs in isolated context.

| Agent | When to use |
|---|---|
| `c1-commander` | Project orchestration only — never modifies code |
| `c5-verify` | Verification runs (lint/test/build) + automatic doc updates |

(Plus existing Cursor subagents already migrated: `bty-arena-data-engineer`, `bty-arena-rules`, `bty-arena-ui`, `bty-auth-deploy-safety`, `bty-domain-architect`, etc.)

---

## Task Completion Discipline (MANDATORY)

When completing any task in the same turn:

1. **Update `docs/CURSOR_TASK_BOARD.md`** — mark TASK row `[x]`, add one-line result summary
2. **Update `docs/CURRENT_TASK.md`** — add `**[task]**: [x] **완료.** …` line near top
3. **Update `docs/BTY_RELEASE_GATE_CHECK.md`** — if change touches auth/reset/leaderboard/API/deploy

**Never defer doc updates to the next turn** — this prevents the same task from being re-issued.

For C5 verification specifically, see `/c5-verify` command.

---

## Testing Conventions

| Suffix | Type |
|--------|------|
| `.test.ts` / `.test.tsx` | Unit |
| `.edges.test.ts` | Edge-case unit |
| `.smoke.test.ts` | Regression/quick validation |
| `.contract.test.ts` | Integration contract |
| `.spec.ts` | E2E (Playwright) |

E2E uses 3 isolated auth contracts (default / step6-policy / step6-forced) to avoid 409 conflicts. Auth state stored in `e2e/.auth/`.

---

## Tech Stack

- **Next.js 15** (App Router, RSC) + **React 19** + **TypeScript 5**
- **Supabase** (PostgreSQL) — primary database and auth
- **NextAuth v5** — session management; **Entra ID** for admin RBAC (`BTY_ADMIN_EMAILS`)
- **Tailwind CSS 3**, Radix UI, Framer Motion
- **Zod** — validation at system boundaries
- **Vitest** (unit) + **Playwright** (e2e)
- **Cloudflare Pages** (opennextjs-cloudflare) — deployment target

---

## I18n

Routes: `/` and `/bty` (Korean), `/en` and `/en/bty` (English). Locale injected via `[locale]` route param. Static index at `src/lib/i18n.ts`.
