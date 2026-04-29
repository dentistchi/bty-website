/**
 * Q3: GET dojo/questions (200), POST dojo/integrity/submit (401·에러).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

const mockGetSupabaseServerClient = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

const mockSubmitIntegrity = vi.fn();
vi.mock("@/lib/bty/foundry/integritySubmitService", () => ({
  submitIntegrity: (...args: unknown[]) => mockSubmitIntegrity(...args),
}));

const { GET: getQuestions } = await import("./questions/route");
const { POST: postIntegrity } = await import("./integrity/submit/route");

function integrityReq(body: unknown): Request {
  return new Request("http://localhost/api/dojo/integrity/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("Q3 dojo/questions · integrity/submit — 200·에러", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitIntegrity.mockReset();
  });

  it("questions 200 empty; integrity 401 unauth; integrity 400 invalid JSON when authed", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const q = await getQuestions();
    expect(q.status).toBe(200);
    const jq = await q.json();
    expect(Array.isArray(jq.questions)).toBe(true);
    expect(jq.choiceValues).toEqual([1, 2, 3, 4, 5]);

    const i401 = await postIntegrity(integrityReq({ text: "x" }));
    expect(i401.status).toBe(401);
    expect((await i401.json()).error).toBe("UNAUTHENTICATED");
    expect(mockSubmitIntegrity).not.toHaveBeenCalled();

    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const i400 = await postIntegrity(
      integrityReq("not json {") as Request,
    );
    expect(i400.status).toBe(400);
    expect((await i400.json()).error).toBe("invalid_body");
  });
});
