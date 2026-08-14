# BTY Implementation Rules

**Purpose:** How to implement **safely** — git, layers, ledger, migrations, auth, deploy.  
**Audience:** Every AI before touching code.  
**Prerequisite:** [`BTY_PRODUCT_CONSTITUTION.md`](./BTY_PRODUCT_CONSTITUTION.md) → [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) → [`BTY_PROJECT_STATE.md`](./BTY_PROJECT_STATE.md) → [`BTY_PRODUCT_ROADMAP.md`](./BTY_PRODUCT_ROADMAP.md) → [`decisions/README.md`](./decisions/README.md)

Belief is in Constitution. Thinking is in Boot. Current reality is Project State. Direction is Roadmap. Guardrails are here. **Why** is in ADR.

---

## 0. Architecture Freeze Rule (development culture)

**Architecture is frozen.** The Architecture Phase is over.

### What is locked

Do not re-open or duplicate these in new documents:

- Product Constitution · AI Boot · Reality OS (Constitution + Boot + Engine contract)
- ADR system · Ledger system
- Reality Engine pattern · Event Engine (as built) · Core XP Root · SDK contract (`award → new_core_xp → reproject`)
- AI Onboarding stack

New canonical documents require **Commander approval**.  
Forbidden without approval: `BTY_*_CANON.md`, `BTY_*_ARCHITECTURE.md`, `*_v2.md` design dumps.

### Default for every new feature

```
Can it be explained by existing Constitution, Reality OS,
Implementation Rules, and ADRs?
        │
       YES → Do NOT create documents. Build code.
        │
        NO  → One new ADR (Why only). Then build code.
        │
  New Canon? → Commander approval only. Almost never.
```

**Default answer to "Shall we create a new document?"**  
*If Constitution already explains it — write code, not docs.*

### Development flow (now)

```
Think
  ↓
ADR (only when needed)
  ↓
Code
  ↓
Evidence (the running app)
```

Not: Think → Design → Document → Code.

BTY is **Product-Driven**, not Architecture-Driven.  
Success is not measured by new Canons. It is measured by product evidence:

- Verified Learning actually awards Core XP
- TODAY unifies Action / Event / Learning in one experience
- Avatar reflects verified real-world behavior
- Office culture visible through TII from accumulated verified events

---

## 1. Layer law (non-negotiable)

```
UI (app, components)
  ↓
API (app/api)
  ↓
Service (lib/bty, engine)
  ↓
Domain (domain)
```

| Rule | Meaning |
|------|---------|
| Domain imports nothing from lib, app, or UI | Pure functions only — no DB, no side effects |
| Service imports domain, not app/UI | Orchestration and I/O live here |
| API handlers are thin | Parse → validate → call service → respond. No business rules inline |
| UI renders only | No XP math, no leaderboard sort, no season logic in components |

Import map: [`architecture/DOMAIN_LAYER_TARGET_MAP.md`](./architecture/DOMAIN_LAYER_TARGET_MAP.md)

---

## 2. System boundary law

Modify **only** the system you are assigned:

| System | Paths |
|--------|-------|
| Arena | `src/domain/arena`, `src/lib/bty/arena`, `src/app/[locale]/bty-arena`, arena APIs |
| Center | `src/domain/center`, `src/lib/bty/center`, `src/app/[locale]/dear-me` |
| Foundry | `src/domain/foundry`, `src/lib/bty/foundry`, `src/app/[locale]/bty/(protected)` |

Do not edit another system's domain rules to fix your task.

---

## 3. Arena invariants (never regress)

1. **Season progression must not affect leaderboard ranking** — rank = Weekly XP only in active week
2. **Core XP is permanent** — weekly reset never reduces Core XP
3. **Weekly XP** resets at week boundary; used only for weekly ranking
4. **`interpretArenaDecision` stays pure** — no I/O
5. **`user_scenario_history` is sole source of truth** for scenario rotation
6. **Action QR validation** routes through `/api/arena/leadership-engine/qr/validate` — do not overload Event QR (`btyev1`) into this path
7. **Run completes as `complete_verified` only** when approved + `verified_at` set

Contract authority: [`ARENA_CANONICAL_CONTRACT.md`](./ARENA_CANONICAL_CONTRACT.md)

---

## 4. Reality Engine implementation contract

Every Reality Engine must follow:

```
verify(reality) → award() → new_core_xp → reproject(new_core_xp)
```

- **Authority:** `new_core_xp` returned from the award transaction is the only input to derived fields
- **Do not** re-fetch or recompute Core XP for projection
- **Engines do not calculate growth** — they verify and submit
- **Award failure** must not leave orphan participation rows (atomic tx)
- **SECURITY DEFINER functions:** Postgres defaults to PUBLIC EXECUTE. Service-role-only requires explicit:

  ```sql
  REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION … TO service_role;
  ```

  Verify runtime ACL after apply — catalog assumptions are not enough.

---

## 5. Git & repo topology

| Repo area | Role |
|-----------|------|
| `bty-app/` | Application code — **inner-main** is deploy source |
| `docs/` (repo root) | **Single source of truth** for operating docs |
| `bty-app/docs/` | App-internal technical docs only — not the task board |

- **Do not commit** unless the user explicitly asks
- **Do not force-push** main
- Operating docs (`CURSOR_TASK_BOARD`, `CURRENT_TASK`, `BTY_RELEASE_GATE_CHECK`) live in **repo root `docs/`**, not `bty-app/docs/`

---

## 6. Ledger & task discipline

**Ledger** = automatic decision record. Primary files:

| File | Contents |
|------|----------|
| [`CURSOR_TASK_BOARD.md`](./CURSOR_TASK_BOARD.md) | Shipped work, deploy versions, closure notes |
| [`CURRENT_TASK.md`](./CURRENT_TASK.md) | Latest canonical state + recent decisions |

When you **complete** an implementation task in the same turn:

1. Mark the board row `[x]` with one-line result
2. Add `[x]` line to `CURRENT_TASK.md` near top
3. If auth / reset / leaderboard / API / deploy touched → update [`BTY_RELEASE_GATE_CHECK.md`](./BTY_RELEASE_GATE_CHECK.md)

**Do not** leave outcomes only in chat.

Task queue for agents: board **"이번 런"** section — see [`agent-runtime/HOW_TO_READ_TASKS.md`](./agent-runtime/HOW_TO_READ_TASKS.md)

---

## 7. Migrations

- Files: `bty-app/supabase/migrations/` — **ordered, idempotent**
- Prefer `ADD COLUMN IF NOT EXISTS`, guarded `DO $$` blocks
- Never regress existing test baseline
- **Apply is separate from commit** — Commander GO for production
- Before apply: snapshot / rollback path documented in ledger
- After apply: **verify runtime** (constraints, ACL, not just migration history table)

Evaluation skill: `.claude/skills/evaluate-migration-safety/SKILL.md`

---

## 8. Auth, cookies, deploy

Treat session/cookies as production-critical.

| Flag | Production expectation |
|------|------------------------|
| Secure | `true` on HTTPS |
| SameSite | `Lax` or `Strict` |
| Path | Usually `/` for app-wide session |
| Domain | Unset unless cross-subdomain required |

Release gate contract:

- Valid login → **200** + `Set-Cookie`
- Authenticated `GET /api/arena/session/next` succeeds
- No in-memory-only or demo-auth bypass on production paths

Deploy target: Cloudflare Workers via `npm run deploy` from `bty-app/`.  
Verify: local → preview/staging → prod smoke.

Full checklist: [`BTY_RELEASE_GATE_CHECK.md`](./BTY_RELEASE_GATE_CHECK.md) · [`architecture/RELEASE_GATE.md`](./architecture/RELEASE_GATE.md)

---

## 9. Verification commands

Run from `bty-app/`:

```bash
npm run lint              # tsc --noEmit
npm run lint:terminology  # terminology lock
npm test                  # Vitest unit tests
npm run build             # production build
npm run test:e2e:ci       # Playwright (when E2E scope applies)
```

C5 verify agent runs full gate when requested — see [`agent-runtime/C5_VERIFY_TASK.md`](./agent-runtime/C5_VERIFY_TASK.md)

---

## 10. Document creation gate

**Last resort:** new documents are the last resort. Default action is **code**.

Before writing any doc, confirm the idea is **not** already covered by Constitution, Boot, or an existing ADR.

| If… | Then… |
|-----|--------|
| Fits existing Constitution / Boot / ADR | **Build code** |
| New eternal law | Constitution — Commander only (almost never) |
| New guardrail learned the hard way | Implementation Rules — rarely |
| New **Why** (year-scale fork) | **One ADR** — append-only |
| Something shipped | Ledger line only |
| Position / priority changed | Update State or Roadmap |

Before writing a new doc:

> *Will this prevent the same mistake ten times across AI sessions?*

| Answer | Action |
|--------|--------|
| YES — eternal law | Constitution (Commander only) |
| YES — why we chose X | **New ADR** in `docs/decisions/` |
| YES — new system born | Architecture doc for that system |
| YES — shipped work | Ledger line in `CURRENT_TASK` / board |
| NO | Do not create — put knowledge in code |

Allowed permanent types: Constitution, Boot (LOCKED), Architecture (per system), ADR (append-only), Ledger.  
**Mutable orientation:** Project State, Product Roadmap.  
Boot + onboarding are meta — not feature specs.

### When to write an ADR

Write an ADR when someone will ask **"why?"** in six months and the answer is not in Constitution:

- HTTP semantics (e.g. 200 on duplicate scan)
- RPC atomicity choices
- Security incident lessons
- Engine contract interpretations

Do **not** duplicate ADR content in Project State — link to the ADR.

---

## 11. UI implementation rules

- UI receives **precomputed** values from API/engine
- No business-rule duplication in React components
- Prefer extending existing components over new screens
- i18n: `src/lib/i18n.ts` — KO default, `/en` for English
- Code Name only in user-facing Arena surfaces (no real names in leaderboard display rules)

---

## 12. When uncertain

1. Re-read Boot §12 — does this bring people back to reality?
2. Check Project State — is this the current priority?
3. Check relevant **ADR** — was this already decided?
4. Check Constitution — does this bypass Core XP or verification?
5. Stop and ask Commander — **do not guess** domain rules

---

*Version: 1.0 · Established: 2026-06-25*
