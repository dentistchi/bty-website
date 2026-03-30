/**
 * Mirror slot selection — no immediate repeat when alternatives exist; least-recent tie-break preserved.
 */
import { describe, it, expect } from "vitest";
import { pickLeastRecentMirror } from "./scenario-type-router";
import { MIRROR_SCENARIO_PREFIX } from "@/engine/perspective-switch/mirror-scenario.service";
import type { MirrorScenario } from "@/engine/perspective-switch/mirror-scenario.service";

function mirrorRow(id: string, origin: string, createdAt: string): MirrorScenario {
  return {
    id,
    user_id: "u1",
    origin_scenario_id: origin,
    target_role: "peer",
    mirror_title: "t",
    mirror_context: "c",
    created_at: createdAt,
  };
}

describe("pickLeastRecentMirror", () => {
  const mA = mirrorRow("pool-a", "origin_a", "2026-01-01T00:00:00.000Z");
  const mB = mirrorRow("pool-b", "origin_b", "2026-01-02T00:00:00.000Z");

  it("does not pick the same mirror immediately when another candidate exists", () => {
    const played = [
      "catalog_x",
      `${MIRROR_SCENARIO_PREFIX}${mA.id}`,
      "catalog_y",
    ];
    const picked = pickLeastRecentMirror([mA, mB], played);
    expect(picked.id).toBe(mB.id);
  });

  it("falls back to the only mirror when last served was that mirror (single candidate)", () => {
    const played = [`${MIRROR_SCENARIO_PREFIX}${mA.id}`];
    const picked = pickLeastRecentMirror([mA], played);
    expect(picked.id).toBe(mA.id);
  });

  it("when last served mirror is excluded, still prefers never-played among remaining", () => {
    const played = [
      `${MIRROR_SCENARIO_PREFIX}${mA.id}`,
      "cat",
      `${MIRROR_SCENARIO_PREFIX}${mB.id}`,
    ];
    const mC = mirrorRow("pool-c", "origin_c", "2026-01-03T00:00:00.000Z");
    const picked = pickLeastRecentMirror([mA, mB, mC], played);
    expect(picked.id).toBe(mC.id);
  });

  it("with no prior mirror in played, prefers oldest never-played by created_at", () => {
    const played = ["catalog_only"];
    const picked = pickLeastRecentMirror([mA, mB], played);
    expect(picked.id).toBe(mA.id);
  });

  it("when both were played and last mirror excluded, uses least recent index among remaining", () => {
    const played = [
      `${MIRROR_SCENARIO_PREFIX}${mA.id}`,
      "c",
      `${MIRROR_SCENARIO_PREFIX}${mB.id}`,
    ];
    const picked = pickLeastRecentMirror([mA, mB], played);
    expect(picked.id).toBe(mA.id);
  });
});
