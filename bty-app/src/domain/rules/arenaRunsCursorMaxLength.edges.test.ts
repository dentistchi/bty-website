import { describe, it, expect } from "vitest";
import {
  ARENA_RUNS_CURSOR_MAX_LENGTH,
  isArenaRunsCursorOverMax,
} from "./arenaRunsCursorMaxLength";

describe("arenaRunsCursorMaxLength (edges)", () => {
  it("max length is 512", () => {
    expect(ARENA_RUNS_CURSOR_MAX_LENGTH).toBe(512);
  });

  it("isArenaRunsCursorOverMax false at or below max", () => {
    expect(isArenaRunsCursorOverMax("")).toBe(false);
    expect(isArenaRunsCursorOverMax("a".repeat(512))).toBe(false);
  });

  it("isArenaRunsCursorOverMax true over max", () => {
    expect(isArenaRunsCursorOverMax("a".repeat(513))).toBe(true);
  });
});
