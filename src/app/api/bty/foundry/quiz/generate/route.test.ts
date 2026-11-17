import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const { generateQuizDraft, rateLimitKV } = vi.hoisted(() => ({
  generateQuizDraft: vi.fn(),
  rateLimitKV: vi.fn(),
}));

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: { id: "training-author" }, base: NextResponse.json({}) }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitKV }));
vi.mock("@/lib/bty/foundry/events/quickTrainingQuizGeneration", () => ({ generateQuizDraft }));

function request() {
  return new NextRequest("http://localhost/api/bty/foundry/quiz/generate", {
    method: "POST",
    body: JSON.stringify({ sourceText: "Course material", questionCount: 3, locale: "en" }),
  });
}

beforeEach(() => vi.resetAllMocks());

describe("Quick Training quiz generation", () => {
  it("uses the session author for throttling and forwards the material to the generator", async () => {
    rateLimitKV.mockResolvedValue({ allowed: true });
    generateQuizDraft.mockResolvedValue({ ok: true });
    expect((await POST(request())).status).toBe(200);
    expect(rateLimitKV).toHaveBeenCalledWith(expect.objectContaining({ identifier: "training-author" }));
    expect(generateQuizDraft).toHaveBeenCalledWith("Course material", 3, "en");
  });

  it("blocks the provider call when the author exceeds their limit", async () => {
    rateLimitKV.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(generateQuizDraft).not.toHaveBeenCalled();
  });
});
