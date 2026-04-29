import { describe, expect, it } from "vitest";
import { detectScenarioIdUuidIssues } from "./scenarioPoolHealth";

describe("detectScenarioIdUuidIssues", () => {
  it("flags nil UUID", () => {
    expect(detectScenarioIdUuidIssues("00000000-0000-0000-0000-000000000000")).toContain("nil_uuid");
  });

  it("flags UUID v1 pattern", () => {
    expect(detectScenarioIdUuidIssues("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toContain("uuid_v1_time_embedded");
  });

  it("ignores non-UUID scenario ids", () => {
    expect(detectScenarioIdUuidIssues("doctor_chronic_v2")).toEqual([]);
  });

  it("ignores mirror: synthetic ids (§3.1.1 — deterministic mirror UUID is allowed)", () => {
    expect(detectScenarioIdUuidIssues("mirror:6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toEqual([]);
  });
});
