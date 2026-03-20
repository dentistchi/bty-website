import { describe, it, expect } from "vitest";
import {
  ARENA_SCENARIO_OUTCOMES_MAX_KEYS,
  arenaScenarioOutcomesFromUnknown,
} from "./arenaScenarioOutcomesFromUnknown";

const minimalOutcome = {
  interpretation: ["one"],
  systemMessage: "SYSTEM // ok",
  activatedStats: ["Integrity"],
};

describe("arenaScenarioOutcomesFromUnknown (edges)", () => {
  it("returns canonical keyed outcomes when all keys and values parse", () => {
    expect(
      arenaScenarioOutcomesFromUnknown({
        A_X: minimalOutcome,
        " B_Y ": {
          interpretation: ["x"],
          systemMessage: "SYSTEM // y",
          activatedStats: ["Gratitude"],
        },
      }),
    ).toEqual({
      A_X: {
        interpretation: ["one"],
        systemMessage: "SYSTEM // ok",
        activatedStats: ["Integrity"],
      },
      B_Y: {
        interpretation: ["x"],
        systemMessage: "SYSTEM // y",
        activatedStats: ["Gratitude"],
      },
    });
  });

  it("returns null when value is not a plain object, empty, over max keys, duplicate key, bad key, or bad value", () => {
    expect(arenaScenarioOutcomesFromUnknown(null)).toBeNull();
    expect(arenaScenarioOutcomesFromUnknown([])).toBeNull();
    expect(arenaScenarioOutcomesFromUnknown({})).toBeNull();
    expect(
      arenaScenarioOutcomesFromUnknown(
        Object.fromEntries(
          Array.from({ length: ARENA_SCENARIO_OUTCOMES_MAX_KEYS + 1 }, (_, i) => [`K${i}`, minimalOutcome]),
        ),
      ),
    ).toBeNull();
    expect(
      arenaScenarioOutcomesFromUnknown({
        A_X: minimalOutcome,
        " A_X": minimalOutcome,
      }),
    ).toBeNull();
    expect(arenaScenarioOutcomesFromUnknown({ bad: minimalOutcome })).toBeNull();
    expect(arenaScenarioOutcomesFromUnknown({ A_X: { ...minimalOutcome, interpretation: [] } })).toBeNull();
  });

  it("accepts full primary×reinforcement outcome grid (6 keys)", () => {
    const raw = {
      A_X: minimalOutcome,
      A_Y: minimalOutcome,
      B_X: minimalOutcome,
      B_Y: minimalOutcome,
      C_X: minimalOutcome,
      C_Y: minimalOutcome,
    };
    const parsed = arenaScenarioOutcomesFromUnknown(raw);
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed!)).toHaveLength(6);
  });
});
