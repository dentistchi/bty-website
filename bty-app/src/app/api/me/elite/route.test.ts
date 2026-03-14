/**
 * GET /api/me/elite — 401·200 (Elite 5% + badges + eliteContentUnlocked).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();
const mockGetIsEliteTop5 = vi.fn();
const mockGetEliteBadgeGrants = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) => mockGetSupabaseServerClient(...args),
}));
vi.mock("@/lib/bty/arena/eliteStatus", () => ({
  getIsEliteTop5: (...args: unknown[]) => mockGetIsEliteTop5(...args),
}));
vi.mock("@/lib/bty/arena/eliteBadge", () => ({
  getEliteBadgeGrants: (...args: unknown[]) => mockGetEliteBadgeGrants(...args),
}));

describe("GET /api/me/elite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockGetIsEliteTop5).not.toHaveBeenCalled();
  });

  it("returns 200 with isElite, badges, eliteContentUnlocked when authenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    mockGetIsEliteTop5.mockResolvedValue(true);
    mockGetEliteBadgeGrants.mockReturnValue([{ kind: "weekly_elite", labelKey: "weekly_elite" }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isElite).toBe(true);
    expect(data.badges).toHaveLength(1);
    expect(data.badges[0].kind).toBe("weekly_elite");
    expect(data.eliteContentUnlocked).toBe(true);
    expect(mockGetIsEliteTop5).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(mockGetEliteBadgeGrants).toHaveBeenCalledWith(true);
  });

  it("returns 200 with multiple badges when getEliteBadgeGrants returns several", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    mockGetIsEliteTop5.mockResolvedValue(true);
    mockGetEliteBadgeGrants.mockReturnValue([
      { kind: "weekly_elite", labelKey: "weekly_elite" },
      { kind: "season_elite", labelKey: "season_elite" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isElite).toBe(true);
    expect(data.badges).toHaveLength(2);
    expect(data.badges[0].kind).toBe("weekly_elite");
    expect(data.badges[1].kind).toBe("season_elite");
    expect(data.eliteContentUnlocked).toBe(true);
  });

  it("returns 200 with isElite false when not in top 5%", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u2" } } }) },
    });
    mockGetIsEliteTop5.mockResolvedValue(false);
    mockGetEliteBadgeGrants.mockReturnValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isElite).toBe(false);
    expect(data.badges).toEqual([]);
    expect(data.eliteContentUnlocked).toBe(false);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    mockGetIsEliteTop5.mockResolvedValue(true);
    mockGetEliteBadgeGrants.mockReturnValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("isElite");
    expect(data).toHaveProperty("badges");
    expect(data).toHaveProperty("eliteContentUnlocked");
  });
});
