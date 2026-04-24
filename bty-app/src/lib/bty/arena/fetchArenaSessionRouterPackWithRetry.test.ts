/**
 * Live exclusivity: `ACTION_REQUIRED` + `scenario: null` (session_shell) must never be retried into
 * a catalog `ARENA_SCENARIO_READY` bootstrap — same client tick would spawn an unrelated `IN_PROGRESS` run.
 */
import { describe, expect, it, vi } from "vitest";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import type { Scenario } from "@/lib/bty/scenario/types";
import { fetchArenaSessionRouterPackWithRetryImpl } from "@/lib/bty/arena/arenaSessionRouterClient";

const shellSnap = {
  mode: ARENA_SESSION_MODE,
  runtime_state: "ACTION_REQUIRED" as const,
  state_priority: 90,
  gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
  action_contract: {
    exists: true,
    id: null,
    status: null,
    verification_type: null,
    deadline_at: null,
  },
};

describe("fetchArenaSessionRouterPackWithRetryImpl", () => {
  it("returns session_shell on first response and does not retry into scenario (ACTION_REQUIRED exclusivity)", async () => {
    const scenarioReadySnap = {
      ...shellSnap,
      runtime_state: "ARENA_SCENARIO_READY" as const,
      gates: { next_allowed: true, choice_allowed: true, qr_allowed: false },
    };
    const mockFetch = vi.fn();
    mockFetch
      .mockResolvedValueOnce({ outcome: "session_shell" as const, snapshot: shellSnap })
      .mockResolvedValue({
        outcome: "scenario" as const,
        scenario: { scenarioId: "core_01_training_system" } as Scenario,
        recallPrompt: null,
        snapshot: scenarioReadySnap,
      });

    const pack = await fetchArenaSessionRouterPackWithRetryImpl(mockFetch, "en", "legacy");
    expect(pack.outcome).toBe("session_shell");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
