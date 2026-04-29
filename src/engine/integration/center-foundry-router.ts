/**
 * Center healing phase → Foundry / Elite routing.
 *
 * On healing phase change: assign Foundry program tracks or unlock Elite 3rd mentor request flow.
 * Wire **`advancePhase` → `output.phase`** into {@link routeHealingToFoundry} (see {@link AdvancePhaseOutput}).
 *
 * Single entry: {@link routeHealingToFoundry}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshFoundryProgramRecommendations } from "@/engine/foundry/program-recommender.service";
import {
  FOUNDRY_PROGRAM_ASSIGN_EVENT,
  type FoundryProgramAssignPayload,
} from "@/engine/foundry/foundry-program-assign.types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export { FOUNDRY_PROGRAM_ASSIGN_EVENT, type FoundryProgramAssignPayload };

export const HEALING_FOUNDRY_PHASES = ["REFLECTION", "REINTEGRATION", "RENEWAL"] as const;

/** Phases emitted by healing `advancePhase` that this router understands. */
export type HealingFoundryPhase = (typeof HEALING_FOUNDRY_PHASES)[number];

/** Pass-through shape from `advancePhase` — callers forward `phase` to {@link routeHealingToFoundry}. */
export type AdvancePhaseOutput = {
  phase: HealingFoundryPhase;
};

/** Unlocks mentor request flow per `docs/ELITE_3RD_SPEC_AND_CHECKLIST.md` (renewal path). */
export const ELITE_3RD_MENTOR_REQUEST_FLOW_UNLOCK_EVENT = "elite_3rd_mentor_request_flow_unlock" as const;

export type EliteThirdMentorRequestFlowUnlockPayload = {
  type: typeof ELITE_3RD_MENTOR_REQUEST_FLOW_UNLOCK_EVENT;
  userId: string;
  /** Spec anchor for handlers (Elite 3rd checklist). */
  spec: "elite_3rd";
  source: "healing_renewal";
  occurredAt: string;
};

export type RouteHealingToFoundryDeps = {
  /** DB client for Foundry recommendation refresh; prefer route `getSupabaseServerClient()` or `getSupabaseAdmin()` in tests/smoke. */
  supabase?: SupabaseClient;
  emitProgramAssign?: (e: FoundryProgramAssignPayload) => void | Promise<void>;
  emitEliteMentorFlowUnlock?: (e: EliteThirdMentorRequestFlowUnlockPayload) => void | Promise<void>;
};

export type RouteHealingToFoundryResult = {
  branch: "reflection" | "reintegration" | "renewal" | "unknown";
  programAssign: FoundryProgramAssignPayload | null;
  mentorFlowUnlock: EliteThirdMentorRequestFlowUnlockPayload | null;
};

function isHealingFoundryPhase(v: string): v is HealingFoundryPhase {
  return (HEALING_FOUNDRY_PHASES as readonly string[]).includes(v);
}

/**
 * Healing phase change handler: Foundry program assign or Elite 3rd mentor flow unlock.
 *
 * @param phase — typically `advancePhase(...).phase` when `AdvancePhaseOutput` is used.
 */
export async function routeHealingToFoundry(
  userId: string,
  phase: HealingFoundryPhase | string,
  deps: RouteHealingToFoundryDeps = {},
): Promise<RouteHealingToFoundryResult> {
  const occurredAt = new Date().toISOString();

  if (!isHealingFoundryPhase(phase)) {
    return { branch: "unknown", programAssign: null, mentorFlowUnlock: null };
  }

  const db = deps.supabase ?? getSupabaseAdmin();

  if (phase === "REFLECTION") {
    const programAssign: FoundryProgramAssignPayload = {
      type: FOUNDRY_PROGRAM_ASSIGN_EVENT,
      userId,
      track: "self-awareness",
      occurredAt,
    };
    await deps.emitProgramAssign?.(programAssign);
    await refreshFoundryProgramRecommendations(userId, db ?? undefined).catch((err) =>
      console.warn("[routeHealingToFoundry] refreshFoundryProgramRecommendations", err),
    );
    return { branch: "reflection", programAssign, mentorFlowUnlock: null };
  }

  if (phase === "REINTEGRATION") {
    const programAssign: FoundryProgramAssignPayload = {
      type: FOUNDRY_PROGRAM_ASSIGN_EVENT,
      userId,
      track: "team-dynamics",
      occurredAt,
    };
    await deps.emitProgramAssign?.(programAssign);
    await refreshFoundryProgramRecommendations(userId, db ?? undefined).catch((err) =>
      console.warn("[routeHealingToFoundry] refreshFoundryProgramRecommendations", err),
    );
    return { branch: "reintegration", programAssign, mentorFlowUnlock: null };
  }

  const mentorFlowUnlock: EliteThirdMentorRequestFlowUnlockPayload = {
    type: ELITE_3RD_MENTOR_REQUEST_FLOW_UNLOCK_EVENT,
    userId,
    spec: "elite_3rd",
    source: "healing_renewal",
    occurredAt,
  };
  await deps.emitEliteMentorFlowUnlock?.(mentorFlowUnlock);
  return { branch: "renewal", programAssign: null, mentorFlowUnlock };
}

/**
 * Convenience: same as `routeHealingToFoundry(userId, advance.phase, deps)`.
 */
export function routeHealingToFoundryFromAdvancePhase(
  userId: string,
  advance: AdvancePhaseOutput,
  deps?: RouteHealingToFoundryDeps,
): Promise<RouteHealingToFoundryResult> {
  return routeHealingToFoundry(userId, advance.phase, deps);
}
