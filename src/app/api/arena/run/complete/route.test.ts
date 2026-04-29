import { describe, it, expect, vi, beforeEach } from "vitest";
import { ARENA_DAILY_XP_CAP } from "@/lib/bty/arena/activityXp";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applySeasonalXpToCore: vi.fn(),
  applyDirectCoreXp: vi.fn(),
}));

vi.mock("@/lib/bty/arena/weeklyQuest", () => ({
  getWeekStartUTC: () => "2026-03-02",
  REFLECTION_QUEST_TARGET: 3,
  REFLECTION_QUEST_BONUS_XP: 15,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/bty/action-contract/ensureActionContractForArenaRun", () => ({
  ensureActionContractForArenaRun: vi.fn(),
}));

vi.mock("@/lib/bty/pattern-engine/syncPatternStates", () => ({
  syncPatternStatesForUser: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/bty/pattern-engine/resolvePatternFamilyForContractTrigger", () => ({
  resolvePatternFamilyForContractTrigger: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/bty/arena/reflectionRewards.server", () => ({
  applyArenaRunRewardsOnVerifiedCompletion: vi.fn().mockResolvedValue({
    ok: true,
    applied: true,
    coreXp: 21,
    weeklyXp: 13,
    deltaApplied: 13,
  }),
}));

const { getSupabaseServerClient } = await import(
  "@/lib/bty/arena/supabaseServer"
);
const { applyDirectCoreXp } = await import(
  "@/lib/bty/arena/applyCoreXp"
);
const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
const { ensureActionContractForArenaRun } = await import(
  "@/lib/bty/action-contract/ensureActionContractForArenaRun"
);
const { applyArenaRunRewardsOnVerifiedCompletion } = await import(
  "@/lib/bty/arena/reflectionRewards.server"
);

// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/arena/run/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Builds a chainable Supabase-like query builder.
 * Every chain method returns `self`; awaiting or calling `.maybeSingle()`
 * resolves to `value`.
 */
function chainable(value: Record<string, unknown>) {
  const self: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "gte", "in", "limit", "order"]) {
    self[m] = () => self;
  }
  self.update = () => chainable(value);
  self.insert = () => chainable(value);
  self.maybeSingle = () => Promise.resolve(value);
  self.single = () => Promise.resolve(value);
  self.then = (
    ok: (v: unknown) => unknown,
    fail?: (e: unknown) => unknown,
  ) => Promise.resolve(value).then(ok, fail);
  return self;
}

function mockSupabase(user: { id: string } | null, flags?: { runAborted?: boolean }) {
  const callCounts: Record<string, number> = {};

  const sb = {
    auth: {
      getUser: () => Promise.resolve({ data: { user } }),
    },
    rpc: () => Promise.resolve({ error: null }),
    from: (table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const n = callCounts[table];

      if (table === "arena_runs") {
        if (n === 1) {
          if (flags?.runAborted) {
            return chainable({
              data: {
                run_id: "run-aborted",
                status: "IN_PROGRESS",
                scenario_id: "sc-1",
                meta: { aborted_at: "2026-01-01T00:00:00.000Z" },
              },
              error: null,
            });
          }
          return chainable({
            data: {
              run_id: "run-1",
              status: "IN_PROGRESS",
              scenario_id: "sc-1",
            },
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      }

      if (table === "arena_events") {
        if (n === 1)
          return chainable({ data: [], error: null });
        if (n === 2)
          return chainable({
            data: [{ xp: 60, event_type: "CHOICE" }],
            error: null,
          });
        if (n === 3)
          return chainable({ data: [{ xp: 60 }], error: null });
        if (n === 4)
          return chainable({ data: null, error: null });
        if (n === 5)
          return chainable({ count: 1, data: null, error: null });
        return chainable({ data: null, error: null });
      }

      if (table === "arena_profiles") {
        return chainable({
          data: { streak: 0 },
          error: null,
        });
      }

      if (table === "weekly_xp") {
        if (n === 1) {
          return chainable({
            data: { id: "wx-1", xp_total: 200 },
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      }

      return chainable({ data: null, error: null });
    },
  };

  (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
  return sb;
}

// ---------------------------------------------------------------------------

describe("POST /api/arena/run/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabaseAdmin).mockReturnValue({} as never);
    vi.mocked(ensureActionContractForArenaRun).mockResolvedValue({
      ok: true,
      contractId: null,
      created: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase(null);

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockSupabase(null);
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  /** C6 251: 비인증 401 짝 + 중단 런(meta.aborted_at) → 409 RUN_ABORTED. */
  it("251: returns 401 then 409 RUN_ABORTED when run has aborted_at in meta", async () => {
    mockSupabase(null);
    expect((await POST(makeRequest({ runId: "run-aborted" }))).status).toBe(401);
    mockSupabase({ id: "u1" }, { runAborted: true });
    const res = await POST(makeRequest({ runId: "run-aborted" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("RUN_ABORTED");
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("returns 400 with error as string when runId missing", async () => {
    mockSupabase({ id: "u1" });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 400 when runId is missing", async () => {
    mockSupabase({ id: "u1" });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("MISSING_RUN_ID");
  });

  it("returns 400 with JSON body containing only error key", async () => {
    mockSupabase({ id: "u1" });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when runId is not a string", async () => {
    mockSupabase({ id: "u1" });

    const res = await POST(makeRequest({ runId: 123 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("MISSING_RUN_ID");
  });

  /**
   * S148 C3 TASK9: `runId` **bigint** (≠ 위 **number** · **S147** `membership-request` `submitted_at`).
   * JSON 본문은 bigint를 담을 수 없어 `req.json()` 스텁으로 파싱 결과만 재현.
   */
  it("returns 400 MISSING_RUN_ID when runId is bigint", async () => {
    mockSupabase({ id: "u1" });
    const req = new Request("http://localhost/api/arena/run/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    vi.spyOn(req, "json").mockResolvedValue({ runId: BigInt(1) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("MISSING_RUN_ID");
  });

  it("returns 200 with deltaApplied >= 0", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.deltaApplied).toBe("number");
    expect(data.deltaApplied).toBeGreaterThanOrEqual(0);
  });

  it("returns 200 with content-type application/json", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with weeklyXp as number", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.weeklyXp).toBe("number");
  });

  it("returns 200 with weeklyXp >= 0", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.weeklyXp).toBeGreaterThanOrEqual(0);
  });

  it("returns 200 with ok true on success", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 200 with deltaApplied as number", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.deltaApplied).toBe("number");
  });

  it("returns 200 with correct response structure on success", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({
      newCoreTotal: 201,
    });

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.runId).toBe("run-1");
    expect(data.status).toBe("DONE");
    expect(typeof data.deltaApplied).toBe("number");
    expect(data.deltaApplied).toBeGreaterThanOrEqual(0);
    expect(typeof data.coreXp).toBe("number");
    expect(typeof data.weeklyXp).toBe("number");
  });

  it("returns 200 with runId as string", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.runId).toBe("string");
    expect(data.runId).toBe("run-1");
  });

  it("returns 200 with status DONE on success", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("DONE");
  });

  it("returns 200 with coreXp as number >= 0", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.coreXp).toBe("number");
    expect(data.coreXp).toBeGreaterThanOrEqual(0);
  });

  it("returns 200 with expected response keys (ok, runId, status, deltaApplied, coreXp, weeklyXp, action contract flags)", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const expectedKeys = [
      "actionContractCreated",
      "action_contract",
      "contractId",
      "coreXp",
      "deltaApplied",
      "gates",
      "mode",
      "myPageRefetchRequired",
      "ok",
      "runId",
      "runtime_state",
      "state_priority",
      "status",
      "weeklyXp",
      "xpDeferredToContractVerification",
    ].sort();
    expect(Object.keys(data).sort()).toEqual(expectedKeys);
    expect(data.runtime_state).toBe("NEXT_SCENARIO_READY");
    expect(data.mode).toBe("arena");
    expect(data.actionContractCreated).toBe(false);
    expect(data.myPageRefetchRequired).toBe(true);
  });

  it("applies run rewards via reflection service for non-contract completion", async () => {
    mockSupabase({ id: "u1" });

    await POST(makeRequest({ runId: "run-1" }));

    expect(applyArenaRunRewardsOnVerifiedCompletion).toHaveBeenCalledOnce();
    expect(applyArenaRunRewardsOnVerifiedCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        run: expect.objectContaining({ run_id: "run-1" }),
      }),
    );
  });

  it("calls ensureActionContractForArenaRun on first completion with userId, runId, scenarioId", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    vi.mocked(ensureActionContractForArenaRun).mockResolvedValue({
      ok: true,
      created: true,
      contractId: "contract-new-1",
    });

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(ensureActionContractForArenaRun).toHaveBeenCalledWith({
      userId: "u1",
      runId: "run-1",
      scenarioId: "sc-1",
      nbaLogId: null,
      patternFamily: null,
    });
    expect(data.actionContractCreated).toBe(true);
    expect(data.myPageRefetchRequired).toBe(true);
    expect(data.contractId).toBe("contract-new-1");
  });

  it("returns 200 with idempotent flag when run already applied", async () => {
    const callCounts: Record<string, number> = {};
    const sb = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: (table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const n = callCounts[table];

        if (table === "arena_runs") {
          return chainable({
            data: {
              run_id: "run-1",
              status: "DONE",
              scenario_id: "sc-1",
            },
            error: null,
          });
        }
        if (table === "arena_events" && n === 1) {
          return chainable({
            data: [{ event_id: "ev-already" }],
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      },
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      sb,
    );

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.idempotent).toBe(true);
    expect(applyDirectCoreXp).not.toHaveBeenCalled();
    expect(ensureActionContractForArenaRun).toHaveBeenCalledWith({
      userId: "u1",
      runId: "run-1",
      scenarioId: "sc-1",
      nbaLogId: null,
      patternFamily: null,
    });
  });

  it("idempotent: RUN_COMPLETED_APPLIED + admin unavailable (ensure ok:false) — 200, actionContractCreated false", async () => {
    vi.mocked(ensureActionContractForArenaRun).mockResolvedValue({
      ok: false,
      contractId: null,
      created: false,
    });
    const callCounts: Record<string, number> = {};
    const sb = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: (table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const n = callCounts[table];

        if (table === "arena_runs") {
          return chainable({
            data: {
              run_id: "run-1",
              status: "DONE",
              scenario_id: "sc-1",
            },
            error: null,
          });
        }
        if (table === "arena_events" && n === 1) {
          return chainable({
            data: [{ event_id: "ev-already" }],
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      },
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      sb,
    );

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.idempotent).toBe(true);
    expect(data.actionContractCreated).toBe(false);
    expect(data.contractId).toBeNull();
    expect(ensureActionContractForArenaRun).toHaveBeenCalled();
  });

  it("idempotent: RUN_COMPLETED_APPLIED + repairs contract — ensure returns created:true", async () => {
    vi.mocked(ensureActionContractForArenaRun).mockResolvedValue({
      ok: true,
      contractId: "recovered-uuid",
      created: true,
    });
    const callCounts: Record<string, number> = {};
    const sb = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: (table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const n = callCounts[table];

        if (table === "arena_runs") {
          return chainable({
            data: {
              run_id: "run-1",
              status: "DONE",
              scenario_id: "sc-1",
            },
            error: null,
          });
        }
        if (table === "arena_events" && n === 1) {
          return chainable({
            data: [{ event_id: "ev-already" }],
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      },
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      sb,
    );

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.idempotent).toBe(true);
    expect(data.actionContractCreated).toBe(true);
    expect(data.contractId).toBe("recovered-uuid");
    expect(data.myPageRefetchRequired).toBe(true);
    expect(applyDirectCoreXp).not.toHaveBeenCalled();
  });

  it("idempotent: contract already exists — actionContractCreated false", async () => {
    vi.mocked(ensureActionContractForArenaRun).mockResolvedValue({
      ok: true,
      contractId: "existing-uuid",
      created: false,
    });
    const callCounts: Record<string, number> = {};
    const sb = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: (table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const n = callCounts[table];

        if (table === "arena_runs") {
          return chainable({
            data: {
              run_id: "run-1",
              status: "DONE",
              scenario_id: "sc-1",
            },
            error: null,
          });
        }
        if (table === "arena_events" && n === 1) {
          return chainable({
            data: [{ event_id: "ev-already" }],
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      },
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      sb,
    );

    const res = await POST(makeRequest({ runId: "run-1" }));
    const data = await res.json();
    expect(data.actionContractCreated).toBe(false);
    expect(data.contractId).toBe("existing-uuid");
  });

  it("first completion: ensure fails after XP — 200, actionContractCreated false", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    vi.mocked(ensureActionContractForArenaRun).mockResolvedValue({
      ok: false,
      contractId: null,
      created: false,
    });

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.actionContractCreated).toBe(false);
    expect(data.myPageRefetchRequired).toBe(true);
  });

  it("defers XP when action contract exists (verified stage applies XP)", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(ensureActionContractForArenaRun).mockResolvedValue({
      ok: true,
      contractId: "contract-pending-1",
      created: true,
    });

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.xpDeferredToContractVerification).toBe(true);
    expect(data.coreXp).toBe(0);
    expect(data.weeklyXp).toBe(0);
    expect(data.deltaApplied).toBe(0);
    expect(applyArenaRunRewardsOnVerifiedCompletion).not.toHaveBeenCalled();
  });

  it("returns 404 when run does not exist", async () => {
    const sb = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: () =>
        chainable({ data: null, error: null }),
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      sb,
    );

    const res = await POST(makeRequest({ runId: "nonexistent" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("NOT_FOUND");
  });

  it("returns 404 with JSON body containing only error key", async () => {
    const sb = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: () =>
        chainable({ data: null, error: null }),
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      sb,
    );
    const res = await POST(makeRequest({ runId: "missing" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  /** C6 243: 404 NOT_FOUND vs 이미 완료 멱등 200(델타 필드 없음). */
  it("243: unknown run NOT_FOUND; applied run returns idempotent without delta fields", async () => {
    const sb404 = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: () => chainable({ data: null, error: null }),
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(sb404);
    const r404 = await POST(makeRequest({ runId: "ghost-run" }));
    expect(r404.status).toBe(404);
    expect((await r404.json()).error).toBe("NOT_FOUND");

    const callCounts: Record<string, number> = {};
    const sb200 = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      rpc: () => Promise.resolve({ error: null }),
      from: (table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const n = callCounts[table];
        if (table === "arena_runs") {
          return chainable({
            data: { run_id: "run-done", status: "DONE", scenario_id: "sc-1" },
            error: null,
          });
        }
        if (table === "arena_events" && n === 1) {
          return chainable({ data: [{ event_id: "ev-applied" }], error: null });
        }
        return chainable({ data: null, error: null });
      },
    };
    (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(sb200);
    const r200 = await POST(makeRequest({ runId: "run-done" }));
    expect(r200.status).toBe(200);
    const j = await r200.json();
    expect(j).toMatchObject({
      ok: true,
      runId: "run-done",
      status: "DONE",
      idempotent: true,
      myPageRefetchRequired: true,
    });
    expect("deltaApplied" in j).toBe(false);
    expect("coreXp" in j).toBe(false);
  });
});
