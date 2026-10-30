import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ requireUser: vi.fn(), getServer: vi.fn(), admin: vi.fn(), consent: vi.fn(), get: vi.fn(), sync: vi.fn(), feature: vi.fn(), acknowledge: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireUser: m.requireUser }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServer: m.getServer }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: m.admin }));
vi.mock("@/lib/legal/activeConsent", () => ({ isConsentCurrent: m.consent }));
vi.mock("@/lib/bty/learning-rewards/service.server", () => ({ getLearningRewards: m.get, syncLearningRewards: m.sync, featureLearningBadge: m.feature, acknowledgeLearningAchievements: m.acknowledge, learningRewardsEnabled: () => process.env.LEARNING_REWARDS_ENABLED === "1" }));
import { GET, POST } from "./route";
const db = { name: "synthetic admin" };
const request = (body?: unknown) => new NextRequest("https://example.test/api/me/learning-rewards", body == null ? {} : { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
beforeEach(() => {
  vi.stubEnv("LEARNING_REWARDS_ENABLED", "1");
  m.requireUser.mockResolvedValue({ ok: true, user: { id: "canonical-teams-user" } });
  m.getServer.mockResolvedValue({}); m.admin.mockReturnValue(db); m.consent.mockResolvedValue(true);
  m.get.mockResolvedValue({ totalXp: 20 });
  m.sync.mockResolvedValue({ summary: { totalXp: 20 }, awards: [], xpAwarded: 0, newAchievements: [] });
  m.feature.mockResolvedValue({ totalXp: 20, featuredBadgeId: "first" });
  m.acknowledge.mockResolvedValue({ totalXp: 20, pendingAchievements: [] });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe("private Learning Rewards API", () => {
  it.each([GET, POST])("unauthenticated requests never initialize admin or reward services", async handler => {
    m.requireUser.mockResolvedValueOnce({ ok: false, status: 401 });
    const res = await handler(request({ operation: "sync" }));
    expect(res.status).toBe(401); expect(m.admin).not.toHaveBeenCalled(); expect(m.sync).not.toHaveBeenCalled();
  });
  it("current consent is required before reward access", async () => {
    m.consent.mockResolvedValueOnce(false);
    expect((await GET(request())).status).toBe(403); expect(m.admin).not.toHaveBeenCalled();
  });
  it.each([GET, POST])("feature-off is an explicit disabled state with no reward database access", async handler => {
    vi.stubEnv("LEARNING_REWARDS_ENABLED", "0");
    const res = await handler(request({ operation: "sync" }));
    expect(await res.json()).toEqual({ ok: true, enabled: false }); expect(m.admin).not.toHaveBeenCalled();
  });
  it("GET is private/no-store, uses canonical user identity, and never syncs", async () => {
    const res = await GET(request());
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(m.get).toHaveBeenCalledWith(db, "canonical-teams-user"); expect(m.sync).not.toHaveBeenCalled();
  });
  it.each([{ operation: "sync", xp: 100000 }, { operation: "sync", userId: "foreign" }, { operation: "sync", evidence: {} }, { operation: "award", action: "learn" }, { operation: "feature", badgeId: "made-up" }])("rejects browser-supplied authority %o", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(m.sync).not.toHaveBeenCalled(); expect(m.feature).not.toHaveBeenCalled();
  });
  it("POST sync accepts only the operation and forwards no client evidence", async () => {
    const res = await POST(request({ operation: "sync" }));
    expect(res.status).toBe(200); expect(m.sync).toHaveBeenCalledWith(db, "canonical-teams-user");
  });
  it("feature validation failure is a conflict and cannot award XP", async () => {
    m.feature.mockRejectedValueOnce(Error("BADGE_NOT_EARNED"));
    const res = await POST(request({ operation: "feature", badgeId: "level50" }));
    expect(res.status).toBe(409); expect(m.sync).not.toHaveBeenCalled();
  });
  it("acknowledgement is authenticated, server-validated, and awards no XP", async () => {
    const res = await POST(request({ operation: "acknowledge", achievementIds: ["badge:first"] }));
    expect(res.status).toBe(200); expect(m.acknowledge).toHaveBeenCalledWith(db, "canonical-teams-user", ["badge:first"]);
    expect(m.sync).not.toHaveBeenCalled();
    m.acknowledge.mockRejectedValueOnce(Error("ACHIEVEMENT_NOT_EARNED"));
    expect((await POST(request({ operation: "acknowledge", achievementIds: ["badge:level50"] }))).status).toBe(409);
  });
  it("unknown failures return unavailable, not a synthetic empty summary or internal error", async () => {
    m.get.mockRejectedValueOnce(Error("private table detail"));
    const res = await GET(request());
    expect(res.status).toBe(503); expect(await res.json()).toEqual({ ok: false, error: "UNAVAILABLE" });
  });
  it("bounds request size and malformed JSON", async () => {
    expect((await POST(request("x".repeat(4097)))).status).toBe(413);
    expect((await POST(request("{"))).status).toBe(400);
  });
});
