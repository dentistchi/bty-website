import { describe, it, expect } from "vitest";
import {
  EXAMPLE_BANK,
  getExamplesByFlagType,
  normalizeToFlagType,
} from "./mentor-example-bank.service";

describe("mentor-example-bank.service", () => {
  it("EXAMPLE_BANK has 5 examples per flag type", () => {
    for (const ft of ["HERO_TRAP", "INTEGRITY_SLIP", "CLEAN", "ROLE_MIRROR"] as const) {
      expect(EXAMPLE_BANK[ft].length).toBe(5);
    }
  });

  it("getExamplesByFlagType localizes both locales", () => {
    const ko = getExamplesByFlagType("CLEAN", "ko");
    const en = getExamplesByFlagType("CLEAN", "en");
    expect(ko.length).toBe(5);
    expect(en.length).toBe(5);
    expect(ko[0]!.situation).not.toBe(en[0]!.situation);
  });

  it("normalizeToFlagType maps substrings", () => {
    expect(normalizeToFlagType("INTEGRITY_SLIP")).toBe("INTEGRITY_SLIP");
    expect(normalizeToFlagType("x HERO_TRAP y")).toBe("HERO_TRAP");
    expect(normalizeToFlagType("unknown")).toBeNull();
  });
});
