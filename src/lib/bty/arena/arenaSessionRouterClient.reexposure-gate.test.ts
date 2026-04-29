import { describe, expect, it } from "vitest";
import {
  reexposureSnapshotFromSessionPack,
  snapshotQualifiesAsReexposureGate,
} from "@/lib/bty/arena/arenaSessionRouterClient";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

function snap(
  rs: ArenaSessionRouterSnapshot["runtime_state"],
  re?: ArenaSessionRouterSnapshot["re_exposure"],
): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: rs === "REEXPOSURE_DUE" ? 55 : 20,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
    ...(re ? { re_exposure: re } : {}),
  };
}

describe("snapshotQualifiesAsReexposureGate", () => {
  it("returns false for REEXPOSURE_DUE without pending_outcome_id", () => {
    expect(
      snapshotQualifiesAsReexposureGate(
        snap("REEXPOSURE_DUE", { due: true, scenario_id: "s1" }),
      ),
    ).toBe(false);
  });

  it("returns true for REEXPOSURE_DUE with pending_outcome_id", () => {
    expect(
      snapshotQualifiesAsReexposureGate(
        snap("REEXPOSURE_DUE", { due: true, scenario_id: "s1", pending_outcome_id: "po-1" }),
      ),
    ).toBe(true);
  });

  it("returns false for NEXT_SCENARIO_READY with due but no pending id", () => {
    expect(
      snapshotQualifiesAsReexposureGate(
        snap("NEXT_SCENARIO_READY", { due: true, scenario_id: null }),
      ),
    ).toBe(false);
  });
});

describe("reexposureSnapshotFromSessionPack", () => {
  it("returns null for reexposure outcome without pending id", () => {
    const pack = {
      outcome: "reexposure" as const,
      snapshot: snap("REEXPOSURE_DUE", { due: true, scenario_id: "x" }),
      delayedOutcomePending: false,
    };
    expect(reexposureSnapshotFromSessionPack(pack)).toBeNull();
  });

  it("returns snapshot when pending id exists", () => {
    const s = snap("REEXPOSURE_DUE", { due: true, scenario_id: "x", pending_outcome_id: "p" });
    const pack = { outcome: "reexposure" as const, snapshot: s, delayedOutcomePending: true };
    expect(reexposureSnapshotFromSessionPack(pack)).toBe(s);
  });
});
