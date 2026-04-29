import { describe, it, expect } from "vitest";
import { isValidArenaAvatarUserIdKey } from "./arenaAvatarUserIdParam";

describe("isValidArenaAvatarUserIdKey (edges)", () => {
  it("accepts canonical lowercase UUID", () => {
    expect(
      isValidArenaAvatarUserIdKey("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(
      isValidArenaAvatarUserIdKey("550E8400-E29B-41D4-A716-446655440000"),
    ).toBe(true);
  });

  it("trims whitespace", () => {
    expect(
      isValidArenaAvatarUserIdKey("  550e8400-e29b-41d4-a716-446655440000  "),
    ).toBe(true);
  });

  it("rejects null, empty, non-UUID", () => {
    expect(isValidArenaAvatarUserIdKey(null)).toBe(false);
    expect(isValidArenaAvatarUserIdKey(undefined)).toBe(false);
    expect(isValidArenaAvatarUserIdKey("")).toBe(false);
    expect(isValidArenaAvatarUserIdKey("not-a-uuid")).toBe(false);
    expect(isValidArenaAvatarUserIdKey("550e8400-e29b-41d4-a716")).toBe(false);
  });
});
