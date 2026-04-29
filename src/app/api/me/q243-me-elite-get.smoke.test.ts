/**
 * C6 243 — GET /api/me/elite 401→200 스모크.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./elite/route";

const mockGetSupabaseServerClient = vi.fn();
const mockGetIsEliteTop5 = vi.fn();
const mockGetEliteBadgeGrants = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...a: unknown[]) => mockGetSupabaseServerClient(...a),
}));
vi.mock("@/lib/bty/arena/eliteStatus", () => ({
  getIsEliteTop5: (...a: unknown[]) => mockGetIsEliteTop5(...a),
}));
vi.mock("@/lib/bty/arena/eliteBadge", () => ({
  getEliteBadgeGrants: (...a: unknown[]) => mockGetEliteBadgeGrants(...a),
}));

describe("243 GET /api/me/elite smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 then 200 with isElite and badges", async () => {
    mockGetSupabaseServerClient.mockResolvedValueOnce({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const r401 = await GET();
    expect(r401.status).toBe(401);

    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u243" } } }) },
    });
    mockGetIsEliteTop5.mockResolvedValue(false);
    mockGetEliteBadgeGrants.mockReturnValue([]);

    const r200 = await GET();
    expect(r200.status).toBe(200);
    const j = await r200.json();
    expect(typeof j.isElite).toBe("boolean");
    expect(Array.isArray(j.badges)).toBe(true);
    expect(typeof j.eliteContentUnlocked).toBe("boolean");
  });
});
