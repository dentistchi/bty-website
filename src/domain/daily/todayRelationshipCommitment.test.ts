import { describe, it, expect } from "vitest";
import {
  RELATIONSHIP_VALUES,
  focusFromRelationship,
  isRelationshipValue,
  relationshipFromFocus,
  type RelationshipFocus,
  type RelationshipValue,
} from "@/domain/daily/todayRelationshipCommitment";

describe("todayRelationshipCommitment domain", () => {
  it("canonical values are exactly self/others/world", () => {
    expect(RELATIONSHIP_VALUES).toEqual(["self", "others", "world"]);
  });

  it("isRelationshipValue accepts only the three canonical strings", () => {
    for (const v of ["self", "others", "world"]) expect(isRelationshipValue(v)).toBe(true);
    for (const bad of ["Self", "SELF", "", "friend", "ground", null, undefined, 3, {}]) {
      expect(isRelationshipValue(bad)).toBe(false);
    }
  });

  it("focus ↔ value round-trips for all three doors", () => {
    const focuses: RelationshipFocus[] = ["Self", "Others", "World"];
    for (const f of focuses) {
      const v = relationshipFromFocus(f);
      expect(isRelationshipValue(v)).toBe(true);
      expect(focusFromRelationship(v)).toBe(f);
    }
    const values: RelationshipValue[] = ["self", "others", "world"];
    for (const v of values) expect(relationshipFromFocus(focusFromRelationship(v))).toBe(v);
  });

  it("maps exact pairs", () => {
    expect(relationshipFromFocus("Self")).toBe("self");
    expect(relationshipFromFocus("Others")).toBe("others");
    expect(relationshipFromFocus("World")).toBe("world");
    expect(focusFromRelationship("self")).toBe("Self");
    expect(focusFromRelationship("others")).toBe("Others");
    expect(focusFromRelationship("world")).toBe("World");
  });
});
