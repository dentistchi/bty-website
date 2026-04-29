import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureDraftActionContractWithAdmin } from "./actionContractLifecycle.server";

describe("ensureDraftActionContractWithAdmin", () => {
  const userId = "user-1";
  const sessionId = "run-abc";
  const scenarioId = "elite_bundled_fixture_001";
  const primaryChoice = "c1";
  const patternFamily = "ownership_escape";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeAdmin(overrides: {
    arenaRunsData?: unknown;
    arenaRunsError?: unknown;
    existingContractData?: unknown;
    existingContractError?: unknown;
    familyData?: unknown;
    familyError?: unknown;
    insertData?: unknown;
    insertError?: unknown;
    reconcileData?: unknown;
    reconcileError?: unknown;
  } = {}) {
    let btyFromN = 0;
    return {
      from: vi.fn((table: string) => {
        if (table === "arena_runs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: overrides.arenaRunsData ?? { user_id: userId },
                  error: overrides.arenaRunsError ?? null,
                }),
              })),
            })),
          };
        }
        // bty_action_contracts
        btyFromN += 1;
        if (btyFromN === 1) {
          // existing row: .eq(user_id).eq(session_id).maybeSingle()
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: overrides.existingContractData ?? null,
                    error: overrides.existingContractError ?? null,
                  }),
                })),
              })),
            })),
          };
        }
        if (btyFromN === 2) {
          // family open row: .eq().eq().in().maybeSingle()
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: overrides.familyData ?? null,
                      error: overrides.familyError ?? null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        if (btyFromN === 3) {
          // could be reconcile OR insert depending on branch
          // reconcile: select().eq().eq().maybeSingle()
          // insert: insert().select().single()
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: overrides.reconcileData ?? null,
                    error: overrides.reconcileError ?? null,
                  }),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: overrides.insertData ?? null,
                  error: overrides.insertError ?? null,
                }),
              })),
            })),
          };
        }
        // fromN === 4: reconcile after insert attempt
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: overrides.reconcileData ?? null,
                  error: overrides.reconcileError ?? null,
                }),
              })),
            })),
          })),
        };
      }),
    } as never;
  }

  it("returns existing row when (user_id, session_id) matches", async () => {
    const admin = makeAdmin({
      existingContractData: { id: "contract-existing", status: "draft" },
    });
    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId, sessionId, scenarioId, primaryChoice, patternFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "contract-existing", created: false });
  });

  it("reuses open family row when it is the same arena session (session_id match)", async () => {
    const admin = makeAdmin({
      familyData: {
        id: "contract-fam",
        session_id: sessionId,
        action_id: `arena_action_loop:${sessionId}`,
      },
    });
    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId, sessionId, scenarioId, primaryChoice, patternFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "contract-fam", created: false });
  });

  it("reuses open family row when session_id differs but action_id matches this run", async () => {
    const admin = makeAdmin({
      familyData: {
        id: "contract-act",
        session_id: "different-stale",
        action_id: `arena_action_loop:${sessionId}`,
      },
    });
    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId, sessionId, scenarioId, primaryChoice, patternFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "contract-act", created: false });
  });

  it("returns open_contract_exists_for_family when family conflict is a different session", async () => {
    const admin = makeAdmin({
      familyData: {
        id: "other",
        session_id: "other-run",
        action_id: "arena_action_loop:other-run",
      },
      reconcileData: null,
    });
    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId, sessionId, scenarioId, primaryChoice, patternFamily,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected failure");
    expect(r.error).toBe("open_contract_exists_for_family");
  });
});
