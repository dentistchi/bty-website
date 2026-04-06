/**
 * @vitest-environment node
 */
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

  it("returns existing row when (user_id, session_id) matches", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "contract-existing", status: "draft" },
      error: null,
    });
    const admin = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle }),
          }),
        }),
      })),
    } as never;

    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId,
      sessionId,
      scenarioId,
      primaryChoice,
      patternFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "contract-existing", created: false });
  });

  function makeAdminForFamilyBranch(
    existingData: { data: unknown; error: unknown },
    familyMaybeSingle: ReturnType<typeof vi.fn>,
    reconcileMaybeSingle?: ReturnType<typeof vi.fn>,
  ) {
    let fromN = 0;
    return {
      from: vi.fn(() => {
        fromN += 1;
        if (fromN === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: vi.fn().mockResolvedValue(existingData) }),
              }),
            }),
          };
        }
        if (fromN === 2) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({ maybeSingle: familyMaybeSingle }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: reconcileMaybeSingle ?? vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }),
    } as never;
  }

  it("reuses open family row when it is the same arena session (session_id match)", async () => {
    let ms = 0;
    const familyMs = vi.fn().mockImplementation(() => {
      ms += 1;
      return Promise.resolve({
        data: {
          id: "contract-fam",
          session_id: sessionId,
          action_id: `arena_action_loop:${sessionId}`,
        },
        error: null,
      });
    });
    const admin = makeAdminForFamilyBranch({ data: null, error: null }, familyMs);

    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId,
      sessionId,
      scenarioId,
      primaryChoice,
      patternFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "contract-fam", created: false });
    expect(ms).toBe(1);
  });

  it("reuses open family row when session_id differs but action_id matches this run", async () => {
    let ms = 0;
    const familyMs = vi.fn().mockImplementation(() => {
      ms += 1;
      return Promise.resolve({
        data: {
          id: "contract-act",
          session_id: "different-stale",
          action_id: `arena_action_loop:${sessionId}`,
        },
        error: null,
      });
    });
    const admin = makeAdminForFamilyBranch({ data: null, error: null }, familyMs);

    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId,
      sessionId,
      scenarioId,
      primaryChoice,
      patternFamily,
    });
    expect(r).toEqual({ ok: true, contractId: "contract-act", created: false });
    expect(ms).toBe(1);
  });

  it("returns open_contract_exists_for_family when family conflict is a different session", async () => {
    let famCalls = 0;
    const familyMs = vi.fn().mockImplementation(() => {
      famCalls += 1;
      return Promise.resolve({
        data: {
          id: "other",
          session_id: "other-run",
          action_id: "arena_action_loop:other-run",
        },
        error: null,
      });
    });
    let recCalls = 0;
    const reconcileMs = vi.fn().mockImplementation(() => {
      recCalls += 1;
      return Promise.resolve({ data: null, error: null });
    });
    const admin = makeAdminForFamilyBranch({ data: null, error: null }, familyMs, reconcileMs);

    const r = await ensureDraftActionContractWithAdmin(admin, {
      userId,
      sessionId,
      scenarioId,
      primaryChoice,
      patternFamily,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected failure");
    expect(r.error).toBe("open_contract_exists_for_family");
    expect(famCalls).toBe(1);
    expect(recCalls).toBe(1);
  });
});
