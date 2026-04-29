import { describe, expect, it } from "vitest";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { deriveReexposureValidateLocalAssist } from "./useArenaSession";

function baseSnapshot(
  runtime_state: ArenaSessionRouterSnapshot["runtime_state"],
): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state,
    state_priority: 55,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
    re_exposure: { due: true, scenario_id: "core_01_training_system" },
  };
}

describe("useArenaSession re-exposure validate local assist", () => {
  it("does not override active server REEXPOSURE_DUE shell with NEXT_SCENARIO_READY assist", () => {
    const result = deriveReexposureValidateLocalAssist({
      arenaServerSnapshot: baseSnapshot("REEXPOSURE_DUE"),
      nextRuntimeState: "NEXT_SCENARIO_READY",
      currentScenarioId: "core_01_training_system",
      clearCandidate: false,
    });
    expect(result.localAssistSnapshot).toBeNull();
    expect(result.clearLocalDueCandidate).toBe(false);
  });

  it("keeps shell priority even when clear candidate is true", () => {
    const result = deriveReexposureValidateLocalAssist({
      arenaServerSnapshot: baseSnapshot("REEXPOSURE_DUE"),
      nextRuntimeState: "NEXT_SCENARIO_READY",
      currentScenarioId: "core_01_training_system",
      clearCandidate: true,
    });
    expect(result.localAssistSnapshot).toBeNull();
    expect(result.clearLocalDueCandidate).toBe(true);
  });

  it("builds NEXT_SCENARIO_READY assist only when server shell is not active", () => {
    const result = deriveReexposureValidateLocalAssist({
      arenaServerSnapshot: null,
      nextRuntimeState: "NEXT_SCENARIO_READY",
      currentScenarioId: "core_01_training_system",
      clearCandidate: false,
    });
    expect(result.localAssistSnapshot?.runtime_state).toBe("NEXT_SCENARIO_READY");
    expect(result.localAssistSnapshot?.re_exposure?.due).toBe(false);
  });
});
