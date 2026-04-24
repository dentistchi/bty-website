import type { ArenaBindingRuntimeSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

export type ArenaUiStep =
  | "initial"
  | "primary_choice"
  | "escalation"
  | "second_choice"
  | "blocked"
  | "complete";

export type ArenaBindingState = {
  snapshot: ArenaBindingRuntimeSnapshot | null;
  currentScenario: import("@/lib/bty/scenario/types").Scenario | null;
  uiStep: ArenaUiStep;
  bindingError: string | null;
  submitting: boolean;
};

export type ArenaBindingAction =
  | { type: "LOAD_SCENARIO"; scenario: import("@/lib/bty/scenario/types").Scenario }
  | { type: "BINDING_ERROR"; reason: string }
  | { type: "CHOICE_SUBMIT_START" }
  | { type: "APPLY_SNAPSHOT"; snapshot: ArenaBindingRuntimeSnapshot }
  | { type: "LOCAL_ESCALATION" }
  | { type: "RESET" };

export function arenaBindingReducer(state: ArenaBindingState, action: ArenaBindingAction): ArenaBindingState {
  switch (action.type) {
    case "LOAD_SCENARIO":
      return {
        ...state,
        currentScenario: action.scenario,
        uiStep: "primary_choice",
        bindingError: null,
      };

    case "BINDING_ERROR":
      return {
        ...state,
        bindingError: action.reason,
        uiStep: "blocked",
        submitting: false,
      };

    case "CHOICE_SUBMIT_START":
      return {
        ...state,
        submitting: true,
      };

    case "APPLY_SNAPSHOT": {
      const snapshot = action.snapshot;

      if (!snapshot.gates.choice_allowed) {
        return {
          ...state,
          snapshot,
          submitting: false,
          uiStep: "blocked",
        };
      }

      return {
        ...state,
        snapshot,
        submitting: false,
        uiStep: state.uiStep === "initial" ? "primary_choice" : state.uiStep,
      };
    }

    case "LOCAL_ESCALATION":
      return {
        ...state,
        uiStep: "second_choice",
      };

    case "RESET":
      return {
        snapshot: null,
        currentScenario: null,
        uiStep: "initial",
        bindingError: null,
        submitting: false,
      };

    default:
      return state;
  }
}
