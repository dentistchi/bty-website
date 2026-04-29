import { describe, expect, it, vi } from "vitest";
import { buildArenaBindingSnapshotResponse } from "./buildArenaBindingSnapshotResponse.server";

const fetchBlockingArenaContractForSession = vi.fn();
const fetchBlockingContractRowByContractId = vi.fn();

vi.mock("@/lib/bty/arena/blockingArenaActionContract", () => ({
  fetchBlockingArenaContractForSession: (...args: unknown[]) =>
    fetchBlockingArenaContractForSession(...args),
  fetchBlockingContractRowByContractId: (...args: unknown[]) =>
    fetchBlockingContractRowByContractId(...args),
}));

const supabaseStub = {} as never;

describe("buildArenaBindingSnapshotResponse — AD1 action contract loop", () => {
  it("AD1 commitment maps to ACTION_REQUIRED when blocking contract status is pending", async () => {
    fetchBlockingArenaContractForSession.mockResolvedValueOnce({
      id: "ac-1",
      contract_description: "Do the action",
      deadline_at: "2026-04-28T00:00:00.000Z",
      verification_mode: "hybrid",
      created_at: "2026-04-26T00:00:00.000Z",
      status: "pending",
    });
    const snap = await buildArenaBindingSnapshotResponse(supabaseStub, "u1", {
      runId: "run-1",
      jsonScenarioId: "core_01",
      dbScenarioId: "INCIDENT-01-OWN-01",
      jsonChoiceId: "AD1",
      dbChoiceId: "db-ad1",
      scenarioTitle: "Scenario",
      bindingPhase: "action_decision",
      actionDecisionOutcome: "commitment_contract",
      commitmentContractId: "ac-1",
    });
    expect(snap.runtime_state).toBe("ACTION_REQUIRED");
    expect(snap.gates.next_allowed).toBe(false);
    expect(snap.gates.choice_allowed).toBe(false);
    expect(snap.action_contract.exists).toBe(true);
  });

  it("submitted contract (by id) unlocks NEXT_SCENARIO_READY — no ACTION_SUBMITTED loop after QR", async () => {
    fetchBlockingArenaContractForSession.mockResolvedValueOnce(null);
    fetchBlockingContractRowByContractId.mockResolvedValueOnce({
      id: "ac-2",
      contract_description: "Submitted action",
      deadline_at: "2026-04-28T00:00:00.000Z",
      verification_mode: "hybrid",
      created_at: "2026-04-26T00:00:00.000Z",
      status: "submitted",
    });
    const snap = await buildArenaBindingSnapshotResponse(supabaseStub, "u1", {
      runId: "run-1",
      jsonScenarioId: "core_01",
      dbScenarioId: "INCIDENT-01-OWN-01",
      jsonChoiceId: "AD1",
      dbChoiceId: "db-ad1",
      scenarioTitle: "Scenario",
      bindingPhase: "action_decision",
      actionDecisionOutcome: "commitment_contract",
      commitmentContractId: "ac-2",
    });
    expect(snap.runtime_state).toBe("NEXT_SCENARIO_READY");
    expect(snap.gates.next_allowed).toBe(true);
    expect(snap.gates.choice_allowed).toBe(false);
    expect(snap.action_contract.exists).toBe(false);
  });

  it("approved+awaiting verification contract maps to ACTION_AWAITING_VERIFICATION", async () => {
    fetchBlockingArenaContractForSession.mockResolvedValueOnce({
      id: "ac-3",
      contract_description: "Awaiting verify action",
      deadline_at: "2026-04-28T00:00:00.000Z",
      verification_mode: "hybrid",
      created_at: "2026-04-26T00:00:00.000Z",
      status: "approved",
    });
    const snap = await buildArenaBindingSnapshotResponse(supabaseStub, "u1", {
      runId: "run-1",
      jsonScenarioId: "core_01",
      dbScenarioId: "INCIDENT-01-OWN-01",
      jsonChoiceId: "AD1",
      dbChoiceId: "db-ad1",
      scenarioTitle: "Scenario",
      bindingPhase: "action_decision",
      actionDecisionOutcome: "commitment_contract",
      commitmentContractId: "ac-3",
    });
    expect(snap.runtime_state).toBe("ACTION_AWAITING_VERIFICATION");
    expect(snap.gates.next_allowed).toBe(false);
    expect(snap.gates.choice_allowed).toBe(false);
    expect(snap.action_contract.status).toBe("approved");
  });

  it("AD2 avoidance path remains NEXT_SCENARIO_READY", async () => {
    fetchBlockingArenaContractForSession.mockResolvedValueOnce(null);
    const snap = await buildArenaBindingSnapshotResponse(supabaseStub, "u1", {
      runId: "run-1",
      jsonScenarioId: "core_01",
      dbScenarioId: "INCIDENT-01-OWN-01",
      jsonChoiceId: "AD2",
      dbChoiceId: "db-ad2",
      scenarioTitle: "Scenario",
      bindingPhase: "action_decision",
      actionDecisionOutcome: "avoidance_wrap_up",
    });
    expect(snap.runtime_state).toBe("NEXT_SCENARIO_READY");
    expect(snap.gates.next_allowed).toBe(true);
    expect(snap.gates.choice_allowed).toBe(false);
    expect(snap.action_contract.exists).toBe(false);
  });
});
