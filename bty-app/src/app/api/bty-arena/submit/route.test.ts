/**
 * POST /api/bty-arena/submit — 200·503·500.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockResolve = vi.fn();
vi.mock("@/lib/bty/arena/arenaScenarioResolve.server", () => ({
  resolveArenaScenarioForAnonymousSubmit: (...args: unknown[]) => mockResolve(...args),
}));

const mockComputeResultFromScenario = vi.fn();
vi.mock("@/lib/bty/scenario/engine", () => ({
  computeResultFromScenario: (...args: unknown[]) => mockComputeResultFromScenario(...args),
}));

function makeRequest(body: { scenarioId: string; choiceId: "A" | "B" | "C" | "D"; locale?: string }): Request {
  return new Request("http://localhost/api/bty-arena/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bty-arena/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with result on success", async () => {
    const scenario = { scenarioId: "s1", choices: [] };
    const result = { ok: true, scenarioId: "s1", choiceId: "B", xpEarned: 10 };
    mockResolve.mockResolvedValue(scenario);
    mockComputeResultFromScenario.mockReturnValue(result);

    const res = await POST(makeRequest({ scenarioId: "s1", choiceId: "B" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(result);
    expect(mockResolve).toHaveBeenCalledWith("s1", "en");
    expect(mockComputeResultFromScenario).toHaveBeenCalledWith(
      scenario,
      expect.objectContaining({ scenarioId: "s1", choiceId: "B" }),
    );
  });

  it("returns 503 when scenario cannot be resolved (no legacy fallback)", async () => {
    mockResolve.mockResolvedValue(null);

    const res = await POST(makeRequest({ scenarioId: "missing", choiceId: "A" }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.code).toBe("scenario_payload_missing");
    expect(mockComputeResultFromScenario).not.toHaveBeenCalled();
  });

  it("returns 500 when computeResultFromScenario throws", async () => {
    mockResolve.mockResolvedValue({ scenarioId: "s1", choices: [] });
    mockComputeResultFromScenario.mockImplementation(() => {
      throw new Error("Choice not found");
    });

    const res = await POST(makeRequest({ scenarioId: "s1", choiceId: "A" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Choice not found");
  });
});
