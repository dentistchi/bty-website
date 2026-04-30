import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
const mockEnsureContract = vi.fn();
const mockBuildSnapshot = vi.fn();
const mockGetEliteScenarioById = vi.fn();
const mockEliteScenarioToScenario = vi.fn();
const mockIsEliteChainScenarioId = vi.fn();
const mockBindingIncomplete = vi.fn();
const mockAccrueNoChangeRisk = vi.fn();
const mockGetScenarioByDbId = vi.fn();
const mockGetScenarioById = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  copyCookiesAndDebug: vi.fn(),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock("@/lib/bty/arena/eliteBindingActionCommitment.server", () => ({
  ensureEliteBindingActionCommitmentContract: (...args: unknown[]) => mockEnsureContract(...args),
}));

vi.mock("@/lib/bty/arena/binding/buildArenaBindingSnapshotResponse.server", () => ({
  buildArenaBindingSnapshotResponse: (...args: unknown[]) => mockBuildSnapshot(...args),
}));

vi.mock("@/lib/bty/arena/eliteScenariosCanonical.server", () => ({
  getEliteScenarioById: (...args: unknown[]) => mockGetEliteScenarioById(...args),
  eliteScenarioToScenario: (...args: unknown[]) => mockEliteScenarioToScenario(...args),
}));

vi.mock("@/lib/bty/arena/postLoginEliteEntry", () => ({
  isEliteChainScenarioId: (...args: unknown[]) => mockIsEliteChainScenarioId(...args),
}));

vi.mock("@/lib/bty/arena/binding/eliteChainBindingCompleteness.server", () => ({
  eliteChainScenarioBindingIncompleteReason: (...args: unknown[]) => mockBindingIncomplete(...args),
}));

vi.mock("@/lib/bty/arena/noChangeRisk.server", () => ({
  accrueNoChangeRisk: (...args: unknown[]) => mockAccrueNoChangeRisk(...args),
}));

vi.mock("@/lib/bty/arena/verticalSliceChoiceHistoryBridge.server", () => ({
  recordVerticalSliceActionDecisionHistory: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/data/scenario", () => ({
  getScenarioByDbId: (...args: unknown[]) => mockGetScenarioByDbId(...args),
  getScenarioById: (...args: unknown[]) => mockGetScenarioById(...args),
}));

function makeSupabaseMock(
  runMeta: Record<string, unknown>,
  runScenarioId = "INCIDENT-01-OWN-01",
  onRunScenarioMigrate?: () => void,
  onPendingInsert?: (payload: Record<string, unknown>) => void,
) {
  return {
    from: (table: string) => {
      if (table === "arena_runs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    run_id: "run-1",
                    user_id: "user-1",
                    scenario_id: runScenarioId,
                    status: "in_progress",
                    meta: runMeta,
                    started_at: "2026-04-26T00:00:00.000Z",
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: async () => {
                  onRunScenarioMigrate?.();
                  return { error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === "arena_events") {
        return {
          insert: async () => ({ error: null }),
        };
      }
      if (table === "arena_pending_outcomes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              maybeSingle: async () => {
                onPendingInsert?.(payload);
                return { data: { id: "pend-1" }, error: null };
              },
            }),
          }),
        };
      }
      if (table === "user_scenario_choice_history") {
        const historyResult = async () => ({ data: { id: "hist-1" }, error: null });
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: historyResult,
                    }),
                  }),
                }),
                order: () => ({
                  limit: () => ({
                    maybeSingle: historyResult,
                  }),
                }),
              }),
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: historyResult,
                  }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "hist-seed-1" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ error: null }),
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/arena/choice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsEliteChainScenarioId.mockReturnValue(true);
  mockBindingIncomplete.mockReturnValue(null);
  mockGetEliteScenarioById.mockReturnValue({ title: "Scenario" });
  mockEliteScenarioToScenario.mockReturnValue({
    choices: [{ choiceId: "A", intent: "intent", xpBase: 10, difficulty: 0.5, hiddenDelta: {}, dbChoiceId: "db-a" }],
    escalationBranches: {
      A: {
        second_choices: [{ id: "X", dbChoiceId: "db-x", pattern_family: "repair" }],
        action_decision: {
          choices: [
            { id: "AD1", dbChoiceId: "db-ad1", meaning: { is_action_commitment: true } },
            { id: "AD2", dbChoiceId: "db-ad2", meaning: { is_action_commitment: false } },
          ],
        },
      },
    },
  });
  mockBuildSnapshot.mockResolvedValue({
    mode: "arena",
    runtime_state: "ACTION_REQUIRED",
    state_priority: 90,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
    action_contract: { exists: true, id: "ac-1", status: "pending", verification_type: "hybrid", deadline_at: null },
  });
  mockAccrueNoChangeRisk.mockResolvedValue({ reExposureDueCandidate: false });
  mockGetScenarioByDbId.mockReturnValue({
    incidentId: "incident_01",
    axisGroup: "Ownership",
    axisIndex: 1,
    base: {
      structure: {
        primary: [{ choiceId: "A", dbChoiceId: "db-a" }],
        tradeoff: {
          A: [
            { choiceId: "X", dbChoiceId: "db-x" },
            { choiceId: "Y", dbChoiceId: "db-y" },
          ],
        },
        action_decision: {
          A_X: [
            { choiceId: "AD1", dbChoiceId: "db-ad1", is_action_commitment: true },
            { choiceId: "AD2", dbChoiceId: "db-ad2", is_action_commitment: false },
          ],
        },
      },
    },
    content: {
      title: "Performance Issue or Early System Signal",
      choices: [{ id: "A", intent: "intent", xpBase: 10, difficulty: 0.5, hiddenDelta: {}, dbChoiceId: "db-a" }],
      escalationBranches: {
        A: {
          second_choices: [{ id: "X", dbChoiceId: "db-x", pattern_family: "repair" }],
          action_decision: {
            choices: [
              { id: "AD1", dbChoiceId: "db-ad1", meaning: { is_action_commitment: true } },
              { id: "AD2", dbChoiceId: "db-ad2", meaning: { is_action_commitment: false } },
            ],
          },
        },
      },
    },
  });
  mockGetScenarioById.mockReturnValue(null);
});

describe("POST /api/arena/choice — AD1 action-contract boundary", () => {
  const actionDecisionBodyBase = {
    run_id: "run-1",
    json_scenario_id: "core_01",
    db_scenario_id: "INCIDENT-01-OWN-01",
    binding_phase: "action_decision",
  };

  it("returns 503 error state when AD1 contract ensure fails", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }),
    });
    mockGetSupabaseAdmin.mockReturnValue({});
    mockEnsureContract.mockResolvedValue({
      ok: false,
      contractId: null,
      detail: { code: "23514", message: "constraint failure" },
    });

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD1",
        db_choice_id: "db-ad1",
      }),
    );
    expect(res.status).toBe(503);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("elite_action_contract_ensure_failed");
    expect(json.detail).toEqual({ code: "23514", message: "constraint failure" });
    expect(json.runtime_state).toBe("ERROR");
    expect(json.gates).toEqual({ next_allowed: false, choice_allowed: false, qr_allowed: false });
    expect(json.action_contract).toEqual({
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
  });

  it("returns ACTION_REQUIRED snapshot when AD1 contract ensure succeeds", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }),
    });
    mockGetSupabaseAdmin.mockReturnValue({});
    mockEnsureContract.mockResolvedValue({ ok: true, contractId: "ac-1" });
    mockBuildSnapshot.mockResolvedValueOnce({
      mode: "arena",
      runtime_state: "ACTION_REQUIRED",
      state_priority: 90,
      gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
      action_contract: { exists: true, id: "ac-1", status: "pending", verification_type: "hybrid", deadline_at: null },
    });

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD1",
        db_choice_id: "db-ad1",
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.runtime_state).toBe("ACTION_REQUIRED");
    expect((json.gates as Record<string, unknown>).next_allowed).toBe(false);
    expect((json.gates as Record<string, unknown>).choice_allowed).toBe(false);
    expect((json.action_contract as Record<string, unknown>).exists).toBe(true);
    expect((json.action_contract as Record<string, unknown>).id).toBe("ac-1");
    expect(mockEnsureContract).toHaveBeenCalledTimes(1);
  });

  it("never returns ACTION_REQUIRED without contract id", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }),
    });
    mockGetSupabaseAdmin.mockReturnValue({});
    mockEnsureContract.mockResolvedValue({ ok: true, contractId: "ac-1" });
    mockBuildSnapshot.mockResolvedValueOnce({
      mode: "arena",
      runtime_state: "ACTION_REQUIRED",
      state_priority: 90,
      gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
      action_contract: { exists: false, id: null, status: null, verification_type: null, deadline_at: null },
    });

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD1",
        db_choice_id: "db-ad1",
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.runtime_state).toBe("ERROR");
    expect(json.error).toBe("action_required_contract_invariant_failed");
    expect(json.gates).toEqual({ next_allowed: false, choice_allowed: false, qr_allowed: false });
  });

  it("AD2 does not call contract ensure and returns NEXT_SCENARIO_READY", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }),
    });
    mockGetSupabaseAdmin.mockReturnValue(
      makeSupabaseMock({}, "INCIDENT-01-OWN-01", undefined, (payload) => {
        pendingInsertPayload = payload;
      }),
    );
    mockBuildSnapshot.mockResolvedValueOnce({
      mode: "arena",
      runtime_state: "NEXT_SCENARIO_READY",
      state_priority: 20,
      gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
      action_contract: { exists: false, id: null, status: null, verification_type: null, deadline_at: null },
    });

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.runtime_state).toBe("NEXT_SCENARIO_READY");
    expect(mockEnsureContract).not.toHaveBeenCalled();
  });

  it("promotes AD2 threshold to REEXPOSURE_DUE with pending_outcome_id and json scenario id", async () => {
    let pendingInsertPayload: Record<string, unknown> | null = null;
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock(
        { escalation_branch_key: "A", second_choice_id: "X" },
        "INCIDENT-01-OWN-01",
        undefined,
        (payload) => {
          pendingInsertPayload = payload;
        },
      ),
    });
    mockGetSupabaseAdmin.mockReturnValue(
      makeSupabaseMock({}, "INCIDENT-01-OWN-01", undefined, (payload) => {
        pendingInsertPayload = payload;
      }),
    );
    mockAccrueNoChangeRisk.mockResolvedValueOnce({ reExposureDueCandidate: true });
    mockBuildSnapshot.mockResolvedValueOnce({
      mode: "arena",
      runtime_state: "NEXT_SCENARIO_READY",
      state_priority: 20,
      gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
      action_contract: { exists: false, id: null, status: null, verification_type: null, deadline_at: null },
    });

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.runtime_state).toBe("REEXPOSURE_DUE");
    const reExposure = json.re_exposure as Record<string, unknown>;
    expect(reExposure.scenario_id).toBe("core_01");
    expect(reExposure.pending_outcome_id).toBe("pend-1");
    expect(pendingInsertPayload?.choice_type).toBe("no_change_reexposure");
    expect(pendingInsertPayload?.status).toBe("pending");
    expect(typeof pendingInsertPayload?.scheduled_for).toBe("string");
    expect((pendingInsertPayload?.outcome_title as string) ?? "").toBe("Re-exposure round");
    expect(pendingInsertPayload?.validation_payload).toBeTruthy();
    expect(mockEnsureContract).not.toHaveBeenCalled();
  });

  it("returns 500 when AD2 threshold is due but pending outcome creation fails", async () => {
    const failingSupabase = {
      from: (table: string) => {
        if (table === "arena_runs") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      run_id: "run-1",
                      user_id: "user-1",
                      scenario_id: "INCIDENT-01-OWN-01",
                      status: "in_progress",
                      meta: { escalation_branch_key: "A", second_choice_id: "X" },
                      started_at: "2026-04-26T00:00:00.000Z",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  eq: async () => ({ error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "arena_events") return { insert: async () => ({ error: null }) };
        if (table === "user_scenario_choice_history") {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: null, error: { message: "seed failed" } }),
              }),
            }),
          };
        }
        if (table === "arena_pending_outcomes") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: null, error: { message: "insert failed" } }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc: async () => ({ error: null }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: failingSupabase,
    });
    mockGetSupabaseAdmin.mockReturnValue(failingSupabase);
    mockAccrueNoChangeRisk.mockResolvedValueOnce({ reExposureDueCandidate: true });

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(500);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("no_change_reexposure_pending_outcome_create_failed");
  });

  it("AD2 with unresolved dbScenarioId hard-fails with 422 before risk accrual", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }),
    });
    mockGetSupabaseAdmin.mockReturnValue({});
    mockGetScenarioByDbId.mockReturnValueOnce(null);

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("action_decision_scenario_binding_unresolved");
    expect(mockAccrueNoChangeRisk).not.toHaveBeenCalled();
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
  });

  it("returns 500 service_role_missing_for_reexposure_pending_outcome when service role is unavailable", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }),
    });
    mockGetSupabaseAdmin.mockReturnValue(null);
    mockAccrueNoChangeRisk.mockResolvedValueOnce({ reExposureDueCandidate: true });

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(500);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("service_role_missing_for_reexposure_pending_outcome");
  });

  it("hard-fails when canonical json_scenario_id is sent as db_scenario_id (core_* misuse)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }, "core_01_training_system"),
    });
    mockGetSupabaseAdmin.mockReturnValue({});

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_scenario_id: "core_01_training_system",
        db_scenario_id: "core_01_training_system",
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("db_scenario_id_must_be_canonical_base_db_scenario_id");
    expect(mockAccrueNoChangeRisk).not.toHaveBeenCalled();
  });

  it("AD2 with unresolved non-canonical dbScenarioId does not 422 and skips risk accrual", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock(
        { escalation_branch_key: "A", second_choice_id: "X" },
        "OWN-RE-02-R1",
      ),
    });
    mockGetSupabaseAdmin.mockReturnValue({});
    mockGetScenarioByDbId.mockReturnValueOnce(null);

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        db_scenario_id: "OWN-RE-02-R1",
        json_scenario_id: "OWN-RE-02-R1",
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockAccrueNoChangeRisk).not.toHaveBeenCalled();
  });

  it("migrates legacy run scenario_id core_* to canonical dbScenarioId when payload is canonical", async () => {
    const migrateSpy = vi.fn();
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock(
        { escalation_branch_key: "A", second_choice_id: "X" },
        "core_01_training_system",
        migrateSpy,
      ),
    });
    mockGetSupabaseAdmin.mockReturnValue({});

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_scenario_id: "core_01_training_system",
        db_scenario_id: "INCIDENT-01-OWN-01",
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(200);
    expect(migrateSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps 409 for unrelated db_scenario mismatch with debug fields", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }, "INCIDENT-99-WRONG-99"),
    });
    mockGetSupabaseAdmin.mockReturnValue({});

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_scenario_id: "core_01_training_system",
        db_scenario_id: "INCIDENT-01-OWN-01",
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(409);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("db_scenario_mismatch");
    expect(json.currentRunScenarioId).toBe("INCIDENT-99-WRONG-99");
    expect(json.requestedDbScenarioId).toBe("INCIDENT-01-OWN-01");
    expect(json.expectedDbScenarioId).toBe(null);
  });

  it("allows canonical binding path for core json id + INCIDENT db id (no 400 guard)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }, "INCIDENT-01-OWN-01"),
    });
    mockIsEliteChainScenarioId.mockImplementation((value: string) => value === "core_01_training_system");
    mockGetSupabaseAdmin.mockReturnValue({});

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_scenario_id: "core_01_training_system",
        db_scenario_id: "INCIDENT-01-OWN-01",
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("keeps binding guard for unsupported non-canonical scenario ids", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A", second_choice_id: "X" }, "OWN-RE-02-R1"),
    });
    mockIsEliteChainScenarioId.mockReturnValue(false);
    mockGetScenarioByDbId.mockReturnValueOnce(null);

    const res = await POST(
      makeRequest({
        ...actionDecisionBodyBase,
        json_scenario_id: "OWN-RE-02-R1",
        db_scenario_id: "OWN-RE-02-R1",
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("binding_only_elite_chain_scenarios");
  });

  it("uses base.structure tradeoff mapping over content dbChoiceId for canonical scenarios", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A" }, "INCIDENT-01-OWN-01"),
    });
    mockIsEliteChainScenarioId.mockReturnValue(false);
    mockGetScenarioByDbId.mockReturnValueOnce({
      incidentId: "incident_01",
      axisGroup: "Ownership",
      axisIndex: 1,
      base: {
        structure: {
          primary: [{ choiceId: "A", dbChoiceId: "db-a" }],
          tradeoff: {
            A: [
              { choiceId: "X", dbChoiceId: "db-x-base" },
              { choiceId: "Y", dbChoiceId: "db-y-base" },
            ],
          },
          action_decision: {
            A_X: [
              { choiceId: "AD1", dbChoiceId: "db-ad1-base", is_action_commitment: true },
              { choiceId: "AD2", dbChoiceId: "db-ad2-base", is_action_commitment: false },
            ],
          },
        },
      },
      content: {
        title: "Canonical",
        choices: [{ id: "A", intent: "intent", xpBase: 10, difficulty: 1, hiddenDelta: {}, dbChoiceId: "db-a-content" }],
        escalationBranches: {
          A: {
            second_choices: [{ id: "X", dbChoiceId: "db-x-content", pattern_family: "repair" }],
            action_decision: {
              choices: [
                { id: "AD1", dbChoiceId: "db-ad1-content", meaning: { is_action_commitment: true } },
                { id: "AD2", dbChoiceId: "db-ad2-content", meaning: { is_action_commitment: false } },
              ],
            },
          },
        },
      },
    });

    const res = await POST(
      makeRequest({
        run_id: "run-1",
        json_scenario_id: "core_01_training_system_exposure",
        db_scenario_id: "INCIDENT-01-OWN-01",
        binding_phase: "tradeoff",
        json_choice_id: "X",
        db_choice_id: "db-x-base",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("returns second_choice_binding_mismatch with expected/received debug fields", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ escalation_branch_key: "A" }, "INCIDENT-01-OWN-01"),
    });
    mockIsEliteChainScenarioId.mockReturnValue(false);
    const res = await POST(
      makeRequest({
        run_id: "run-1",
        json_scenario_id: "core_01_training_system_exposure",
        db_scenario_id: "INCIDENT-01-OWN-01",
        binding_phase: "tradeoff",
        json_choice_id: "X",
        db_choice_id: "db-x-wrong",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("second_choice_binding_mismatch");
    expect(json.expectedDbChoiceId).toBe("db-x");
    expect(json.receivedDbChoiceId).toBe("db-x-wrong");
    expect(json.primaryChoiceId).toBe("A");
    expect(json.secondChoiceId).toBe("X");
  });

  it("returns 400 missing_primary_choice_id_for_tradeoff when primary context is absent", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({}, "INCIDENT-01-OWN-01"),
    });
    mockIsEliteChainScenarioId.mockReturnValue(false);
    const res = await POST(
      makeRequest({
        run_id: "run-1",
        json_scenario_id: "core_01_training_system_exposure",
        db_scenario_id: "INCIDENT-01-OWN-01",
        binding_phase: "tradeoff",
        json_choice_id: "Y",
        db_choice_id: "INCIDENT-01-OWN-01_tradeoff_C_Y",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("missing_primary_choice_id_for_tradeoff");
  });

  it("returns 400 missing_second_choice_id_for_action_decision when second context is absent", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ primary_choice_id: "A" }, "INCIDENT-01-OWN-01"),
    });
    mockIsEliteChainScenarioId.mockReturnValue(false);
    const res = await POST(
      makeRequest({
        run_id: "run-1",
        json_scenario_id: "core_01_training_system_exposure",
        db_scenario_id: "INCIDENT-01-OWN-01",
        binding_phase: "action_decision",
        primary_choice_id: "A",
        json_choice_id: "AD2",
        db_choice_id: "db-ad2",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("missing_second_choice_id_for_action_decision");
  });

  it("returns 400 action_decision_binding_missing when base mapping key is absent", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
      supabase: makeSupabaseMock({ primary_choice_id: "A", second_choice_id: "Y" }, "INCIDENT-01-OWN-01"),
    });
    mockIsEliteChainScenarioId.mockReturnValue(false);
    mockGetScenarioByDbId.mockReturnValueOnce({
      incidentId: "incident_01",
      axisGroup: "Ownership",
      axisIndex: 1,
      base: {
        structure: {
          primary: [{ choiceId: "A", dbChoiceId: "db-a" }],
          tradeoff: { A: [{ choiceId: "Y", dbChoiceId: "db-y" }] },
          action_decision: {
            A_X: [{ choiceId: "AD1", dbChoiceId: "db-ad1", is_action_commitment: true }],
          },
        },
      },
      content: {
        title: "Canonical",
        choices: [{ id: "A", intent: "intent", xpBase: 10, difficulty: 1, hiddenDelta: {}, dbChoiceId: "db-a" }],
        escalationBranches: {
          A: {
            second_choices: [{ id: "Y", dbChoiceId: "db-y", pattern_family: "observe" }],
            action_decision: { choices: [{ id: "AD2", dbChoiceId: "db-ad2", meaning: { is_action_commitment: false } }] },
          },
        },
      },
    });

    const res = await POST(
      makeRequest({
        run_id: "run-1",
        json_scenario_id: "core_01_training_system_exposure",
        db_scenario_id: "INCIDENT-01-OWN-01",
        binding_phase: "action_decision",
        primary_choice_id: "A",
        second_choice_id: "Y",
        json_choice_id: "AD9",
        db_choice_id: "db-ad9",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("action_decision_binding_missing");
  });
});
