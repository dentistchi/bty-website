/**
 * GET /api/arena/lab/usage — 401·200 (SPRINT 60 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLabAttemptsUsed } from "@/lib/bty/arena/labUsage";
import { GET } from "./route";

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
}));

describe("GET /api/arena/lab/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 200 with usage fields when authenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u-lab" } } }),
      },
    });
    vi.mocked(getLabAttemptsUsed).mockResolvedValue(2);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.limit).toBe("number");
    expect(data.attemptsUsed).toBe(2);
    expect(data.attemptsRemaining).toBe(
      Math.max(0, data.limit - data.attemptsUsed)
    );
    expect(getLabAttemptsUsed).toHaveBeenCalledWith(
      expect.anything(),
      "u-lab"
    );
  });

  it("returns 200 with attemptsRemaining 0 when used equals limit", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u-lab" } } }),
      },
    });
    vi.mocked(getLabAttemptsUsed).mockResolvedValue(3);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.attemptsRemaining).toBe(0);
    expect(data.attemptsUsed).toBe(3);
  });
});
