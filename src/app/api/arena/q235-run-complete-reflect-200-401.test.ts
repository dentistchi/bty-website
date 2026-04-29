/**
 * SPRINT 235 C6: POST run/complete + POST reflect — 200·401 batch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as postComplete } from "./run/complete/route";
import { POST as postReflect } from "./reflect/route";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(),
  applySeasonalXpToCore: vi.fn(),
}));

vi.mock("@/lib/bty/arena/weeklyQuest", () => ({
  getWeekStartUTC: () => "2026-03-02",
  REFLECTION_QUEST_TARGET: 3,
  REFLECTION_QUEST_BONUS_XP: 15,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({})),
}));

vi.mock("@/lib/bty/action-contract/ensureActionContractForArenaRun", () => ({
  ensureActionContractForArenaRun: vi.fn().mockResolvedValue({
    ok: true,
    contractId: null,
    created: false,
  }),
}));

const { getSupabaseServerClient } = await import(
  "@/lib/bty/arena/supabaseServer"
);
const { applyDirectCoreXp } = await import("@/lib/bty/arena/applyCoreXp");

function chainable(value: Record<string, unknown>) {
  const self: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "gte", "in", "limit", "order"]) {
    self[m] = () => self;
  }
  self.update = () => chainable(value);
  self.insert = () => chainable(value);
  self.maybeSingle = () => Promise.resolve(value);
  self.single = () => Promise.resolve(value);
  self.then = (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
    Promise.resolve(value).then(ok, fail);
  return self;
}

function mockSupabaseComplete(user: { id: string } | null) {
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
        if (n === 1) return chainable({ data: [], error: null });
        if (n === 2)
          return chainable({
            data: [{ xp: 60, event_type: "CHOICE" }],
            error: null,
          });
        if (n === 3) return chainable({ data: [{ xp: 60 }], error: null });
        if (n === 4) return chainable({ data: null, error: null });
        if (n === 5)
          return chainable({ count: 1, data: null, error: null });
        return chainable({ data: null, error: null });
      }
      if (table === "arena_profiles") {
        return chainable({ data: { streak: 0 }, error: null });
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
  vi.mocked(getSupabaseServerClient).mockResolvedValue(sb as never);
}

function postCompleteReq(body: unknown) {
  return new Request("http://localhost/api/arena/run/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function postReflectReq(body: unknown) {
  return new Request("http://localhost/api/arena/reflect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Q235 POST run/complete · reflect — 200·401", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401: unauthenticated run/complete and reflect", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    } as never);

    const r1 = await postComplete(postCompleteReq({ runId: "run-1" }));
    expect(r1.status).toBe(401);

    const r2 = await postReflect(
      postReflectReq({ levelId: "S1", userText: "hello" }),
    );
    expect(r2.status).toBe(401);
  });

  it("200: run/complete success then reflect with S1", async () => {
    mockSupabaseComplete({ id: "u1" });
    vi.mocked(applyDirectCoreXp).mockResolvedValue({ newCoreTotal: 201 });
    const r1 = await postComplete(postCompleteReq({ runId: "run-1" }));
    expect(r1.status).toBe(200);

    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);

    const r2 = await postReflect(
      postReflectReq({ levelId: "S1", userText: "Team conflict today" }),
    );
    expect(r2.status).toBe(200);
    const j = await r2.json();
    expect(j.ok).toBe(true);
    expect(Array.isArray(j.questions)).toBe(true);
    expect(typeof j.summary).toBe("string");
  });
});
