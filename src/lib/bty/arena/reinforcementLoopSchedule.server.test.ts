import { describe, expect, it } from "vitest";
import {
  REINFORCEMENT_LOOP_ITERATION_CAP,
  REINFORCEMENT_NO_CHANGE_DELAY_DAYS,
  REINFORCEMENT_UNSTABLE_DELAY_DAYS,
  insertReinforcementDelayedOutcome,
  loopIterationForPendingRow,
  reinforcementCapReached,
} from "./reinforcementLoopSchedule.server";

describe("reinforcementLoopSchedule", () => {
  it("loopIterationForPendingRow defaults to 1", () => {
    expect(loopIterationForPendingRow({})).toBe(1);
    expect(loopIterationForPendingRow({ validation_payload: { reinforcement_loop: null } })).toBe(1);
  });

  it("loopIterationForPendingRow reads loop_iteration", () => {
    expect(
      loopIterationForPendingRow({ validation_payload: { reinforcement_loop: { loop_iteration: 3 } } }),
    ).toBe(3);
  });

  it("exposes reschedule day offsets (unstable medium / no_change stronger-sooner)", () => {
    expect(REINFORCEMENT_UNSTABLE_DELAY_DAYS).toBe(5);
    expect(REINFORCEMENT_NO_CHANGE_DELAY_DAYS).toBe(3);
    expect(REINFORCEMENT_NO_CHANGE_DELAY_DAYS).toBeLessThan(REINFORCEMENT_UNSTABLE_DELAY_DAYS);
  });

  it("reinforcementCapReached: loop ends at iteration cap (N=3)", () => {
    expect(REINFORCEMENT_LOOP_ITERATION_CAP).toBe(3);
    // below cap → loop continues (follow-up may schedule)
    expect(reinforcementCapReached(1)).toBe(false);
    expect(reinforcementCapReached(2)).toBe(false);
    // at / past cap → loop ends, no further follow-up
    expect(reinforcementCapReached(3)).toBe(true);
    expect(reinforcementCapReached(4)).toBe(true);
  });

  it("stores reinforcement_seeded_from_pending_id inside validation_payload only", async () => {
    const captured: { payload: Record<string, unknown> | null } = { payload: null };
    const admin = {
      from: (table: string) => {
        if (table !== "arena_pending_outcomes") {
          throw new Error(`unexpected table: ${table}`);
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: async () => ({ data: [], error: null }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            captured.payload = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: "follow-up-1" }, error: null }),
              }),
            };
          },
        };
      },
    } as unknown as Parameters<typeof insertReinforcementDelayedOutcome>[0];

    const result = await insertReinforcementDelayedOutcome(admin, {
      userId: "user-1",
      closingPendingOutcomeId: "pending-close-1",
      sourceChoiceHistoryId: "history-1",
      validationResult: "unstable",
      payload: {
        scenario_id: "core_01_training_system_exposure",
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "entry",
        before_exit_pattern_key: "k1",
        action_decision_commitment: "avoid",
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "blame_shift",
        after_second_choice_direction: "exit",
        after_exit_pattern_key: "k2",
        validation_result: "unstable",
        axis_guard: "same_axis_ok",
        prior_run_id: "run-1",
        reexposure_run_id: "run-2",
        recorded_at: new Date().toISOString(),
        result_origin: "computed",
      },
      nextLoopIteration: 2,
    });

    expect(result.ok).toBe(true);
    const vp = (captured.payload?.validation_payload ?? null) as Record<string, unknown> | null;
    expect(vp).toBeTruthy();
    expect(vp?.reinforcement_seeded_from_pending_id).toBe("pending-close-1");
    expect(captured.payload?.reinforcement_seeded_from_pending_id).toBeUndefined();
  });
});
