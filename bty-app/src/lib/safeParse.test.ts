import { describe, it, expect } from "vitest";
import { safeParse } from "./safeParse";

describe("safeParse", () => {
  it("returns null for null input", () => {
    expect(safeParse(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(safeParse(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeParse("")).toBeNull();
  });

  it("parses valid JSON object", () => {
    expect(safeParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses valid JSON array", () => {
    expect(safeParse<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("returns null for invalid JSON", () => {
    expect(safeParse("{ invalid }")).toBeNull();
    expect(safeParse("not json")).toBeNull();
  });
});
