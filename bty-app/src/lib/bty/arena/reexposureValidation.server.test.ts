import { describe, expect, it } from "vitest";
import { patternShiftBandFromReexposure } from "@/domain/leadership-engine/patternShift";

describe("re-exposure validation (pattern shift closure)", () => {
  it("exit → entry crossing yields changed", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: true,
        priorExitPatternKey: "future_deferral|X",
        afterExitPatternKey: "ignored",
      }),
    ).toBe("changed");
  });

  it("same exit keys yields no_change", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: false,
        priorExitPatternKey: "future_deferral|id1",
        afterExitPatternKey: "future_deferral|id1",
      }),
    ).toBe("no_change");
  });

  it("different exit keys yields unstable", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: false,
        priorExitPatternKey: "future_deferral|id1",
        afterExitPatternKey: "repair_avoidance|id2",
      }),
    ).toBe("unstable");
  });
});
