import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockLoadScenario = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  copyCookiesAndDebug: vi.fn(),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
}));

vi.mock("@/lib/bty/arena/scenarioPayloadFromDb", () => ({
  getSupabaseScenarioReader: vi.fn(() => null),
  loadArenaScenarioPayloadFromDb: (...args: unknown[]) => mockLoadScenario(...args),
}));

function makeSupabaseMock() {
  return {
    from: (table: string) => {
      if (table === "user_scenario_choice_history") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [{ id: "hist-1" }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "arena_pending_outcomes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  lte: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: { id: "pending-1" }, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({
    user: { id: "user-1" },
    base: new Response(),
    supabase: makeSupabaseMock(),
  });
});

function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as unknown as import("next/server").NextRequest;
}

describe("GET /api/arena/re-exposure/[scenarioId]", () => {
  it("allows canonical core scenario id", async () => {
    mockLoadScenario.mockResolvedValueOnce({
      scenarioId: "core_01_training_system_exposure",
      dbScenarioId: "INCIDENT-01-OWN-01",
      title: "Core 01",
      context: "ctx",
      choices: [],
      escalationBranches: {},
      source: "json",
    });
    const res = await GET(makeNextRequest("http://localhost/api/arena/re-exposure/core_01_training_system_exposure?locale=en"), {
      params: Promise.resolve({ scenarioId: "core_01_training_system_exposure" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect((json.scenario as Record<string, unknown>).source).toBe("json");
    expect((json.scenario as Record<string, unknown>).dbScenarioId).toBe("INCIDENT-01-OWN-01");
  });

  it("returns 404 for unsupported scenario id", async () => {
    mockLoadScenario.mockResolvedValueOnce(null);
    const res = await GET(makeNextRequest("http://localhost/api/arena/re-exposure/not_supported?locale=en"), {
      params: Promise.resolve({ scenarioId: "not_supported" }),
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("reexposure_scenario_not_found");
  });

  it("keeps legacy elite scenario path when payload exists", async () => {
    mockLoadScenario.mockResolvedValueOnce({
      scenarioId: "OWN-RE-02-R1",
      dbScenarioId: "OWN-RE-02-R1",
      title: "Legacy Elite",
      context: "ctx",
      choices: [],
      escalationBranches: {},
      source: "json",
    });
    const res = await GET(makeNextRequest("http://localhost/api/arena/re-exposure/OWN-RE-02-R1?locale=en"), {
      params: Promise.resolve({ scenarioId: "OWN-RE-02-R1" }),
    });
    expect(res.status).toBe(200);
  });
});
