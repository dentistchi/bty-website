/**
 * POST /api/arena/sub-name — 401·400·404 (서브네임 변경; S102 optional `scenarioOutcomes`·S93 INVALID_JSON·도메인 경계).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));

function makePostRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/arena/sub-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/arena/sub-name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await POST(makePostRequest({ subName: "Valid" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when subName is empty", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "   " }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_SUB_NAME");
    expect(data.reason).toBe("EMPTY");
  });

  it("returns 400 when subName exceeds 7 chars", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "EightChar" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_SUB_NAME");
    expect(data.reason).toBe("MAX_7_CHARS");
  });

  /** S102 C3 TASK9: optional `scenarioOutcomes` — `arenaScenarioOutcomesFromUnknown` rejects → 400. */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes is present but empty", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "Valid", scenarioOutcomes: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /** S106 C3 TASK9: optional `scenarioOutcomes` — array (≠ S102 plain empty object) → 400. */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes is an array", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "Valid", scenarioOutcomes: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /** S111 C3 TASK9: optional `scenarioOutcomes` — string (≠ object/array) → 400. */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes is a string", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      makePostRequest({ subName: "Valid", scenarioOutcomes: "not-an-object" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /** S131 C3 TASK9: optional `scenarioOutcomes` — empty string (≠ S111 non-empty string) → 400. */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes is an empty string", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      makePostRequest({ subName: "Valid", scenarioOutcomes: "" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /** S115 C3 TASK9: optional `scenarioOutcomes` — number (≠ S111 string·S106 array·S102 object) → 400. */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes is a number", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      makePostRequest({ subName: "Valid", scenarioOutcomes: 42 }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /** S122 C3 TASK9: optional `scenarioOutcomes` — JSON `null` (키 존재, ≠ S115 number) → 400. */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes is JSON null", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      makePostRequest({ subName: "Valid", scenarioOutcomes: null }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /** S126 C3 TASK9: optional `scenarioOutcomes` — boolean (≠ S122 null · S115 number) → 400. */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes is boolean", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      makePostRequest({ subName: "Valid", scenarioOutcomes: true }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /**
   * S141 C3 TASK9: optional `scenarioOutcomes` — **duplicate canonical keys** (`A_X` vs `" A_X"`) (≠ **S135** `A_X: {}` · **S102** 바깥 `{}`) → 400.
   */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes has duplicate canonical outcome keys", async () => {
    const minimal = {
      interpretation: ["one"],
      systemMessage: "SYSTEM // ok",
      activatedStats: ["Integrity"],
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      makePostRequest({
        subName: "Valid",
        scenarioOutcomes: {
          A_X: minimal,
          " A_X": { ...minimal, interpretation: ["two"] },
        },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /**
   * S135 C3 TASK9: optional `scenarioOutcomes` — 유효 키 하나 + **빈 outcome 객체** (≠ **S102** 바깥 `{}` · **S134** free-response) → 400.
   */
  it("returns 400 scenario_outcomes_invalid when scenarioOutcomes has a valid key but empty outcome object", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      makePostRequest({ subName: "Valid", scenarioOutcomes: { A_X: {} } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_outcomes_invalid");
  });

  /** S86 C3 TASK9: disallowed characters → INVALID_CHARS. */
  it("returns 400 INVALID_SUB_NAME when subName has invalid characters", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "a@b" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_SUB_NAME");
    expect(data.reason).toBe("INVALID_CHARS");
  });

  /** S93 TASK9: `arenaSubNameFromUnknown` — INVALID_JSON; omitted/null → EMPTY; MAX_7 vs INVALID at length 7/8. */
  it("returns 400 INVALID_JSON when body is not valid JSON", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      new NextRequest("http://localhost/api/arena/sub-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_JSON");
  });

  it("returns 400 EMPTY when subName is omitted or JSON null", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const resOmit = await POST(makePostRequest({}));
    expect(resOmit.status).toBe(400);
    expect(await resOmit.json()).toEqual({
      error: "INVALID_SUB_NAME",
      reason: "EMPTY",
    });
    const resNull = await POST(makePostRequest({ subName: null as unknown as string }));
    expect(resNull.status).toBe(400);
    expect(await resNull.json()).toEqual({
      error: "INVALID_SUB_NAME",
      reason: "EMPTY",
    });
  });

  it("returns 400 INVALID_CHARS at 7 chars and MAX_7_CHARS at 8 when trailing @", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res7 = await POST(makePostRequest({ subName: "xxxxxx@" }));
    expect(res7.status).toBe(400);
    expect((await res7.json()).reason).toBe("INVALID_CHARS");
    const res8 = await POST(makePostRequest({ subName: "xxxxxxx@" }));
    expect(res8.status).toBe(400);
    expect((await res8.json()).reason).toBe("MAX_7_CHARS");
  });

  /** SPRINT 49 TASK 9 / 255: 프로필 없음 → 404. */
  it("returns 404 when arena_profiles row missing", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "Nick" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("NOT_FOUND");
  });
});
