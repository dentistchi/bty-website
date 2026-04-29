/**
 * Edge-case tests for milestone — getPendingMilestone boundary only.
 * milestone.test.ts와 중복 없이 경계만.
 */
import { describe, it, expect } from "vitest";
import { getPendingMilestone } from "./milestone";

describe("milestone (edges)", () => {
  it("getPendingMilestone(24, 24) returns null (no new milestone)", () => {
    expect(getPendingMilestone(24, 24)).toBeNull();
  });
});
