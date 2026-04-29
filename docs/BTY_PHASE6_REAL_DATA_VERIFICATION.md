# Phase 6 — Real data flow (client) — Verification

> **Status:** The My Page pipeline already uses **real** `loadSignals` → `computeMetrics` → `computeLeadershipState` → `mergeLeadershipReflectionLayer` → UI.  
> This doc is the **verification** guide and the **exact storage keys** (not `bty_signals` / generic mocks).

## 1. Source of truth (code)

| Step | Module | Function / key |
|------|--------|----------------|
| Load Arena signals | `features/arena/logic/signalStorage.ts` | `loadSignals()`, `ARENA_SIGNALS_STORAGE_KEY` = **`bty-signals`** |
| Load reflections | `features/growth/logic/reflectionStorage.ts` | `loadReflections()`, **`bty-reflections`** (legacy migrate: `bty-reflection-entries`) |
| Metrics | `features/arena/logic/computeMetrics.ts` | `computeMetrics(signals)` — domain metrics, not the illustrative `type: "relational"` stub in chat examples |
| Leadership copy | `features/my-page/logic/computeLeadershipState.ts` | `computeLeadershipState(metrics, locale, reflections)` |
| Reflection merge | `features/my-page/logic/mergeLeadershipReflection.ts` | `mergeLeadershipReflectionLayer(..., reflections)` |
| UI | `components/bty/my-page/MyPageLeadershipConsole.tsx` | Wires all of the above into `PremiumMyPageIdentityScreen` |

Arena writes signals via **`pushSignal` / `pushSignalIfNew`** (see `bty-arena/result`).  
Reflections write via **`pushReflection`** after writing screen save.

## 2. DevTools checks

```js
JSON.parse(localStorage.getItem("bty-signals") || "[]");
JSON.parse(localStorage.getItem("bty-reflections") || "[]");
```

Expect:

- **`bty-signals`**: array of `ArenaSignal` (scenarioId, traits, meta, timestamp, …).
- **`bty-reflections`**: array of `ReflectionEntry` (focus, commitment, answers, …).

If these stay empty, My Page will show **dormant / default** interpreted copy — that is correct behavior.

## 3. End-to-end flow to validate

1. **Arena** — complete a play → **Result** persists signal (+ reflection seed).  
2. **Growth** — complete reflection writing → **`bty-reflections`** gains an entry.  
3. **My Page** — reopen overview: headline / depth / recovery layer should reflect accumulated data.

The console also **reloads storage on window focus** so returning from Arena/Growth without a full refresh picks up new data.

## 4. What we are *not* doing here

- Replacing `computeMetrics` with ad-hoc `signals.filter(s => s.type === "relational")` — that is **not** the BTY domain model.  
- Using keys `bty_signals` / `bty_reflections` — **wrong**; use **`bty-signals`** and **`bty-reflections`**.

## 5. Next split (Phase 7 options)

| Track | Meaning |
|-------|---------|
| **A. Supabase (or API)** | Persist signals/reflections per user; localStorage becomes cache or guest-only. |
| **B. Scenario engine** | Richer `scenario JSON` and generation — content scale. |

Recommendation for production: **A** when you need multi-device and authenticated history.

---

*See also: `BTY_MASTER_BUILD_V1.md`, `BTY_IMPLEMENTATION_CHECKLIST_V1.md`.*
