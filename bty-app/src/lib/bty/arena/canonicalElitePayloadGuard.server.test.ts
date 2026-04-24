import { describe, expect, it } from "vitest";
import { assertCanonicalEliteNoLegacyLeak } from "./canonicalElitePayloadGuard.server";

describe("assertCanonicalEliteNoLegacyLeak", () => {
  it("throws when legacy bundled markers appear", () => {
    expect(() =>
      assertCanonicalEliteNoLegacyLeak({
        id: "core_11_staffing_collapse",
        x: "The schedule is at full Medicaid capacity — 34 patients.",
      } as unknown as { id: string }),
    ).toThrow(/34 patients/);
    expect(() =>
      assertCanonicalEliteNoLegacyLeak({
        id: "core_06_lead_assistant",
        x: "pre-DSO assistant",
      } as unknown as { id: string }),
    ).toThrow(/pre-dso/);
    expect(() =>
      assertCanonicalEliteNoLegacyLeak({
        id: "core_06_lead_assistant",
        x: "DSO protocols",
      } as unknown as { id: string }),
    ).toThrow(/DSO/);
  });

  it("allows canonical chain core_01 copy mentioning Medicaid eligibility", () => {
    expect(() =>
      assertCanonicalEliteNoLegacyLeak({
        id: "core_01_training_system",
        pressure: "Medicaid eligibility verification failed.",
      } as unknown as { id: string }),
    ).not.toThrow();
  });
});
