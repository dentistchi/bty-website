/**
 * AL-1.9-E-P1.1-A/D-sub3 — wiring contract for served-scenario suppression.
 * handleSlipRecovery (scenario_retry case only) passes servedArenaScenarioIds
 * (from helper) to selector, with admin-nullable conditional matching
 * recovery-loop-router.ts L159 dojo_assessment guard pattern.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SlipRecoveryTask } from "@/engine/integrity/slip-recovery.service";

const mockFetchRecentServedScenarioIds = vi.fn();
const mockGetNextScenarioForSession = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
const mockGetRecoveryTask = vi.fn();

vi.mock("@/lib/bty/arena/fetchRecentServedScenarioIds", () => ({
  fetchRecentServedScenarioIds: (...args: unknown[]) => mockFetchRecentServedScenarioIds(...args),
}));
vi.mock("@/engine/integration/scenario-type-router", () => ({
  getNextScenarioForSession: (...args: unknown[]) => mockGetNextScenarioForSession(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));
vi.mock("@/engine/integrity/slip-recovery.service", () => ({
  getRecoveryTask: (...args: unknown[]) => mockGetRecoveryTask(...args),
}));

import { handleSlipRecovery } from "./recovery-loop-router";

const taskScenarioRetry: SlipRecoveryTask = {
  id: "task-1",
  user_id: "user-1",
  task_type: "scenario_retry",
  assigned_at: "2026-05-06T00:00:00Z",
  completed_at: null,
  slip_severity: 1,
  slip_reason: "test",
};

describe("handleSlipRecovery scenario_retry — D-sub3 servedArenaScenarioIds wiring contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecoveryTask.mockResolvedValue(taskScenarioRetry);
    mockGetNextScenarioForSession.mockResolvedValue(null);
  });

  it("Case A: admin available + helper returns served IDs → selector receives them", async () => {
    const stubAdmin = { sentinel: true };
    mockGetSupabaseAdmin.mockReturnValue(stubAdmin);
    mockFetchRecentServedScenarioIds.mockResolvedValue(["s1", "s2"]);

    await handleSlipRecovery("user-1");

    expect(mockFetchRecentServedScenarioIds).toHaveBeenCalledWith(stubAdmin, "user-1");
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({ servedArenaScenarioIds: ["s1", "s2"] }),
    );
  });

  it("Case B: admin available + helper returns [] → selector receives empty servedArenaScenarioIds", async () => {
    mockGetSupabaseAdmin.mockReturnValue({ sentinel: true });
    mockFetchRecentServedScenarioIds.mockResolvedValue([]);

    await handleSlipRecovery("user-1");

    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({ servedArenaScenarioIds: [] }),
    );
  });

  it("Case C: admin null → helper NOT called, selector receives empty servedArenaScenarioIds", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);

    await handleSlipRecovery("user-1");

    expect(mockFetchRecentServedScenarioIds).not.toHaveBeenCalled();
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith(
      "user-1",
      "en",
      expect.objectContaining({ servedArenaScenarioIds: [] }),
    );
  });
});
