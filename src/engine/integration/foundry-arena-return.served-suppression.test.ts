/**
 * AL-1.9-E-P1.1-A/D-sub3 — wiring contract for served-scenario suppression.
 * handleFoundryCompletion passes servedArenaScenarioIds (from helper) to selector,
 * with admin-nullable conditional matching foundry-arena-return.ts L153 pattern.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetchRecentServedScenarioIds = vi.fn();
const mockGetNextScenarioForSession = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
const mockGetScenarioStats = vi.fn();
const mockGetPromotionReadiness = vi.fn();
const mockHandleEliteSpecNomination = vi.fn();

vi.mock("@/lib/bty/arena/fetchRecentServedScenarioIds", () => ({
  fetchRecentServedScenarioIds: (...args: unknown[]) => mockFetchRecentServedScenarioIds(...args),
}));
vi.mock("@/engine/integration/scenario-type-router", () => ({
  getNextScenarioForSession: (...args: unknown[]) => mockGetNextScenarioForSession(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));
vi.mock("@/engine/scenario/scenario-stats.service", () => ({
  getScenarioStats: (...args: unknown[]) => mockGetScenarioStats(...args),
}));
vi.mock("@/engine/integrity/promotion-readiness.service", () => ({
  getPromotionReadiness: (...args: unknown[]) => mockGetPromotionReadiness(...args),
}));
vi.mock("@/engine/integration/elite-spec-flow", () => ({
  ELITE_SPEC_READINESS_THRESHOLD: 100,
  handleEliteSpecNomination: (...args: unknown[]) => mockHandleEliteSpecNomination(...args),
}));

import { handleFoundryCompletion } from "./foundry-arena-return";

function makeStubAdmin() {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return { from: vi.fn(() => chain) };
}

describe("handleFoundryCompletion — D-sub3 servedArenaScenarioIds wiring contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScenarioStats.mockResolvedValue({ playsByFlagType: {} });
    mockGetPromotionReadiness.mockResolvedValue({ readiness_score: 0, promotion_blocked: false });
    mockGetNextScenarioForSession.mockResolvedValue(null);
  });

  it("Case A: admin available + helper returns served IDs → selector receives them", async () => {
    const stubAdmin = makeStubAdmin();
    mockGetSupabaseAdmin.mockReturnValue(stubAdmin);
    mockFetchRecentServedScenarioIds.mockResolvedValue(["s1", "s2"]);

    await handleFoundryCompletion("user-1", "program-1");

    expect(mockFetchRecentServedScenarioIds).toHaveBeenCalledWith(stubAdmin, "user-1");
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({
        servedArenaScenarioIds: ["s1", "s2"],
        foundry_return: true,
      }),
    );
  });

  it("Case B: admin available + helper returns [] → selector receives empty servedArenaScenarioIds", async () => {
    mockGetSupabaseAdmin.mockReturnValue(makeStubAdmin());
    mockFetchRecentServedScenarioIds.mockResolvedValue([]);

    await handleFoundryCompletion("user-1", "program-1");

    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({ servedArenaScenarioIds: [] }),
    );
  });

  it("Case C: admin null → helper NOT called, selector receives empty servedArenaScenarioIds", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);

    await handleFoundryCompletion("user-1", "program-1");

    expect(mockFetchRecentServedScenarioIds).not.toHaveBeenCalled();
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({ servedArenaScenarioIds: [] }),
    );
  });
});
