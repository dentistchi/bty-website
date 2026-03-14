/**
 * POST /api/bty-arena/submit — 200·500.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockComputeResult = vi.fn();
vi.mock("@/lib/bty/scenario/engine", () => ({
  computeResult: (...args: unknown[]) => mockComputeResult(...args),
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
    const result = { ok: true, score: 10, feedback: "Good" };
    mockComputeResult.mockReturnValue(result);

    const res = await POST(makeRequest({ scenarioId: "s1", choiceId: "B" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(result);
    expect(mockComputeResult).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioId: "s1", choiceId: "B" })
    );
  });

  it("returns 500 when computeResult throws", async () => {
    mockComputeResult.mockImplementation(() => {
      throw new Error("Scenario not found");
    });

    const res = await POST(makeRequest({ scenarioId: "missing", choiceId: "A" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Scenario not found");
  });
});
