import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureActionContractWithAdmin,
  getBundledEliteScenarioById,
  resolveActionContractSpecForScenario,
  BUNDLED_ELITE_ACTION_CONTRACT_FIXTURE,
} from "./ensureActionContract";

describe("resolveActionContractSpecForScenario", () => {
  it("uses default window for mirror:… (elite lookup null does not block contract path)", () => {
    const r = resolveActionContractSpecForScenario("mirror:550e8400-e29b-41d4-a716-446655440000");
    expect(r.source).toBe("mirror");
    expect(r.time_window_hours).toBe(48);
    expect(r.description).toContain("Complete your committed");
  });

  it("uses default window for pswitch_…", () => {
    const r = resolveActionContractSpecForScenario("pswitch_abc123");
    expect(r.source).toBe("perspective_switch");
    expect(r.time_window_hours).toBe(48);
  });
});

describe("getBundledEliteScenarioById", () => {
  it("returns elite spec for bundled id", () => {
    const id = Object.keys(BUNDLED_ELITE_ACTION_CONTRACT_FIXTURE)[0];
    const g = getBundledEliteScenarioById(id);
    expect(g?.action_contract.description).toContain("Elite fixture");
    expect(g?.action_contract.time_window_hours).toBe(72);
  });

  it("returns null for unknown scenario", () => {
    expect(getBundledEliteScenarioById("unknown_scenario_xyz")).toBeNull();
  });
});

describe("ensureActionContractWithAdmin", () => {
  const userId = "u1";
  const runId = "run-1";
  const scenarioElite = Object.keys(BUNDLED_ELITE_ACTION_CONTRACT_FIXTURE)[0];
  const canonicalFamily = "ownership_escape" as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeAdmin(
    btyFromFn: (n: number) => object,
    opts: { doneCount?: number } = {},
  ) {
    let arenaRunsN = 0;
    let btyN = 0;
    return {
      from: vi.fn((table: string) => {
        if (table === "arena_runs") {
          arenaRunsN += 1;
          if (arenaRunsN === 1) {
            // loadArenaRunOwnerUserId: .select().eq().maybeSingle()
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { user_id: userId },
                    error: null,
                  }),
                })),
              })),
            };
          }
          // done count guard: .select().eq().eq() → { count, error }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  count: opts.doneCount ?? 2,
                  error: null,
                }),
              })),
            })),
          };
        }
        btyN += 1;
        return btyFromFn(btyN);
      }),
    } as never;
  }

  it("contract exists → ok:true, created:false", async () => {
    const admin = makeAdmin(() => ({
      insert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "existing-c", status: "pending" },
              error: null,
            }),
          }),
        }),
      }),
    }));

    const r = await ensureActionContractWithAdmin(admin, {
      userId,
      runId,
      scenarioId: "any",
      nbaLogId: null,
    });
    expect(r).toEqual({ ok: true, contractId: "existing-c", created: false });
  });

  it("contract missing + threshold family → creates with pattern-based copy, ok:true, created:true", async () => {
    const maybeSingleOpen = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingleSession = vi.fn().mockResolvedValue({ data: null, error: null });
    const singleInsert = vi.fn().mockResolvedValue({ data: { id: "new-c" }, error: null });

    let selectCall = 0;
    const admin = makeAdmin(() => ({
      select: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return { eq: () => ({ eq: () => ({ in: () => ({ maybeSingle: maybeSingleOpen }) }) }) };
        }
        return { eq: () => ({ eq: () => ({ maybeSingle: maybeSingleSession }) }) };
      },
      insert: () => ({ select: () => ({ single: singleInsert }) }),
    }));

    const r = await ensureActionContractWithAdmin(admin, {
      userId,
      runId,
      scenarioId: scenarioElite,
      nbaLogId: null,
      patternFamily: canonicalFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "new-c", created: true });
    expect(singleInsert).toHaveBeenCalled();
  });

  it("contract missing + no threshold family → no insert, ok:true, contractId:null", async () => {
    const admin = makeAdmin(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }));

    const r = await ensureActionContractWithAdmin(admin, {
      userId,
      runId,
      scenarioId: "plain_catalog_scenario",
      nbaLogId: null,
    });
    expect(r).toEqual({ ok: true, contractId: null, created: false });
  });

  it("persist fails → ok:false, contractId:null", async () => {
    const maybeSingleOpen = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingleSession = vi.fn().mockResolvedValue({ data: null, error: null });
    const singleInsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "db boom" },
    });

    let selectCall = 0;
    const admin = makeAdmin(() => ({
      select: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return { eq: () => ({ eq: () => ({ in: () => ({ maybeSingle: maybeSingleOpen }) }) }) };
        }
        return { eq: () => ({ eq: () => ({ maybeSingle: maybeSingleSession }) }) };
      },
      insert: () => ({ select: () => ({ single: singleInsert }) }),
    }));

    const r = await ensureActionContractWithAdmin(admin, {
      userId,
      runId,
      scenarioId: "plain_catalog_scenario",
      nbaLogId: null,
      patternFamily: canonicalFamily,
    });
    expect(r).toEqual({ ok: false, contractId: null, created: false });
  });

  it("insert returns no id but row exists → reconcile returns contractId", async () => {
    const maybeSingleOpen = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingleSession = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "reconciled-c" }, error: null });
    const singleInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    let selectCall = 0;
    const admin = makeAdmin(() => ({
      select: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return { eq: () => ({ eq: () => ({ in: () => ({ maybeSingle: maybeSingleOpen }) }) }) };
        }
        return { eq: () => ({ eq: () => ({ maybeSingle: maybeSingleSession }) }) };
      },
      insert: () => ({ select: () => ({ single: singleInsert }) }),
    }));

    const r = await ensureActionContractWithAdmin(admin, {
      userId,
      runId,
      scenarioId: "mirror:550e8400-e29b-41d4-a716-446655440000",
      nbaLogId: null,
      patternFamily: canonicalFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "reconciled-c", created: false });
    expect(maybeSingleSession).toHaveBeenCalledTimes(2);
  });

  it("insert fails with DB error but row exists → final reconcile returns contractId", async () => {
    const maybeSingleOpen = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingleSession = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue({ data: { id: "race-c" }, error: null });
    const singleInsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "08000", message: "transient" },
    });

    let selectCall = 0;
    const admin = makeAdmin(() => ({
      select: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return { eq: () => ({ eq: () => ({ in: () => ({ maybeSingle: maybeSingleOpen }) }) }) };
        }
        return { eq: () => ({ eq: () => ({ maybeSingle: maybeSingleSession }) }) };
      },
      insert: () => ({ select: () => ({ single: singleInsert }) }),
    }));

    const r = await ensureActionContractWithAdmin(admin, {
      userId,
      runId,
      scenarioId: "plain_catalog_scenario",
      nbaLogId: null,
      patternFamily: canonicalFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "race-c", created: false });
  });
});
