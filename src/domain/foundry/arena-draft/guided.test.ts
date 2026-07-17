import { describe, it, expect } from "vitest";
import { deriveAvoidanceSeeds, hardestWhenOptions } from "./guided";
import { AVOIDANCE_PRESSURE_SEEDS, HARDEST_WHEN_OPTIONS } from "./types";
import type { ModuleSnapshot } from "../module/module-publish";

describe("guided suggestions", () => {
  it("exposes the fixed Q1 options", () => {
    expect(hardestWhenOptions()).toEqual(HARDEST_WHEN_OPTIONS);
  });

  it("always returns every avoidance seed (only the order changes)", () => {
    const seeds = deriveAvoidanceSeeds(undefined);
    expect([...seeds].sort()).toEqual([...AVOIDANCE_PRESSURE_SEEDS].sort());
  });

  it("pulls authority/credibility forward for a shared-standard module", () => {
    const snap: ModuleSnapshot = { learningNeeds: ["shared_standard"] };
    const seeds = deriveAvoidanceSeeds(snap);
    expect(seeds.slice(0, 2)).toEqual(["authority", "credibility"]);
    expect([...seeds].sort()).toEqual([...AVOIDANCE_PRESSURE_SEEDS].sort()); // still exhaustive
  });

  it("pulls time/cost forward for a decision module", () => {
    const seeds = deriveAvoidanceSeeds({ learningNeeds: ["decide"] });
    expect(seeds.slice(0, 2)).toEqual(["time", "cost"]);
  });

  it("keeps the neutral base order for a know-only module", () => {
    const seeds = deriveAvoidanceSeeds({ learningNeeds: ["know"] });
    expect(seeds).toEqual([...AVOIDANCE_PRESSURE_SEEDS]);
  });
});
