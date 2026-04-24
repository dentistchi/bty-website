# BTY Arena — Elite V2 Runtime Finalization

Handoff note: canonical data, resume rules, UI surface, Action Contract boundary, and architectural principle.

---

## 1. Canonical source lock

- **Runtime scenario payload** is built **exclusively** from the chain workspace via **`buildEliteScenarioFromChainWorkspace`** (`src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts`), surfaced through **`getEliteScenarioById` / `loadEliteDataset`** in `eliteScenariosCanonical.server.ts`.
- **`bty_elite_scenarios_v2.json`** is a **build/sync artifact only** (`npm run sync:elite-from-chain` / `scripts/sync-elite-from-chain-workspace.ts`). It is **not** read as a runtime narrative source.
- **Only `ELITE_CHAIN_SCENARIO_IDS`** (`postLoginEliteEntry.ts`) are valid Arena Elite runtime scenario ids — three chain ids, no hybrid catalog merge.

---

## 2. Stale run protection

- **Resume is allowed only** for valid Elite runs: **`status === IN_PROGRESS`** and **`elite_runtime_compat`** present when escalation payload exists in `arena_runs.meta` (see `eliteRunResumeCompat.ts`, `useArenaSession.ts` → `validateRunForResume`).
- **Step 3 / step 4 server behavior:** `POST /api/arena/run/step` applies escalation from **`getArenaScenarioForRunStep` → canonical scenario**, not from trusting stale `run.meta` alone; `meta` is updated for persistence/audit, not as the source of truth for branch text.
- **Principle:** step payloads (3/4) are **derived from canonical scenario data**; `run.meta` must not override canonical escalation/second-choice definitions for **display logic** (client should consume scenario from session/router + API, not replay raw meta as the scenario).

---

## 3. Elite-only UI flow

Arena UI under `/[locale]/bty-arena` follows this model:

| Step | Content |
|------|--------|
| **2** | Context (**title, role, pressure, tradeoff**) + **primary choices** — `EliteArenaStep2Context` + `ChoiceList` `variant="elite"` (`BtyArenaRunPageClient.tsx`). |
| **3** | **`escalation_text` only** (from canonical branch for the chosen primary id). |
| **4** | **`second_choices` only**. |
| **5** | **Minimal completion** (no legacy mirror/contract/gate stack on this surface). |

- **Legacy post-choice stack removed** from Arena: Pattern Mirror, Action Contract step, Execution Gate as **separate product surfaces** are not mounted on this page.
- **Current implementation:** **`EliteArenaPostChoiceBlock`** (`src/components/bty-arena/EliteArenaPostChoiceBlock.tsx`) drives post–step-2 Elite flow in the Arena shell.

---

## 4. Action Contract rule

**Arena must not render any Action Contract UI.**

This includes:

- follow-up modals tied to contract completion  
- contract editors or draft surfaces  
- gate / execution / verification flows for action contracts  

**Action Contract UX** belongs **outside Arena** (e.g. My Page, Center-adjacent flows). Server routes under `/api/bty/action-contract/*` or `/api/action-contracts` may exist for other clients; they **must not** be wired into `/bty-arena` UI.

---

## 5. System principle

The system enforces a **single source of truth** and **prohibits** fallback, merge, or hybrid runtime paths for Elite Arena:

- No bundled-JSON runtime path alongside chain workspace.  
- No “legacy Elite + canonical Elite” merged scenario payload for the same run.  
- No Action Contract UI embedded in Arena to satisfy parallel product requirements.

---

## Implementation pointers (for developers)

| Area | Primary files |
|------|----------------|
| Chain → Elite projection | `chainWorkspaceToEliteScenario.server.ts`, `eliteScenariosCanonical.server.ts` |
| Session + run | `useArenaSession.ts`, `arenaScenarioForRunStep.ts`, `scenarioPayloadFromDb.ts` |
| Resume compat | `eliteRunResumeCompat.ts`, `validateRunForResume` in `useArenaSession.ts` |
| Arena page shell | `BtyArenaRunPageClient.tsx`, `EliteArenaPostChoiceBlock.tsx`, `EliteArenaStep2Context.tsx` |
| Allowed ids | `ELITE_CHAIN_SCENARIO_IDS` in `postLoginEliteEntry.ts` |

---

*Repo root `docs/` remains the single source for cross-app planning; this file is **bty-app** runtime/engineering detail.*
