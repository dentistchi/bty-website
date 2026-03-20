# Cursor Master Prompt — BTY Full Product Loop

> **Purpose:** Single operational baseline so implementation stays aligned from **Arena → Reflection → Recovery → My Page → API → E2E** without drifting product philosophy.  
> **How to use:** Paste into Cursor when onboarding a new session, scoping a large change, or auditing alignment.

---

You are implementing BTY as a connected leadership operating system.

BTY is NOT a casual game, NOT a noisy dashboard, and NOT a reward-first training app.  
It is a calm, premium, structured leadership loop.

**Core system:**

| Layer | Role |
|--------|------|
| **Arena** | action |
| **Growth** | interpretation |
| **Recovery** | protection |
| **My Page** | identity |

**Core product loop:**

```
Arena Lobby
→ Arena Play
→ Arena Result
→ save Arena signal
→ create Reflection seed
→ Growth Reflection Entry / Writing
→ save Reflection entry
→ Growth History
→ Recovery prompt (if needed)
→ My Page interpreted identity state
→ next Arena cycle
```

---

## 1. DESIGN RULES

Keep the full product in one visual family:

- deep navy / slate-black background
- dark glass panels
- muted cyan accents
- rounded-2xl / rounded-3xl
- soft borders
- subtle shadows
- premium spacing and typography
- calm, cinematic, restrained

**Tone rules:**

- calm  
- observational  
- professional  
- non-judgmental  
- structured  

**Never use:**

- right / wrong  
- victory  
- reward bursts  
- noisy leaderboard/dashboard clutter  
- playful gamification language  
- green/red moral feedback  

**Feel:**

- **Arena** — leadership simulation console  
- **Growth** — guided reflection  
- **Recovery** — structured reset, not failure  
- **My Page** — premium identity console  

---

## 2. ROUTES

Implement / keep these routes:

- `/[locale]/bty-arena`
- `/[locale]/bty-arena/play`
- `/[locale]/bty-arena/result`
- `/[locale]/growth`
- `/[locale]/growth/reflection`
- `/[locale]/growth/reflection/write` (airlock → writing)
- `/[locale]/growth/history`
- `/[locale]/growth/recovery`
- `/[locale]/my-page`

---

## 3. DOMAIN MODELS

Implement / keep these core types:

- `ArenaScenario`
- `ArenaSignal`
- `ReflectionSeed`
- `ReflectionEntry`
- `RecoveryPrompt`
- `RecoveryEntry`
- `LeadershipMetrics`
- `LeadershipState`

**ArenaScenario** must support: `id`, `stage`, `caseTag`, `title`, `difficulty`, `description`, `primaryChoices`, `reinforcementChoices`, outcomes keyed by `A_X`, `A_Y`, etc.

**ArenaSignal** must include: `scenarioId`, `primary`, `reinforcement`, `traits`, `meta`, `timestamp`

**ReflectionSeed** must include: `source`, `scenarioId`, `primary`, `reinforcement`, `focus`, `promptTitle`, `promptBody`, `cue`, `createdAt` (optional `id` when from Supabase)

**ReflectionEntry** must include: `id`, `scenarioId`, `focus`, `promptTitle`, `promptBody`, `cue`, `answer1`, `answer2`, `answer3`, `commitment`, `createdAt`

**RecoveryEntry** must include: `reason` (via prompt), `patternNote`, `resetAction`, `reentryCommitment`, `createdAt`

**LeadershipState** must be **interpreted**, not raw-dump-first.

---

## 4. ARENA IMPLEMENTATION

**Routes:**

- `/bty-arena` = Lobby  
- `/bty-arena/play` = Play  
- `/bty-arena/result` = Resolve  

**Behavior:**

- Lobby: Enter Arena, Resume Scenario  
- Play: primary + reinforcement decisions  
- Resolve: sealed decisions + interpretation  
- no right/wrong  
- no raw XP celebration  

Use a typed scenario model and one fully formed mock scenario: **Patient Complaint: Revised Estimate**.

**Shared UI:** `ArenaTopBar`, `ArenaSystemLog`, `GlassPanel`, `DecisionCard`, `SealedDecisionCard`, `HiddenStatRow`

**Session:** `selectedPrimary`, `selectedReinforcement`, `phase`, `scenarioId` (e.g. `bty-arena-session-v1` in sessionStorage)

---

## 5. GROWTH IMPLEMENTATION

**Arena Result** must produce:

- `ArenaSignal`  
- `ReflectionSeed`  

**Reflection flow:**

- `/growth/reflection` loads latest `ReflectionSeed` (then **Open** → `/growth/reflection/write`)  
- Reflection Writing: 3 structured questions + 1 commitment  
- Save → `ReflectionEntry` → navigate to `/growth/history`  

**Growth History:**

- recent reflection records  
- focus pattern accumulation  
- commitment lines  
- optional Recovery signal strip when compound trigger applies  

**Recovery (`/growth/recovery`):**

- calm structured reset, not shame  
- short prompt: pressure pattern → what must reset → re-entry commitment  

---

## 6. MY PAGE IMPLEMENTATION

Premium identity console — **not** a generic profile page or KPI dashboard.

**Structure:** `IdentityHero`, `LeadershipStateRow`, `PatternField`, `ReflectionDepthPanel`, `InfluenceField`, `RecoveryAwarenessPanel`, `NextFocusCommand`

**Show (interpreted):** codename, stage, headline, system note, AIR/TII/Rhythm labels, relational/operational/emotional pattern copy, reflection depth, recent focus, integration signal, recovery awareness, next focus, development cue, suggested route.

**Example language:** Stabilizing Insight Pattern, High Relational Influence, Reflection Depth: Active, Recovery Awareness: Detected — **not** raw analytics as primary UI.

---

## 7. STORAGE / SERVER EVOLUTION

Local/session may support prototype/guest fallback; **product path** uses Supabase + API.

**Session key:** `bty-arena-session-v1`

**Supabase tables:** `bty_arena_signals`, `bty_reflection_seeds`, `bty_reflection_entries`, `bty_recovery_entries`

**Requirements:** `user_id` → `auth.users.id`, RLS on, users **read/insert own** rows only (v1: no broad update/delete unless specified).

---

## 8. API ROUTES

Implement / keep:

| Method | Path |
|--------|------|
| `POST` | `/api/bty/arena/signals` |
| `GET` | `/api/bty/growth/seeds/latest` |
| `POST` | `/api/bty/growth/reflections` |
| `GET` | `/api/bty/growth/history` |
| `POST` | `/api/bty/growth/recovery` |
| `GET` | `/api/bty/my-page/state?locale=en\|ko` |

**Rules:**

- Server Supabase client (`@/lib/supabase/server` or project equivalent)  
- `auth.getUser()` for user scope  
- `POST /api/bty/arena/signals`: signal + reflection seed in one flow  
- `GET /api/bty/my-page/state`: `computeMetrics` + `computeLeadershipState` + `mergeLeadershipReflectionLayer` (interpreted state)  

**BTY Arena rules (global):** Do not duplicate XP/season/leaderboard business logic in UI; identity metrics on My Page are **trace/meaning** layer, not competitive ranking.

---

## 9. COMPUTATION LAYERS

**Functions:** `buildArenaSignal`, `buildReflectionSeed`, `buildReflectionEntry`, `computeMetrics`, `computeLeadershipState`, `mergeLeadershipReflectionLayer`, `checkRecoveryTrigger` / `checkArenaLowRegulation` (see codebase)

**Flows:**

- Arena Result → build signal → store → build seed → store  
- Reflection Writing → build entry → store  
- My Page → read signals + reflections → `computeMetrics` → `computeLeadershipState` → merge → render  

**Recovery trigger:** recent low emotional regulation **and/or** repeated regulation-focused reflections (compound signal).

---

## 10. E2E TEST COVERAGE

Playwright project: **`bty-loop`** (`e2e/bty/**/*.spec.ts`). See `docs/BTY_E2E_LOOP.md`.

**Loop:** `/bty-arena` → enter → `/play` → primary/reinforce → resolve → `/result` → review reflection → `/growth/reflection` → **open-reflection-write** → `/growth/reflection/write` → fill → save → `/growth/history` → optional recovery → `/my-page` identity regions.

**Use `data-testid` only** in specs (stable ids documented in `docs/BTY_E2E_LOOP.md` and UI).

**Minimum ids include:** `arena-enter`, `arena-resume`, `primary-A`…`C`, `reinforce-X`…`Y`, `resolve-decision`, `resolve-interpretation`, `review-reflection`, `return-arena`, `continue-arena`, `open-reflection-write`, `reflection-prompt-title`, `reflection-answer-1..3`, `reflection-commitment`, `save-reflection`, `growth-history-list`, `reflection-history-card`, `recovery-signal-strip`, `open-latest-reflection`, `open-recovery`, `recovery-prompt-title`, `recovery-pattern-note`, `recovery-reset-action`, `recovery-reentry-commitment`, `save-recovery`, `identity-hero`, `leadership-state-row`, `pattern-field`, `reflection-depth-panel`, `recovery-awareness-panel`, `next-focus-command`

---

## 11. IMPLEMENTATION ORDER

1. **Phase 1** — Arena routes, scenario model, shared UI, play/result flow  
2. **Phase 2** — Signal save, reflection seed, reflection writing  
3. **Phase 3** — Growth history, recovery trigger, recovery screen  
4. **Phase 4** — My Page premium identity, interpreted state  
5. **Phase 5** — Supabase schema, API routes, frontend fetch, E2E  

**Execution tip:** Close one segment at a time without breaking the loop; avoid “big bang” refactors.

---

## 12. OUTPUT RULE

When implementing:

- keep code typed and clean  
- no unrelated refactors  
- no flashy features  
- preserve calm BTY tone  
- prefer **code + minimal diffs** in responses  

---

## 13. REPO POINTER (current implementation)

| Area | Location (indicative) |
|------|------------------------|
| Arena mission flow | `src/app/[locale]/bty-arena/**`, `src/features/arena/**` |
| Growth | `src/app/[locale]/growth/**`, `src/features/growth/**` |
| My Page | `src/app/[locale]/my-page/page.tsx`, `MyPageLeadershipConsole`, `PremiumMyPageIdentityScreen` |
| API + identity lib | `src/app/api/bty/**`, `src/lib/bty/identity/**`, `src/lib/supabase/server.ts` |
| Migrations | `supabase/migrations/*bty_identity*` |
| E2E | `e2e/bty/**`, `playwright.config.ts` project `bty-loop` |

---

*This document is the operational “north star” for BTY product alignment in Cursor.*
