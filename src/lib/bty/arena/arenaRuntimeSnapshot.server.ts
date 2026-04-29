import type { Scenario } from "@/lib/bty/scenario/types";
import type { BlockingArenaContractRow } from "@/lib/bty/arena/blockingArenaActionContract";
import {
  ARENA_SESSION_MODE,
  type ArenaRuntimeStateId,
  type ArenaSessionActionContractSnapshot,
  type ArenaSessionGates,
  type ArenaSessionRouterSnapshot,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

export function statePriorityForRuntime(id: ArenaRuntimeStateId): number {
  switch (id) {
    case "ACTION_AWAITING_VERIFICATION":
      return 100;
    case "ACTION_SUBMITTED":
      return 95;
    case "ACTION_REQUIRED":
      return 90;
    case "FORCED_RESET_PENDING":
      return 60;
    case "REEXPOSURE_DUE":
      return 55;
    case "NEXT_SCENARIO_READY":
      return 20;
    case "TRADEOFF_ACTIVE":
      return 14;
    case "ACTION_DECISION_ACTIVE":
      return 12;
    case "ARENA_SCENARIO_READY":
      return 10;
    default:
      return 0;
  }
}

export function runtimeStateFromBlockingContract(row: BlockingArenaContractRow): ArenaRuntimeStateId {
  const st = String(row.status ?? "").toLowerCase();
  if (st === "approved") return "ACTION_AWAITING_VERIFICATION";
  if (st === "submitted" || st === "escalated") return "ACTION_SUBMITTED";
  return "ACTION_REQUIRED";
}

export function gatesForBlockedContract(): ArenaSessionGates {
  return { next_allowed: false, choice_allowed: false, qr_allowed: true };
}

export function gatesForScenarioReady(): ArenaSessionGates {
  return { next_allowed: true, choice_allowed: true, qr_allowed: false };
}

/** Post-scenario: next session fetch allowed; in-scenario choices not until a new ARENA_SCENARIO_READY. */
export function gatesForNextScenarioReady(): ArenaSessionGates {
  return { next_allowed: true, choice_allowed: false, qr_allowed: false };
}

export function actionContractSnapshotFromBlocking(row: BlockingArenaContractRow): ArenaSessionActionContractSnapshot {
  return {
    exists: true,
    id: row.id,
    status: row.status,
    verification_type: row.verification_mode,
    deadline_at: row.deadline_at,
  };
}

export function emptyActionContractSnapshot(): ArenaSessionActionContractSnapshot {
  return {
    exists: false,
    id: null,
    status: null,
    verification_type: null,
    deadline_at: null,
  };
}

export function scenarioWithJsonSource(scenario: Scenario): Scenario & { source: "json" } {
  return { ...scenario, source: "json" };
}

export function snapshotForBlockedContract(row: BlockingArenaContractRow): ArenaSessionRouterSnapshot {
  const rs = runtimeStateFromBlockingContract(row);
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: statePriorityForRuntime(rs),
    gates: gatesForBlockedContract(),
    action_contract: actionContractSnapshotFromBlocking(row),
  };
}

export function gatesForReexposureDue(): ArenaSessionGates {
  return { next_allowed: false, choice_allowed: false, qr_allowed: false };
}

export function gatesForForcedResetPending(): ArenaSessionGates {
  return { next_allowed: false, choice_allowed: false, qr_allowed: false };
}

export function snapshotForScenarioReady(): ArenaSessionRouterSnapshot {
  const rs: ArenaRuntimeStateId = "ARENA_SCENARIO_READY";
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: statePriorityForRuntime(rs),
    gates: gatesForScenarioReady(),
    action_contract: emptyActionContractSnapshot(),
  };
}

/** Gates: in-run forced tradeoff (second tier) — not Action Decision / not contract. */
export function gatesForTradeoffActive(): ArenaSessionGates {
  return { next_allowed: false, choice_allowed: true, qr_allowed: false };
}

export function snapshotForTradeoffActive(): ArenaSessionRouterSnapshot {
  const rs: ArenaRuntimeStateId = "TRADEOFF_ACTIVE";
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: statePriorityForRuntime(rs),
    gates: gatesForTradeoffActive(),
    action_contract: emptyActionContractSnapshot(),
  };
}

/** Gates: in-run Action Decision surface (third meaningful choice) — not contract / not next scenario. */
export function gatesForActionDecisionActive(): ArenaSessionGates {
  return { next_allowed: false, choice_allowed: true, qr_allowed: false };
}

export function snapshotForActionDecisionActive(): ArenaSessionRouterSnapshot {
  const rs: ArenaRuntimeStateId = "ACTION_DECISION_ACTIVE";
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: statePriorityForRuntime(rs),
    gates: gatesForActionDecisionActive(),
    action_contract: emptyActionContractSnapshot(),
  };
}

/** GET session: delayed outcomes queue non-empty — re-exposure / recall surface takes precedence over play. */
export function snapshotForReexposureDue(): ArenaSessionRouterSnapshot {
  const rs: ArenaRuntimeStateId = "REEXPOSURE_DUE";
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: statePriorityForRuntime(rs),
    gates: gatesForReexposureDue(),
    action_contract: emptyActionContractSnapshot(),
  };
}

/** GET session: LE stage 4 with forced reset triggered — Center completion required before Arena play. */
export function snapshotForForcedResetPending(): ArenaSessionRouterSnapshot {
  const rs: ArenaRuntimeStateId = "FORCED_RESET_PENDING";
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: statePriorityForRuntime(rs),
    gates: gatesForForcedResetPending(),
    action_contract: emptyActionContractSnapshot(),
  };
}

export function snapshotForNextScenarioReady(): ArenaSessionRouterSnapshot {
  const rs: ArenaRuntimeStateId = "NEXT_SCENARIO_READY";
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: statePriorityForRuntime(rs),
    gates: gatesForNextScenarioReady(),
    action_contract: emptyActionContractSnapshot(),
  };
}

/** Spread into JSON bodies (POST run/complete, etc.) alongside existing fields. */
export function arenaRouterSnapshotJsonFields(
  snap: ArenaSessionRouterSnapshot,
): Record<string, unknown> {
  return {
    mode: snap.mode,
    runtime_state: snap.runtime_state,
    state_priority: snap.state_priority,
    gates: snap.gates,
    action_contract: snap.action_contract,
  };
}
