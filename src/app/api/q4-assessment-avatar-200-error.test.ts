/**
 * Q4: POST assessment/submit (401 에러), GET arena/avatar-assets (200).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetLetterAuth = vi.fn();
vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  submitAssessment: vi.fn(),
}));

function validAnswers(): Record<string, number> {
  const out: Record<string, number> = {};
  for (let q = 1; q <= 50; q++) out[String(q)] = 3;
  return out;
}

const { POST: postAssessment } = await import("./assessment/submit/route");
const { GET: getAvatarAssets } = await import("./arena/avatar-assets/route");

describe("Q4 assessment/submit · avatar-assets — 200·에러", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLetterAuth.mockResolvedValue(null);
  });

  it("assessment 401 when unauthenticated; avatar-assets 200 public", async () => {
    const r1 = await postAssessment(
      new Request("http://localhost/api/assessment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: validAnswers() }),
      }),
    );
    expect(r1.status).toBe(401);
    expect((await r1.json()).error).toBe("UNAUTHENTICATED");

    const r2 = await getAvatarAssets();
    expect(r2.status).toBe(200);
    const j2 = await r2.json();
    expect(j2).toHaveProperty("accessories");
    expect(j2).toHaveProperty("outfits");
  });
});
