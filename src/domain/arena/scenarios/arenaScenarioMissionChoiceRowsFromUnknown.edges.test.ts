import { describe, it, expect } from "vitest";
import {
  arenaScenarioMissionChoiceRowsFromUnknown,
  arenaScenarioPrimaryChoicesRowFromUnknown,
  arenaScenarioReinforcementChoicesRowFromUnknown,
} from "./arenaScenarioMissionChoiceRowsFromUnknown";

const p = (id: string) => ({
  id,
  label: id,
  title: `title-${id}`,
});

const r = (id: string) => ({
  id,
  label: id,
  title: `title-${id}`,
});

const fullPrimary = [p("C"), p("A"), p("B")];
const fullReinf = [r("Y"), r("X")];

describe("arenaScenarioMissionChoiceRowsFromUnknown (edges)", () => {
  it("returns both rows when object has valid primaryChoices and reinforcementChoices", () => {
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: fullPrimary,
        reinforcementChoices: fullReinf,
      }),
    ).toEqual({
      primaryChoices: fullPrimary,
      reinforcementChoices: fullReinf,
    });
  });

  it("ignores extra keys on root object when both rows are valid", () => {
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        noise: 1,
        primaryChoices: fullPrimary,
        reinforcementChoices: fullReinf,
        extra: "x",
      }),
    ).toEqual({
      primaryChoices: fullPrimary,
      reinforcementChoices: fullReinf,
    });
  });

  it("returns null when primaryChoices or reinforcementChoices is not an array", () => {
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: "not-array",
        reinforcementChoices: fullReinf,
      }),
    ).toBeNull();
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: fullPrimary,
        reinforcementChoices: 42,
      }),
    ).toBeNull();
  });

  it("returns null when root is not an object or either row fails row rules", () => {
    expect(arenaScenarioMissionChoiceRowsFromUnknown(null)).toBeNull();
    expect(arenaScenarioMissionChoiceRowsFromUnknown([])).toBeNull();
    expect(arenaScenarioMissionChoiceRowsFromUnknown({ primaryChoices: fullPrimary })).toBeNull();
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: [p("A"), p("B")],
        reinforcementChoices: fullReinf,
      }),
    ).toBeNull();
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: [p("A"), p("A"), p("B")],
        reinforcementChoices: fullReinf,
      }),
    ).toBeNull();
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: fullPrimary,
        reinforcementChoices: [r("X")],
      }),
    ).toBeNull();
  });

  it("arenaScenarioPrimaryChoicesRowFromUnknown rejects missing C / invalid item", () => {
    expect(arenaScenarioPrimaryChoicesRowFromUnknown([p("A"), p("B"), p("A")])).toBeNull();
    expect(arenaScenarioPrimaryChoicesRowFromUnknown([p("A"), p("B"), { id: "C", label: "", title: "t" }])).toBeNull();
  });

  it("arenaScenarioReinforcementChoicesRowFromUnknown rejects missing Y / duplicate / invalid id", () => {
    expect(arenaScenarioReinforcementChoicesRowFromUnknown([r("X"), r("X")])).toBeNull();
    expect(
      arenaScenarioReinforcementChoicesRowFromUnknown([r("X"), { id: "Z", label: "Z", title: "t" }]),
    ).toBeNull();
  });

  /** S88 C3 TASK8: tolerates extra root keys; fails when a valid id set has a broken choice shape. */
  it("allows extra keys on root; rejects primary row when one choice fails shape", () => {
    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: fullPrimary,
        reinforcementChoices: fullReinf,
        meta: { k: 1 },
        version: 2,
      }),
    ).toEqual({
      primaryChoices: fullPrimary,
      reinforcementChoices: fullReinf,
    });

    expect(
      arenaScenarioMissionChoiceRowsFromUnknown({
        primaryChoices: [p("A"), { id: "B", label: "", title: "t" }, p("C")],
        reinforcementChoices: fullReinf,
      }),
    ).toBeNull();
  });

  /**
   * S148 C3 TASK8 — **S135** 동일 축 — top-level **`Symbol`** / **`bigint`** → **null** (S88 root·choice-shape와 구분).
   */
  it("S148: returns null when value is Symbol or bigint", () => {
    expect(arenaScenarioMissionChoiceRowsFromUnknown(Symbol("mission"))).toBeNull();
    expect(arenaScenarioMissionChoiceRowsFromUnknown(BigInt(1))).toBeNull();
  });
});
