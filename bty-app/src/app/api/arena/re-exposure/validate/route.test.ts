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

  beforeEach(() => {
    validationUpdatePayload = null;
    signatureUpsertPayload = null;
    mockMarkDue.mockResolvedValue(undefined);
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
                        reinforcement_loop: null,
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
                      data: { scenario_id: SCENARIO_ID },
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
      validation_payload?: { validation_result?: string; after_pattern_family?: string };
    };
    expect(json.ok).toBe(true);
    expect(json.validation_result).toBe("changed");
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
    expect(validationUpdatePayload?.reinforcement_loop).toBeDefined();

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
});
