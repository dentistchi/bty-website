/**
 * Re-exports legacy bundled TS scenarios for **catalog sync, tests, and non-Arena tooling only**.
 *
 * **Do not** use for Arena runtime (session/next, selector, mirror copy, client play).
 * Runtime Arena content lives in `bty_elite_scenarios.json` via {@link loadArenaScenarioPayloadFromDb}.
 *
 * Escalation / mission schema (steps 3–4): see domain {@link ArenaScenario} — reference data:
 * {@link patientComplaintScenario} in `@/domain/arena/scenarios/mockScenario`.
 */
export type {
  ArenaDifficultyLevel,
  EscalationBranch,
  SecondChoice,
} from "@/domain/arena/scenarios/types";
export { DIFFICULTY_ESCALATION_INTENSITY } from "@/domain/arena/scenarios/difficultyEscalationIntensity";
export * from "./legacy/bundledScenarios";
