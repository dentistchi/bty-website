/**
 * GET /api/bty-arena/scenario — 404·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetScenarioById = vi.fn();
const mockGetRandomScenario = vi.fn();
vi.mock("@/lib/bty/scenario/engine", () => ({
  getScenarioById: (...args: unknown[]) => mockGetScenarioById(...args),
  getRandomScenario: (...args: unknown[]) => mockGetRandomScenario(...args),
}));

function makeRequest(params?: { id?: string; exclude?: string }): Request {
  const url = new URL("http://localhost/api/bty-arena/scenario");
  if (params?.id) url.searchParams.set("id", params.id);
  if (params?.exclude) url.searchParams.set("exclude", params.exclude);
  return new Request(url.toString(), { method: "GET" });
}

describe("GET /api/bty-arena/scenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when scenario not found by id", async () => {
    mockGetScenarioById.mockReturnValue(null);

    const res = await GET(makeRequest({ id: "missing" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Scenario not found");
    expect(mockGetScenarioById).toHaveBeenCalledWith("missing");
  });

  it("returns 200 with scenario when id provided", async () => {
    const scenario = { id: "s1", title: "Test", body: "Body" };
    mockGetScenarioById.mockReturnValue(scenario);

    const res = await GET(makeRequest({ id: "s1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.scenario).toEqual(scenario);
    expect(mockGetRandomScenario).not.toHaveBeenCalled();
  });

  it("returns 200 with scenario when no id (random)", async () => {
    const scenario = { id: "r1", title: "Random", body: "Content" };
    mockGetRandomScenario.mockReturnValue(scenario);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.scenario).toEqual(scenario);
    expect(mockGetRandomScenario).toHaveBeenCalledWith([]);
  });

  it("passes exclude param to getRandomScenario", async () => {
    mockGetRandomScenario.mockReturnValue({ id: "r2", title: "R2" });

    await GET(makeRequest({ exclude: "a,b,c" }));
    expect(mockGetRandomScenario).toHaveBeenCalledWith(["a", "b", "c"]);
  });
});
