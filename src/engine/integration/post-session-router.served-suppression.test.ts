/**
 * AL-1.9-E-P1.1-A/D-sub3 — wiring contract for served-scenario suppression.
 * routePostSession passes servedArenaScenarioIds (from helper) to selector.
 *
 * Scope: wiring only (D-sub2 contract). Full router behavior NOT covered here.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetchRecentServedScenarioIds = vi.fn();
const mockGetNextScenarioForSession = vi.fn();
const mockGetSupabaseServerClient = vi.fn();
const mockGetAIRTrend = vi.fn();
const mockGetUnlockedAssets = vi.fn();
const mockGetRecommendations = vi.fn();

vi.mock("@/lib/bty/arena/fetchRecentServedScenarioIds", () => ({
  fetchRecentServedScenarioIds: (...args: unknown[]) => mockFetchRecentServedScenarioIds(...args),
}));
vi.mock("@/engine/integration/scenario-type-router", () => ({
  getNextScenarioForSession: (...args: unknown[]) => mockGetNextScenarioForSession(...args),
}));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () => mockGetSupabaseServerClient(),
}));
vi.mock("@/engine/integrity/air-trend.service", () => ({
  getAIRTrend: (...args: unknown[]) => mockGetAIRTrend(...args),
}));
vi.mock("@/engine/avatar/avatar-state.service", () => ({
  getUnlockedAssets: (...args: unknown[]) => mockGetUnlockedAssets(...args),
}));
vi.mock("@/engine/foundry/program-recommender.service", () => ({
  getRecommendations: (...args: unknown[]) => mockGetRecommendations(...args),
}));

import { routePostSession, type SessionOutcome } from "./post-session-router";

const baseOutcome: SessionOutcome = {
  dismissal: "next_scenario",
  locale: "en",
  foundryUnlockFired: false,
  avatarTierUpgradedFired: false,
  airDelta: 0,
};

describe("routePostSession — D-sub3 servedArenaScenarioIds wiring contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServerClient.mockResolvedValue({});
    mockGetAIRTrend.mockResolvedValue({ consecutiveDecliningRollingSteps: 0 });
    mockGetUnlockedAssets.mockResolvedValue([]);
    mockGetRecommendations.mockResolvedValue([]);
    mockGetNextScenarioForSession.mockResolvedValue(null);
  });

  it("Case A: helper returns served IDs → selector receives same array as servedArenaScenarioIds", async () => {
    mockFetchRecentServedScenarioIds.mockResolvedValue(["s1", "s2"]);

    await routePostSession("user-1", baseOutcome);

    expect(mockFetchRecentServedScenarioIds).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({ servedArenaScenarioIds: ["s1", "s2"] }),
    );
  });

  it("Case B: helper returns [] → selector receives empty servedArenaScenarioIds", async () => {
    mockFetchRecentServedScenarioIds.mockResolvedValue([]);

    await routePostSession("user-1", baseOutcome);

    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({ servedArenaScenarioIds: [] }),
    );
  });
});
