import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchBlockingArenaContractForSession,
  fetchBlockingContractRowByContractId,
} from "@/lib/bty/arena/blockingArenaActionContract";
import {
  snapshotForActionDecisionActive,
  snapshotForBlockedContract,
  snapshotForNextScenarioReady,
  snapshotForScenarioReady,
  snapshotForTradeoffActive,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.server";
import type { ArenaBindingRuntimeSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

export type BindingSnapshotPhase = "primary" | "tradeoff" | "action_decision";

export type BuildArenaBindingSnapshotParams = {
  runId: string;
  jsonScenarioId: string;
  dbScenarioId: string;
  jsonChoiceId: string;
  dbChoiceId: string;
  scenarioTitle: string | null;
  bindingPhase: BindingSnapshotPhase;
  /**
   * Tradeoff only: when true, emit `ACTION_DECISION_ACTIVE` (defer contract until action_decision).
   * When false (legacy branch shape), restore pre–action-decision contract semantics after tradeoff.
   */
  tradeoffLeadsToActionDecision?: boolean;
  /**
   * `action_decision` only: `avoidance_wrap_up` → `NEXT_SCENARIO_READY` (no contract); otherwise expect blocking contract snapshot after commitment ensure.
   */
  actionDecisionOutcome?: "commitment_contract" | "avoidance_wrap_up";
  /** When `action_decision` + commitment: resolves ACTION_REQUIRED if session-wide fetch misses the new row. */
  commitmentContractId?: string | null;
};

/** Re-exposure slice is populated from GET `/api/arena/n/session` + delayed-outcome queue — not from binding POST. */
const bindingExtras = {
  trigger: null as null,
  pattern: null as null,
  re_exposure: { due: false as const, scenario_id: null as null },
};

/**
 * After recording a binding choice, compose the canonical runtime snapshot for the client.
 * **Contract rule:** `ACTION_REQUIRED` is emitted only after `action_decision` (not after primary or tradeoff when the third stage exists).
 */
export async function buildArenaBindingSnapshotResponse(
  supabase: SupabaseClient,
  userId: string,
  params: BuildArenaBindingSnapshotParams,
): Promise<ArenaBindingRuntimeSnapshot> {
  const scenarioSlice = {
    source: "json" as const,
    json_scenario_id: params.jsonScenarioId,
    db_scenario_id: params.dbScenarioId,
    title: params.scenarioTitle,
  };

  if (params.bindingPhase === "primary") {
    const tradeoffSnap = snapshotForTradeoffActive();
    return {
      ...tradeoffSnap,
      run_id: params.runId,
      scenario: scenarioSlice,
      ...bindingExtras,
    };
  }

  if (params.bindingPhase === "tradeoff") {
    if (params.tradeoffLeadsToActionDecision) {
      const snap = snapshotForActionDecisionActive();
      return {
        ...snap,
        run_id: params.runId,
        scenario: scenarioSlice,
        ...bindingExtras,
      };
    }
    const blocking = await fetchBlockingArenaContractForSession(supabase, userId);
    if (blocking) {
      const snap = snapshotForBlockedContract(blocking);
      return {
        ...snap,
        run_id: params.runId,
        scenario: scenarioSlice,
      };
    }
    const ready = snapshotForScenarioReady();
    return {
      ...ready,
      run_id: params.runId,
      scenario: scenarioSlice,
      ...bindingExtras,
    };
  }

  if (params.bindingPhase === "action_decision") {
    if (params.actionDecisionOutcome === "avoidance_wrap_up") {
      const next = snapshotForNextScenarioReady();
      return {
        ...next,
        run_id: params.runId,
        scenario: scenarioSlice,
        ...bindingExtras,
      };
    }
    let blocking = await fetchBlockingArenaContractForSession(supabase, userId);
    if (!blocking && params.commitmentContractId) {
      blocking = await fetchBlockingContractRowByContractId(
        supabase,
        userId,
        params.commitmentContractId,
      );
    }
    if (blocking) {
      const snap = snapshotForBlockedContract(blocking);
      return {
        ...snap,
        run_id: params.runId,
        scenario: scenarioSlice,
      };
    }
    console.error("[arena] binding_snapshot_commitment_without_contract_row", {
      runId: params.runId,
      commitmentContractId: params.commitmentContractId ?? null,
    });
    const fallbackNext = snapshotForNextScenarioReady();
    return {
      ...fallbackNext,
      run_id: params.runId,
      scenario: scenarioSlice,
      ...bindingExtras,
    };
  }

  throw new Error("arena_binding_snapshot_unreachable");
}
