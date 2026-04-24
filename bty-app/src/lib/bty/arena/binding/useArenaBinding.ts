"use client";

import * as React from "react";
import { validateScenarioBinding } from "@/domain/arena/binding/validateScenarioBinding";
import { collectDbChoiceIdsFromScenario } from "@/lib/bty/arena/binding/collectDbChoiceIdsFromScenario";
import { arenaBindingReducer } from "@/lib/bty/arena/binding/arenaBindingReducer";
import { postArenaChoice } from "@/lib/bty/arena/binding/postArenaChoice";
import type { Scenario } from "@/lib/bty/scenario/types";

const initial: import("@/lib/bty/arena/binding/arenaBindingReducer").ArenaBindingState = {
  snapshot: null,
  currentScenario: null,
  uiStep: "initial",
  bindingError: null,
  submitting: false,
};

/**
 * Snapshot-authoritative binding hook — JSON narrative + DB-mapped choices.
 * Load-time validation uses elite catalog ids when `dbScenarioId` is a chain scenario id.
 */
export function useArenaBinding(initialScenario: Scenario | null) {
  const [state, dispatch] = React.useReducer(arenaBindingReducer, initial);

  React.useEffect(() => {
    if (!initialScenario) return;

    const allowedDbChoiceIds = collectDbChoiceIdsFromScenario(initialScenario);

    const validation = validateScenarioBinding(
      {
        dbScenarioId: initialScenario.dbScenarioId,
        choices: initialScenario.choices.map((c) => ({
          choiceId: c.choiceId,
          dbChoiceId: c.dbChoiceId,
        })),
      },
      allowedDbChoiceIds,
    );

    if (!validation.ok) {
      dispatch({ type: "BINDING_ERROR", reason: validation.reason });
      return;
    }

    dispatch({ type: "LOAD_SCENARIO", scenario: initialScenario });
  }, [initialScenario]);

  const applySnapshot = React.useCallback((snapshot: import("@/lib/bty/arena/arenaRuntimeSnapshot.types").ArenaBindingRuntimeSnapshot) => {
    dispatch({ type: "APPLY_SNAPSHOT", snapshot });
  }, []);

  const submitPrimaryChoice = React.useCallback(
    async (runId: string, choiceId: string) => {
      const scenario = state.currentScenario;
      if (!scenario?.dbScenarioId) {
        dispatch({ type: "BINDING_ERROR", reason: "missing_dbScenarioId" });
        return;
      }

      const choice = scenario.choices.find((c) => c.choiceId === choiceId);
      if (!choice?.dbChoiceId) {
        dispatch({ type: "BINDING_ERROR", reason: "unknown_json_choice" });
        return;
      }

      dispatch({ type: "CHOICE_SUBMIT_START" });

      try {
        const snapshot = await postArenaChoice({
          run_id: runId,
          json_scenario_id: scenario.scenarioId,
          db_scenario_id: scenario.dbScenarioId,
          json_choice_id: choice.choiceId,
          db_choice_id: choice.dbChoiceId,
        });

        applySnapshot(snapshot);

        if (snapshot.runtime_state === "ARENA_SCENARIO_READY" && snapshot.gates.choice_allowed) {
          dispatch({ type: "LOCAL_ESCALATION" });
        }
      } catch (e) {
        dispatch({
          type: "BINDING_ERROR",
          reason: e instanceof Error ? e.message : "arena_choice_failed",
        });
      }
    },
    [state.currentScenario, applySnapshot],
  );

  return {
    state,
    submitPrimaryChoice,
    applySnapshot,
  };
}
