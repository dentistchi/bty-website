/**
 * C5 live-proof chain: POST validate → validation_payload update → user_pattern_signatures upsert.
 * Mocks Supabase + compute; asserts executed handler behavior (200, persisted shapes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

const mockRequireUser = vi.fn();
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  copyCookiesAndDebug: vi.fn(),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
}));

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

const mockCompute = vi.fn();
vi.mock("@/lib/bty/arena/reexposureValidation.server", () => ({
  computeReexposureValidation: (...args: unknown[]) => mockCompute(...args),
}));

const mockMarkDue = vi.fn();
vi.mock("@/engine/scenario/delayed-outcome-trigger.service", () => ({
  markDueOutcomesDelivered: (...args: unknown[]) => mockMarkDue(...args),
}));

const mockInsertReinforcementDelayedOutcome = vi.fn();
const mockLoopIterationForPendingRow = vi.fn(() => 1);
vi.mock("@/lib/bty/arena/reinforcementLoopSchedule.server", () => ({
  insertReinforcementDelayedOutcome: (...args: unknown[]) =>
    mockInsertReinforcementDelayedOutcome.apply(null, args),
  loopIterationForPendingRow: (...args: unknown[]) => mockLoopIterationForPendingRow.apply(null, args),
}));

const mockApplyReexposureOutcomeReflection = vi.fn();
vi.mock("@/lib/bty/arena/reflectionRewards.server", () => ({
  applyReexposureOutcomeReflection: (...args: unknown[]) =>
    mockApplyReexposureOutcomeReflection(...args),
}));

const mockGetScenarioByDbId = vi.fn();
const mockGetScenarioById = vi.fn();
vi.mock("@/data/scenario", () => ({
  getScenarioByDbId: (...args: unknown[]) => mockGetScenarioByDbId(...args),
  getScenarioById: (...args: unknown[]) => mockGetScenarioById(...args),
}));

const USER_ID = "user-c5-reexposure";
const PENDING_ID = "pending-outcome-c5-1";
const HISTORY_ID = "choice-hist-c5-1";
const RUN_ID = "run-reexposure-c5-1";
const SCENARIO_ID = "core_01_training_system";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/arena/re-exposure/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/arena/re-exposure/validate — C5 chain proof", () => {
  let validationUpdatePayload: Record<string, unknown> | null;
  let signatureUpsertPayload: Record<string, unknown> | null;
  let pendingRowScenarioId: string;

  beforeEach(() => {
    validationUpdatePayload = null;
    signatureUpsertPayload = null;
    pendingRowScenarioId = SCENARIO_ID;
    mockMarkDue.mockResolvedValue(undefined);
    mockInsertReinforcementDelayedOutcome.mockResolvedValue({
      ok: true,
      newPendingId: "pending-follow-up-1",
      next_scheduled_for: "2026-04-15T12:00:00.000Z",
    });
    mockApplyReexposureOutcomeReflection.mockResolvedValue({
      ok: true,
      applied: true,
      coreXp: 12,
      weeklyXp: 8,
      deltaApplied: 8,
    });
    mockLoopIterationForPendingRow.mockReturnValue(1);
    mockGetScenarioByDbId.mockReturnValue(null);
    mockGetScenarioById.mockReturnValue(null);
    mockCompute.mockResolvedValue({
      ok: true,
      payload: {
        scenario_id: SCENARIO_ID,
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "exit" as const,
        before_exit_pattern_key: "blame_shift|x",
        action_decision_commitment: "commit" as const,
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "blame_shift",
        after_second_choice_direction: "exit" as const,
        after_exit_pattern_key: "blame_shift|y",
        validation_result: "changed",
        axis_guard: "same_axis_ok",
        prior_run_id: "prior-run-1",
        reexposure_run_id: RUN_ID,
        recorded_at: "2026-04-10T12:00:00.000Z",
      },
    });

    const userSupabase = {
      from: (table: string) => {
        if (table !== "arena_runs") throw new Error(`unexpected user table ${table}`);
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      run_id: RUN_ID,
                      scenario_id: SCENARIO_ID,
                      user_id: USER_ID,
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      },
    };

    mockRequireUser.mockResolvedValue({
      user: { id: USER_ID },
      supabase: userSupabase,
      base: new Response(),
      error: null,
    });

    const admin = {
      from: (table: string) => {
        if (table === "arena_pending_outcomes") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: PENDING_ID,
                        status: "pending",
                        source_choice_history_id: HISTORY_ID,
                        validation_payload: null,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              validationUpdatePayload = payload;
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve({ error: null }),
                  }),
                }),
              };
            },
          };
        }
        if (table === "user_scenario_choice_history") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { scenario_id: pendingRowScenarioId },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "user_pattern_signatures") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: null,
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
            upsert: (rows: Record<string, unknown>, _opts?: unknown) => {
              signatureUpsertPayload = rows;
              return Promise.resolve({ error: null });
            },
          };
        }
        throw new Error(`unexpected admin table ${table}`);
      },
    };

    mockGetSupabaseAdmin.mockReturnValue(admin);
  });

  it("returns 200 with validation_result and persists validation_payload + signature upsert", async () => {
    const res = await POST(makeRequest({ pendingOutcomeId: PENDING_ID, runId: RUN_ID, scenarioId: SCENARIO_ID }) as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok?: boolean;
      validation_result?: string;
      next_runtime_state?: string;
      re_exposure_clear_candidate?: boolean;
      intervention_sensitivity_up?: boolean;
      validation_payload?: { validation_result?: string; after_pattern_family?: string };
      follow_up_scheduled?: boolean;
      new_pending_outcome_id?: string | null;
      next_scheduled_for?: string | null;
    };
    expect(json.ok).toBe(true);
    expect(json.validation_result).toBe("changed");
    expect(json.next_runtime_state).toBe("NEXT_SCENARIO_READY");
    expect(json.re_exposure_clear_candidate).toBe(true);
    expect(json.intervention_sensitivity_up).toBe(false);
    expect(json.validation_payload?.validation_result).toBe("changed");
    expect(json.validation_payload?.after_pattern_family).toBe("blame_shift");

    expect(mockCompute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        scenarioId: SCENARIO_ID,
        reexposureRunId: RUN_ID,
      }),
    );

    expect(validationUpdatePayload).not.toBeNull();
    expect(validationUpdatePayload?.validation_payload).toBeDefined();
    const vp = validationUpdatePayload!.validation_payload as { validation_result?: string };
    expect(vp.validation_result).toBe("changed");
    const vpWithLoop = validationUpdatePayload?.validation_payload as
      | { reinforcement_loop?: unknown }
      | undefined;
    expect(vpWithLoop?.reinforcement_loop).toBeDefined();
    expect(json.follow_up_scheduled).toBe(false);
    expect(json.new_pending_outcome_id).toBeNull();
    expect(json.next_scheduled_for).toBeNull();
    expect(mockInsertReinforcementDelayedOutcome).not.toHaveBeenCalled();
    expect(mockApplyReexposureOutcomeReflection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        runId: RUN_ID,
        scenarioId: SCENARIO_ID,
        validationResult: "changed",
      }),
    );

    expect(mockMarkDue).toHaveBeenCalledWith(USER_ID, [PENDING_ID], expect.anything());

    expect(signatureUpsertPayload).not.toBeNull();
    expect(signatureUpsertPayload?.user_id).toBe(USER_ID);
    expect(signatureUpsertPayload?.pattern_family).toBeTruthy();
    expect(signatureUpsertPayload?.axis).toBe("Blame vs. Structural Honesty");
    expect(signatureUpsertPayload?.repeat_count).toBeGreaterThanOrEqual(1);
    expect(signatureUpsertPayload?.current_state).toBeTruthy();
    expect(signatureUpsertPayload?.last_validation_result).toBe("changed");
    expect(typeof signatureUpsertPayload?.confidence_score).toBe("number");
  });

  it("returns 400 when body missing ids", async () => {
    const res = await POST(makeRequest({}) as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("rejects cross-axis comparison via scenario/history mismatch", async () => {
    pendingRowScenarioId = "core_02_other_axis";
    mockCompute.mockClear();
    const res = await POST(
      makeRequest({ pendingOutcomeId: PENDING_ID, runId: RUN_ID, scenarioId: SCENARIO_ID }) as import("next/server").NextRequest,
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as {
      error?: string;
      expectedScenarioId?: string | null;
      actualRunScenarioId?: string | null;
      pendingOutcomeId?: string;
      priorRunId?: string | null;
      reexposureRunId?: string;
      scenarioIdFromPayload?: string;
    };
    expect(json.error).toBe("scenario_id_mismatch_history");
    expect(mockCompute).not.toHaveBeenCalled();
  });

  it("changed consumes pending outcome without follow-up scheduling", async () => {
    mockCompute.mockResolvedValueOnce({
      ok: true,
      payload: {
        scenario_id: SCENARIO_ID,
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "exit" as const,
        before_exit_pattern_key: "blame_shift|x",
        action_decision_commitment: "commit" as const,
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "truth_naming",
        after_second_choice_direction: "entry" as const,
        after_exit_pattern_key: "entry:s1",
        validation_result: "changed" as const,
        axis_guard: "same_axis_ok" as const,
        prior_run_id: "prior-run-2",
        reexposure_run_id: RUN_ID,
        recorded_at: "2026-04-10T12:00:00.000Z",
      },
    });

    const res = await POST(
      makeRequest({ pendingOutcomeId: PENDING_ID, runId: RUN_ID, scenarioId: SCENARIO_ID }) as import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      follow_up_scheduled?: boolean;
      new_pending_outcome_id?: string | null;
      next_scheduled_for?: string | null;
    };
    expect(json.follow_up_scheduled).toBe(false);
    expect(json.new_pending_outcome_id).toBeNull();
    expect(json.next_scheduled_for).toBeNull();
    expect(mockMarkDue).toHaveBeenCalledWith(USER_ID, [PENDING_ID], expect.anything());
    expect(mockInsertReinforcementDelayedOutcome).not.toHaveBeenCalled();
    expect(mockApplyReexposureOutcomeReflection).toHaveBeenCalledWith(
      expect.objectContaining({
        validationResult: "changed",
      }),
    );
  });

  it("returns run_scenario_mismatch with debug fields", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: USER_ID },
      base: new Response(),
      supabase: {
        from: (table: string) => {
          if (table !== "arena_runs") throw new Error(`unexpected user table ${table}`);
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        run_id: RUN_ID,
                        scenario_id: "INCIDENT-01-OWN-01",
                        user_id: USER_ID,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        },
      },
      error: null,
    });

    const admin = {
      from: (table: string) => {
        if (table === "arena_pending_outcomes") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: PENDING_ID,
                        status: "pending",
                        source_choice_history_id: HISTORY_ID,
                        validation_payload: { prior_run_id: "prior-run-debug-1" },
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "user_scenario_choice_history") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { scenario_id: SCENARIO_ID },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected admin table ${table}`);
      },
    };
    mockGetSupabaseAdmin.mockReturnValue(admin);

    const res = await POST(
      makeRequest({ pendingOutcomeId: PENDING_ID, runId: RUN_ID, scenarioId: SCENARIO_ID }) as import("next/server").NextRequest,
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("run_scenario_mismatch");
    expect(json.expectedScenarioId).toBe(SCENARIO_ID);
    expect(json.actualRunScenarioId).toBe("INCIDENT-01-OWN-01");
    expect(json.pendingOutcomeId).toBe(PENDING_ID);
    expect(json.priorRunId).toBe("prior-run-debug-1");
    expect(json.reexposureRunId).toBe(RUN_ID);
    expect(json.scenarioIdFromPayload).toBe(SCENARIO_ID);
  });

  it("allows canonical-equivalent run scenario id (INCIDENT-* vs core_*)", async () => {
    mockGetScenarioByDbId.mockImplementation((dbId: string) => {
      if (dbId === "INCIDENT-01-OWNERSHIP-02") {
        return { scenarioId: SCENARIO_ID };
      }
      return null;
    });
    mockRequireUser.mockResolvedValue({
      user: { id: USER_ID },
      base: new Response(),
      supabase: {
        from: (table: string) => {
          if (table !== "arena_runs") throw new Error(`unexpected user table ${table}`);
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        run_id: RUN_ID,
                        scenario_id: "INCIDENT-01-OWNERSHIP-02",
                        user_id: USER_ID,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        },
      },
      error: null,
    });

    const res = await POST(
      makeRequest({ pendingOutcomeId: PENDING_ID, runId: RUN_ID, scenarioId: SCENARIO_ID }) as import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.validation_result).toBe("changed");
  });

  it("unstable/no_change consume pending and schedule reinforcement follow-up", async () => {
    mockCompute.mockResolvedValueOnce({
      ok: true,
      payload: {
        scenario_id: SCENARIO_ID,
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "exit" as const,
        before_exit_pattern_key: "blame_shift|x",
        action_decision_commitment: "commit" as const,
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "blame_shift",
        after_second_choice_direction: "exit" as const,
        after_exit_pattern_key: "blame_shift|y",
        validation_result: "unstable" as const,
        axis_guard: "same_axis_ok" as const,
        prior_run_id: "prior-run-3",
        reexposure_run_id: RUN_ID,
        recorded_at: "2026-04-10T12:00:00.000Z",
      },
    });

    const res = await POST(
      makeRequest({ pendingOutcomeId: PENDING_ID, runId: RUN_ID, scenarioId: SCENARIO_ID }) as import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      follow_up_scheduled?: boolean;
      new_pending_outcome_id?: string | null;
      next_scheduled_for?: string | null;
      validation_result?: string;
      next_runtime_state?: string;
      intervention_sensitivity_up?: boolean;
    };
    expect(json.validation_result).toBe("unstable");
    expect(json.next_runtime_state).toBe("REEXPOSURE_DUE");
    expect(json.intervention_sensitivity_up).toBe(false);
    expect(json.follow_up_scheduled).toBe(true);
    expect(json.new_pending_outcome_id).toBe("pending-follow-up-1");
    expect(json.next_scheduled_for).toBe("2026-04-15T12:00:00.000Z");
    expect(mockMarkDue).toHaveBeenCalledWith(USER_ID, [PENDING_ID], expect.anything());
    expect(mockInsertReinforcementDelayedOutcome).toHaveBeenCalledTimes(1);
    expect(mockApplyReexposureOutcomeReflection).toHaveBeenCalledWith(
      expect.objectContaining({
        validationResult: "unstable",
      }),
    );
  });

  it("no_change consumes pending and schedules reinforcement follow-up", async () => {
    mockCompute.mockResolvedValueOnce({
      ok: true,
      payload: {
        scenario_id: SCENARIO_ID,
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "exit" as const,
        before_exit_pattern_key: "blame_shift|x",
        action_decision_commitment: "commit" as const,
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "blame_shift",
        after_second_choice_direction: "exit" as const,
        after_exit_pattern_key: "blame_shift|x",
        validation_result: "no_change" as const,
        axis_guard: "same_axis_ok" as const,
        prior_run_id: "prior-run-4",
        reexposure_run_id: RUN_ID,
        recorded_at: "2026-04-10T12:00:00.000Z",
      },
    });

    const res = await POST(
      makeRequest({ pendingOutcomeId: PENDING_ID, runId: RUN_ID, scenarioId: SCENARIO_ID }) as import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      follow_up_scheduled?: boolean;
      new_pending_outcome_id?: string | null;
      next_scheduled_for?: string | null;
      validation_result?: string;
      next_runtime_state?: string;
      intervention_sensitivity_up?: boolean;
    };
    expect(json.validation_result).toBe("no_change");
    expect(json.next_runtime_state).toBe("REEXPOSURE_DUE");
    expect(json.intervention_sensitivity_up).toBe(true);
    expect(json.follow_up_scheduled).toBe(true);
    expect(typeof json.new_pending_outcome_id).toBe("string");
    expect(json.new_pending_outcome_id).toBeTruthy();
    expect(typeof json.next_scheduled_for).toBe("string");
    expect(json.next_scheduled_for).toBeTruthy();
    expect(mockMarkDue).toHaveBeenCalledWith(USER_ID, [PENDING_ID], expect.anything());
    expect(mockApplyReexposureOutcomeReflection).toHaveBeenCalledWith(
      expect.objectContaining({
        validationResult: "no_change",
      }),
    );
  });
});
