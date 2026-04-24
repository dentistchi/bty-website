import type { ArenaRuntimeStateId } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

/**
 * Product routing targets for Arena-adjacent navigation — derived only from server snapshot authority.
 * @see runArenaSessionNextCore — canonical GET snapshot gateway.
 */
export type ArenaRuntimeDestination =
  | "arena_play"
  | "arena_contract_gate"
  | "arena_reexposure"
  | "center_forced_reset";

export function arenaRuntimeDestinationFromRuntimeState(
  runtimeState: ArenaRuntimeStateId | null | undefined,
): ArenaRuntimeDestination {
  if (runtimeState == null) return "arena_play";
  switch (runtimeState) {
    case "ACTION_REQUIRED":
    case "ACTION_SUBMITTED":
    case "ACTION_AWAITING_VERIFICATION":
      return "arena_contract_gate";
    case "FORCED_RESET_PENDING":
      return "center_forced_reset";
    case "REEXPOSURE_DUE":
      return "arena_reexposure";
    case "NEXT_SCENARIO_READY":
    case "ARENA_SCENARIO_READY":
    case "TRADEOFF_ACTIVE":
    case "ACTION_DECISION_ACTIVE":
    default:
      return "arena_play";
  }
}

export function arenaRuntimeDestinationFromSnapshot(
  snapshot: ArenaSessionRouterSnapshot | null | undefined,
): ArenaRuntimeDestination {
  return arenaRuntimeDestinationFromRuntimeState(snapshot?.runtime_state);
}

/**
 * Product hrefs from session-router snapshot (see `runArenaSessionNextCore`).
 * - Action-contract runtime states → My Page hub (not Center; Center is forced-reset / collapse only).
 * - Forced reset → Center.
 * - Re-exposure / default play → Arena shell.
 */
export function arenaEntryHrefForDestination(locale: string, dest: ArenaRuntimeDestination): string {
  const l = locale === "ko" || locale === "en" ? locale : "en";
  if (dest === "center_forced_reset") return `/${l}/center`;
  if (dest === "arena_contract_gate") return `/${l}/my-page?arena_contract=resolve`;
  return `/${l}/bty-arena`;
}
