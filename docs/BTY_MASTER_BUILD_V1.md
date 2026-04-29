# BTY Master Build Document v1

> Single source of truth for product structure, loop, storage, and implementation order.  
> **Scope:** `bty-app/**` unless otherwise noted.  
> **실행 체크리스트:** [`BTY_IMPLEMENTATION_CHECKLIST_V1.md`](./BTY_IMPLEMENTATION_CHECKLIST_V1.md)

---

## 1. Product Definition

BTY is a **leadership operating system** that trains decision-making, translates it into reflection, stabilizes it through recovery, and accumulates it into identity.

| Axis | Role |
|------|------|
| **Arena** | Action |
| **Growth** | Interpretation |
| **Recovery** | Protection |
| **My Page** | Identity |

---

## 2. Core Loop

```
Arena → Reflection → Recovery (if needed) → My Page → next Arena cycle
```

### 2.1 Data flow (implemented)

| Step | Action |
|------|--------|
| Arena Result | `buildArenaSignal` → `pushSignalIfNew` → `buildReflectionSeed` → `pushReflectionSeedIfNew` (deduped; `src/app/[locale]/bty-arena/result/page.tsx`) |
| Reflection airlock | `getLatestReflectionSeed()` (`bty-growth-seeds`) |
| Reflection write | `buildReflectionEntry` → `pushReflection` (`bty-reflections`) → optional redirect to `/growth/history` |
| Growth History | `loadReflections()` + `shouldShowCompoundRecovery(loadSignals(), reflections)` |
| My Page | `loadSignals` + `loadReflections` → `computeMetrics` → `computeLeadershipState(metrics, locale, reflections)` → `mergeLeadershipReflectionLayer(..., reflections)` |
| Recovery | `buildRecoveryPrompt` + `pushRecoveryEntry` (`bty-recovery-entries`) |

Aliases: `loadLatestReflectionSeed`, `loadLatestReflection` (see `features/growth/logic/index.ts`).

**Principles**

- Action first  
- Interpretation second  
- Recovery protects the **next** decision (re-entry gate, not failure)  
- Identity is **accumulated**, not declared  

---

## 3. Routes

App routes are under **`/[locale]`** (`en` | `ko`). Logical paths:

| Path | Role |
|------|------|
| `/[locale]/bty-arena` | Arena hub / entry |
| `/[locale]/bty-arena/play` | Play |
| `/[locale]/bty-arena/result` | Result |
| `/[locale]/growth` | Growth hub |
| `/[locale]/growth/reflection` | Reflection airlock (seed + recovery signal) |
| `/[locale]/growth/reflection/write` | Structured reflection writing |
| `/[locale]/growth/history` | Growth history board |
| `/[locale]/growth/recovery` | Recovery entry |
| `/[locale]/my-page` | Identity / leadership console |

*Additional Growth IA (Dojo, Integrity, Journey, etc.) lives under `/growth/*` as implemented.*

---

## 4. Domain Models (code-aligned)

### ArenaSignal

Persisted under `bty-signals`. See `features/my-page/logic/types.ts` / `features/arena/logic/signalStorage.ts`.

- `scenarioId`, `primary`, `reinforcement`, `traits`, `meta` (incl. relational / operational / emotional regulation), `timestamp`

### ReflectionSeed

Built after Arena; stored in Growth seed list. See `features/growth/logic/buildReflectionSeed.ts`, `growthStorage.ts`.

- `scenarioId`, `focus`, `promptTitle`, `promptBody`, `cue`, `createdAt`, plus Arena link fields as defined in `ReflectionSeed`

### ReflectionEntry

Persisted under `bty-reflections`. See `features/growth/logic/types.ts`.

- `id`, `source: "arena"`, `scenarioId`, `focus`, `promptTitle`, `promptBody`, `cue`, `answer1`–`answer3`, `commitment`, `createdAt`  
- *Conceptually “answers + commitment”; implementation uses named answer fields.*

### RecoveryEntry

Persisted under `bty-recovery-entries`. See `features/growth/logic/recoveryTypes.ts`.

- `id`, `promptReason`, `promptSource` (`"arena"` \| `"growth"`), `patternNote`, `resetAction`, `reentryCommitment`, `createdAt`

### RecoveryPrompt (runtime, not always stored)

- `source`, `reason` (`low-regulation` \| `repeated-friction` \| `pressure-accumulation`), `title`, `body`, `cue`, `createdAt`

---

## 5. Storage

| Layer | Key | Notes |
|-------|-----|--------|
| **localStorage** | `bty-signals` | Arena signals |
| **localStorage** | `bty-growth-seeds` | Reflection seeds (Arena → Growth) |
| **localStorage** | `bty-reflections` | Saved `ReflectionEntry` list |
| **localStorage** | `bty-recovery-entries` | Saved `RecoveryEntry` list |
| **localStorage** | `btyArenaState:v1` | Arena client state (hub/play continuity) |
| **sessionStorage** | `bty-arena-mission-v1` | Mission payload (scenario session) |
| **sessionStorage** | `bty-growth-seed-dedupe-keys-v1` | Seed dedupe (implementation detail) |
| **legacy** | `bty-reflection-entries` | Migrated once into `bty-reflections` if new key empty |

*If product copy references “`bty-arena-session`”, treat it as the **mission / arena session** concept above—exact key names may evolve; prefer the constants in code.*

---

## 6. Screen Roles

| Area | Responsibility |
|------|----------------|
| **Arena** | Scenario, decisions, system log / result |
| **Reflection** | Structured questions, commitment, link to Arena seed |
| **Growth History** | Reflection list, focus pattern summary, recovery strip when triggered |
| **Recovery** | Pressure reset, short re-entry fields, return to Growth / Arena |
| **My Page** | Interpreted leadership state; optional reflection layer merge (read-only) |

---

## 7. Tone Rules

**Visual**

- Dark navy / slate gradients  
- Glass panels (`border-white/10`, blur, subtle cyan)  
- Cyan accents  

**Language**

- Calm, observational, non-judgmental  
- Premium, not gamified  

**Avoid**

- Right/wrong framing  
- Reward / punishment language  
- Noisy dashboard or social feed patterns  

---

## 8. Recovery Trigger

Show recovery-oriented UI when **either**:

1. **Low emotional regulation** on recent Arena signals (`checkRecoveryTrigger` — last 3–5 signals, avg regulation threshold), or  
2. **Repeated regulation focus** in recent reflections (last 5 entries, regulation count ≥ 2)  

Compound helper: `shouldShowCompoundRecovery(signals, reflections)`.

Optional **borderline** band for copy only: `buildRecoveryPrompt` may add `pressure-accumulation` when signals suggest thinning margin (see `features/growth/logic/buildRecoveryPrompt.ts`).

---

## 9. Implementation Phases

1. Arena flow  
2. Reflection flow (seed → write → save)  
3. Growth history  
4. Recovery system (prompt + entry storage)  
5. My Page integration (signals + reflection merge; **no duplicated XP/season logic in UI**)  

---

## 10. E2E Coverage

Must validate (adjust selectors to `data-testid` in codebase):

- Arena play → result  
- Reflection save → redirect to history (if implemented)  
- History display  
- Recovery trigger + recovery save (optional)  
- My Page reflects accumulated signals (and reflection strip when entries exist)  

See also: `docs/E2E_ARENA.md`, `docs/E2E_DATA_TESTIDS.md`.

---

## 11. Code Map (quick)

| Concern | Location |
|---------|----------|
| Signals | `features/arena/logic/signalStorage.ts` |
| Reflection storage | `features/growth/logic/reflectionStorage.ts` |
| Recovery storage | `features/growth/logic/recoveryStorage.ts` |
| Recovery compound | `features/growth/logic/recoveryCompoundSignal.ts` |
| Leadership merge | `features/my-page/logic/mergeLeadershipReflection.ts` |
| Growth History UI | `features/growth/history/GrowthHistoryScreen.tsx` |
| Recovery UI | `features/growth/recovery/RecoveryEntryScreen.tsx` |

---

## 12. Final Principle

BTY is **not** a game UI. It is a **leadership operating loop**.

Every screen should reinforce:

- **Clarity**  
- **Control**  
- **Continuity**  

---

*Document version: 1.0 — update when storage keys or route tree changes.*
