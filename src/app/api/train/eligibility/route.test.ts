/**
 * GET /api/train/eligibility — unauthenticated ok:false, authenticated 200 with next.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetAuthUserFromRequest = vi.fn();
const mockGetUnlockedDayCount = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ from: () => ({}) }) }));

/*
  R9B.2: these Bearer/session routes now require CURRENT consent. This suite covers the route's own
  behaviour for an ordinary consented learner; the consent verdict itself is proven by
  `requireConsentedUser.test.ts` and `r9b2ConsentSeams.route.test.ts`, which do not mock it.
*/
vi.mock("@/lib/legal/activeConsent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/activeConsent")>()),
  isConsentCurrent: async () => true,
}));

vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) => mockGetAuthUserFromRequest(...args),
}));
vi.mock("@/lib/trainProgress", () => ({
  getUnlockedDayCount: (...args: unknown[]) => mockGetUnlockedDayCount(...args),
}));

function makeRequest(): Request {
  return new Request("http://localhost/api/train/eligibility", { method: "GET" });
}

describe("GET /api/train/eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnlockedDayCount.mockReturnValue(1);
  });

  it("returns 200 with ok false when unauthenticated", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(mockGetUnlockedDayCount).not.toHaveBeenCalled();
  });

  it("returns 200 with ok true and next when authenticated", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetUnlockedDayCount.mockReturnValue(2);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.next).toBe("/train/day/2");
    expect(mockGetUnlockedDayCount).toHaveBeenCalled();
  });

  it("returns 200 with next /train/day/28 when unlocked day count is 28", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetUnlockedDayCount.mockReturnValue(28);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.next).toBe("/train/day/28");
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetUnlockedDayCount.mockReturnValue(3);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.next).toBe("/train/day/3");
  });

  it("returns 200 with next starting with /train/", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetUnlockedDayCount.mockReturnValue(2);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.next).toMatch(/^\/train\//);
  });

  it("returns 200 with ok as boolean", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetUnlockedDayCount.mockReturnValue(1);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.ok).toBe("boolean");
  });

  it("returns 200 with exactly ok and next keys", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetUnlockedDayCount.mockReturnValue(1);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["next", "ok"].sort());
  });
});
