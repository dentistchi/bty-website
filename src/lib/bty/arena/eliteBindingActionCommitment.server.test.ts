import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureEliteBindingActionCommitmentContract } from "./eliteBindingActionCommitment.server";

const mockLoadArenaRunOwnerUserId = vi.fn();
const mockGetEliteScenarioById = vi.fn();
const mockIsEliteChainScenarioId = vi.fn();
const mockGetScenarioByDbId = vi.fn();

vi.mock("@/lib/bty/action-contract/arenaRunActor.server", () => ({
  loadArenaRunOwnerUserId: (...args: unknown[]) => mockLoadArenaRunOwnerUserId(...args),
  logActionContractActorTrace: vi.fn(),
}));

vi.mock("@/lib/bty/arena/eliteScenariosCanonical.server", () => ({
  getEliteScenarioById: (...args: unknown[]) => mockGetEliteScenarioById(...args),
}));

vi.mock("@/lib/bty/arena/postLoginEliteEntry", () => ({
  isEliteChainScenarioId: (...args: unknown[]) => mockIsEliteChainScenarioId(...args),
}));

vi.mock("@/data/scenario", () => ({
  getScenarioByDbId: (...args: unknown[]) => mockGetScenarioByDbId(...args),
}));

function makeAdmin(params?: {
  insertError?: { code?: string; message?: string; details?: string; hint?: string } | null;
  existingBySessionId?: string | null;
  existingByActionId?: string | null;
  existingByPatternFamilyId?: string | null;
}) {
  const p = params ?? {};
  return {
    from: (table: string) => {
      if (table !== "bty_action_contracts") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_colA: string, valA: string) => ({
            eq: (_colB: string, valB: string) => ({
              maybeSingle: async () => {
                if (valA === "user-1" && valB === "run-1" && p.existingBySessionId) {
                  return { data: { id: p.existingBySessionId }, error: null };
                }
                if (valA === "user-1" && valB === "arena_action_loop:run-1" && p.existingByActionId) {
                  return { data: { id: p.existingByActionId }, error: null };
                }
                return { data: null, error: null };
              },
              in: (_statusCol: string, _statuses: string[]) => ({
                order: (_orderCol: string, _opts: { ascending: boolean }) => ({
                  limit: (_n: number) => ({
                    maybeSingle: async () =>
                      p.existingByPatternFamilyId
                        ? { data: { id: p.existingByPatternFamilyId, status: "pending" }, error: null }
                        : { data: null, error: null },
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () =>
              p.insertError
                ? {
                    data: null,
                    error: {
                      code: p.insertError.code,
                      message: p.insertError.message ?? "insert failed",
                      details: p.insertError.details ?? null,
                      hint: p.insertError.hint ?? null,
                    },
                  }
                : { data: { id: "ac-created-1" }, error: null },
          }),
        }),
      };
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("ensureEliteBindingActionCommitmentContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadArenaRunOwnerUserId.mockResolvedValue("user-1");
    mockIsEliteChainScenarioId.mockReturnValue(false);
    mockGetScenarioByDbId.mockReturnValue({ scenarioId: "core_02_new_doctor_reexposure_compromise_loop" });
    mockGetEliteScenarioById.mockReturnValue({
      action_contract: { description: "Elite action", time_window_hours: 48 },
    });
  });

  it("creates contract for canonical INCIDENT-* scenario id", async () => {
    const res = await ensureEliteBindingActionCommitmentContract(makeAdmin(), {
      userId: "user-1",
      runId: "run-1",
      dbScenarioId: "INCIDENT-01-OWNERSHIP-02",
      patternFamilyRaw: "repair",
      actionLabelRaw: "Have the hard conversation with the new doctor",
    });
    expect(res.ok).toBe(true);
    expect(res.contractId).toBe("ac-created-1");
    expect(res.created).toBe(true);
  });

  it("keeps failure response on insert failure", async () => {
    const res = await ensureEliteBindingActionCommitmentContract(
      makeAdmin({
        insertError: { code: "23514", message: "constraint failure", details: "null value", hint: "check payload" },
      }),
      {
        userId: "user-1",
        runId: "run-1",
        dbScenarioId: "INCIDENT-01-OWNERSHIP-02",
        patternFamilyRaw: "repair",
        actionLabelRaw: "Action",
      },
    );
    expect(res.ok).toBe(false);
    expect(res.contractId).toBeNull();
    expect(res.detail?.code).toBe("23514");
    expect(res.detail?.message).toBe("constraint failure");
    expect(res.detail?.insert_payload?.action_type).toBe("arena_run_completion");
  });

  it("recovers on unique conflict by open pattern-family contract", async () => {
    const res = await ensureEliteBindingActionCommitmentContract(
      makeAdmin({
        insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
        existingByPatternFamilyId: "ac-existing-open-1",
      }),
      {
        userId: "user-1",
        runId: "run-1",
        dbScenarioId: "INCIDENT-01-OWNERSHIP-02",
        patternFamilyRaw: "repair",
        actionLabelRaw: "Action",
      },
    );
    expect(res.ok).toBe(true);
    expect(res.contractId).toBe("ac-existing-open-1");
    expect(res.created).toBe(false);
  });
});
