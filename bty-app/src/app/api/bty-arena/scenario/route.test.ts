/**
 * GET /api/bty-arena/scenario — 404·200·400 (no random / legacy).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockReader = {};
const mockLoad = vi.fn();

vi.mock("@/lib/bty/arena/scenarioPayloadFromDb", () => ({
  getSupabaseScenarioReader: vi.fn(() => mockReader),
  loadArenaScenarioPayloadFromDb: (...args: unknown[]) => mockLoad(...args),
}));

function makeRequest(params?: { id?: string; locale?: string }): Request {
  const url = new URL("http://localhost/api/bty-arena/scenario");
  if (params?.id) url.searchParams.set("id", params.id);
  if (params?.locale) url.searchParams.set("locale", params.locale);
  return new Request(url.toString(), { method: "GET" });
}

describe("GET /api/bty-arena/scenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id missing (random disabled)", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.code).toBe("legacy_catalog_blocked");
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("returns 404 when scenario not found in DB", async () => {
    mockLoad.mockResolvedValue(null);

    const res = await GET(makeRequest({ id: "missing" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Scenario not found");
    expect(mockLoad).toHaveBeenCalledWith(mockReader, "missing", "en");
  });

  it("returns 200 with scenario when id provided", async () => {
    const scenario = {
      scenarioId: "s1",
      title: "Test",
      context: "Body",
      choices: [],
    };
    mockLoad.mockResolvedValue(scenario);

    const res = await GET(makeRequest({ id: "s1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.scenario).toEqual(scenario);
  });

  it("passes ko locale to loader", async () => {
    mockLoad.mockResolvedValue({ scenarioId: "s1", title: "T", context: "C", choices: [] });

    await GET(makeRequest({ id: "s1", locale: "ko" }));
    expect(mockLoad).toHaveBeenCalledWith(mockReader, "s1", "ko");
  });
});
