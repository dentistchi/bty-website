/**
 * Arena session end → Foundry bridge.
 *
 * Uses {@link computeAirDelta} from `integrity-slip.monitor` (same Δ as slip / AIR write path).
 * - AIR **improved** (Δ > 0): emit `foundry_unlock` for the learning program keyed by `scenarioType`.
 * - AIR **declined** (Δ < 0): queue `mirror_scenario_pool` via {@link queueMirrorScenarioPoolEntry}.
 *
 * Single entry: {@link processSessionOutcome}.
 */

import { computeAirDelta } from "@/engine/integrity/integrity-slip.monitor";
import { queueMirrorScenarioPoolEntry } from "@/engine/foundry/mirror-scenario.service";

export const FOUNDRY_UNLOCK_EVENT = "foundry_unlock" as const;

export type FoundryUnlockPayload = {
  type: typeof FOUNDRY_UNLOCK_EVENT;
  userId: string;
  scenarioType: string;
  /** Learning program key derived from scenario type (stable slug). */
  learningProgramId: string;
  airDelta: number;
  occurredAt: string;
};

/** Payload passed from Arena completion (AIR on [0, 1] scale). */
export type ArenaSessionResult = {
  scenarioType: string;
  previousAir: number;
  newAir: number;
  occurredAt?: Date;
};

export type ProcessSessionOutcomeDeps = {
  /** When set, receives `foundry_unlock` for bus / analytics / Foundry unlock handler. */
  emitFoundryUnlock?: (e: FoundryUnlockPayload) => void | Promise<void>;
};

/**
 * Map Arena `scenarioId` / scenario type string → learning program id for unlock routing.
 * Extend when real program catalog exists.
 */
export function learningProgramIdForScenarioType(scenarioType: string): string {
  const s = scenarioType.trim();
  if (s === "") return "learning_program_default";
  const slug = s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `lp_${slug || "default"}`;
}

/**
 * Arena session end: read final AIR Δ from integrity-slip monitor formula, then branch.
 */
export async function processSessionOutcome(
  userId: string,
  sessionResult: ArenaSessionResult,
  deps: ProcessSessionOutcomeDeps = {},
): Promise<{
  airDelta: number;
  branch: "improved" | "declined" | "neutral";
  foundryUnlock: FoundryUnlockPayload | null;
  mirrorQueued: boolean;
}> {
  const { scenarioType, previousAir, newAir, occurredAt } = sessionResult;
  const airDelta = computeAirDelta(previousAir, newAir);
  const at = (occurredAt ?? new Date()).toISOString();

  if (airDelta > 0) {
    const learningProgramId = learningProgramIdForScenarioType(scenarioType);
    const payload: FoundryUnlockPayload = {
      type: FOUNDRY_UNLOCK_EVENT,
      userId,
      scenarioType: scenarioType.trim(),
      learningProgramId,
      airDelta,
      occurredAt: at,
    };
    await deps.emitFoundryUnlock?.(payload);
    return {
      airDelta,
      branch: "improved",
      foundryUnlock: payload,
      mirrorQueued: false,
    };
  }

  if (airDelta < 0) {
    await queueMirrorScenarioPoolEntry({
      userId,
      scenarioType: scenarioType.trim(),
      airDelta,
      source: "arena_session_end",
    });
    return {
      airDelta,
      branch: "declined",
      foundryUnlock: null,
      mirrorQueued: true,
    };
  }

  return {
    airDelta,
    branch: "neutral",
    foundryUnlock: null,
    mirrorQueued: false,
  };
}
