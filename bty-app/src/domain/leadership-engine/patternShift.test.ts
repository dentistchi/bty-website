import { describe, it, expect } from "vitest";
import { patternShiftBandFromReexposure } from "./patternShift";

describe("patternShiftBandFromReexposure (LOCKED §4 integration stub)", () => {
  it("reentryAsEntry → changed", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: true,
        priorExitPatternKey: "p1",
        afterExitPatternKey: "p1",
      }),
    ).toBe("changed");
  });

  it("same exit pattern, no intensity drop → no_change", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: false,
        priorExitPatternKey: "axisA:exit1",
        afterExitPatternKey: "axisA:exit1",
        intensityDecreased: false,
      }),
    ).toBe("no_change");
  });

  it("different exit pattern → unstable", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: false,
        priorExitPatternKey: "axisA:exit1",
        afterExitPatternKey: "axisA:exit2",
      }),
    ).toBe("unstable");
  });

  it("same exit but lower intensity → unstable", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: false,
        priorExitPatternKey: "axisA:exit1",
        afterExitPatternKey: "axisA:exit1",
        intensityDecreased: true,
      }),
    ).toBe("unstable");
  });
});
