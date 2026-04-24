/**
 * Phase 1 — **runtime scenario body authority** vs persistence (readiness note only).
 *
 * **Current (Phase 1):**
 * - Canonical Elite / scenario **content** for the Arena session router is loaded from the **JSON dataset**
 *   (e.g. `bty_elite_scenarios_v2.json` and related loaders) through the engine / `getNextScenarioForSession` path.
 * - DB tables (`arena_runs`, etc.) store **run metadata**, outcomes, XP events — not the authoritative copy of the
 *   full scenario JSON blob for every served scenario at runtime.
 *
 * **Future — JSON authoring → DB “published runtime”:**
 * - Likely touch points (non-exhaustive):
 *   - `src/engine/integration/scenario-type-router.ts` — selection / route to scenario payload.
 *   - `src/engine/scenario/scenario-selector.service.ts` / `scenario-loader.service.ts` — catalog source.
 *   - `src/lib/bty/arena/scenarioPayloadFromDb.ts` — already named for DB-backed payload assembly when introduced.
 *   - `src/lib/bty/arena/arenaScenarioResolve.server.ts` — server resolution of scenario for runs.
 *   - `src/lib/bty/arena/eliteScenariosCanonical.server.ts` — canonical elite projection.
 *   - `getNextScenarioForSession` callers in `arenaSessionNextCore.ts`.
 * - Snapshot **runtime_state** / contract / forced-reset semantics stay in session-router; only **where the scenario
 *   JSON comes from** would migrate — keep GET `/api/arena/n/session` as authority for *gates*, not for JSON storage.
 *
 * Do not implement DB publish here; this file documents the boundary for the single-state runtime work.
 */

export {};
