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
}));

vi.mock("@/lib/bty/arena/weeklyQuest", () => ({
  getWeekStartUTC: () => "2026-03-02",
  REFLECTION_QUEST_TARGET: 3,
  REFLECTION_QUEST_BONUS_XP: 15,
}));

const { getSupabaseServerClient } = await import(
  "@/lib/bty/arena/supabaseServer"
);
const { applySeasonalXpToCore } = await import(
  "@/lib/bty/arena/applyCoreXp"
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

function mockSupabase(user: { id: string } | null) {
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
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase(null);

    const res = await POST(makeRequest({ runId: "run-1" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when runId is missing", async () => {
    mockSupabase({ id: "u1" });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("MISSING_RUN_ID");
  });

  it("returns 400 when runId is not a string", async () => {
    mockSupabase({ id: "u1" });

    const res = await POST(makeRequest({ runId: 123 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("MISSING_RUN_ID");
  });

  it("returns 200 with correct response structure on success", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applySeasonalXpToCore).mockResolvedValue({
      coreGain: 1,
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
  });

  it("calls applySeasonalXpToCore with capped delta", async () => {
    mockSupabase({ id: "u1" });
    vi.mocked(applySeasonalXpToCore).mockResolvedValue({
      coreGain: 1,
      newCoreTotal: 201,
    });

    await POST(makeRequest({ runId: "run-1" }));

    expect(applySeasonalXpToCore).toHaveBeenCalledOnce();
    const [, userId, delta] = vi.mocked(applySeasonalXpToCore).mock.calls[0];
    expect(userId).toBe("u1");
    expect(typeof delta).toBe("number");
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThanOrEqual(ARENA_DAILY_XP_CAP);
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
    expect(applySeasonalXpToCore).not.toHaveBeenCalled();
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
});
