/**
 * POST /api/arena/lab/complete — 401·400 (SPRINT 62 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

/*
  R9B.2: these routes now require CURRENT consent. This suite is about the route's own behaviour,
  and its subject has always been an ordinary consented learner — so the consent primitive says so
  explicitly. The consent VERDICT itself is proven by `requireConsentedUser.test.ts` and
  `learnerConsentGuard.route.test.ts`, which do not mock it.
*/
vi.mock("@/lib/legal/activeConsent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/activeConsent")>()),
  isConsentCurrent: async () => true,
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

vi.mock("@/lib/bty/arena/labUsage", () => ({
  getLabAttemptsUsed: vi.fn(),
  consumeLabAttempt: vi.fn(),
}));

vi.mock("@/engine/xp/lab-xp.service", () => ({
  awardLabXP: vi.fn().mockResolvedValue({ newCoreTotal: 500 }),
}));

import { consumeLabAttempt } from "@/lib/bty/arena/labUsage";
import { awardLabXP } from "@/engine/xp/lab-xp.service";

describe("POST /api/arena/lab/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/arena/lab/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: "easy" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/lab/complete", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_JSON");
  });

  /** S98 C3 TASK9: optional `completedOn` — `arenaIsoDateOnlyFromUnknown` rejects → 400. */
  it("returns 400 completed_on_invalid when completedOn is present but not a valid ISO date", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "easy", completedOn: "2024-02-30" }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("completed_on_invalid");
  });

  /** S108 C3 TASK9: optional `completedOn` — non-string (≠ S98 invalid date string) → 400. */
  it("returns 400 completed_on_invalid when completedOn is present but not a string", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "easy", completedOn: true }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("completed_on_invalid");
  });

  /** S121 C3 TASK9: optional `completedOn` — plain object (≠ S108 boolean · S114 number) → 400. */
  it("returns 400 completed_on_invalid when completedOn is an object", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "easy", completedOn: {} }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("completed_on_invalid");
  });

  /** S124 C3 TASK9: optional `completedOn` — JSON `null` (키 존재) (≠ S121 `{}`) → 400. */
  it("returns 400 completed_on_invalid when completedOn is JSON null", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "easy", completedOn: null }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("completed_on_invalid");
  });

  /**
   * S155 C3 TASK9: `completedOn` **bigint** — `arenaIsoDateOnlyFromUnknown` 비문자 → `null` (≠ **S114** `JSON.stringify` **number**).
   * 표준 JSON은 bigint를 직렬화하지 않으므로 런타임 파서가 넣는 값만 재현하기 위해 **`req.json()` 스텁**.
   */
  it("returns 400 completed_on_invalid when completedOn is bigint", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/lab/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const jsonSpy = vi.spyOn(req, "json").mockResolvedValue({
      difficulty: "easy",
      completedOn: BigInt(20240615),
    });
    try {
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("completed_on_invalid");
    } finally {
      jsonSpy.mockRestore();
    }
  });

  /** S114 C3 TASK9: optional `completedOn` — number (≠ S108 boolean) → 400. */
  it("returns 400 completed_on_invalid when completedOn is a number", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "easy", completedOn: 20240615 }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("completed_on_invalid");
  });

  /** S129 C3 TASK9: optional `completedOn` — array (≠ S114 number · S121 `{}`) → 400. */
  it("returns 400 completed_on_invalid when completedOn is an array", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "easy", completedOn: ["2024-06-15"] }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("completed_on_invalid");
  });

  /** S98 C3 TASK9: valid completedOn still proceeds (consume + core XP mocked). */
  it("returns 200 when completedOn is valid YYYY-MM-DD", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    vi.mocked(consumeLabAttempt).mockResolvedValue({ consumed: true, attemptsUsed: 1 });
    vi.mocked(awardLabXP).mockResolvedValue({ newCoreTotal: 500 });

    const res = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "easy", completedOn: "2024-06-15" }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  /** S89 C3 TASK9: domain difficulty → coreXp matches computeLabCoreXp. */
  it("returns 200 coreXp for mid when difficulty invalid; extreme when valid", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    vi.mocked(consumeLabAttempt).mockResolvedValue({ consumed: true, attemptsUsed: 1 });
    vi.mocked(awardLabXP).mockResolvedValue({ newCoreTotal: 500 });

    const { computeLabCoreXp } = await import("@/lib/bty/arena/arenaLabXp");
    const midXp = computeLabCoreXp("mid");
    const extremeXp = computeLabCoreXp("extreme");

    const r1 = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "not-a-difficulty" }),
      }),
    );
    expect(r1.status).toBe(200);
    expect((await r1.json()).coreXp).toBe(midXp);

    const r2 = await POST(
      new Request("http://localhost/api/arena/lab/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "extreme" }),
      }),
    );
    expect(r2.status).toBe(200);
    expect((await r2.json()).coreXp).toBe(extremeXp);
  });
});
