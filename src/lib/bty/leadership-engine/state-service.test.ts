import { describe, it, expect } from "vitest";
import {
  getLeadershipEngineState,
  applyStageTransition,
  triggerForcedResetToStage4,
  resetStateTransitionHandler,
  type LeadershipEngineStateClient,
} from "./state-service";

function mockClient(initialStage: number | null, forcedResetTriggeredAt?: string | null): LeadershipEngineStateClient {
  let stage = initialStage;
  let forcedAt = forcedResetTriggeredAt ?? null;
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data:
                      stage !== null
                        ? {
                            user_id: "u1",
                            current_stage: stage,
                            stage_entered_at: "",
                            updated_at: "",
                            forced_reset_triggered_at: forcedAt,
                          }
                        : null,
                    error: null,
                  }),
              };
            },
          };
        },
        upsert(row: { current_stage?: number; forced_reset_triggered_at?: string | null }) {
          if (typeof row.current_stage === "number") stage = row.current_stage;
          if (row.forced_reset_triggered_at !== undefined) forcedAt = row.forced_reset_triggered_at;
          return Promise.resolve({ error: null });
        },
      };
    },
  } as LeadershipEngineStateClient;
}

describe("getLeadershipEngineState", () => {
  it("returns default Stage 1 when no row", async () => {
    const client = mockClient(null);
    const out = await getLeadershipEngineState(client, "u1");
    expect(out.currentStage).toBe(1);
    expect(out.stageName).toContain("Over-Intervention");
    expect(out.forcedResetTriggeredAt).toBeNull();
    expect(out.resetDueAt).toBeNull();
  });

  it("returns stored stage when row exists", async () => {
    const client = mockClient(3);
    const out = await getLeadershipEngineState(client, "u1");
    expect(out.currentStage).toBe(3);
    expect(out.stageName).toContain("Leadership Withdrawal");
  });
});

describe("applyStageTransition", () => {
  it("applies 1 → 2 when context is repeat_1_without_delegation", async () => {
    const client = mockClient(1);
    const result = await applyStageTransition(client, "u1", "repeat_1_without_delegation");
    expect(result.applied).toBe(true);
    expect(result.previousStage).toBe(1);
    expect(result.currentStage).toBe(2);
  });

  it("applies 2 → 3 when context is repeat_2_without_corrective_activation", async () => {
    const client = mockClient(2);
    const result = await applyStageTransition(client, "u1", "repeat_2_without_corrective_activation");
    expect(result.applied).toBe(true);
    expect(result.currentStage).toBe(3);
  });

  it("applies 3 → 4 when context is air_below_threshold", async () => {
    const client = mockClient(3);
    const result = await applyStageTransition(client, "u1", "air_below_threshold");
    expect(result.applied).toBe(true);
    expect(result.currentStage).toBe(4);
  });

  it("applies 4 → 1 when context is stage_4_completion", async () => {
    const client = mockClient(4);
    const result = await applyStageTransition(client, "u1", "stage_4_completion");
    expect(result.applied).toBe(true);
    expect(result.currentStage).toBe(1);
  });

  it("returns applied: false when context does not match current stage", async () => {
    const client = mockClient(1);
    const result = await applyStageTransition(client, "u1", "air_below_threshold");
    expect(result.applied).toBe(false);
    expect(result.currentStage).toBe(1);
  });
});

describe("triggerForcedResetToStage4", () => {
  it("sets stage to 4 and forced_reset_triggered_at", async () => {
    const client = mockClient(3);
    const out = await triggerForcedResetToStage4(client, "u1");
    expect(out.ok).toBe(true);
    const state = await getLeadershipEngineState(client, "u1");
    expect(state.currentStage).toBe(4);
    expect(state.forcedResetTriggeredAt).not.toBeNull();
    expect(state.resetDueAt).not.toBeNull();
  });
});

describe("resetStateTransitionHandler", () => {
  it("triggers Stage 4 when two conditions met and current stage is 3", async () => {
    const client = mockClient(3);
    const result = await resetStateTransitionHandler(client, "u1", {
      stage3SelectedCountIn14d: 2,
      air7dBelow70ForTwoConsecutiveWeeks: true,
      noQrVerificationDays: 0,
      tspDecliningTwoConsecutiveWeeks: false,
    });
    expect(result.triggered).toBe(true);
    expect(result.currentStage).toBe(4);
    expect(result.reasons).toHaveLength(2);
  });

  it("does not trigger when only one condition met and current stage is 3", async () => {
    const client = mockClient(3);
    const result = await resetStateTransitionHandler(client, "u1", {
      stage3SelectedCountIn14d: 2,
      air7dBelow70ForTwoConsecutiveWeeks: false,
      noQrVerificationDays: 0,
      tspDecliningTwoConsecutiveWeeks: false,
    });
    expect(result.triggered).toBe(false);
    expect(result.currentStage).toBe(3);
    expect(result.reasons).toHaveLength(1);
  });

  it("does not trigger when two conditions met but current stage is not 3", async () => {
    const client = mockClient(1);
    const result = await resetStateTransitionHandler(client, "u1", {
      stage3SelectedCountIn14d: 2,
      air7dBelow70ForTwoConsecutiveWeeks: true,
      noQrVerificationDays: 0,
      tspDecliningTwoConsecutiveWeeks: false,
    });
    expect(result.triggered).toBe(false);
    expect(result.currentStage).toBe(1);
  });
});
