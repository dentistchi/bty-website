/**
 * P5 regression — snapshot authority invariants (single-state runtime).
 * Domain/lib only: no UI. Complements `BtyArenaRunPageClient.snapshot-gates.test.tsx`.
 */
import { describe, expect, it } from "vitest";
import {
  arenaEntryContractFromSnapshot,
  defaultArenaEntryContract,
} from "@/lib/bty/arena/arenaEntryContract";
import {
  arenaEntryHrefForDestination,
  arenaRuntimeDestinationFromRuntimeState,
  arenaRuntimeDestinationFromSnapshot,
} from "@/lib/bty/arena/arenaRuntimeDestination";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import {
  isArenaActionBlockingRuntimeState,
  snapshotAllowsArenaScenarioPlaySurface,
  type ArenaSessionRouterSnapshot,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

function snap(rs: ArenaSessionRouterSnapshot["runtime_state"]): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: 0,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

describe("P5 A — blocking contract outranks progression surface", () => {
  it.each(["ACTION_REQUIRED", "ACTION_SUBMITTED", "ACTION_AWAITING_VERIFICATION"] as const)(
    "runtime_state %s blocks play surface and maps to contract_gate destination",
    (rs) => {
      expect(isArenaActionBlockingRuntimeState(rs)).toBe(true);
      const s = snap(rs);
      expect(snapshotAllowsArenaScenarioPlaySurface(s, true)).toBe(false);
      expect(snapshotAllowsArenaScenarioPlaySurface(s, false)).toBe(false);
      expect(arenaRuntimeDestinationFromSnapshot(s)).toBe("arena_contract_gate");
    },
  );
});

describe("P5 A′ — action-contract runtime states route to My Page (not Center)", () => {
  it("arena_contract_gate href is My Page with contract hub focus query", () => {
    expect(arenaEntryHrefForDestination("en", "arena_contract_gate")).toBe(
      "/en/my-page?arena_contract=resolve",
    );
    expect(arenaEntryHrefForDestination("ko", "arena_contract_gate")).toBe(
      "/ko/my-page?arena_contract=resolve",
    );
  });
});

describe("P5 B — forced reset outranks Arena play (entry + surface gate)", () => {
  it("FORCED_RESET_PENDING maps to center_forced_reset href and blocks play surface", () => {
    const s = snap("FORCED_RESET_PENDING");
    expect(arenaRuntimeDestinationFromSnapshot(s)).toBe("center_forced_reset");
    expect(arenaEntryHrefForDestination("en", "center_forced_reset")).toBe("/en/center");
    expect(snapshotAllowsArenaScenarioPlaySurface(s, false)).toBe(false);
    const c = arenaEntryContractFromSnapshot("en", s);
    expect(c.destinationId).toBe("center_forced_reset");
    expect(c.href).toBe("/en/center");
  });
});

describe("P5 C′ — tradeoff / action-decision active stays on Arena play surface", () => {
  it("TRADEOFF_ACTIVE and ACTION_DECISION_ACTIVE map to arena_play and allow progression surface", () => {
    const t = snap("TRADEOFF_ACTIVE");
    const a = snap("ACTION_DECISION_ACTIVE");
    expect(arenaRuntimeDestinationFromSnapshot(t)).toBe("arena_play");
    expect(arenaRuntimeDestinationFromSnapshot(a)).toBe("arena_play");
    expect(snapshotAllowsArenaScenarioPlaySurface(t, false)).toBe(true);
    expect(snapshotAllowsArenaScenarioPlaySurface(a, false)).toBe(true);
  });
});

describe("P5 C — re-exposure outranks next-scenario play surface", () => {
  it("REEXPOSURE_DUE maps to arena_reexposure and blocks play surface (shell still /bty-arena)", () => {
    const s = snap("REEXPOSURE_DUE");
    expect(arenaRuntimeDestinationFromSnapshot(s)).toBe("arena_reexposure");
    expect(arenaEntryHrefForDestination("en", "arena_reexposure")).toBe("/en/bty-arena");
    expect(snapshotAllowsArenaScenarioPlaySurface(s, false)).toBe(false);
    const c = arenaEntryContractFromSnapshot("ko", s);
    expect(c.href).toBe("/ko/bty-arena");
    expect(c.destinationId).toBe("arena_reexposure");
  });

  it("NEXT_SCENARIO_READY blocks in-scenario play surface (post-run / fetch-next window)", () => {
    const s = snap("NEXT_SCENARIO_READY");
    expect(snapshotAllowsArenaScenarioPlaySurface(s, false)).toBe(false);
  });
});

describe("P5 D — server snapshot gates win over hypothetical local progression", () => {
  it("when action-blocking snapshot exists, play surface must not allow even if actionBlocking flag were false (defensive)", () => {
    const s = snap("ACTION_REQUIRED");
    expect(snapshotAllowsArenaScenarioPlaySurface(s, false)).toBe(false);
  });

  it("ARENA_SCENARIO_READY allows play only when not action-blocking", () => {
    const s = snap("ARENA_SCENARIO_READY");
    expect(snapshotAllowsArenaScenarioPlaySurface(s, true)).toBe(false);
    expect(snapshotAllowsArenaScenarioPlaySurface(s, false)).toBe(true);
  });

  it("ACTION_DECISION_ACTIVE allows action-decision surface; not contract-blocking", () => {
    const s = snap("ACTION_DECISION_ACTIVE");
    expect(isArenaActionBlockingRuntimeState("ACTION_DECISION_ACTIVE")).toBe(false);
    expect(snapshotAllowsArenaScenarioPlaySurface(s, false)).toBe(true);
  });
});

describe("P5 E — shared entry resolution consistency (pure contract path)", () => {
  it("Landing / nav / growth all use the same destination + href derivation as arenaEntryContractFromSnapshot", () => {
    const states = [
      "ACTION_REQUIRED",
      "FORCED_RESET_PENDING",
      "REEXPOSURE_DUE",
      "ARENA_SCENARIO_READY",
      "ACTION_DECISION_ACTIVE",
    ] as const;
    for (const rs of states) {
      const snapshot = snap(rs);
      const dest = arenaRuntimeDestinationFromRuntimeState(rs);
      expect(arenaRuntimeDestinationFromSnapshot(snapshot)).toBe(dest);
      const c = arenaEntryContractFromSnapshot("en", snapshot);
      expect(c.destinationId).toBe(dest);
      expect(c.href).toBe(arenaEntryHrefForDestination("en", dest));
      expect(c.uiIntentLabel).toBe(c.destinationId);
    }
  });

  it("defaultArenaEntryContract matches arena_play + /bty-arena (first-paint fallback)", () => {
    const d = defaultArenaEntryContract("en");
    expect(d.destinationId).toBe("arena_play");
    expect(d.href).toBe("/en/bty-arena");
  });
});
